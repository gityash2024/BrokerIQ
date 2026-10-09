import Foundation
import Vision
import AppKit

struct InventoryOutput: Codable {
    let sector: String
    let houseNo: String
    let ownerPhone: String?
    let ownerName: String?
    let propertyType: String
    let purpose: String
    let bhk: Int?
    let floor: String?
    let furnishing: String?
    let rent: Double?
    let securityDeposit: Double?
    let brokerage: String?
    let tenantPreference: String?
    let amenities: [String]
    let notes: String
    let status: String
    let pageNo: Int
    let date: String
}

struct OCRItem {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

let SECTOR_MAP: [(start: Int, end: Int, sector: String)] = [
    (1, 8, "Sector 43"),
    (9, 10, "Sector 47"),
    (11, 15, "Sector 27"),
    (16, 16, "Sector 28"),
    (17, 17, "Sector 43"),
    (18, 27, "Sushant Lok 1"),
    (28, 33, "Sector 40"),
    (34, 46, "Sector 57"),
    (47, 49, "Sector 56"),
    (50, 52, "Sector 42"),
    (53, 70, "Sector 46"),
    (71, 78, "Sector 38"),
    (79, 81, "Sector 30"),
    (82, 84, "Sector 41"),
    (85, 86, "Sector 40"),
    (87, 87, "Mohyal Colony"),
    (88, 99, "Sector 45"),
    (100, 102, "Sector 39"),
    (103, 113, "Sector 31"),
    (114, 116, "Sector 52-A"),
    (117, 117, "Sector 51")
]

func defaultSector(for page: Int) -> String {
    for s in SECTOR_MAP {
        if page >= s.start && page <= s.end {
            return s.sector
        }
    }
    return "Sector 43"
}

func parsePhoneAndHouse(line: String, firstToken: String?) -> (phone: String?, house: String?) {
    var detectedPhone: String? = nil
    var detectedHouse: String? = nil
    
    // Check if phone matches anywhere
    // Common phone regex: 10 digits starting with 6, 7, 8, or 9
    let phonePattern = #"(?:^|[^\d])([6-9]\d{9})(?:[^\d]|$)"#
    if let rx = try? NSRegularExpression(pattern: phonePattern) {
        let ns = line as NSString
        if let match = rx.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) {
            detectedPhone = ns.substring(with: match.range(at: 1))
        }
    }
    
    // Check for combined house and phone like "57809811139388" (4 digit house + 10 digit phone)
    let combinedPattern = #"^(\d{1,5})([6-9]\d{9})"#
    if let rx = try? NSRegularExpression(pattern: combinedPattern) {
        let ns = line as NSString
        if let match = rx.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) {
            detectedHouse = ns.substring(with: match.range(at: 1))
            detectedPhone = ns.substring(with: match.range(at: 2))
        }
    }
    
    if detectedHouse == nil {
        if let ft = firstToken {
            let clean = ft.trimmingCharacters(in: CharacterSet(charactersIn: " -:.,|[]()"))
            // If first token is a house number (digits, or e.g. 125A, G-322)
            if clean.range(of: #"^[A-Za-z]?[-]?\d{1,5}[A-Za-z]?$"#, options: .regularExpression) != nil {
                detectedHouse = clean
            }
        }
    }
    
    // If first token had house followed by dash: e.g. "1167 - 9810102198"
    if detectedHouse == nil {
        let houseRegex = #"^([A-Za-z]?[-]?\d{1,5}[A-Za-z]?)\s*[-:]"#
        if let rx = try? NSRegularExpression(pattern: houseRegex) {
            let ns = line as NSString
            if let match = rx.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) {
                detectedHouse = ns.substring(with: match.range(at: 1))
            }
        }
    }
    
    return (detectedPhone, detectedHouse)
}

func parseBhk(from text: String) -> Int? {
    let lower = text.lowercased()
    let rx = try? NSRegularExpression(pattern: #"(\d+)\s*(?:bhk|bed|b\b)"#)
    let ns = lower as NSString
    if let m = rx?.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)) {
        return Int(ns.substring(with: m.range(at: 1)))
    }
    if lower.contains("1 rk") || lower.contains("1rk") || lower.contains("studio") { return 1 }
    if lower.contains("2 rk") || lower.contains("2rk") { return 2 }
    if lower.contains("3 rk") || lower.contains("3rk") { return 3 }
    if lower.contains("4 rk") || lower.contains("4rk") { return 4 }
    if lower.contains("16room") { return 16 }
    return nil
}

func parseFloor(from text: String) -> String? {
    let lower = text.lowercased()
    if lower.range(of: #"\b(?:gf|ground)\b"#, options: .regularExpression) != nil { return "GF" }
    if lower.range(of: #"\b(?:ff|1st|first)\b"#, options: .regularExpression) != nil { return "FF" }
    if lower.range(of: #"\b(?:sf|2nd|second)\b"#, options: .regularExpression) != nil { return "SF" }
    if lower.range(of: #"\b(?:3rd|third)\b"#, options: .regularExpression) != nil { return "3rd" }
    if lower.range(of: #"\b(?:4th|fourth)\b"#, options: .regularExpression) != nil { return "4th" }
    if lower.range(of: #"\b(?:tf|top)\b"#, options: .regularExpression) != nil { return "TF" }
    if lower.contains("basement") { return "Basement" }
    return nil
}

func parseFurnishing(from text: String) -> String? {
    let lower = text.lowercased()
    if lower.contains("ffd") || lower.contains("fully") || lower.contains("full") { return "FULLY_FURNISHED" }
    if lower.contains("sfd") || lower.contains("semi") { return "SEMI_FURNISHED" }
    if lower.contains("unf") || lower.contains("unfurnished") || lower.contains("raw") { return "UNFURNISHED" }
    return nil
}

func parsePrice(from text: String) -> Double? {
    let lower = text.lowercased()
    
    // Check Crores: e.g. 1.75 cr, 1.60cr, @2cr
    if let rx = try? NSRegularExpression(pattern: #"@?\s*(\d+(?:\.\d+)?)\s*cr"#) {
        let ns = lower as NSString
        if let m = rx.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)) {
            if let val = Double(ns.substring(with: m.range(at: 1))) {
                return val * 10_000_000
            }
        }
    }
    
    // Check Lakhs: e.g. 3 lakh, 3.5 lac, @3lakh
    if let rx = try? NSRegularExpression(pattern: #"@?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)"#) {
        let ns = lower as NSString
        if let m = rx.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)) {
            if let val = Double(ns.substring(with: m.range(at: 1))) {
                return val * 100_000
            }
        }
    }
    
    // Check Thousands with 'k': e.g. @40k, 22k, @16k, 30 k
    if let rx = try? NSRegularExpression(pattern: #"@?\s*(\d+(?:\.\d+)?)\s*k\b"#) {
        let ns = lower as NSString
        if let m = rx.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)) {
            if let val = Double(ns.substring(with: m.range(at: 1))) {
                return val * 1_000
            }
        }
    }
    
    // Check direct numbers like 15000, 22000, 42000, 35000 (>= 8000 and <= 500000)
    if let rx = try? NSRegularExpression(pattern: #"\b([1-9]\d{4,5})\b"#) {
        let ns = lower as NSString
        let matches = rx.matches(in: lower, range: NSRange(location: 0, length: ns.length))
        for m in matches {
            let str = ns.substring(with: m.range(at: 1))
            if let val = Double(str), val >= 8000 && val <= 500_000 {
                return val
            }
        }
    }
    
    return nil
}

func parseName(from text: String) -> String? {
    // Look for common name prefixes like Mr., Mrs., Dr. or standalone names
    if let rx = try? NSRegularExpression(pattern: #"(?:mr\.?|mrs\.?)\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)"#, options: .caseInsensitive) {
        let ns = text as NSString
        if let m = rx.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) {
            return ns.substring(with: m.range(at: 0))
        }
    }
    // Check common Indian names
    let commonNames = ["Chandan", "Bahadur", "Sanjay", "Anil", "Satish", "Sudhir", "Rohit", "Harish", "Kapoor", "Sharma", "Verma", "Malhotra", "Gupta", "Yadav", "Singh", "Aggarwal", "Manoj", "Rajesh", "Pooja", "Amit", "Vikas", "Suresh"]
    for n in commonNames {
        if text.localizedCaseInsensitiveContains(n) {
            return n
        }
    }
    return nil
}

func parseTenantPref(from text: String) -> String? {
    let lower = text.lowercased()
    if lower.contains("fly") || lower.contains("family") { return "Family" }
    if lower.contains("girls") || lower.contains("female") { return "Girls PG / Female" }
    if lower.contains("boys") || lower.contains("bachelor") { return "PG / Bachelors" }
    if lower.contains("anyone") || lower.contains("any") || lower.contains("all") { return "Anyone" }
    return nil
}

func parseBrokerage(from text: String) -> String? {
    let lower = text.lowercased()
    if let rx = try? NSRegularExpression(pattern: #"\b(\d+\s*d)\b"#) {
        let ns = lower as NSString
        if let m = rx.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)) {
            return ns.substring(with: m.range(at: 1)).uppercased()
        }
    }
    if lower.contains("1m") || lower.contains("1 month") { return "1M" }
    return nil
}

func extractPages() {
    var allItems: [InventoryOutput] = []
    
    var currentSector = "Sector 43"
    
    for p in 1...117 {
        let path = String(format: "/Users/yashjangid/Desktop/BrokerIQ/all_pages/page-%03d.png", p)
        guard let image = NSImage(contentsOfFile: path),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            continue
        }
        
        let defSec = defaultSector(for: p)
        currentSector = defSec
        
        var items: [OCRItem] = []
        let req = VNRecognizeTextRequest { req, _ in
            guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
            for o in obs {
                if let top = o.topCandidates(1).first {
                    items.append(OCRItem(text: top.string, x: Double(o.boundingBox.origin.x), y: Double(o.boundingBox.origin.y), w: Double(o.boundingBox.size.width), h: Double(o.boundingBox.size.height)))
                }
            }
        }
        req.recognitionLevel = .accurate
        req.usesLanguageCorrection = true
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try? handler.perform([req])
        
        // Sort items top-to-bottom
        items.sort { $0.y > $1.y }
        
        // Group into lines by Y distance <= 0.025
        var lines: [[OCRItem]] = []
        for it in items {
            var placed = false
            for i in 0..<lines.count {
                let avgY = lines[i].reduce(0.0) { $0 + $1.y } / Double(lines[i].count)
                if abs(it.y - avgY) < 0.025 {
                    lines[i].append(it)
                    placed = true
                    break
                }
            }
            if !placed {
                lines.append([it])
            }
        }
        
        var pageDate = "2026-10-09T00:00:00.000Z"
        // Check first 3 lines for sector name or date
        for r in lines.prefix(3) {
            let lineText = r.map { $0.text }.joined(separator: " ")
            // Check for sector
            if let rx = try? NSRegularExpression(pattern: #"(?:sec(?:tor)?|see)\s*[-:]?\s*(\d{1,2}[A-Za-z]?)"#, options: .caseInsensitive) {
                let ns = lineText as NSString
                if let m = rx.firstMatch(in: lineText, range: NSRange(location: 0, length: ns.length)) {
                    let secNum = ns.substring(with: m.range(at: 1))
                    currentSector = "Sector \(secNum)"
                }
            }
            if lineText.localizedCaseInsensitiveContains("Sushant Lok") {
                currentSector = "Sushant Lok 1"
            }
            
            // Check for date: e.g. 22/10/21 or 22-10-2021
            if let rx = try? NSRegularExpression(pattern: #"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})"#) {
                let ns = lineText as NSString
                if let m = rx.firstMatch(in: lineText, range: NSRange(location: 0, length: ns.length)) {
                    let d = ns.substring(with: m.range(at: 1))
                    let mo = ns.substring(with: m.range(at: 2))
                    var yr = ns.substring(with: m.range(at: 3))
                    if yr.count == 2 { yr = "20" + yr }
                    if let dInt = Int(d), let mInt = Int(mo), dInt >= 1 && dInt <= 31 && mInt >= 1 && mInt <= 12 {
                        pageDate = String(format: "%@-%02d-%02dT00:00:00.000Z", yr, mInt, dInt)
                    }
                }
            }
        }
        
        var pageExtractedCount = 0
        for (lineIdx, row) in lines.enumerated() {
            // Skip top 2 lines if they are pure headers (contain "Date", "Saathi", "Sector", "Sal Date")
            let sortedRow = row.sorted { $0.x < $1.x }
            let fullLine = sortedRow.map { $0.text }.joined(separator: " - ")
            
            if lineIdx < 3 && (fullLine.localizedCaseInsensitiveContains("saathi") || fullLine.localizedCaseInsensitiveContains("page no") || fullLine.localizedCaseInsensitiveContains("sal date")) {
                continue
            }
            if fullLine.count < 3 { continue }
            
            let firstToken = sortedRow.first?.text
            let (phone, house) = parsePhoneAndHouse(line: fullLine, firstToken: firstToken)
            
            // If neither phone nor house nor price is present, skip noisy non-property lines
            let price = parsePrice(from: fullLine)
            let bhk = parseBhk(from: fullLine)
            let floor = parseFloor(from: fullLine)
            let furnishing = parseFurnishing(from: fullLine)
            let ownerName = parseName(from: fullLine) ?? "Owner"
            let tenantPref = parseTenantPref(from: fullLine)
            let brokerage = parseBrokerage(from: fullLine)
            
            let isSale = fullLine.localizedCaseInsensitiveContains("sale") || fullLine.localizedCaseInsensitiveContains("सेल") || (price != nil && price! > 5_000_000)
            let purpose = isSale ? "SALE" : "RENT"
            
            var propType = "BUILDER_FLOOR"
            if fullLine.localizedCaseInsensitiveContains("plot") { propType = "RESIDENTIAL_PLOT" }
            else if fullLine.localizedCaseInsensitiveContains("pg") { propType = "PG" }
            else if (bhk == 1 && fullLine.localizedCaseInsensitiveContains("rk")) || fullLine.localizedCaseInsensitiveContains("studio") { propType = "STUDIO" }
            
            let houseNo = house ?? "--"
            
            // If the row has at least a house number OR a phone number OR a price, it's a valid property entry
            if houseNo != "--" || phone != nil || price != nil {
                let item = InventoryOutput(
                    sector: currentSector,
                    houseNo: houseNo,
                    ownerPhone: phone,
                    ownerName: ownerName,
                    propertyType: propType,
                    purpose: purpose,
                    bhk: bhk,
                    floor: floor,
                    furnishing: furnishing,
                    rent: price,
                    securityDeposit: price != nil && !isSale ? (price! * 2) : nil,
                    brokerage: brokerage ?? (price != nil ? "15D" : nil),
                    tenantPreference: tenantPref,
                    amenities: fullLine.localizedCaseInsensitiveContains("lift") ? ["Lift"] : [],
                    notes: String(fullLine.prefix(160)),
                    status: "ACTIVE", // Per user instruction: all entries active
                    pageNo: p,
                    date: pageDate
                )
                allItems.append(item)
                pageExtractedCount += 1
            }
        }
        
        print("Page \(p) (\(currentSector)): extracted \(pageExtractedCount) items")
    }
    
    // Save to all_117_apple_vision_items.json
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let data = try? encoder.encode(allItems) {
        let outUrl = URL(fileURLWithPath: "/Users/yashjangid/Desktop/BrokerIQ/all_117_apple_vision_items.json")
        try? data.write(to: outUrl)
        print("\n🎉 SUCCESSFULLY EXTRACTED \(allItems.count) HIGH-PRECISION INVENTORY ITEMS FROM ALL 117 PAGES!")
    }
}

extractPages()
