package com.brokeriq.connect

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import java.io.ByteArrayOutputStream
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class RecordingDocument(val uri: Uri, val name: String, val modifiedAt: Long, val mime: String)
private const val READ_GRANT = Intent.FLAG_GRANT_READ_URI_PERMISSION
private const val MAX_AUDIO = 12 * 1024 * 1024
private val phoneInFilename = Regex("(?<!\\d)(?:\\+?91[- ]?|0)?[6-9](?:[- ]?\\d){9}(?!\\d)")

class RecordingFolder(private val app: ConnectApplication) {
    private val resolver get() = app.contentResolver

    fun selected(): Uri? = app.vault.read("recordingFolder")?.let(Uri::parse)?.takeIf { uri ->
        resolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission }
    }

    fun choose(uri: Uri) {
        require(uri.scheme == "content" && DocumentsContract.isTreeUri(uri))
        resolver.takePersistableUriPermission(uri, READ_GRANT)
        selected()?.takeIf { it != uri }?.let { release(it) }
        app.vault.write("recordingFolder", uri.toString())
        app.vault.write("recordingFolderFrom", Instant.now().toString())
        app.vault.write("recordingFolderAuto", null)
        app.vault.write("recordingFolderSynced", null)
    }

    private fun release(uri: Uri) {
        runCatching { resolver.releasePersistableUriPermission(uri, READ_GRANT) }
    }

    fun remove() {
        selected()?.let(::release)
        listOf("recordingFolder", "recordingFolderFrom", "recordingFolderAuto", "recordingFolderSynced").forEach { app.vault.write(it, null) }
    }

    fun auto(enabled: Boolean) {
        if (enabled) require(selected() != null)
        app.vault.write("recordingFolderAuto", enabled.takeIf { it }?.let { Instant.now().toString() })
    }

    fun autoEnabled(): Boolean = selected() != null && app.vault.read("recordingFolderAuto") != null

    suspend fun files(): List<RecordingDocument> = withContext(Dispatchers.IO) {
        val folder = selected() ?: return@withContext emptyList()
        val parent = DocumentsContract.getTreeDocumentId(folder)
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(folder, parent)
        val columns = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_LAST_MODIFIED)
        resolver.query(children, columns, null, null, null)?.use { cursor ->
            val documents = mutableListOf<RecordingDocument>()
            while (cursor.moveToNext()) {
                val name = cursor.getString(1).orEmpty()
                val mime = audioMime(cursor.getString(2), name, true) ?: continue
                val path = DocumentsContract.buildDocumentUriUsingTree(folder, cursor.getString(0))
                documents += RecordingDocument(path, name, cursor.getLong(3), mime)
            }
            documents.sortedByDescending { it.modifiedAt }.take(100)
        } ?: emptyList()
    }

    suspend fun queueUnambiguous(account: String, calls: List<JSONObject>): Int = withContext(Dispatchers.IO) {
        val automatedFrom = app.vault.read("recordingFolderAuto") ?: return@withContext 0
        val started = Instant.parse(automatedFrom).toEpochMilli()
        val uploaded = app.vault.json("recordingFolderSynced")
        var queued = 0
        val seen = files()
        for (document in seen) {
            if (app.account() != account || !app.vault.json("settings").flag("recordings") || app.vault.read("recordingFolderAuto") != automatedFrom) break
            val number = phoneInFilename.findAll(document.name.substringBeforeLast('.')).mapNotNull { mobile(it.value) }.distinct().toList().singleOrNull()
                ?: continue
            if (document.modifiedAt < started || System.currentTimeMillis() - document.modifiedAt < 60_000) continue
            val match = calls.filter { call ->
                val at = runCatching { Instant.parse(call.optString("startedAt")).toEpochMilli() }.getOrDefault(0L)
                call.optBoolean("sameDevice") && number == mobile(call.optional("number")) && at >= started &&
                    document.modifiedAt - at in 0..(45 * 60_000)
            }.singleOrNull() ?: continue
            val key = hash("${document.uri}|${document.modifiedAt}")
            if (uploaded.has(key)) continue
            val callId = match.getString("id")
            val loaded = try { loadRecording(document.uri, document.mime) } catch (_: java.io.IOException) { continue }
                catch (_: SecurityException) { continue } catch (_: IllegalArgumentException) { continue }
            if (app.account() != account || app.vault.read("recordingFolderAuto") != automatedFrom) break
            upload(callId, loaded, account)
            uploaded.put(key, document.modifiedAt)
            if (++queued >= 5) break
        }
        if (queued > 0 && app.account() == account && app.vault.read("recordingFolderAuto") == automatedFrom) {
            val latest = uploaded.keys().asSequence().sortedByDescending { uploaded.optLong(it) }.take(200)
            app.vault.write("recordingFolderSynced", JSONObject().apply {
                latest.forEach { put(it, uploaded.optLong(it)) }
            }.toString())
        }
        queued
    }

    suspend fun upload(callId: String, loaded: Pair<String, ByteArray>, account: String) {
        val (mime, bytes) = loaded
        val body = JSONObject().put("callId", callId).put("mime", mime).put("capturedAt", Instant.now().toString())
        app.enqueue("Private recording", body, hash(callId + "|" + hash(bytes)), bytes, account)
    }

    suspend fun loadRecording(uri: Uri, selectedMime: String? = null): Pair<String, ByteArray> = withContext(Dispatchers.IO) {
        require(uri.scheme == "content")
        val mime = selectedMime ?: audioMime(resolver.getType(uri), "", false) ?: throw IllegalArgumentException("Unsupported recording format")
        val bytes = resolver.openInputStream(uri)?.use { stream ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                require(output.size() + count <= MAX_AUDIO) { "Recording exceeds the 12 MB upload limit" }
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        } ?: throw java.io.IOException("Recording could not be opened")
        require(bytes.isNotEmpty())
        mime to bytes
    }

    private fun audioMime(mime: String?, filename: String, allowExtension: Boolean): String? = when (mime) {
        "audio/mp4", "audio/m4a", "audio/x-m4a" -> "audio/mp4"
        "audio/mpeg", "audio/mp3" -> "audio/mpeg"
        "audio/aac", "audio/aacp" -> "audio/aac"
        "audio/wav", "audio/x-wav", "audio/vnd.wave" -> "audio/wav"
        "application/octet-stream", null -> if (allowExtension) when (filename.substringAfterLast('.').lowercase()) {
            "m4a" -> "audio/mp4"
            "mp3" -> "audio/mpeg"
            "aac" -> "audio/aac"
            "wav" -> "audio/wav"
            else -> null
        } else null
        else -> null
    }
}
