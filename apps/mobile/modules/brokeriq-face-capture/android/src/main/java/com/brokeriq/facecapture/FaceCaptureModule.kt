package com.brokeriq.facecapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.Serializable
import java.net.URI

data class CaptureOptions(val owner: String, val labels: HashMap<String, String>, val dark: Boolean) : Serializable
data class CaptureResult(val owner: String, val paths: List<String> = emptyList(), val error: String? = null) {
  fun value(): Map<String, Any?> = mapOf("owner" to owner, "canceled" to paths.isEmpty(), "paths" to paths, "error" to error, "engine" to "mlkit-face-detection-16.1.7")
}
class CaptureContract : AppContextActivityResultContract<CaptureOptions, CaptureResult> {
  override fun createIntent(context: Context, input: CaptureOptions) = Intent(context, FaceCaptureActivity::class.java).putExtra("options", input)
  override fun parseResult(input: CaptureOptions, resultCode: Int, intent: Intent?): CaptureResult =
    if (resultCode == Activity.RESULT_OK) CaptureResult(input.owner, intent?.getStringArrayListExtra("paths") ?: emptyList())
    else CaptureResult(input.owner, error = intent?.getStringExtra("error"))
}

class FaceCaptureModule : Module() {
  private lateinit var launcher: AppContextActivityResultLauncher<CaptureOptions, CaptureResult>
  private var pending: CaptureResult? = null
  private var running = false

  override fun definition() = ModuleDefinition {
    Name("BrokerIQFaceCapture")
    RegisterActivityContracts {
      launcher = registerForActivityResult(CaptureContract()) { _, result -> pending = result }
    }
    AsyncFunction("capture") Coroutine { owner: String, labels: Map<String, String>, dark: Boolean ->
      require(owner.matches(Regex("[A-Za-z0-9_-]{1,64}")))
      check(!running) { "A capture is already open" }
      running = true
      pending = null
      try {
        val result = launcher.launch(CaptureOptions(owner, HashMap(labels), dark))
        pending = null
        result.value()
      }
      finally { running = false }
    }
    AsyncFunction("pending") { owner: String ->
      val result = pending?.takeIf { it.owner == owner }
      if (result != null) pending = null
      result?.value()
    }
    AsyncFunction("cancel") { FaceCaptureActivity.cancelActive() }
    AsyncFunction("discard") { paths: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val root = File(context.cacheDir, "brokeriq-kyc-captures").canonicalFile
      for (path in paths.take(6)) {
        try {
          val uri = URI(path)
          val file = File(uri).canonicalFile
          if (uri.scheme == "file" && file.path.startsWith(root.path + File.separator) && file.name.matches(Regex("[a-f0-9-]+_(STRAIGHT|LEFT|RIGHT)\\.jpg"))) file.delete()
        } catch (_: Exception) { /* Only files created by this module may be discarded. */ }
      }
    }
  }
}
