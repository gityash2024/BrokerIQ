package com.brokeriq.connect

import android.Manifest
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

internal enum class SetupGrant(val title: String, val message: String, val action: String) {
    PHONE("Set your default Phone app",
        "Android will ask you to select BrokerIQ Connect. Your phone handles SIM choice and emergency calls.", "Choose Phone app"),
    CALLS("Allow recent calls",
        "Use call status, time and duration to match new business calls to your leads.", "Allow call history"),
    PLACE_CALLS("Allow placing calls",
        "Place calls from the Connect keypad through Android’s phone service.", "Allow calls"),
    SIM("Allow SIM access",
        "Identify active SIMs so you can choose which line to use for outgoing calls.", "Allow SIM access"),
    CONTACTS("Allow contacts",
        "Show saved names in the dialer and identify matching lead numbers.", "Allow contacts"),
    ALERTS("Allow call alerts",
        "Show incoming and ongoing calls when Connect is outside the foreground.", "Allow notifications"),
    FULL_SCREEN("Show incoming calls on the lock screen",
        "Android manages which Phone app can open its incoming call screen over the lock screen.", "Open call settings"),
    MESSAGES("Allow notification access",
        "Select BrokerIQ Connect in Android settings to process new business SMS and WhatsApp notifications.", "Open notification access"),
}

internal fun Context.missingSetupGrants(): List<SetupGrant> {
    val manager = getSystemService(NotificationManager::class.java)
    val roles = getSystemService(RoleManager::class.java)
    fun granted(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    return buildList {
        if (roles?.isRoleAvailable(RoleManager.ROLE_DIALER) == true) {
            if (!isConnectDialer()) add(SetupGrant.PHONE)
            if (!granted(Manifest.permission.READ_CALL_LOG)) add(SetupGrant.CALLS)
            if (!granted(Manifest.permission.CALL_PHONE)) add(SetupGrant.PLACE_CALLS)
            if (!granted(Manifest.permission.READ_PHONE_STATE)) add(SetupGrant.SIM)
        }
        if (!granted(Manifest.permission.READ_CONTACTS)) add(SetupGrant.CONTACTS)
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) add(SetupGrant.ALERTS)
        if (Build.VERSION.SDK_INT >= 34 && isConnectDialer() && manager?.canUseFullScreenIntent() == false) add(SetupGrant.FULL_SCREEN)
        if (manager?.isNotificationListenerAccessGranted(ComponentName(this@missingSetupGrants, BusinessNotifications::class.java)) != true) {
            add(SetupGrant.MESSAGES)
        }
    }
}

private val runtimeGrants = setOf(SetupGrant.CALLS, SetupGrant.PLACE_CALLS, SetupGrant.SIM, SetupGrant.CONTACTS, SetupGrant.ALERTS)

@Composable
internal fun ConnectSetupScreen(
    grants: List<SetupGrant>,
    consentChecked: Boolean,
    onConsentChecked: (Boolean) -> Unit,
    busy: Boolean,
    feedback: String,
    onGrant: (SetupGrant) -> Unit,
    onSettings: () -> Unit,
    onActivate: () -> Unit,
    onLogout: () -> Unit,
) {
    val grant = grants.firstOrNull()
    Column(
        Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
            .verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Image(painterResource(R.drawable.biq_brand), null, Modifier.size(74.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Set up BrokerIQ Connect", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text(if (grants.isNotEmpty()) "${grants.size} Android permission steps remaining" else "Android access approved",
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        ConnectCard(grant?.title ?: "Start business capture") {
            Text(grant?.message ?: "Sync new business calls and WhatsApp or SMS notifications from this work phone. Authorized recordings can sync after you select their folder.")
            SessionFeedback(feedback, busy)
            if (grant != null) {
                Button(onClick = { onGrant(grant) }, modifier = Modifier.fillMaxWidth(), enabled = !busy) { Text(grant.action) }
                if (grant in runtimeGrants) {
                    TextButton(onClick = onSettings) { Text("Open Android app permissions") }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Checkbox(checked = consentChecked, onCheckedChange = onConsentChecked, enabled = !busy)
                    Text("I am authorized to process business calls and messages on this phone.",
                        Modifier.weight(1f).padding(top = 12.dp), style = MaterialTheme.typography.bodyMedium)
                }
                Button(onClick = onActivate, enabled = consentChecked && !busy, modifier = Modifier.fillMaxWidth()) {
                    Text("Connect and start sync")
                }
            }
        }
        TextButton(onClick = onLogout, enabled = !busy) { Text("Sign out") }
    }
}
