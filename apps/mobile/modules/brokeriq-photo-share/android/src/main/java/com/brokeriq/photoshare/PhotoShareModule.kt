package com.brokeriq.photoshare

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URI

class PhotoShareFileProvider : FileProvider()

class PhotoShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BrokerIQPhotoShare")

    AsyncFunction("sharePhotos") { paths: List<String>, title: String, caption: String ->
      require(paths.size in 1..50)
      val activity = appContext.throwingActivity
      val root = File(activity.cacheDir, "brokeriq-photo-share").canonicalFile
      val streams = ArrayList<Uri>(paths.size)
      for (path in paths) {
        val file = File(URI(path)).canonicalFile
        require(file.parentFile?.parentFile == root && file.isFile && file.length() > 0)
        streams.add(FileProvider.getUriForFile(activity, "${activity.packageName}.PropertyPhotoShare", file))
      }

      val intent = if (streams.size == 1) {
        Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, streams.first())
      } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, streams)
      }
      if (caption.isNotBlank()) intent.putExtra(Intent.EXTRA_TEXT, caption)
      intent.type = "image/*"
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      intent.clipData = ClipData.newUri(activity.contentResolver, title, streams.first()).apply {
        streams.drop(1).forEach { addItem(ClipData.Item(it)) }
      }

      activity.startActivity(Intent.createChooser(intent, title))
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)
  }
}
