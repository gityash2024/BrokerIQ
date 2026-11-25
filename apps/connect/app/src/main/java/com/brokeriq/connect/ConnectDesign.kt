package com.brokeriq.connect

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

private val Indigo = Color(0xFF5340D7)
private val Ink = Color(0xFF161C35)
private val Mint = Color(0xFFADDBBF)

@Composable
internal fun ConnectTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(
        primary = Color(0xFFC9C0FF), onPrimary = Color(0xFF271679),
        background = Color(0xFF101422), surface = Color(0xFF151B2E),
        surfaceContainerHigh = Color(0xFF222941),
    ) else lightColorScheme(
        primary = Indigo, onPrimary = Color.White, background = Color(0xFFF6F7FD),
        surface = Color.White, onSurface = Ink, surfaceContainerHigh = Color(0xFFEDEBFA),
        secondaryContainer = Color(0xFFE8E4FF), onSecondaryContainer = Ink,
    )
    MaterialTheme(colorScheme = colors, content = content)
}

@Composable
internal fun ConnectSignIn(model: ConnectViewModel, openBrokerIq: (String) -> Unit) {
    val challenge by model.step.collectAsState()
    val sessionLimit by model.sessionLimit.collectAsState()
    val mainLink by model.mainLink.collectAsState()
    val destination by model.otpDestination.collectAsState()
    val resendAt by model.otpResendAt.collectAsState()
    val feedback by model.feedback.collectAsState()
    val busy by model.busy.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var code by remember(challenge) { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var remaining by remember(resendAt) { mutableIntStateOf(0) }
    LaunchedEffect(resendAt) {
        do {
            remaining = ((resendAt - System.currentTimeMillis() + 999) / 1000).toInt().coerceAtLeast(0)
            if (remaining > 0) delay(500)
        } while (remaining > 0)
    }
    val verifying = challenge.isNotEmpty()
    BackHandler((verifying || sessionLimit != null || mainLink != null) && !busy) {
        if (mainLink != null) model.cancelMainLink() else model.resetLogin()
    }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()
            .verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Surface(color = Ink, contentColor = Color.White, shape = RoundedCornerShape(28.dp)) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Image(painterResource(R.drawable.biq_brand), contentDescription = null, Modifier.size(64.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("BrokerIQ Connect", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Connect. Capture. Automate.", color = Color(0xFFD2CAFF), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        ElevatedCard(shape = RoundedCornerShape(24.dp)) {
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                val link = mainLink
                if (link != null) {
                    Text("Approve in BrokerIQ", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("Enter this code in the main BrokerIQ app on this phone within three minutes.")
                    Text(link.getString("code"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    SessionFeedback(feedback, busy)
                    Button(onClick = { openBrokerIq(link.getString("id")) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Text("Open BrokerIQ")
                    }
                    OutlinedButton(onClick = model::finishMainLink, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Text("Finish sign-in")
                    }
                    TextButton(onClick = model::cancelMainLink, enabled = !busy) { Text("Use email instead") }
                    return@Column
                }
                val selection = sessionLimit
                if (selection != null) {
                    Text("Manage signed-in devices", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("Your account has reached its device limit. Choose a session to sign out.")
                    val sessions = selection.optJSONArray("sessions")
                    var selectedId by remember(selection) { mutableStateOf<String?>(null) }
                    for (index in 0 until (sessions?.length() ?: 0)) {
                        val device = sessions?.optJSONObject(index) ?: continue
                        val id = device.optional("id") ?: continue
                        val rawAgent = device.optional("userAgent").orEmpty()
                        val name = when {
                            rawAgent.contains("BrokerIQ Connect", true) -> "BrokerIQ Connect"
                            rawAgent.contains("iPhone", true) -> "iPhone"
                            rawAgent.contains("Android", true) -> "Android"
                            rawAgent.contains("Windows", true) -> "Windows"
                            rawAgent.contains("Macintosh", true) -> "Mac"
                            else -> "BrokerIQ session"
                        }
                        val lastActive = (device.optional("lastUsedAt") ?: device.optional("createdAt"))?.let {
                            runCatching {
                                java.time.format.DateTimeFormatter.ofLocalizedDateTime(java.time.format.FormatStyle.MEDIUM, java.time.format.FormatStyle.SHORT)
                                    .withZone(java.time.ZoneId.systemDefault()).format(java.time.Instant.parse(it))
                            }.getOrNull()
                        }
                        OutlinedButton(onClick = { selectedId = id }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                            Column(Modifier.weight(1f)) {
                                Text(name)
                                if (lastActive != null) Text(lastActive, style = MaterialTheme.typography.bodySmall)
                            }
                            RadioButton(selected = selectedId == id, onClick = null)
                        }
                    }
                    SessionFeedback(feedback, busy)
                    val replacement = selectedId
                    Button(onClick = { if (replacement != null) model.replaceSession(replacement) },
                        modifier = Modifier.fillMaxWidth(), enabled = !busy && replacement != null) {
                        Text("Sign out selected session and continue")
                    }
                    TextButton(enabled = !busy, onClick = model::resetLogin) { Text("Back to sign in") }
                    return@Column
                }
                Text(if (verifying) "Verify your email" else "Sign in to your workspace", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                if (verifying) {
                    Text(if (destination.isBlank()) "Enter the six-digit code from your email." else "Enter the six-digit code sent to $destination.")
                    OutlinedTextField(
                        code, { code = it.filter { digit -> digit in '0'..'9' }.take(6) }, label = { Text("Verification code") },
                        modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
                    )
                } else {
                    Button(onClick = {
                        password = ""
                        model.startMainLink()
                    }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                        Text("Continue with BrokerIQ app")
                    }
                    HorizontalDivider()
                    OutlinedTextField(
                        email, { email = it }, label = { Text("Email address") }, modifier = Modifier.fillMaxWidth(),
                        enabled = !busy, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    )
                    OutlinedTextField(
                        password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(),
                        enabled = !busy, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") } },
                    )
                }
                SessionFeedback(feedback, busy)
                Button(
                    enabled = !busy && if (verifying) code.length == 6 else email.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                    onClick = { model.login(email, password, code) },
                ) { Text(if (verifying) "Verify and link this phone" else "Sign in with email") }
                if (verifying) {
                    TextButton(enabled = !busy && remaining == 0, onClick = model::resendCode) {
                        Text(if (remaining > 0) "Resend in ${remaining}s" else "Resend code")
                    }
                    TextButton(enabled = !busy, onClick = model::resetLogin) { Text("Change email") }
                }
            }
        }
        Text("You choose which device permissions to enable after sign-in.", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
    }
}

@Composable
internal fun SessionFeedback(message: String, busy: Boolean) {
    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    if (message.isNotBlank()) {
        Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = RoundedCornerShape(14.dp)) {
            Text(message, modifier = Modifier.fillMaxWidth().padding(12.dp), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

internal enum class ConnectTab(val label: String) { OVERVIEW("Home"), CALLS("Calls"), INBOX("Messages"), SYNC("Activity"), SETUP("Settings") }

@Composable
internal fun ConnectNavigation(selected: ConnectTab, select: (ConnectTab) -> Unit) {
    NavigationBar {
        for (tab in ConnectTab.entries) {
            NavigationBarItem(
                selected = tab == selected,
                onClick = { select(tab) },
                icon = {
                    Icon(when (tab) {
                        ConnectTab.OVERVIEW -> Icons.Filled.Home
                        ConnectTab.CALLS -> Icons.Filled.Call
                        ConnectTab.INBOX -> Icons.Filled.Email
                        ConnectTab.SYNC -> Icons.AutoMirrored.Filled.List
                        ConnectTab.SETUP -> Icons.Filled.Settings
                    }, contentDescription = null)
                },
                label = { Text(tab.label) },
            )
        }
    }
}

@Composable
internal fun ConnectWorkspaceHeader(title: String, connected: Boolean) {
    Surface(color = Ink, contentColor = Color.White, shape = RoundedCornerShape(22.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Image(painterResource(R.drawable.biq_brand), contentDescription = null, Modifier.size(42.dp))
            Column(Modifier.weight(1f)) {
                Text("BrokerIQ Connect", style = MaterialTheme.typography.labelMedium, color = Color(0xFFC9C0FF))
                Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            Box(Modifier.size(8.dp).background(if (connected) Mint else Color(0xFFF3C474), CircleShape))
        }
    }
}

@Composable
internal fun ConnectCard(title: String, body: @Composable ColumnScope.() -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            body()
        }
    }
}
