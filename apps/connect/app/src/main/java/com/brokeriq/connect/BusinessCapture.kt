package com.brokeriq.connect

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telephony.PhoneNumberUtils
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

private val sensitive = Regex(
    "\\b(otp|password|passcode|verification code|security code|authentication code|one.time code|do not share|bank account|debited|credited)\\b|ओटीपी|सत्यापन कोड",
    RegexOption.IGNORE_CASE,
)
private val applications = setOf("com.whatsapp.w4b", "com.whatsapp")

class BusinessNotifications : NotificationListenerService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val notifications = Mutex()

    override fun onNotificationPosted(item: StatusBarNotification) {
        if (item.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        val app = applicationContext as ConnectApplication
        val owner = app.account() ?: return
        val whatsapp = item.packageName in applications
        val flag = if (whatsapp) "whatsapp" else "smsNotifications"
        if (!app.vault.json("settings").flag(flag)) return
        if (!whatsapp && item.packageName != Telephony.Sms.getDefaultSmsPackage(this)) return
        val extras = item.notification.extras ?: return
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(item.notification)
        val originalTitle = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()
        val title = style?.conversationTitle?.toString()?.trim()?.takeIf(String::isNotBlank) ?: originalTitle ?: return
        if (sensitive.containsMatchIn(title)) return
        val shortcut = item.notification.shortcutId ?: if (!whatsapp) originalTitle ?: item.key else item.key
        val identity = hash(item.packageName + ":" + shortcut)
        serviceScope.launch {
            notifications.withLock {
                if (owner != app.account()) return@withLock
                val settings = app.vault.json("settings")
                if (!settings.flag(flag)) return@withLock
                val all = app.vault.json("channelApprovals")
                val broad = if (whatsapp && settings.optBoolean("allWhatsapp")) all.optLong("allWhatsapp")
                    else if (!whatsapp) all.optLong("smsNotifications") else 0L
                val individual = if (whatsapp && item.notification.shortcutId != null) {
                    val encountered = app.vault.json("conversations")
                    if (!encountered.has(identity) && encountered.length() < 100) {
                        encountered.put(identity, JSONObject().put("name", title.take(120)).put("app", item.packageName))
                        app.vault.write("conversations", encountered.toString())
                    }
                    app.vault.json("approvedAt").optLong(identity)
                } else 0L
                val approved = listOf(broad, individual).filter { it > 0L }.minOrNull() ?: return@withLock
                val kind = if (whatsapp) "WHATSAPP" else "SMS"
                suspend fun store(text: String?, timestamp: Long, sender: String?) {
                    val content = text?.trim()?.take(4000)?.takeIf { it.length > 1 } ?: return
                    if (timestamp < approved || sensitive.containsMatchIn(content) ||
                        (!whatsapp && !content.any(Char::isLetter))) return
                    val body = JSONObject().put("kind", kind).put("group", identity).put("text", content)
                        .put("capturedAt", Instant.ofEpochMilli(timestamp).toString())
                    if (whatsapp) body.put("packageName", item.packageName)
                    mobile(sender)?.let { body.put("senderPhone", it) }
                    app.enqueue(if (whatsapp) "WhatsApp message" else "SMS notification", body,
                        hash("$owner|$kind|$identity|$timestamp|$content"), owner = owner)
                }
                for (message in style?.messages.orEmpty()) {
                    val timestamp = message.timestamp.takeIf { it > 0 } ?: item.postTime
                    val sender = message.person?.uri?.takeIf { it.startsWith("tel:") }?.substringAfter("tel:")
                    store(message.text?.toString(), timestamp, sender)
                }
                if (!whatsapp && style == null && item.notification.category == Notification.CATEGORY_MESSAGE) {
                    store(extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(), item.postTime, originalTitle)
                }
            }
        }
    }
}

internal suspend fun capturePhoneCall(
    app: ConnectApplication, owner: String, address: String?, at: Long, direction: String, outcome: String, duration: Long? = null, simLabel: String? = null,
): Lead? {
    if (owner != app.account()) return null
    val settings = app.vault.json("settings")
    if (!settings.flag("calls")) return null
    val normalized = mobile(address)
    val matches = if (normalized == null) emptyList() else app.vault.directory()
        .filter { mobile(it.phone) == normalized || mobile(it.alternate) == normalized }.take(20)
    val body = JSONObject().put("kind", "CALL").put("direction", direction).put("outcome", outcome)
        .put("capturedAt", Instant.ofEpochMilli(at).toString())
    duration?.let { body.put("durationSec", it) }
    simLabel?.let { body.put("simLabel", it) }
    val lead = matches.singleOrNull()
    if (lead != null) {
        body.put("number", normalized).put("leadId", lead.id)
        app.enqueue("SIM call", body, hash("$direction|$at|${lead.id}"), owner = owner)
    } else if (matches.isNotEmpty()) {
        val id = hash("$owner|$direction|$at|$normalized")
        app.vault.rememberAmbiguous(id, JSONObject().put("owner", owner).put("detectedAt", at)
            .put("event", body.put("number", normalized)).put("candidateIds", JSONArray(matches.map { it.id })))
    } else if (settings.optBoolean("unmatchedCalls") && at >= app.vault.json("channelApprovals").optLong("unmatchedCalls", Long.MAX_VALUE)) {
        val number = address?.let(PhoneNumberUtils::normalizeNumber)?.takeIf { it.matches(Regex("\\+?[0-9]{1,25}")) }
        body.put("kind", "UNMATCHED_CALL")
        number?.let { body.put("number", it) }
        app.enqueue("Unmatched SIM call", body, hash("$owner|$direction|$at|${number.orEmpty()}"), owner = owner)
    }
    return lead
}

class BusinessCalls : CallScreeningService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onScreenCall(details: Call.Details) {
        val incoming = details.callDirection == Call.Details.DIRECTION_INCOMING
        if (incoming) respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
        if (isConnectDialer()) return
        val app = applicationContext as ConnectApplication
        val owner = app.account() ?: return
        if (!app.vault.json("settings").flag("calls")) return
        val address = details.handle?.takeIf { it.scheme == "tel" }?.schemeSpecificPart ?: return
        val at = details.creationTimeMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
        val direction = if (incoming) "INBOUND" else "OUTBOUND"
        serviceScope.launch {
            capturePhoneCall(app, owner, address, at, direction, "DETECTED")?.let { showCaller(it.name, at) }
        }
    }

    private fun showCaller(name: String, id: Long) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(NotificationChannel("known_leads", "Known lead caller ID", NotificationManager.IMPORTANCE_LOW))
        val alert = Notification.Builder(this, "known_leads").setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle("BrokerIQ lead").setContentText(name).setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).build()
        manager.notify(id.toInt(), alert)
    }
}
