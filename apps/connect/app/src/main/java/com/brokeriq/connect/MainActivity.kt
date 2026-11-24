package com.brokeriq.connect

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private val controls = listOf(
    "calls" to "Identify authorized lead SIM calls",
    "recordings" to "Import authorized recordings",
    "whatsapp" to "Process approved WhatsApp notifications",
    "analysis" to "Transcribe and analyze with free AI",
    "createLeads" to "Create eligible leads",
    "createInventory" to "Create eligible property drafts",
    "fillSurvey" to "Suggest Survey and CRM updates",
    "backgroundSync" to "Background synchronization",
)

class ConnectViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as ConnectApplication
    val account = MutableStateFlow(app.account())
    val settings = MutableStateFlow(app.vault.json("settings"))
    val directory = MutableStateFlow(app.vault.directory())
    val events = MutableStateFlow<List<JSONObject>>(emptyList())
    val pending = MutableStateFlow<List<OutboxEvent>>(emptyList())
    val conversations = MutableStateFlow(app.vault.json("conversations"))
    val approved = MutableStateFlow(app.vault.json("approvedAt"))
    val feedback = MutableStateFlow("")
    val busy = MutableStateFlow(false)
    val step = MutableStateFlow("")
    val audio = MutableStateFlow<Uri?>(null)
    val wifiAudio = MutableStateFlow(app.vault.json("local").optBoolean("wifiAudio"))
    val lastSync = MutableStateFlow(app.vault.read("lastSync"))
    val updateUrl = MutableStateFlow<String?>(null)
    private var observe: kotlinx.coroutines.Job? = null

    init { if (account.value != null) { observeQueue(); refresh() } }

    private fun run(action: suspend () -> Unit) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            try { feedback.value = ""; action() }
            catch (error: ConnectHttpError) { feedback.value = error.message.orEmpty() }
            catch (_: Exception) { feedback.value = "Connection or file unavailable. Try again." }
            finally { busy.value = false }
        }
    }
    fun login(email: String, password: String, code: String) = run {
        val submitted = if (step.value.isEmpty()) JSONObject().put("email", email.trim()).put("password", password)
            else JSONObject().put("challenge", step.value).put("code", code).put("factor", "EMAIL")
        try {
            val path = if (step.value.isEmpty()) "auth/login" else "auth/login/otp/verify"
            val session = app.api.call(path, "POST", submitted, authenticated = false)
            require(session.has("user") && session.has("accessToken") && session.has("refreshToken"))
            app.vault.write("session", session.toString())
            try {
                val device = app.api.call("connect/devices", "POST", JSONObject().put("installId", app.vault.installId())
                    .put("label", (Build.MANUFACTURER + " " + Build.MODEL).take(100)).put("version", BuildConfig.VERSION_CODE))
                app.vault.write("device", device.getString("id"))
                val choice = device.getJSONObject("settings")
                app.vault.write("settings", choice.toString())
                settings.value = choice
                account.value = app.account()
                step.value = ""
                observeQueue()
                readActivity()
            } catch (error: Exception) {
                runCatching { app.api.call("auth/logout", "POST", JSONObject().put("refreshToken", session.getString("refreshToken")), false) }
                app.vault.write("session", null)
                throw error
            }
        } catch (error: ConnectHttpError) {
            if (error.code != "LOGIN_OTP_REQUIRED") throw error
            step.value = error.details.getString("challenge")
            feedback.value = "Enter the six-digit code from your email."
        }
    }
    private fun observeQueue() {
        observe?.cancel()
        val owner = account.value ?: return
        observe = viewModelScope.launch {
            app.outbox.watch(owner).catch { }.collect { pending.value = it }
        }
    }
    private suspend fun readActivity() {
        val directoryData = JSONArray()
        if (settings.value.flag("calls")) {
            var after: String? = null
            do {
                val response = app.api.call("connect/directory" + (after?.let { "?after=" + Uri.encode(it) } ?: ""))
                response.getJSONArray("items").objects().forEach { directoryData.put(it) }
                after = response.optional("next")
            } while (after != null && directoryData.length() < 3000)
        }
        app.vault.write("directory", directoryData.toString())
        directory.value = app.vault.directory()
        events.value = app.api.call("connect/events").optJSONArray("items")?.objects() ?: emptyList()
        val profile = app.api.call("connect/profile")
        updateUrl.value = if (profile.optInt("latestVersion") > BuildConfig.VERSION_CODE) profile.optional("downloadUrl") else null
        conversations.value = app.vault.json("conversations")
        approved.value = app.vault.json("approvedAt")
        lastSync.value = app.vault.read("lastSync")
    }
    fun refresh() = run { readActivity() }
    fun showConversations() { conversations.value = app.vault.json("conversations") }
    fun toggle(key: String, value: Boolean) = run {
        val proposed = JSONObject(settings.value.toString()).put(key, value)
        val result = app.api.call("connect/settings", "PATCH", proposed)
        app.vault.write("settings", result.toString())
        settings.value = result
        if (!result.optBoolean("consent")) {
            app.vault.write("approvedAt", null)
            approved.value = JSONObject()
        }
        app.schedule()
        readActivity()
    }
    fun allow(id: String, allow: Boolean) = run {
        val choices = JSONObject(approved.value.toString())
        if (allow) choices.put(id, System.currentTimeMillis()) else choices.remove(id)
        val result = app.api.call("connect/settings", "PATCH",
            JSONObject(settings.value.toString()).put("groups", JSONArray(choices.keys().asSequence().toList())))
        app.vault.write("approvedAt", choices.toString())
        app.vault.write("settings", result.toString())
        approved.value = choices
        settings.value = result
    }
    fun wifi(value: Boolean) {
        app.vault.write("local", JSONObject().put("wifiAudio", value).toString())
        wifiAudio.value = value
    }
    fun sync() = run {
        account.value?.let { app.outbox.retry(it) }
        app.syncNow()
        readActivity()
        feedback.value = "Synchronization queued."
    }
    fun attach(callId: String, confirmed: Boolean) = run {
        check(confirmed && settings.value.flag("recordings"))
        val uri = audio.value ?: return@run
        require(uri.scheme == "content")
        val loaded = withContext(Dispatchers.IO) {
            val mime = when (app.contentResolver.getType(uri)) {
                "audio/mp4", "audio/m4a", "audio/x-m4a" -> "audio/mp4"
                "audio/mpeg", "audio/mp3" -> "audio/mpeg"
                "audio/aac", "audio/aacp" -> "audio/aac"
                "audio/wav", "audio/x-wav", "audio/vnd.wave" -> "audio/wav"
                else -> error("Unsupported recording format")
            }
            val bytes = app.contentResolver.openInputStream(uri)?.use { it.readNBytes(12 * 1024 * 1024 + 1) } ?: error("Recording could not be opened")
            require(bytes.isNotEmpty() && bytes.size <= 12 * 1024 * 1024)
            mime to bytes
        }
        val body = JSONObject().put("callId", callId).put("mime", loaded.first).put("capturedAt", Instant.now().toString())
        app.enqueue("Private recording", body, hash(callId + "|" + java.util.Arrays.hashCode(loaded.second) + "|" + loaded.second.size), loaded.second)
        audio.value = null
        feedback.value = "Recording saved to the encrypted outbox."
    }
    fun logout() = run {
        val id = app.vault.read("device")
        if (id != null) app.api.call("connect/devices/" + id, "DELETE")
        observe?.cancel()
        account.value?.let { app.outbox.clear(it) }
        withContext(Dispatchers.IO) { app.filesDir.listFiles()?.filter { it.name.startsWith("recording-") }?.forEach { it.delete() } }
        listOf("session", "device", "settings", "directory", "conversations", "approvedAt", "lastSync").forEach { app.vault.write(it, null) }
        app.schedule(false)
        account.value = null
        settings.value = JSONObject()
        directory.value = emptyList()
        events.value = emptyList()
        pending.value = emptyList()
        conversations.value = JSONObject()
        approved.value = JSONObject()
    }
}

class MainActivity : ComponentActivity() {
    private lateinit var model: ConnectViewModel
    private val openRecording = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.audio.value = uri
    }
    private val requestRole = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { model.refresh() }
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        model = ViewModelProvider(this)[ConnectViewModel::class.java]
        handleShare(intent)
        setContent { MaterialTheme { Surface(Modifier.fillMaxSize()) { ConnectScreen(model) } } }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShare(intent)
    }
    @Suppress("DEPRECATION")
    private fun handleShare(intent: Intent) {
        if (intent.action == Intent.ACTION_SEND) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            if (uri?.scheme == "content") model.audio.value = uri
        }
    }

    @Composable
    private fun ConnectScreen(model: ConnectViewModel) {
        val account by model.account.collectAsState()
        val settings by model.settings.collectAsState()
        val leads by model.directory.collectAsState()
        val events by model.events.collectAsState()
        val outbox by model.pending.collectAsState()
        val groups by model.conversations.collectAsState()
        val approved by model.approved.collectAsState()
        val feedback by model.feedback.collectAsState()
        val busy by model.busy.collectAsState()
        val challenge by model.step.collectAsState()
        val recording by model.audio.collectAsState()
        val wifi by model.wifiAudio.collectAsState()
        val lastSync by model.lastSync.collectAsState()
        val update by model.updateUrl.collectAsState()
        var tab by remember { mutableStateOf("Dashboard") }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var code by remember { mutableStateOf("") }
        var search by remember { mutableStateOf("") }
        var number by remember { mutableStateOf("") }
        var consentToRecording by remember(recording) { mutableStateOf(false) }
        Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("BrokerIQ Connect", style = MaterialTheme.typography.headlineMedium)
            Text("Connect. Capture. Automate.")
            if (feedback.isNotBlank()) Text(feedback)
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (account == null) {
                if (challenge.isEmpty()) {
                    OutlinedTextField(email, { email = it }, label = { Text("BrokerIQ email") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(password, { password = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true)
                } else OutlinedTextField(code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Email verification code") }, modifier = Modifier.fillMaxWidth())
                Button(enabled = !busy && if (challenge.isEmpty()) email.isNotBlank() && password.isNotBlank() else code.length == 6,
                    onClick = { model.login(email, password, code) }) { Text(if (challenge.isEmpty()) "Link my BrokerIQ account" else "Verify code") }
                return@Column
            }
            LaunchedEffect(account) { password = ""; code = "" }
            listOf(listOf("Dashboard", "Calls", "WhatsApp"), listOf("Activity", "Compatibility", "Settings")).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { label -> FilterChip(selected = tab == label, onClick = { tab = label }, label = { Text(label) }) }
                }
            }
            when (tab) {
                "Dashboard" -> {
                    Text(if (settings.optBoolean("consent")) "Connected" else "Connected · permissions required")
                    Text("Calls " + events.count { it.optString("kind") == "CALL" })
                    Text("Recordings " + events.count { it.optString("kind") == "RECORDING" })
                    Text("WhatsApp messages " + events.count { it.optString("kind") == "WHATSAPP" })
                    Text("Pending sync " + outbox.count { it.state == "PENDING" } + " · Failed " + outbox.count { it.state == "FAILED" })
                    Text("Last synchronization " + (lastSync ?: "Pending"))
                    Button(onClick = model::sync, enabled = !busy) { Text("Sync now") }
                    update?.let { url -> Button(onClick = { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }) { Text("Update available") } }
                }
                "Calls" -> {
                    OutlinedTextField(number, { number = it.take(25) }, label = { Text("SIM dial pad number") }, singleLine = true)
                    Button(enabled = mobile(number) != null, onClick = { dial(number) }) { Text("Open system dialer") }
                    OutlinedTextField(search, { search = it }, label = { Text("Search authorized leads") }, singleLine = true)
                    leads.filter { it.name.contains(search, true) || it.phone.contains(search) }.take(30).forEach { lead ->
                        TextButton(onClick = { dial(lead.phone) }) { Text(lead.name + " · " + lead.phone) }
                    }
                    Button(enabled = settings.flag("recordings"), onClick = { openRecording.launch(arrayOf("audio/*")) }) { Text("Choose recording") }
                    events.filter { it.optString("kind") == "CALL" }.take(25).forEach { row ->
                        Text("SIM call · " + row.optString("capturedAt") + " · " + row.optString("status"))
                    }
                }
                "WhatsApp" -> {
                    Text("Only new notifications from conversations you authorize are processed. Notification previews depend on WhatsApp and device settings.")
                    OutlinedButton(onClick = { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }) { Text("Open Android notification access") }
                    OutlinedButton(onClick = model::showConversations) { Text("Refresh detected conversations") }
                    if (!settings.flag("whatsapp")) Text("Enable WhatsApp processing in Settings first.")
                    else groups.keys().asSequence().toList().forEach { id ->
                        val item = groups.optJSONObject(id) ?: return@forEach
                        Toggle(item.optString("name") + " · " + if (item.optString("app").endsWith(".w4b")) "Business" else "Messenger",
                            approved.has(id), !busy) { value -> model.allow(id, value) }
                    }
                }
                "Activity" -> {
                    Button(onClick = model::sync, enabled = !busy) { Text("Retry and synchronize") }
                    outbox.forEach { Text(it.kind + " · " + it.state) }
                    events.forEach {
                        Text(it.optString("kind") + " · " + it.optString("status") + " · " + it.optString("capturedAt"))
                        it.optional("lastError")?.let { message -> Text(message, style = MaterialTheme.typography.bodySmall) }
                    }
                }
                "Compatibility" -> {
                    val roles = getSystemService(RoleManager::class.java)
                    val notifications = getSystemService(NotificationManager::class.java)
                    Text("Call identification role " + if (roles?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true) "active" else "requires Android approval")
                    Text("Notification access " + if (notifications?.isNotificationListenerAccessGranted(ComponentName(this@MainActivity, BusinessNotifications::class.java)) == true) "granted" else "not granted")
                    Text("The system dialer keeps SIM selection and recording. Authorized recordings can be shared to Connect or chosen using the file picker.")
                    OutlinedButton(onClick = {
                        if (roles?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true) requestRole.launch(roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
                    }) { Text("Enable lead caller ID") }
                    if (Build.VERSION.SDK_INT >= 33) OutlinedButton(onClick = { askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS) }) { Text("Allow caller ID notifications") }
                    Text("Call details, native recordings and background delivery vary by handset. Enabling battery restrictions may delay synchronization.")
                }
                "Settings" -> {
                    Text("Authorize only business communications you have permission to process. Keep recordings private and obtain appropriate consent.")
                    Toggle("I authorize business capture", settings.optBoolean("consent"), !busy) { model.toggle("consent", it) }
                    controls.forEach { (key, label) -> Toggle(label, settings.optBoolean(key), !busy && settings.optBoolean("consent")) { model.toggle(key, it) } }
                    Toggle("Wi-Fi only for audio uploads", wifi, true, model::wifi)
                    Text("Version " + BuildConfig.VERSION_NAME)
                    OutlinedButton(enabled = !busy, onClick = model::logout) { Text("Revoke this device and sign out") }
                }
            }
            if (recording != null && settings.flag("recordings")) {
                Text("Associate shared recording with a synchronized call")
                Toggle("I have permission to upload this recording", consentToRecording, !busy) { consentToRecording = it }
                events.filter { it.optString("kind") == "CALL" && it.optional("callId") != null }.take(20).forEach { row ->
                    OutlinedButton(enabled = consentToRecording && !busy, onClick = { model.attach(row.getString("callId"), consentToRecording) }) {
                        Text("Attach to " + row.optString("capturedAt"))
                    }
                }
                OutlinedButton(onClick = { model.audio.value = null }) { Text("Cancel recording") }
            }
        }
    }

    private fun dial(value: String) {
        val phone = mobile(value) ?: return
        runCatching { startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null))) }
    }

    @Composable
    private fun Toggle(label: String, value: Boolean, enabled: Boolean, change: (Boolean) -> Unit) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, modifier = Modifier.weight(1f))
            Switch(checked = value, enabled = enabled, onCheckedChange = change)
        }
    }
}
