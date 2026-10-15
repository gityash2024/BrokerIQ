import Foundation
import Vision
import PDFKit
import AppKit

// Offline OCR with geometry. Raw source and candidates are retained; this never declares data verified.
struct Box: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
struct PageResult: Codable {
    let pageNo: Int
    let width: Int
    let height: Int
    let boxes: [Box]
    let marginBoxes: [Box]
}
let args = CommandLine.arguments
if args.count < 3 { fatalError("Usage: swift vision-ocr.swift <source.pdf> <private-output-directory> [first-page] [last-page]") }
let source = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
guard let pdf = PDFDocument(url: source) else { fatalError("PDF could not be opened") }
let first = args.count > 3 ? Int(args[3])! : 1
let last = args.count > 4 ? Int(args[4])! : pdf.pageCount
func recognize(_ image: CGImage, roi: CGRect? = nil) throws -> [Box] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US"]
    request.minimumTextHeight = 0.003
    if let roi = roi { request.regionOfInterest = roi }
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    return (request.results ?? []).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let b = observation.boundingBox
        return Box(text: candidate.string, confidence: candidate.confidence,
                   x: Double((roi?.minX ?? 0) + b.minX * (roi?.width ?? 1)),
                   y: Double((roi.map { 1 - $0.maxY } ?? 0) + (1 - b.maxY) * (roi?.height ?? 1)),
                   width: Double(b.width * (roi?.width ?? 1)), height: Double(b.height * (roi?.height ?? 1)))
    }
}
for number in first...min(last, pdf.pageCount) {
    try autoreleasepool {
        let jsonPath = output.appendingPathComponent(String(format: "page-%03d.json", number))
        if FileManager.default.fileExists(atPath: jsonPath.path) { print("Page \(number): already captured"); return }
        guard let page = pdf.page(at: number - 1) else { throw NSError(domain: "PDF", code: number) }
        let bounds = page.bounds(for: .mediaBox)
        let scale = 200.0 / 72.0
        let w = Int(bounds.width * scale), h = Int(bounds.height * scale)
        guard let context = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw NSError(domain: "Render", code: number) }
        context.setFillColor(NSColor.white.cgColor); context.fill(CGRect(x: 0, y: 0, width: w, height: h))
        context.scaleBy(x: scale, y: scale); page.draw(with: .mediaBox, to: context)
        guard let image = context.makeImage() else { throw NSError(domain: "Render", code: number) }
        let bitmap = NSBitmapImageRep(cgImage: image)
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(String(format: "page-%03d.png", number)), options: .atomic)
        let boxes = try recognize(image)
        // A second independent OCR pass isolates the handwritten house-number column.
        let margin = try recognize(image, roi: CGRect(x: 0, y: 0.025, width: 0.22, height: 0.875))
        let result = PageResult(pageNo: number, width: w, height: h, boxes: boxes, marginBoxes: margin)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(result).write(to: jsonPath, options: .atomic)
        print("Page \(number)/\(pdf.pageCount): \(boxes.count) observations; \(margin.count) margin observations")
        fflush(stdout)
    }
}
