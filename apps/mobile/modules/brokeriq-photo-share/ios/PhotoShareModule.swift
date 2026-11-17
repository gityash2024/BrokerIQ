import ExpoModulesCore
import UIKit

private final class PhotoShareException: Exception {
  override var reason: String { "Unable to open the photo share sheet." }
}

public final class PhotoShareModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BrokerIQPhotoShare")

    AsyncFunction("sharePhotos") { (paths: [String], title: String, caption: String, promise: Promise) in
      let files = FileManager.default
      let root = try files.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
        .appendingPathComponent("brokeriq-photo-share").resolvingSymlinksInPath().path
      let urls = paths.compactMap { URL(string: $0)?.resolvingSymlinksInPath() }
      guard (1...50).contains(paths.count), urls.count == paths.count,
        urls.allSatisfy({ $0.isFileURL && $0.deletingLastPathComponent().deletingLastPathComponent().path == root
          && files.isReadableFile(atPath: $0.path) }),
        let presenter = self.appContext?.utilities?.currentViewController()
      else { throw PhotoShareException() }

      var items: [Any] = urls
      if !caption.isEmpty { items.append(caption) }
      let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
      sheet.title = title
      sheet.completionWithItemsHandler = { _, _, _, _ in promise.resolve(nil) }
      sheet.popoverPresentationController?.sourceView = presenter.view
      sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
      presenter.present(sheet, animated: true)
    }.runOnQueue(.main)
  }
}
