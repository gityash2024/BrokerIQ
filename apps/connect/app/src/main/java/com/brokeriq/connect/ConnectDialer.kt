package com.brokeriq.connect

import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.OutcomeReceiver
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.CallEndpoint
import android.telecom.CallEndpointException
import android.telecom.DisconnectCause
import android.telecom.InCallService
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telecom.VideoProfile
import android.telephony.PhoneNumberUtils
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

internal fun Context.isConnectDialer(): Boolean =
    getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_DIALER) == true

internal data class LiveCall(
    val id: Int, val call: Call, val phase: Int, val name: String?, val number: String?, val connectedAt: Long, val simLabel: String?,
)
private data class SimAccount(val handle: PhoneAccountHandle, val label: String)
private fun Context.simLabel(handle: PhoneAccountHandle?): String? {
    if (handle == null) return null
    return runCatching { getSystemService(TelecomManager::class.java)?.getPhoneAccount(handle) }
        .getOrNull()?.takeIf { it.hasCapabilities(PhoneAccount.CAPABILITY_SIM_SUBSCRIPTION) }
        ?.label?.toString()?.trim()?.take(80)?.takeIf(String::isNotBlank)
}
internal data class AudioRoute(val label: String, val select: () -> Unit)

@Suppress("DEPRECATION")
class ConnectInCallService : InCallService() {
    companion object {
        private const val CALL_CHANNEL = "connect_phone_calls"
        private const val CALL_ALERT = 40
        private var instance: ConnectInCallService? = null
        private val active = MutableStateFlow<List<LiveCall>>(emptyList())
        private val routes = MutableStateFlow<List<AudioRoute>>(emptyList())
        private val muted = MutableStateFlow(false)
        internal fun currentCalls() = active
        internal fun currentRoutes() = routes
        internal fun muteState() = muted
        internal fun changeMute() { instance?.setMuted(!muted.value) }
        internal fun hasCalls() = active.value.isNotEmpty()
    }

    private val tracked = linkedMapOf<Call, Call.Callback>()
    private val captureScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCallAdded(call: Call) {
        instance = this
        val callback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) { publish() }
            override fun onDetailsChanged(call: Call, details: Call.Details) { publish() }
        }
        tracked[call] = callback
        call.registerCallback(callback)
        publish()
        if (Build.VERSION.SDK_INT < 34) callAudioState?.let(::onCallAudioStateChanged)
        if (call.isExternalCall() || call.state == Call.STATE_RINGING) return
        openPhone()
    }

    override fun onBringToForeground(showDialpad: Boolean) { openPhone(showDialpad) }

    override fun onCallRemoved(call: Call) {
        tracked.remove(call)?.let(call::unregisterCallback)
        publish()
        captureFinishedCall(call)
    }

    override fun onDestroy() {
        tracked.forEach { (call, cb) -> call.unregisterCallback(cb) }
        tracked.clear()
        publish()
        routes.value = emptyList()
        muted.value = false
        if (instance == this) instance = null
        super.onDestroy()
    }

    private fun Call.isExternalCall() = details.hasProperty(Call.Details.PROPERTY_IS_EXTERNAL_CALL)

    private fun publish() {
        val app = application as ConnectApplication
        val directory = runCatching { app.vault.directory() }.getOrDefault(emptyList())
        val calls = tracked.keys.mapNotNull { call ->
            if (call.isExternalCall() || call.state == Call.STATE_DISCONNECTED) return@mapNotNull null
            val number = call.details.handle?.takeIf { it.scheme == "tel" }?.schemeSpecificPart
            val normalized = mobile(number)
            val lead = normalized?.let { value -> directory.singleOrNull { mobile(it.phone) == value || mobile(it.alternate) == value } }
            LiveCall(System.identityHashCode(call), call, call.state,
                sequenceOf(lead?.name, call.details.contactDisplayName, call.details.callerDisplayName)
                    .firstOrNull { !it.isNullOrBlank() },
                number?.takeIf(String::isNotBlank), call.details.connectTimeMillis, simLabel(call.details.accountHandle))
        }
        active.value = calls
        updateCallNotification(calls.firstOrNull { it.phase == Call.STATE_RINGING } ?: calls.firstOrNull())
    }

    private fun openPhone(showDialpad: Boolean = false) {
        startActivity(Intent(this, ConnectPhoneActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("keypad", showDialpad))
    }

    private fun action(id: Int, verb: String): PendingIntent = PendingIntent.getBroadcast(
        this, id + verb.hashCode(), Intent(this, ConnectCallAction::class.java).setAction(verb).putExtra("id", id),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun updateCallNotification(call: LiveCall?) {
        val manager = getSystemService(NotificationManager::class.java)
        if (call == null) {
            manager.cancel(CALL_ALERT)
            return
        }
        manager.createNotificationChannel(NotificationChannel(CALL_CHANNEL, "Phone calls", NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(null, null)
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        })
        val open = PendingIntent.getActivity(this, CALL_ALERT, Intent(this, ConnectPhoneActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val incoming = call.phase == Call.STATE_RINGING
        val caller = call.name ?: call.number ?: "Unknown caller"
        val canShowIncomingScreen = incoming && (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent())
        val dismiss = action(call.id, if (incoming) "decline" else "end")
        fun notification() = Notification.Builder(this, CALL_CHANNEL).setContentIntent(open)
            .setSmallIcon(android.R.drawable.sym_action_call).setCategory(Notification.CATEGORY_CALL)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setOngoing(true).setOnlyAlertOnce(true)
            .setContentTitle(if (incoming) "Incoming call" else "Ongoing call").setContentText(caller)
        if (Build.VERSION.SDK_INT >= 31 && canShowIncomingScreen) {
            val person = android.app.Person.Builder().setName(caller).setImportant(true).build()
            val posted = runCatching {
                manager.notify(CALL_ALERT, notification().setFullScreenIntent(open, true)
                    .setStyle(Notification.CallStyle.forIncomingCall(person, dismiss, action(call.id, "answer"))).build())
            }.isSuccess
            if (posted) return
        }
        val fallback = notification()
            .addAction(Notification.Action.Builder(null, if (incoming) "Decline" else "End call", dismiss).build())
        if (incoming) fallback.addAction(Notification.Action.Builder(null, "Answer", action(call.id, "answer")).build())
        if (canShowIncomingScreen) fallback.setFullScreenIntent(open, true)
        manager.notify(CALL_ALERT, fallback.build())
    }

    override fun onMuteStateChanged(isMuted: Boolean) { muted.value = isMuted }

    override fun onCallAudioStateChanged(state: CallAudioState) {
        muted.value = state.isMuted
        if (Build.VERSION.SDK_INT >= 34) return
        routes.value = listOf(
            CallAudioState.ROUTE_EARPIECE to "Phone", CallAudioState.ROUTE_SPEAKER to "Speaker",
            CallAudioState.ROUTE_WIRED_HEADSET to "Headset", CallAudioState.ROUTE_BLUETOOTH to "Bluetooth",
        ).filter { (route, _) -> state.supportedRouteMask and route != 0 }
            .map { (route, name) -> AudioRoute(name) { setAudioRoute(route) } }
    }

    override fun onAvailableCallEndpointsChanged(availableEndpoints: MutableList<CallEndpoint>) {
        if (Build.VERSION.SDK_INT < 34) return
        routes.value = availableEndpoints.map { endpoint ->
            AudioRoute(endpoint.endpointName.toString()) {
                requestCallEndpointChange(endpoint, mainExecutor, object : OutcomeReceiver<Void, CallEndpointException> {
                    override fun onResult(result: Void?) = Unit
                    override fun onError(error: CallEndpointException) {
                        android.widget.Toast.makeText(this@ConnectInCallService, "Audio route unavailable", android.widget.Toast.LENGTH_SHORT).show()
                    }
                })
            }
        }
    }

    private fun captureFinishedCall(call: Call) {
        val app = application as ConnectApplication
        val owner = app.account() ?: return
        val details = call.details
        if (call.isExternalCall()) return
        val address = details.handle?.takeIf { it.scheme == "tel" }?.schemeSpecificPart
        val start = details.creationTimeMillis.takeIf { it > 0 } ?: return
        val connectedAt = details.connectTimeMillis
        val direction = when (details.callDirection) {
            Call.Details.DIRECTION_INCOMING -> "INBOUND"
            Call.Details.DIRECTION_OUTGOING -> "OUTBOUND"
            else -> return
        }
        val outcome = when {
            connectedAt > 0 -> "COMPLETED"
            details.disconnectCause.code == DisconnectCause.MISSED -> "MISSED"
            details.disconnectCause.code == DisconnectCause.REJECTED -> "REJECTED"
            else -> "DETECTED"
        }
        val duration = connectedAt.takeIf { it > 0 }?.let { ((System.currentTimeMillis() - it) / 1000L).coerceIn(0, 86400) }
        val label = simLabel(details.accountHandle)
        captureScope.launch { capturePhoneCall(app, owner, address, start, direction, outcome, duration, label) }
    }

    class ConnectCallAction : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val call = active.value.firstOrNull { it.id == intent.getIntExtra("id", 0) }?.call ?: return
            when (intent.action) {
                "answer" -> if (call.state == Call.STATE_RINGING) call.answer(VideoProfile.STATE_AUDIO_ONLY)
                "decline" -> if (call.state == Call.STATE_RINGING) call.reject(false, null)
                "end" -> call.disconnect()
            }
        }
    }
}

@Suppress("DEPRECATION")
class ConnectPhoneActivity : ComponentActivity() {
    private var prefill by mutableStateOf("")
    private var showKeypad by mutableStateOf(false)
    private var receivedCall by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLockScreenPolicy()
        parseIntent(intent)
        setContent { ConnectTheme { Phone() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyLockScreenPolicy()
        parseIntent(intent)
    }

    private fun applyLockScreenPolicy() {
        val inCall = ConnectInCallService.hasCalls()
        setShowWhenLocked(inCall)
        setTurnScreenOn(inCall)
        if (inCall && getSystemService(KeyguardManager::class.java).isDeviceLocked) {
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    private fun parseIntent(intent: Intent) {
        showKeypad = intent.getBooleanExtra("keypad", false)
        if (intent.action == Intent.ACTION_DIAL && intent.data?.scheme == "tel") {
            prefill = PhoneNumberUtils.extractNetworkPortion(intent.data?.schemeSpecificPart.orEmpty()).take(30)
        }
    }

    @Composable
    private fun Phone() {
        val calls by ConnectInCallService.currentCalls().collectAsState()
        val muted by ConnectInCallService.muteState().collectAsState()
        val routes by ConnectInCallService.currentRoutes().collectAsState()
        var selectedCall by rememberSaveable { mutableIntStateOf(0) }
        var routeMenu by remember { mutableStateOf(false) }
        var simOptions by remember { mutableStateOf(emptyList<SimAccount>()) }
        var digits by rememberSaveable(prefill) { mutableStateOf(prefill) }
        var error by remember { mutableStateOf("") }
        var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
        val current = calls.firstOrNull { it.phase == Call.STATE_RINGING } ?: calls.firstOrNull { it.id == selectedCall }
            ?: calls.firstOrNull { it.phase == Call.STATE_ACTIVE } ?: calls.firstOrNull()
        LaunchedEffect(current?.id) {
            if (current != null) {
                receivedCall = true
                while (true) { now = System.currentTimeMillis(); delay(1000) }
            } else if (receivedCall) finish()
        }
        if (current?.phase == Call.STATE_RINGING) {
            IncomingCall(current)
            return
        }
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = {
                if (current != null && current.phase != Call.STATE_RINGING) {
                    Surface(tonalElevation = 2.dp) {
                        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center) {
                            Button(
                                onClick = { current.call.disconnect() },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                            ) { Text("End call") }
                        }
                    }
                }
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                ConnectWorkspaceHeader("Phone", current != null)
                if (current == null) {
                    Text(digits.ifBlank { "Enter a number" }, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                    DialKeys { key -> if (digits.length < 30) digits += key }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = {
                            val options = availableSims()
                            if (options.size > 1) simOptions = options else error = placeCall(digits).orEmpty()
                        }, enabled = digits.any(Char::isDigit)) {
                            Icon(Icons.Filled.Call, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Call")
                        }
                        OutlinedButton(onClick = { digits = digits.dropLast(1) }, enabled = digits.isNotEmpty()) { Text("Delete") }
                    }
                    TextButton(onClick = { startActivity(Intent(this@ConnectPhoneActivity, MainActivity::class.java)); finish() }) {
                        Text("Open Connect")
                    }
                    SessionFeedback(error, false)
                    if (simOptions.isNotEmpty()) AlertDialog(
                        onDismissRequest = { simOptions = emptyList() },
                        title = { Text("Choose SIM") },
                        text = {
                            Column {
                                simOptions.forEach { account ->
                                    TextButton(onClick = {
                                        simOptions = emptyList()
                                        error = placeCall(digits, account.handle).orEmpty()
                                    }) { Text(account.label) }
                                }
                            }
                        },
                        confirmButton = { TextButton(onClick = { simOptions = emptyList() }) { Text("Cancel") } },
                    )
                    return@Column
                }
                val call = current.call
                val phase = current.phase
                Text(when (phase) {
                    Call.STATE_HOLDING -> "On hold"
                    Call.STATE_ACTIVE -> if (current.connectedAt > 0) {
                        val elapsed = ((now - current.connectedAt) / 1000L).coerceAtLeast(0)
                        "%d:%02d".format(elapsed / 60, elapsed % 60)
                    } else "Connected"
                    else -> "Connecting"
                }, style = MaterialTheme.typography.titleMedium)
                Text(current.name ?: current.number ?: "Unknown caller", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                if (current.name != null && current.number != null) Text(current.number)
                current.simLabel?.let { Text(it, style = MaterialTheme.typography.labelLarge) }
                calls.filter { it.id != current.id }.forEach { other ->
                    OutlinedButton(onClick = {
                        if (other.phase == Call.STATE_HOLDING) other.call.unhold()
                        selectedCall = other.id
                    }) { Text(other.name ?: other.number ?: "Other call") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = muted, onClick = ConnectInCallService::changeMute, label = { Text("Mute") })
                    if (call.details.can(Call.Details.CAPABILITY_HOLD)) FilterChip(selected = phase == Call.STATE_HOLDING, onClick = {
                        if (phase == Call.STATE_HOLDING) call.unhold() else call.hold()
                    }, label = { Text(if (phase == Call.STATE_HOLDING) "Resume" else "Hold") })
                    Box {
                        FilterChip(selected = routeMenu, onClick = { routeMenu = true }, enabled = routes.isNotEmpty(), label = { Text("Audio") })
                        DropdownMenu(expanded = routeMenu, onDismissRequest = { routeMenu = false }) {
                            routes.forEach { route ->
                                DropdownMenuItem(text = { Text(route.label) }, onClick = { routeMenu = false; route.select() })
                            }
                        }
                    }
                    FilterChip(selected = showKeypad, onClick = { showKeypad = !showKeypad }, label = { Text("Keypad") })
                }
                if (showKeypad && phase == Call.STATE_ACTIVE) {
                    var tone by remember { mutableStateOf<Char?>(null) }
                    LaunchedEffect(tone) {
                        tone?.let { digit ->
                            call.playDtmfTone(digit)
                            try { delay(120) } finally { call.stopDtmfTone() }
                            tone = null
                        }
                    }
                    DialKeys { tone = it }
                }
            }
        }
    }

    @Composable
    private fun IncomingCall(current: LiveCall) {
        val background = Brush.verticalGradient(listOf(Color(0xFF161C35), Color(0xFF101422), Color(0xFF251C58)))
        Column(Modifier.fillMaxSize().background(background).statusBarsPadding().navigationBarsPadding()
            .verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Spacer(Modifier.height(34.dp))
            Image(painterResource(R.drawable.biq_brand), null, Modifier.size(72.dp))
            Text("BrokerIQ Connect", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(26.dp))
            Text("Incoming call", color = Color(0xFFC9C0FF), style = MaterialTheme.typography.titleMedium)
            Text(current.name ?: current.number ?: "Unknown caller", color = Color.White, textAlign = TextAlign.Center,
                style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, maxLines = 3)
            if (current.name != null && current.number != null) Text(current.number, color = Color.White)
            current.simLabel?.let { Text(it, color = Color(0xFFC9C0FF), style = MaterialTheme.typography.labelLarge) }
            Canvas(Modifier.size(width = 124.dp, height = 60.dp)) {
                val bars = listOf(.16f, .36f, .58f, .82f, .58f, .36f, .16f)
                bars.forEachIndexed { index, height ->
                    val x = size.width * (index + 1) / (bars.size + 1)
                    val half = size.height * height / 2
                    drawLine(Color(0xFF846BFA), Offset(x, center.y - half), Offset(x, center.y + half), 4.dp.toPx(), StrokeCap.Round)
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                IncomingAction("Decline", Color(0xFFFF686D), Color(0xFF161C35), rotate = 135f) {
                    current.call.reject(false, null)
                }
                IncomingAction("Answer", Color(0xFF9BDFB3), Color(0xFF161C35)) {
                    current.call.answer(VideoProfile.STATE_AUDIO_ONLY)
                }
            }
        }
    }

    @Composable
    private fun IncomingAction(label: String, background: Color, foreground: Color, rotate: Float = 0f, action: () -> Unit) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = action, modifier = Modifier.size(68.dp).semantics { contentDescription = label },
                colors = ButtonDefaults.buttonColors(containerColor = background, contentColor = foreground),
                contentPadding = PaddingValues(0.dp), shape = CircleShape) {
                Icon(Icons.Filled.Call, contentDescription = null, Modifier.size(28.dp).rotate(rotate))
            }
            Text(label, color = Color.White, style = MaterialTheme.typography.labelLarge)
        }
    }

    private fun availableSims(): List<SimAccount> {
        if (!isConnectDialer() || checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return emptyList()
        val manager = getSystemService(TelecomManager::class.java)
        return runCatching {
            manager.callCapablePhoneAccounts.mapNotNull { handle -> simLabel(handle)?.let { SimAccount(handle, it) } }
        }.getOrDefault(emptyList())
    }

    private fun placeCall(digits: String, account: PhoneAccountHandle? = null): String? {
        val number = PhoneNumberUtils.extractNetworkPortion(digits)
        if (number.isBlank()) return "Enter a phone number."
        val uri = Uri.fromParts("tel", number, null)
        return try {
            if (!isConnectDialer() || checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                val manager = getSystemService(TelecomManager::class.java)
                val systemDialer = manager.systemDialerPackage
                if (systemDialer == null || systemDialer == packageName) return "Choose a default phone app in Android settings."
                startActivity(Intent(Intent.ACTION_DIAL, uri).setPackage(systemDialer))
            } else {
                getSystemService(TelecomManager::class.java).placeCall(uri, Bundle().apply {
                    if (account != null) putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, account)
                })
            }
            null
        } catch (_: RuntimeException) {
            "The phone service could not place this call."
        }
    }
}

@Composable
private fun DialKeys(onKey: (Char) -> Unit) {
    val characters = listOf("123", "456", "789", "*0#")
    characters.forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { key ->
                FilledTonalButton(
                    onClick = { onKey(key) },
                    modifier = Modifier.weight(1f).heightIn(min = 54.dp).semantics { contentDescription = "Dial $key" },
                ) { Text(key.toString(), style = MaterialTheme.typography.titleLarge) }
            }
        }
    }
}
