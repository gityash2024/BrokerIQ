package com.brokeriq.connect

import android.Manifest
import android.app.Application
import android.content.ActivityNotFoundException
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CallLog
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.security.MessageDigest
import java.security.SecureRandom
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private val expandedCapture = listOf("unmatchedCalls", "allWhatsapp", "smsNotifications")
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
    val setupCompleted = MutableStateFlow(app.setupCompleted())
    val settings = MutableStateFlow(app.vault.json("settings"))
    val directory = MutableStateFlow(app.vault.directory())
    val events = MutableStateFlow<List<JSONObject>>(emptyList())
    val pending = MutableStateFlow<List<OutboxEvent>>(emptyList())
    val conversations = MutableStateFlow(app.vault.json("conversations"))
    val approved = MutableStateFlow(app.vault.json("approvedAt"))
    val feedback = MutableStateFlow("")
    val busy = MutableStateFlow(false)
    val step = MutableStateFlow("")
    val mainLink = MutableStateFlow(app.vault.json("mainLink").takeIf(::linkStillValid))
    val sessionLimit = MutableStateFlow<JSONObject?>(null)
    val otpDestination = MutableStateFlow("")
    val otpResendAt = MutableStateFlow(0L)
    val audio = MutableStateFlow<Uri?>(null)
    val recentCalls = MutableStateFlow<List<JSONObject>>(emptyList())
    val callReviews = MutableStateFlow(emptyList<Pair<String, JSONObject>>())
    val folderGranted = MutableStateFlow(app.recordingFolder.selected() != null)
    val automaticRecordings = MutableStateFlow(app.recordingFolder.autoEnabled())
    val folderDocuments = MutableStateFlow<List<RecordingDocument>>(emptyList())
    var folderAudio by mutableStateOf<RecordingDocument?>(null)
        private set
    val wifiAudio = MutableStateFlow(app.vault.json("local").optBoolean("wifiAudio"))
    val lastSync = MutableStateFlow(app.vault.read("lastSync"))
    val updateUrl = MutableStateFlow<String?>(null)
    private var observe: kotlinx.coroutines.Job? = null

    init { if (account.value != null) { observeQueue(); if (app.captureReady()) refresh() } }

    private fun run(action: suspend () -> Unit) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            try { feedback.value = ""; action() }
            catch (error: ConnectHttpError) { feedback.value = error.message.orEmpty() }
            catch (error: IllegalArgumentException) { feedback.value = error.message ?: "Unsupported or unreadable file." }
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
            acceptSession(session)
        } catch (error: ConnectHttpError) {
            when (error.code) {
                "LOGIN_OTP_REQUIRED" -> setChallenge(error.details)
                "SESSION_LIMIT_REACHED" -> {
                    step.value = ""
                    sessionLimit.value = error.details
                }
                else -> throw error
            }
        }
    }

    fun startMainLink() = run {
        val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = Base64.encodeToString(secret, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        val hash = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()).joinToString("") { "%02x".format(it) }
        val result = app.api.call("auth/connect-link/start", "POST", JSONObject().put("verifierHash", hash), authenticated = false)
        result.put("verifier", verifier)
        require(linkStillValid(result) && result.optional("id") != null && result.optional("code") != null) { "Could not start the device link." }
        app.vault.write("mainLink", result.toString())
        mainLink.value = result
    }

    fun finishMainLink() = run {
        val request = mainLink.value ?: return@run
        if (!linkStillValid(request)) {
            clearMainLink()
            throw IllegalArgumentException("This link expired. Start a new request.")
        }
        try {
            val result = app.api.call("auth/connect-link/exchange", "POST",
                JSONObject().put("id", request.getString("id")).put("verifier", request.getString("verifier")), authenticated = false)
            if (result.optBoolean("pending")) {
                feedback.value = "Approve the request in the BrokerIQ app first."
                return@run
            }
            acceptSession(result)
        } catch (error: ConnectHttpError) {
            if (error.status == 401 || error.status == 403) clearMainLink()
            throw error
        }
    }

    fun cancelMainLink() {
        if (busy.value) return
        clearMainLink()
        feedback.value = ""
    }

    private fun clearMainLink() {
        mainLink.value = null
        app.vault.write("mainLink", null)
    }

    private fun linkStillValid(request: JSONObject): Boolean =
        request.optional("expiresAt")?.let { runCatching { Instant.parse(it).isAfter(Instant.now()) }.getOrDefault(false) } ?: false

    private fun setChallenge(info: JSONObject) {
        step.value = info.optional("challenge") ?: throw IllegalArgumentException("Email verification could not start. Try signing in again.")
        otpDestination.value = info.optString("destination")
        otpResendAt.value = info.optional("resendAt")?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() } ?: 0L
    }

    fun resendCode() = run {
        val current = step.value
        if (current.isEmpty() || System.currentTimeMillis() < otpResendAt.value) return@run
        setChallenge(app.api.call("auth/login/otp/resend", "POST", JSONObject().put("challenge", current), authenticated = false))
        feedback.value = "A new verification code was sent."
    }

    fun replaceSession(sessionId: String) = run {
        val challenge = sessionLimit.value?.optional("challenge") ?: return@run
        try {
            acceptSession(app.api.call("auth/sessions/replace", "POST",
                JSONObject().put("challenge", challenge).put("sessionId", sessionId), authenticated = false))
        } catch (error: ConnectHttpError) {
            if (error.status == 401 || error.status == 409) sessionLimit.value = null
            throw error
        }
    }

    fun resetLogin() {
        if (busy.value) return
        step.value = ""
        sessionLimit.value = null
        otpDestination.value = ""
        otpResendAt.value = 0L
        feedback.value = ""
    }

    private suspend fun acceptSession(session: JSONObject) {
        val user = session.optJSONObject("user")
        require(user?.optional("id") != null && session.optional("accessToken") != null && session.optional("refreshToken") != null) {
            "BrokerIQ did not return a valid session. Try signing in again."
        }
        step.value = ""
        sessionLimit.value = null
        clearMainLink()
        app.vault.write("session", session.toString())
        val device = try {
            app.api.call("connect/devices", "POST", JSONObject().put("installId", app.vault.installId())
                .put("label", (Build.MANUFACTURER + " " + Build.MODEL).trim().take(100)).put("version", BuildConfig.VERSION_CODE))
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            runCatching { app.api.call("auth/logout", "POST", JSONObject().put("refreshToken", session.getString("refreshToken")), false) }
            app.vault.write("session", null)
            if (error is ConnectHttpError) {
                throw ConnectHttpError(error.status, error.code, error.details, "Sign-in succeeded. Device linking failed: " + error.message.orEmpty())
            }
            throw IllegalArgumentException("Sign-in succeeded. A connection problem prevented device linking. Try again.")
        }
        app.vault.write("device", device.getString("id"))
        settings.value = device.getJSONObject("settings")
        app.vault.write("settings", settings.value.toString())
        account.value = app.account()
        setupCompleted.value = app.setupCompleted()
        observeQueue()
        if (app.captureReady()) readActivity()
    }
    private fun observeQueue() {
        observe?.cancel()
        val owner = account.value ?: return
        observe = viewModelScope.launch {
            app.outbox.watch(owner).catch { }.collect { pending.value = it }
        }
    }
    fun showCallReviews() {
        val owner = account.value
        val saved = app.vault.json("ambiguousCalls")
        callReviews.value = if (owner != null && settings.value.flag("calls")) saved.keys().asSequence().mapNotNull { id ->
            saved.optJSONObject(id)?.takeIf { it.optional("owner") == owner }?.let { id to it }
        }.sortedByDescending { (_, item) -> item.optLong("detectedAt") }.take(25).toList() else emptyList()
    }
    fun resolveCall(id: String, leadId: String) = run {
        val owner = account.value ?: return@run
        check(settings.value.flag("calls"))
        val row = app.vault.json("ambiguousCalls").optJSONObject(id)?.takeIf { it.optional("owner") == owner } ?: return@run
        val event = row.getJSONObject("event")
        val approved = row.getJSONArray("candidateIds")
        val number = event.getString("number")
        require((0 until approved.length()).any { approved.optString(it) == leadId } &&
            app.vault.directory().any { it.id == leadId && (mobile(it.phone) == number || mobile(it.alternate) == number) }) {
            "This lead is no longer available for this number."
        }
        val at = row.getLong("detectedAt")
        val direction = event.getString("direction")
        app.enqueue("SIM call", event.put("leadId", leadId), hash("$direction|$at|$leadId"), owner = owner)
        app.vault.forgetAmbiguous(id)
        showCallReviews()
    }
    fun dismissCall(id: String) {
        app.vault.forgetAmbiguous(id)
        showCallReviews()
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
        showCallReviews()
        events.value = app.api.call("connect/events").optJSONArray("items")?.objects() ?: emptyList()
        recentCalls.value = if (settings.value.flag("calls") || settings.value.flag("recordings")) {
            try {
                app.api.call("connect/calls").optJSONArray("items")?.objects().orEmpty()
            } catch (error: ConnectHttpError) {
                if (error.status != 404) throw error
                emptyList()
            }
        } else emptyList()
        folderGranted.value = app.recordingFolder.selected() != null
        automaticRecordings.value = app.recordingFolder.autoEnabled()
        val profile = app.api.call("connect/profile")
        updateUrl.value = if (profile.optInt("latestVersion") > BuildConfig.VERSION_CODE) profile.optional("downloadUrl") else null
        conversations.value = app.vault.json("conversations")
        approved.value = app.vault.json("approvedAt")
        lastSync.value = app.vault.read("lastSync")
    }
    fun refresh() = run { if (app.captureReady()) readActivity() }
    fun activateCapture() = run {
        val owner = account.value ?: return@run
        require(app.missingSetupGrants().isEmpty()) { "Finish the Android permission steps first." }
        val proposed = JSONObject(settings.value.toString())
        for (flag in listOf("consent", "calls", "unmatchedCalls", "recordings", "whatsapp",
            "allWhatsapp", "smsNotifications", "analysis", "backgroundSync")) proposed.put(flag, true)
        saveCaptureSettings(proposed)
        app.vault.write("setupAccount", owner)
        setupCompleted.value = true
        app.schedule()
        readActivity()
    }
    fun reconcilePermissions() {
        if (app.captureReady()) { app.schedule(); refresh() }
        else app.schedule(false)
    }
    fun showConversations() { conversations.value = app.vault.json("conversations") }
    fun toggle(key: String, value: Boolean) = run {
        val proposed = JSONObject(settings.value.toString()).put(key, value)
        if (key == "calls" && !value) proposed.put("unmatchedCalls", false)
        if (key == "whatsapp" && !value) proposed.put("allWhatsapp", false)
        saveCaptureSettings(proposed)
        if (!settings.value.optBoolean("consent")) {
            app.vault.write("setupAccount", null)
            setupCompleted.value = false
        }
        app.schedule()
        if (app.captureReady()) readActivity()
    }
    private suspend fun saveCaptureSettings(proposed: JSONObject) {
        val result = app.api.call("connect/settings", "PATCH", proposed)
        val approvals = app.vault.json("channelApprovals")
        for (category in expandedCapture) {
            val parentEnabled = when (category) {
                "unmatchedCalls" -> result.flag("calls")
                "allWhatsapp" -> result.flag("whatsapp")
                else -> result.optBoolean("consent")
            }
            if (parentEnabled && result.optBoolean(category)) {
                if (!approvals.has(category)) approvals.put(category, System.currentTimeMillis())
            } else approvals.remove(category)
        }
        app.vault.write("channelApprovals", approvals.toString())
        app.vault.write("settings", result.toString())
        settings.value = result
        if (!result.optBoolean("consent")) {
            app.vault.write("approvedAt", null)
            approved.value = JSONObject()
        }
        if (!result.flag("calls")) {
            app.vault.write("ambiguousCalls", null)
            callReviews.value = emptyList()
        }
        if (!result.flag("recordings")) {
            app.recordingFolder.remove()
            automaticRecordings.value = false
            folderGranted.value = false
            folderDocuments.value = emptyList()
        }
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
    fun chooseFolder(uri: Uri) = run {
        check(settings.value.flag("recordings"))
        app.recordingFolder.choose(uri)
        folderGranted.value = true
        automaticRecordings.value = false
        folderDocuments.value = app.recordingFolder.files()
    }
    fun removeFolder() = run {
        app.recordingFolder.remove()
        folderGranted.value = false
        automaticRecordings.value = false
        folderDocuments.value = emptyList()
        if (folderAudio != null) selectAudio(null)
    }
    fun scanFolder() = run {
        folderGranted.value = app.recordingFolder.selected() != null
        folderDocuments.value = app.recordingFolder.files()
        if (!folderGranted.value) feedback.value = "Recording folder access expired. Choose the folder again."
        else if (folderDocuments.value.isEmpty()) feedback.value = "No supported recordings in this directory."
    }
    fun autoRecordings(value: Boolean) = run {
        check(settings.value.flag("recordings"))
        app.recordingFolder.auto(value)
        automaticRecordings.value = value
        if (value) app.syncNow()
    }
    fun selectAudio(uri: Uri?, document: RecordingDocument? = null) {
        folderAudio = document
        audio.value = uri
    }
    fun attach(callId: String, confirmed: Boolean) = run {
        check(confirmed && settings.value.flag("recordings"))
        val owner = account.value ?: return@run
        val uri = audio.value ?: return@run
        val loaded = app.recordingFolder.loadRecording(uri, folderAudio?.mime)
        app.recordingFolder.upload(callId, loaded, owner)
        selectAudio(null)
        feedback.value = "Recording saved to the encrypted outbox."
    }
    fun logout() = run {
        val id = app.vault.read("device")
        if (id != null) app.api.call("connect/devices/" + id, "DELETE")
        observe?.cancel()
        app.recordingFolder.remove()
        account.value?.let { app.outbox.clear(it) }
        withContext(Dispatchers.IO) { app.filesDir.listFiles()?.filter { it.name.startsWith("recording-") }?.forEach { it.delete() } }
        listOf("session", "device", "settings", "directory", "conversations", "approvedAt", "channelApprovals", "lastSync", "ambiguousCalls", "setupAccount").forEach { app.vault.write(it, null) }
        app.schedule(false)
        account.value = null
        setupCompleted.value = false
        settings.value = JSONObject()
        directory.value = emptyList()
        events.value = emptyList()
        pending.value = emptyList()
        recentCalls.value = emptyList()
        callReviews.value = emptyList()
        folderDocuments.value = emptyList()
        automaticRecordings.value = false
        folderGranted.value = false
        selectAudio(null)
        conversations.value = JSONObject()
        approved.value = JSONObject()
    }
}

class MainActivity : ComponentActivity() {
    private lateinit var model: ConnectViewModel
    private val openRecording = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.selectAudio(uri)
    }
    private val openRecordingFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) model.chooseFolder(uri)
    }
    private var accessRevision by mutableIntStateOf(0)
    private val askCallLog = registerForActivityResult(ActivityResultContracts.RequestPermission()) { accessRevision++ }
    private val askContacts = registerForActivityResult(ActivityResultContracts.RequestPermission()) { accessRevision++ }
    private val requestRole = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { accessRevision++ }
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { accessRevision++ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        model = ViewModelProvider(this)[ConnectViewModel::class.java]
        handleShare(intent)
        setContent {
            ConnectTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ConnectScreen(model)
                }
            }
        }
    }
    override fun onResume() {
        super.onResume()
        accessRevision++
        model.reconcilePermissions()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShare(intent)
    }
    @Suppress("DEPRECATION")
    private fun handleShare(intent: Intent) {
        if (intent.action == Intent.ACTION_VIEW && intent.data?.scheme == "brokeriq-connect" && intent.data?.host == "resume")
            model.finishMainLink()
        if (intent.action == Intent.ACTION_SEND) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            if (uri?.scheme == "content") model.selectAudio(uri)
        }
    }

    private fun requestSetupGrant(grant: SetupGrant) {
        when (grant) {
            SetupGrant.PHONE -> getSystemService(RoleManager::class.java)?.let { roles ->
                requestRole.launch(roles.createRequestRoleIntent(RoleManager.ROLE_DIALER))
            }
            SetupGrant.CALLS -> askCallLog.launch(Manifest.permission.READ_CALL_LOG)
            SetupGrant.CONTACTS -> askContacts.launch(Manifest.permission.READ_CONTACTS)
            SetupGrant.ALERTS -> if (Build.VERSION.SDK_INT >= 33) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
            SetupGrant.FULL_SCREEN -> if (Build.VERSION.SDK_INT >= 34) {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
            }
            SetupGrant.MESSAGES -> startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    @Composable
    private fun ConnectScreen(model: ConnectViewModel) {
        val account by model.account.collectAsState()
        if (account == null) {
            ConnectSignIn(model, ::openBrokerIqForApproval)
            return
        }
        val settings by model.settings.collectAsState()
        val completed by model.setupCompleted.collectAsState()
        val grants = remember(accessRevision) { missingSetupGrants() }
        val feedback by model.feedback.collectAsState()
        val busy by model.busy.collectAsState()
        if (!completed || grants.isNotEmpty() || !settings.optBoolean("consent")) {
            var consentChecked by rememberSaveable(account) { mutableStateOf(false) }
            ConnectSetupScreen(grants, consentChecked, { consentChecked = it }, busy, feedback, ::requestSetupGrant,
                { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))) },
                model::activateCapture, model::logout)
            return
        }
        val leads by model.directory.collectAsState()
        val events by model.events.collectAsState()
        val outbox by model.pending.collectAsState()
        val groups by model.conversations.collectAsState()
        val approved by model.approved.collectAsState()
        val recording by model.audio.collectAsState()
        val calls by model.recentCalls.collectAsState()
        val callReviews by model.callReviews.collectAsState()
        val hasFolder by model.folderGranted.collectAsState()
        val automaticRecordings by model.automaticRecordings.collectAsState()
        val folderDocuments by model.folderDocuments.collectAsState()
        val wifi by model.wifiAudio.collectAsState()
        val lastSync by model.lastSync.collectAsState()
        val update by model.updateUrl.collectAsState()
        var tab by rememberSaveable(account) { mutableStateOf(ConnectTab.OVERVIEW) }
        var search by rememberSaveable(account) { mutableStateOf("") }
        var missedOnly by rememberSaveable(account) { mutableStateOf(false) }
        var advanced by rememberSaveable(account) { mutableStateOf(false) }
        var consentToRecording by remember(recording) { mutableStateOf(false) }
        val scroll = ConnectTab.entries.associateWith { rememberScrollState() }
        BackHandler(tab != ConnectTab.OVERVIEW) { tab = ConnectTab.OVERVIEW }
        Scaffold(
            bottomBar = { ConnectNavigation(tab) { tab = it } },
            contentWindowInsets = WindowInsets.systemBars,
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(scroll.getValue(tab)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ConnectWorkspaceHeader(tab.label, settings.optBoolean("consent"))
                SessionFeedback(feedback, busy)
                when (tab) {
                    ConnectTab.OVERVIEW -> {
                        ConnectCard("Connected") {
                            Text(if (settings.flag("backgroundSync")) "Business capture syncs automatically." else "Background sync is paused.")
                            Text("Last sync " + (lastSync?.let {
                                runCatching { DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT)
                                    .withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }.getOrDefault(it)
                            } ?: "pending"))
                            if (outbox.isNotEmpty()) {
                                Text("${outbox.count { it.state == "PENDING" }} pending · ${outbox.count { it.state == "FAILED" }} need retry")
                            }
                            Button(onClick = {
                                startActivity(Intent(Intent.ACTION_DIAL).setClass(this@MainActivity, ConnectPhoneActivity::class.java))
                            }, modifier = Modifier.fillMaxWidth()) { Text("Open keypad") }
                            OutlinedButton(onClick = { tab = ConnectTab.SYNC }, modifier = Modifier.fillMaxWidth()) { Text("View activity") }
                            update?.let { url -> TextButton(onClick = { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }) {
                                Text("Update available")
                            } }
                        }
                        if (settings.flag("recordings") && !hasFolder) ConnectCard("Sync call recordings") {
                            Text("Connect can match new recordings in a folder created by your phone. Availability depends on your device.")
                            OutlinedButton(onClick = { openRecordingFolder.launch(null) }, enabled = !busy) { Text("Choose recording folder") }
                        }
                    }
                    ConnectTab.CALLS -> {
                        val localCallLogAccess = remember(accessRevision) {
                            isConnectDialer() && checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
                        }
                        var handsetCalls by remember { mutableStateOf<List<HandsetCall>>(emptyList()) }
                        LaunchedEffect(localCallLogAccess, accessRevision) {
                            handsetCalls = if (localCallLogAccess) withContext(Dispatchers.IO) { loadHandsetCalls() } else emptyList()
                        }
                        Button(onClick = {
                            startActivity(Intent(Intent.ACTION_DIAL).setClass(this@MainActivity, ConnectPhoneActivity::class.java))
                        }) { Text("Open keypad") }
                        OutlinedTextField(search, { search = it.take(80) }, label = { Text("Search calls or leads") },
                            modifier = Modifier.fillMaxWidth(), singleLine = true)
                        if (search.isNotBlank()) leads.filter { it.name.contains(search, true) || it.phone.contains(search) }.take(15).forEach { lead ->
                            TextButton(onClick = { dial(lead.phone) }) { Text(lead.name + " · " + lead.phone) }
                        }
                        if (localCallLogAccess) {
                            ConnectCard("Recent phone calls") {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterChip(selected = !missedOnly, onClick = { missedOnly = false }, label = { Text("All") })
                                    FilterChip(selected = missedOnly, onClick = { missedOnly = true }, label = { Text("Missed") })
                                }
                                val matching = handsetCalls.filter { (!missedOnly || it.kind == "Missed") &&
                                    (search.isBlank() || it.name?.contains(search, true) == true || it.number?.contains(search) == true) }
                                if (matching.isEmpty()) Text("No matching recent calls.")
                                val formatter = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT).withZone(ZoneId.systemDefault())
                                matching.forEach { call ->
                                    Column(Modifier.fillMaxWidth()) {
                                        Text(call.name ?: call.number ?: "Unknown caller", style = MaterialTheme.typography.titleSmall)
                                        Text(listOf(call.kind, formatter.format(Instant.ofEpochMilli(call.time)), "${call.duration} s").joinToString(" · "),
                                            style = MaterialTheme.typography.bodySmall)
                                        if (!call.number.isNullOrBlank()) TextButton(onClick = { dial(call.number) }) { Text("Call back") }
                                    }
                                    HorizontalDivider()
                                }
                            }
                        }
                        if (settings.flag("recordings")) ConnectCard("Recordings") {
                            Button(onClick = { openRecording.launch(arrayOf("audio/*")) }) { Text("Choose recording") }
                            OutlinedButton(onClick = { openRecordingFolder.launch(null) }) { Text("Choose recording folder") }
                            if (hasFolder) {
                                Toggle("Auto-sync new recordings matched to one business call", automaticRecordings, !busy, model::autoRecordings)
                                OutlinedButton(onClick = model::scanFolder, enabled = !busy) { Text("Browse recording folder") }
                                OutlinedButton(onClick = model::removeFolder, enabled = !busy) { Text("Disconnect recording folder") }
                                folderDocuments.take(20).forEach { file ->
                                    TextButton(onClick = { model.selectAudio(file.uri, file) }) { Text(file.name) }
                                }
                            }
                        }
                        if (settings.flag("calls")) {
                            OutlinedButton(onClick = model::showCallReviews) { Text("Refresh call matches") }
                            callReviews.forEach { (id, item) ->
                                val info = item.optJSONObject("event")
                                val candidates = item.optJSONArray("candidateIds")
                                val candidateIds = (0 until (candidates?.length() ?: 0)).map { candidates?.optString(it) }.toSet()
                                Text("Choose a lead for " + info?.optString("capturedAt").orEmpty(), style = MaterialTheme.typography.titleSmall)
                                leads.filter { it.id in candidateIds }.forEach { lead ->
                                    OutlinedButton(enabled = !busy, onClick = { model.resolveCall(id, lead.id) }) { Text(lead.name) }
                                }
                                TextButton(onClick = { model.dismissCall(id) }) { Text("Dismiss unmatched call") }
                            }
                        }
                    }
                    ConnectTab.INBOX -> {
                        ConnectCard("Message capture") {
                            Text("Connect reads new message previews exposed by Android after you enable capture. It excludes verification codes and cannot read stored message history.")
                            Toggle("Capture new SMS app notifications", settings.flag("smsNotifications"), !busy && settings.optBoolean("consent")) {
                                model.toggle("smsNotifications", it)
                            }
                            Toggle("Capture all new WhatsApp notifications on this work phone", settings.flag("allWhatsapp"),
                                !busy && settings.flag("whatsapp")) { model.toggle("allWhatsapp", it) }
                        }
                        OutlinedButton(onClick = { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }) { Text("Open Android notification access") }
                        OutlinedButton(onClick = model::showConversations) { Text("Refresh detected conversations") }
                        if (!settings.flag("whatsapp")) Text("Enable WhatsApp processing in Setup first.")
                        else groups.keys().asSequence().toList().forEach { id ->
                            val item = groups.optJSONObject(id) ?: return@forEach
                            Toggle(item.optString("name") + " · " + if (item.optString("app").endsWith(".w4b")) "Business" else "Messenger",
                                approved.has(id), !busy) { value -> model.allow(id, value) }
                        }
                    }
                    ConnectTab.SYNC -> {
                        ConnectCard("Synchronization") {
                            if (outbox.isEmpty()) Text("No pending uploads.")
                            else outbox.forEach { Text(it.kind + " · " + it.state) }
                            OutlinedButton(onClick = model::sync, enabled = !busy) { Text("Sync now") }
                        }
                        if (calls.isNotEmpty()) ConnectCard("Matched calls") {
                            calls.take(25).forEach { row ->
                                Text(listOfNotNull(row.optional("leadName"), row.optional("direction")?.replaceFirstChar(Char::uppercase),
                                    row.optional("simLabel"), row.optional("status"), row.optional("processingStatus")).joinToString(" · "))
                            }
                        }
                        ConnectCard("Recent captures") {
                            if (events.isEmpty()) Text("New captures will appear here.")
                            events.forEach {
                                Text(it.optString("kind") + " · " + it.optString("status"))
                                it.optional("lastError")?.let { message -> Text(message, style = MaterialTheme.typography.bodySmall) }
                            }
                        }
                    }
                    ConnectTab.SETUP -> {
                        ConnectCard("This device") {
                            Text("Android permissions are ready.")
                            if (settings.flag("recordings") && !hasFolder) Text("Choose a recording folder to sync audio.")
                            TextButton(onClick = {
                                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                            }) { Text("Android permissions") }
                            Text("Version " + BuildConfig.VERSION_NAME, style = MaterialTheme.typography.bodySmall)
                        }
                        ConnectCard("Capture preferences") {
                            Toggle("Enable business capture", settings.optBoolean("consent"), !busy) { model.toggle("consent", it) }
                            Toggle("Wi-Fi only for audio uploads", wifi, true, model::wifi)
                            TextButton(onClick = { advanced = !advanced }) { Text(if (advanced) "Hide advanced settings" else "Advanced settings") }
                            if (advanced) {
                                controls.forEach { (key, label) -> Toggle(label, settings.optBoolean(key), !busy) { model.toggle(key, it) } }
                                Toggle("Keep new unmatched calls in Connect activity", settings.flag("unmatchedCalls"),
                                    !busy && settings.flag("calls")) { model.toggle("unmatchedCalls", it) }
                                val roles = getSystemService(RoleManager::class.java)
                                if (!isConnectDialer() && roles?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true) {
                                    OutlinedButton(onClick = { requestRole.launch(roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)) }) {
                                        Text("Enable lead caller ID")
                                    }
                                }
                            }
                            OutlinedButton(enabled = !busy, onClick = model::logout) { Text("Revoke this device and sign out") }
                        }
                    }
                }
                if (recording != null && settings.flag("recordings")) {
                    Text("Associate shared recording with a synchronized call")
                    Toggle("I have permission to upload this recording", consentToRecording, !busy) { consentToRecording = it }
                    calls.take(20).forEach { row ->
                        OutlinedButton(enabled = consentToRecording && !busy, onClick = { model.attach(row.getString("id"), consentToRecording) }) {
                            Text(listOfNotNull(row.optional("leadName"), row.optional("startedAt")).joinToString(" · "))
                        }
                    }
                    OutlinedButton(onClick = { model.selectAudio(null) }) { Text("Cancel recording") }
                }
            }
        }
    }

    private fun openBrokerIqForApproval(id: String) {
        val url = Uri.Builder().scheme("brokeriq").authority("connect-approve").appendQueryParameter("request", id).build()
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url).setPackage("com.brokeriq.app"))
        } catch (_: ActivityNotFoundException) {
            model.feedback.value = "Install or update the main BrokerIQ app, or use email sign-in."
        }
    }

    private fun dial(value: String) {
        val phone = android.telephony.PhoneNumberUtils.extractNetworkPortion(value)?.takeIf { it.any(Char::isDigit) } ?: return
        val action = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", phone, null))
        if (isConnectDialer()) action.setClass(this, ConnectPhoneActivity::class.java)
        else getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let(action::setPackage)
        runCatching { startActivity(action) }
    }

    private data class HandsetCall(val name: String?, val number: String?, val kind: String, val time: Long, val duration: Long)

    private fun loadHandsetCalls(): List<HandsetCall> {
        if (!isConnectDialer() || checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) return emptyList()
        val fields = arrayOf(CallLog.Calls.CACHED_NAME, CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION)
        val latest = CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, "25").build()
        return try {
            contentResolver.query(latest, fields, null, null, CallLog.Calls.DATE + " DESC")?.use { rows ->
                buildList {
                    while (rows.moveToNext() && size < 25) {
                        val kind = when (rows.getInt(2)) {
                            CallLog.Calls.INCOMING_TYPE -> "Incoming"
                            CallLog.Calls.OUTGOING_TYPE -> "Outgoing"
                            CallLog.Calls.MISSED_TYPE -> "Missed"
                            CallLog.Calls.REJECTED_TYPE -> "Rejected"
                            CallLog.Calls.BLOCKED_TYPE -> "Blocked"
                            else -> "Call"
                        }
                        add(HandsetCall(rows.getString(0)?.takeIf(String::isNotBlank), rows.getString(1)?.takeIf(String::isNotBlank),
                            kind, rows.getLong(3), rows.getLong(4)))
                    }
                }
            }.orEmpty()
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    @Composable
    private fun Toggle(label: String, value: Boolean, enabled: Boolean, change: (Boolean) -> Unit) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, modifier = Modifier.weight(1f))
            Switch(checked = value, enabled = enabled, onCheckedChange = change)
        }
    }
}
