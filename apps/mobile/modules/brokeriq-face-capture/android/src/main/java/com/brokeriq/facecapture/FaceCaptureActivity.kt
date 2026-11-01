package com.brokeriq.facecapture

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Size
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.abs

/** Non-exported, FLAG_SECURE camera UI. No gallery fallback and no automatic KYC decision. */
class FaceCaptureActivity : ComponentActivity() {
  companion object {
    private var active: WeakReference<FaceCaptureActivity>? = null
    fun cancelActive() { active?.get()?.let { activity -> activity.runOnUiThread { activity.finish() } } }
  }
  private lateinit var options: CaptureOptions
  private lateinit var root: LinearLayout
  private lateinit var detector: FaceDetector
  private var provider: ProcessCameraProvider? = null
  private var capture: ImageCapture? = null
  private var analyzer: ImageAnalysis? = null
  private var preview: PreviewView? = null
  private var guidance: TextView? = null
  private var shutter: Button? = null
  private val executor = Executors.newSingleThreadExecutor()
  private val gate = PoseGate()
  private val handler = Handler(Looper.getMainLooper())
  private val freshnessCheck = object : Runnable {
    override fun run() {
      if (!foreground) return
      if (!capturing && pending == null && !summary) shutter?.isEnabled = gate.allowed(SystemClock.elapsedRealtime())
      handler.postDelayed(this, 150)
    }
  }
  private val files = arrayOfNulls<File>(3)
  private var pending: File? = null
  private var step = 0
  private var summary = false
  @Volatile private var foreground = false
  private var returned = false
  @Volatile private var capturing = false
  @Volatile private var generation = 0
  @Volatile private var analyzing = false
  private var lastFrame = 0L
  private var lastGuide = ""
  private val pose get() = Pose.entries[step]
  private val main get() = ContextCompat.getMainExecutor(this)
  private val bg get() = if (options.dark) Color.rgb(13, 18, 31) else Color.WHITE
  private val fg get() = if (options.dark) Color.WHITE else Color.rgb(15, 23, 42)
  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
  private fun label(key: String, fallback: String) = options.labels[key] ?: fallback
  private fun poseLabel(index: Int) = label(Pose.entries[index].name, Pose.entries[index].name)

  @Suppress("DEPRECATION")
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    options = intent.getSerializableExtra("options") as? CaptureOptions ?: run { finish(); return }
    if (!options.owner.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { finish(); return }
    active = WeakReference(this)
    root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
    root.setOnApplyWindowInsetsListener { view, insets ->
      view.setPadding(dp(16), insets.systemWindowInsetTop + dp(10), dp(16), insets.systemWindowInsetBottom + dp(10)); insets
    }
    setContentView(root)
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { finish() } })
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      fail("CAMERA_PERMISSION_REQUIRED"); return
    }
    try {
      detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .setMinFaceSize(.15f).enableTracking().build())
    } catch (_: Throwable) { fail("FACE_DETECTOR_UNAVAILABLE"); return }
    state?.getStringArrayList("accepted")?.forEachIndexed { index, path ->
      if (index < 3 && path.isNotEmpty()) ownedFile(path)?.takeIf { it.exists() }?.let { files[index] = it }
    }
    step = (state?.getInt("step") ?: 0).coerceIn(0, 2)
    pending = state?.getString("pending")?.let { ownedFile(it) }?.takeIf { it.exists() }
    summary = files.all { it != null } && pending == null
    render()
  }

  override fun onSaveInstanceState(out: Bundle) {
    out.putStringArrayList("accepted", ArrayList(files.map { it?.absolutePath ?: "" }))
    out.putInt("step", step); out.putString("pending", pending?.absolutePath)
    super.onSaveInstanceState(out)
  }
  override fun onResume() {
    super.onResume(); foreground = true; handler.post(freshnessCheck)
    if (::options.isInitialized && ::detector.isInitialized && pending == null && !summary) startCamera()
  }
  override fun onPause() {
    foreground = false; handler.removeCallbacks(freshnessCheck); capturing = false; stopCamera(requireBlink = true)
    super.onPause()
  }
  override fun onDestroy() {
    stopCamera(); if (::detector.isInitialized) detector.close(); executor.shutdown()
    if (!returned && !isChangingConfigurations) (files.filterNotNull() + listOfNotNull(pending)).toSet().forEach { it.delete() }
    if (active?.get() === this) active = null
    super.onDestroy()
  }

  private fun text(value: String, size: Float = 15f): TextView = TextView(this).apply {
    text = value; textSize = size; setTextColor(fg); setPadding(0, dp(8), 0, dp(8))
  }
  private fun button(value: String, action: () -> Unit): Button = Button(this).apply {
    text = value; isAllCaps = false; setTextColor(Color.WHITE)
    backgroundTintList = ColorStateList.valueOf(Color.rgb(79, 70, 229)); setOnClickListener { action() }
  }
  private fun render() {
    stopCamera()
    root.removeAllViews()
    root.addView(text(label("title", "Face captures"), 21f).apply { setTypeface(typeface, Typeface.BOLD) })
    root.addView(text(label("reviewer", "Your reviewer decides KYC approval. These checks guide photo capture."), 12f))
    root.addView(button(label("cancel", "Cancel")) { finish() })
    if (summary) { renderSummary(); return }
    root.addView(text("${step + 1}/3 · ${poseLabel(step)}", 18f))
    pending?.let { file ->
      root.addView(image(file), LinearLayout.LayoutParams(-1, 0, 1f))
      root.addView(text(label("review", "Check the complete face before accepting.")))
      root.addView(button(label("retake", "Retake")) {
        if (files[step] == file) files[step] = null
        file.delete(); pending = null; gate.reset(); render()
      })
      root.addView(button(label("accept", "Accept capture")) {
        files[step]?.takeIf { it != file }?.delete(); files[step] = file; pending = null
        val missing = files.indexOfFirst { it == null }
        if (missing == -1) summary = true else step = missing
        render()
      })
      return
    }
    preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FIT_CENTER }
    root.addView(preview, LinearLayout.LayoutParams(-1, 0, 1f))
    guidance = text(label("starting", "Starting camera…"))
    root.addView(guidance)
    shutter = button(label("capture", "Capture")) { takePhoto() }.apply { isEnabled = false }
    root.addView(shutter)
    if (foreground) startCamera()
  }
  private fun renderSummary() {
    val scroll = ScrollView(this)
    val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    files.forEachIndexed { index, file ->
      list.addView(text(poseLabel(index), 17f))
      file?.let { list.addView(image(it), LinearLayout.LayoutParams(-1, dp(180))) }
      list.addView(button(label("retake", "Retake") + " · " + poseLabel(index)) {
        files[index]?.delete(); files[index] = null; step = index; summary = false; gate.reset(requireBlink = true); render()
      })
    }
    scroll.addView(list); root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
    root.addView(button(label("finish", "Use all three captures")) {
      if (files.any { it == null || !it.exists() }) { summary = false; step = files.indexOfFirst { it == null || !it.exists() }.coerceAtLeast(0); render(); return@button }
      returned = true
      setResult(Activity.RESULT_OK, Intent().putStringArrayListExtra("paths", ArrayList(files.map { Uri.fromFile(it!!).toString() })))
      finish()
    })
  }
  private fun image(file: File): ImageView = ImageView(this).apply {
    scaleType = ImageView.ScaleType.FIT_CENTER
    contentDescription = label("review", "Captured face preview")
    val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = 2 }) ?: return@apply
    val orientation = ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    val matrix = Matrix().apply {
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
      }
    }
    setImageBitmap(Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true))
  }

  private fun stopCamera(requireBlink: Boolean = false) {
    generation++; analyzer?.clearAnalyzer(); analyzer = null; provider?.unbindAll(); capture = null
    gate.reset(requireBlink); shutter?.isEnabled = false
  }
  @Suppress("DEPRECATION")
  private fun startCamera() {
    if (!foreground || isFinishing || pending != null || summary || preview == null || capture != null) return
    val epoch = generation
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({
      if (!foreground || isFinishing || epoch != generation || capture != null) return@addListener
      try {
        provider = future.get()
        val live = Preview.Builder().build().also { it.setSurfaceProvider(preview!!.surfaceProvider) }
        capture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).setTargetResolution(Size(960, 1280)).build()
        analyzer = ImageAnalysis.Builder().setTargetResolution(Size(640, 480)).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
        analyzer!!.setAnalyzer(executor) { frame -> analyze(frame, epoch) }
        provider!!.unbindAll()
        provider!!.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, live, capture, analyzer)
      } catch (_: Throwable) { fail("CAMERA_START_FAILED") }
    }, main)
  }
  @androidx.camera.core.ExperimentalGetImage
  private fun analyze(frame: ImageProxy, epoch: Int) {
    val at = SystemClock.elapsedRealtime()
    val source = frame.image
    if (!foreground || isFinishing || source == null || epoch != generation || capturing || analyzing || at - lastFrame < 100) { frame.close(); return }
    analyzing = true; lastFrame = at
    val width = if (frame.imageInfo.rotationDegrees % 180 == 0) frame.width else frame.height
    val height = if (frame.imageInfo.rotationDegrees % 180 == 0) frame.height else frame.width
    try { detector.process(InputImage.fromMediaImage(source, frame.imageInfo.rotationDegrees))
      .addOnSuccessListener(main) { faces ->
        if (!foreground || isFinishing || epoch != generation || capturing) return@addOnSuccessListener
        val face = faces.singleOrNull()
        val centered = face?.let { centered(it, width, height) } ?: false
        gate.observe(pose, faces.size, face?.headEulerAngleY ?: Float.NaN, face?.headEulerAngleZ ?: Float.NaN, face?.leftEyeOpenProbability, face?.rightEyeOpenProbability, centered, at)
        val allowed = gate.allowed(SystemClock.elapsedRealtime())
        shutter?.isEnabled = allowed
        val guide = when {
          faces.size > 1 -> label("oneFace", "Only one face should be visible")
          faces.isEmpty() || !centered -> label("center", "Place your complete face in the camera")
          !gate.blinkComplete -> label("blink", "Look straight and blink once")
          allowed -> label("ready", "Ready — capture now")
          else -> label(pose.name, pose.name) + " · " + label("hold", "Hold still")
        }
        if (guide != lastGuide) { lastGuide = guide; guidance?.text = guide }
      }
      .addOnFailureListener(main) { if (epoch == generation) { gate.reset(requireBlink = true); shutter?.isEnabled = false; guidance?.text = label("detectionFailed", "Face detection failed. Retry or cancel.") } }
      .addOnCompleteListener { analyzing = false; frame.close() }
    } catch (_: Throwable) {
      analyzing = false; frame.close()
      main.execute { if (epoch == generation) fail("FACE_DETECTOR_UNAVAILABLE") }
    }
  }
  private fun centered(face: Face, width: Int, height: Int): Boolean {
    val box = face.boundingBox
    return box.width() >= 100 && box.height() >= 100 && box.left >= 0 && box.top >= 0 && box.right <= width && box.bottom <= height && box.centerX() in (width * .2f).toInt()..(width * .8f).toInt()
  }
  private fun takePhoto() {
    if (!foreground || capturing || !gate.allowed(SystemClock.elapsedRealtime())) return
    val camera = capture ?: return
    val epoch = generation
    val selectedPose = pose
    capturing = true; shutter?.isEnabled = false
    val owner = MessageDigest.getInstance("SHA-256").digest(options.owner.toByteArray()).joinToString("") { "%02x".format(it) }
    val directory = File(cacheDir, "brokeriq-kyc-captures/$owner").apply { mkdirs() }
    val file = File(directory, "${UUID.randomUUID()}_${selectedPose.name}.jpg")
    try { camera.takePicture(ImageCapture.OutputFileOptions.Builder(file).build(), main, object : ImageCapture.OnImageSavedCallback {
      override fun onError(error: ImageCaptureException) { file.delete(); capturing = false; gate.reset(); guidance?.text = label("captureFailed", "Capture failed. Please retry.") }
      override fun onImageSaved(result: ImageCapture.OutputFileResults) {
        if (!foreground || isFinishing || epoch != generation) { file.delete(); capturing = false; return }
        try {
          val input = InputImage.fromFilePath(this@FaceCaptureActivity, Uri.fromFile(file))
          detector.process(input).addOnSuccessListener(main) { faces ->
            val face = faces.singleOrNull()
            if (!foreground || isFinishing || epoch != generation || face == null || !centered(face, if (input.rotationDegrees % 180 == 0) input.width else input.height, if (input.rotationDegrees % 180 == 0) input.height else input.width) || !PoseGate.poseMatches(selectedPose, face.headEulerAngleY, face.headEulerAngleZ)) {
              file.delete(); capturing = false; gate.reset(); guidance?.text = label("moved", "Face moved during capture. Please retry."); return@addOnSuccessListener
            }
            capturing = false; pending = file; render()
          }.addOnFailureListener(main) { file.delete(); capturing = false; gate.reset(); guidance?.text = label("captureFailed", "Capture failed. Please retry.") }
        } catch (_: Throwable) { file.delete(); capturing = false; gate.reset() }
      }
    }) } catch (_: Throwable) { file.delete(); capturing = false; gate.reset(); guidance?.text = label("captureFailed", "Capture failed. Please retry.") }
  }
  private fun ownedFile(path: String): File? = try {
    val file = File(path).canonicalFile
    val owner = MessageDigest.getInstance("SHA-256").digest(options.owner.toByteArray()).joinToString("") { "%02x".format(it) }
    val root = File(cacheDir, "brokeriq-kyc-captures/$owner").canonicalFile
    if (file.parentFile == root && file.name.matches(Regex("[a-f0-9-]+_(STRAIGHT|LEFT|RIGHT)\\.jpg"))) file else null
  } catch (_: Exception) { null }
  private fun fail(code: String) { setResult(Activity.RESULT_CANCELED, Intent().putExtra("error", code)); finish() }
}
