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
import androidx.core.app.NotificationCompat
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

private val sensitive = Regex("\\b(otp|password|passcode|verification code|one.time code|bank account|debited|credited)\\b", RegexOption.IGNORE_CASE)
private val applications = setOf("com.whatsapp.w4b", "com.whatsapp")

class BusinessNotifications : NotificationListenerService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onNotificationPosted(item: StatusBarNotification) {
        if (item.packageName !in applications || item.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        val app = applicationContext as ConnectApplication
        if (!app.vault.json("settings").flag("whatsapp") || app.account() == null) return
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(item.notification) ?: return
        val title = style.conversationTitle?.toString()?.trim()?.takeIf(String::isNotEmpty)
            ?: item.notification.extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()?.takeIf(String::isNotEmpty)
            ?: return
        val shortcut = item.notification.shortcutId ?: return
        val identity = hash(item.packageName + ":" + shortcut)
        serviceScope.launch {
            val encountered = app.vault.json("conversations")
            if (!encountered.has(identity) && encountered.length() < 100) {
                encountered.put(identity, JSONObject().put("name", title.take(120)).put("app", item.packageName))
                app.vault.write("conversations", encountered.toString())
            }
            val approval = app.vault.json("approvedAt").optLong(identity, 0)
            if (approval == 0L) return@launch
            for (message in style.messages) {
                val messageText = message.text?.toString()?.trim()?.take(4000)?.takeIf { it.length > 1 } ?: continue
                val timestamp = message.timestamp.takeIf { it > 0 } ?: item.postTime
                if (timestamp < approval || sensitive.containsMatchIn(messageText)) continue
                val body = JSONObject().put("kind", "WHATSAPP").put("packageName", item.packageName).put("group", identity)
                    .put("text", messageText).put("capturedAt", Instant.ofEpochMilli(timestamp).toString())
                val sender = message.person?.uri?.takeIf { it.startsWith("tel:") }?.substringAfter("tel:")
                mobile(sender)?.let { body.put("senderPhone", it) }
                app.enqueue("WhatsApp message", body, hash("$identity|$timestamp|$messageText"))
            }
        }
    }
}

class BusinessCalls : CallScreeningService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onScreenCall(details: Call.Details) {
        val incoming = details.callDirection == Call.Details.DIRECTION_INCOMING
        if (incoming) respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
        val app = applicationContext as ConnectApplication
        if (!app.vault.json("settings").flag("calls")) return
        val address = details.handle?.takeIf { it.scheme == "tel" }?.schemeSpecificPart ?: return
        val number = mobile(address) ?: return
        serviceScope.launch {
            val lead = app.vault.directory().filter { mobile(it.phone) == number || mobile(it.alternate) == number }.singleOrNull() ?: return@launch
            val at = details.creationTimeMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
            val direction = if (incoming) "INBOUND" else "OUTBOUND"
            val body = JSONObject().put("kind", "CALL").put("direction", direction).put("leadId", lead.id).put("number", number)
                .put("outcome", "DETECTED").put("capturedAt", Instant.ofEpochMilli(at).toString())
            app.enqueue("SIM call", body, hash("$direction|$at|" + lead.id))
            showCaller(lead.name, at)
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
