package com.brokeriq.connect

import android.app.Application
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.room.*
import androidx.work.*
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.OkHttpClient
import org.json.JSONArray
import org.json.JSONObject

data class Lead(val id: String, val name: String, val phone: String, val alternate: String?)
fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 0xff) }
fun mobile(value: String?): String? {
    val digits = value.orEmpty().filter(Char::isDigit)
    val national = when {
        digits.length == 12 && digits.startsWith("91") -> digits.drop(2)
        digits.length == 11 && digits.startsWith("0") -> digits.drop(1)
        else -> digits
    }
    return if (national.matches(Regex("[6-9]\\d{9}"))) "+91$national" else null
}
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull(::optJSONObject)
fun JSONObject.optional(name: String): String? = if (isNull(name)) null else optString(name).takeIf(String::isNotBlank)
fun JSONObject.flag(name: String) = optBoolean("consent") && optBoolean(name)

class Vault(context: Context) {
    private val prefs = context.getSharedPreferences("connect", Context.MODE_PRIVATE)
    private val alias = "BrokerIQConnectData"
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    @Synchronized private fun key(): SecretKey {
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }
    fun seal(value: ByteArray): ByteArray = Cipher.getInstance("AES/GCM/NoPadding").run {
        init(Cipher.ENCRYPT_MODE, key())
        iv + doFinal(value)
    }
    fun unseal(value: ByteArray): ByteArray = Cipher.getInstance("AES/GCM/NoPadding").run {
        require(value.size > 12)
        init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, value.copyOfRange(0, 12)))
        doFinal(value.copyOfRange(12, value.size))
    }
    fun read(name: String): String? = prefs.getString(name, null)?.let {
        runCatching { String(unseal(Base64.decode(it, Base64.NO_WRAP))) }.getOrNull()
    }
    fun write(name: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(name) else putString(name, Base64.encodeToString(seal(value.toByteArray()), Base64.NO_WRAP)) }.apply()
    }
    fun json(name: String): JSONObject = read(name)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
    fun directory(): List<Lead> = read("directory")?.let { JSONArray(it).objects().map { row ->
        Lead(row.getString("id"), row.getString("name"), row.getString("phone"), row.optional("alternatePhone"))
    } } ?: emptyList()
    fun installId(): String = read("installId") ?: UUID.randomUUID().toString().also { write("installId", it) }
}

@Entity(tableName = "outbox")
data class OutboxEvent(@PrimaryKey val id: String, val account: String, val kind: String, val at: Long, val encrypted: ByteArray, val audio: Boolean, val state: String = "PENDING")

@Dao interface Outbox {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun add(row: OutboxEvent): Long
    @Query("SELECT * FROM outbox WHERE account = :account ORDER BY at DESC LIMIT 100") fun watch(account: String): Flow<List<OutboxEvent>>
    @Query("SELECT * FROM outbox WHERE account = :account AND state = 'PENDING' ORDER BY at LIMIT 30") suspend fun pending(account: String): List<OutboxEvent>
    @Query("UPDATE outbox SET state = 'FAILED' WHERE id = :id") suspend fun fail(id: String)
    @Query("UPDATE outbox SET state = 'PENDING' WHERE account = :account AND state = 'FAILED'") suspend fun retry(account: String)
    @Query("DELETE FROM outbox WHERE id = :id") suspend fun remove(id: String)
    @Query("DELETE FROM outbox WHERE account = :account") suspend fun clear(account: String)
}

@Database(entities = [OutboxEvent::class], version = 1, exportSchema = false)
abstract class ConnectDatabase : RoomDatabase() { abstract fun outbox(): Outbox }

class ConnectHttpError(val status: Int, val code: String, val details: JSONObject, detail: String) : Exception(detail)
class ConnectApi(private val vault: Vault) {
    private val transport = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).build()
    private val refreshLock = Mutex()
    private val json = "application/json".toMediaType()
    private suspend fun request(method: String, path: String, body: JSONObject?, token: String?): JSONObject = withContext(Dispatchers.IO) {
        val call = Request.Builder().url(BuildConfig.BROKERIQ_API + path).apply {
            if (token != null) header("Authorization", "Bearer $token")
            method(method, if (method == "POST" || method == "PATCH") (body ?: JSONObject()).toString().toRequestBody(json) else null)
        }.build()
        transport.newCall(call).execute().use { response ->
            val content = response.body?.string().orEmpty()
            val value = if (content.isBlank()) JSONObject() else runCatching { JSONObject(content) }.getOrDefault(JSONObject())
            if (!response.isSuccessful) throw ConnectHttpError(response.code, value.optString("code"),
                value.optJSONObject("details") ?: JSONObject(), value.optional("message") ?: "Request failed (" + response.code + ")")
            value
        }
    }

    suspend fun call(path: String, method: String = "GET", body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        val session = if (authenticated) vault.json("session") else JSONObject()
        val token = session.optional("accessToken")
        try { return request(method, path, body, token) } catch (error: ConnectHttpError) {
            if (!authenticated || error.status != 401 || token == null) throw error
        }
        val refreshed = refreshLock.withLock {
            val current = vault.json("session")
            val owner = session.optJSONObject("user")?.optional("id")
            if (owner == null || current.optJSONObject("user")?.optional("id") != owner) {
                throw ConnectHttpError(401, "SIGNED_OUT", JSONObject(), "Sign in again")
            }
            val newToken = current.optional("accessToken") ?: throw ConnectHttpError(401, "SIGNED_OUT", JSONObject(), "Sign in again")
            if (newToken != token) return@withLock newToken
            val refresh = request("POST", "auth/refresh", JSONObject().put("refreshToken", current.getString("refreshToken")), null)
            if (vault.json("session").optJSONObject("user")?.optional("id") != owner) {
                throw ConnectHttpError(401, "SIGNED_OUT", JSONObject(), "Sign in again")
            }
            vault.write("session", refresh.toString())
            refresh.getString("accessToken")
        }
        return request(method, path, body, refreshed)
    }
}

class ConnectApplication : Application() {
    lateinit var vault: Vault
        private set
    lateinit var api: ConnectApi
        private set
    lateinit var outbox: Outbox
        private set
    val syncGate = Mutex()
    override fun onCreate() {
        super.onCreate()
        vault = Vault(this)
        api = ConnectApi(vault)
        outbox = Room.databaseBuilder(this, ConnectDatabase::class.java, "connect.db").build().outbox()
    }
    fun account() = vault.json("session").optJSONObject("user")?.optional("id")
    fun audio(id: String) = File(filesDir, "recording-$id")
    private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    fun schedule(background: Boolean = vault.json("settings").flag("backgroundSync")) {
        val manager = WorkManager.getInstance(this)
        if (!background) { manager.cancelUniqueWork("connect-periodic"); return }
        manager.enqueueUniquePeriodicWork("connect-periodic", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<ConnectWorker>(15, TimeUnit.MINUTES).setConstraints(network).build())
        syncNow()
    }
    fun syncNow() {
        WorkManager.getInstance(this).enqueueUniqueWork("connect-send", ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<ConnectWorker>().setConstraints(network).build())
    }
    suspend fun enqueue(kind: String, body: JSONObject, id: String, recorded: ByteArray? = null) {
        val account = account() ?: return
        withContext(Dispatchers.IO) {
            if (recorded != null && !audio(id).exists()) audio(id).writeBytes(vault.seal(recorded))
            outbox.add(OutboxEvent(id, account, kind, System.currentTimeMillis(), vault.seal(body.toString().toByteArray()), recorded != null))
        }
        if (vault.json("settings").flag("backgroundSync")) syncNow()
    }
}

class ConnectWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as ConnectApplication
        val owner = app.account() ?: return Result.success()
        return app.syncGate.withLock {
            withContext(Dispatchers.IO) {
                var retry = false
                for (row in app.outbox.pending(owner)) {
                    if (app.account() != owner) break
                    try {
                        val body = JSONObject(String(app.vault.unseal(row.encrypted)))
                        val path = if (row.audio) {
                            val wifi = app.vault.json("local").optBoolean("wifiAudio")
                            val network = applicationContext.getSystemService(android.net.ConnectivityManager::class.java)
                            if (wifi && network?.isActiveNetworkMetered == true) { retry = true; continue }
                            val bytes = app.vault.unseal(app.audio(row.id).readBytes())
                            body.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                            "connect/recordings"
                        } else "connect/events"
                        app.api.call(path, "POST", body)
                        if (row.audio) app.audio(row.id).delete()
                        app.outbox.remove(row.id)
                        app.vault.write("lastSync", Instant.now().toString())
                    } catch (error: ConnectHttpError) {
                        if (error.status in 400..499 && error.status != 429) app.outbox.fail(row.id) else retry = true
                    } catch (_: Exception) { retry = true }
                }
                if (retry) Result.retry() else Result.success()
            }
        }
    }
}
