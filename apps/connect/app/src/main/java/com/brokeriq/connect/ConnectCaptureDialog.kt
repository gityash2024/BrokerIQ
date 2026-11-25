package com.brokeriq.connect

import android.media.MediaDataSource
import android.media.MediaPlayer
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable
fun ConnectCaptureDialog(
    event: JSONObject,
    audio: ByteArray?,
    busy: Boolean,
    feedback: String,
    onClose: () -> Unit,
    onLoad: () -> Unit,
    onOpenCapture: (String) -> Unit,
) {
    val details = event.optJSONObject("details")
    val call = details?.optJSONObject("call")
    val message = event.optJSONObject("capturedMessage")
    val proposal = details?.optJSONObject("proposal")
    val transcript = details?.optJSONObject("transcript")
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(event.optString("kind").replace('_', ' ') + " · " + event.optString("status")) },
        confirmButton = { TextButton(enabled = !busy, onClick = onClose) { Text("Close") } },
        text = {
            Column(Modifier.heightIn(max = 500.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(listOfNotNull(event.optional("capturedBy"), event.optional("deviceLabel")).joinToString(" · "))
                call?.let {
                    Text("Call details", style = MaterialTheme.typography.titleSmall)
                    Text(listOfNotNull(it.optional("direction"), it.optional("outcome"), it.optional("number"),
                        it.optional("simLabel"), it.optional("durationSec")?.let { duration -> "$duration seconds" }).joinToString(" · "))
                }
                message?.let {
                    Text("Captured " + it.optString("app") + " preview", style = MaterialTheme.typography.titleSmall)
                    it.optional("senderPhone")?.let { sender -> Text(sender) }
                    Text(it.optString("text"))
                }
                Text("Stored in", style = MaterialTheme.typography.titleSmall)
                Text("Private BrokerIQ Connect activity")
                event.optJSONArray("destinations")?.objects()?.forEach {
                    Text(it.optString("module") + " · " + it.optString("label") + " · " + it.optString("recordId"))
                }
                if (event.optString("status") == "REVIEW") Text("AI suggestions await review.")
                proposal?.let {
                    Text("AI decision · " + it.optInt("confidence") + "% confidence", style = MaterialTheme.typography.titleSmall)
                    Text(it.optString("summary"))
                    it.optional("evidence")?.let { evidence -> Text(evidence) }
                }
                event.optional("lastError")?.let { Text(it) }
                if (feedback.isNotBlank()) Text(feedback)
                event.optJSONArray("recordings")?.objects()?.forEach {
                    OutlinedButton(enabled = !busy, onClick = { onOpenCapture(it.getString("id")) }) { Text("Open related recording") }
                }
                if (event.optBoolean("recording")) {
                    if (audio == null) OutlinedButton(enabled = !busy, onClick = onLoad) { Text("Load private recording") }
                    else ConnectAudioControls(audio)
                }
                transcript?.let {
                    Text("Full transcript · " + it.optString("language"), style = MaterialTheme.typography.titleSmall)
                    it.optJSONArray("segments")?.objects()?.forEach { segment ->
                        val start = segment.optDouble("start", 0.0).toInt().coerceAtLeast(0)
                        val clock = "%02d:%02d".format(start / 60, start % 60)
                        Text("$clock · " + segment.optString("text"))
                    }
                }
            }
        },
    )
}

@Composable
private fun ConnectAudioControls(audio: ByteArray) {
    val player = remember(audio) { MediaPlayer() }
    var ready by remember(audio) { mutableStateOf(false) }
    var playing by remember(audio) { mutableStateOf(false) }
    var failed by remember(audio) { mutableStateOf(false) }
    DisposableEffect(player) {
        try {
            player.setDataSource(object : MediaDataSource() {
                override fun getSize() = audio.size.toLong()
                override fun readAt(position: Long, buffer: ByteArray, offset: Int, size: Int): Int {
                    if (position < 0 || position >= audio.size) return -1
                    val start = position.toInt()
                    val count = minOf(size, audio.size - start)
                    audio.copyInto(buffer, offset, start, start + count)
                    return count
                }
                override fun close() = Unit
            })
            player.setOnPreparedListener { ready = true }
            player.setOnCompletionListener { playing = false }
            player.setOnErrorListener { _, _, _ -> failed = true; true }
            player.prepareAsync()
        } catch (_: Exception) {
            failed = true
        }
        onDispose { player.release() }
    }
    if (failed) Text("This recording could not be played.")
    else OutlinedButton(enabled = ready, onClick = {
        if (playing) player.pause() else player.start()
        playing = !playing
    }) { Text(if (!ready) "Preparing recording…" else if (playing) "Pause recording" else "Play recording") }
}
