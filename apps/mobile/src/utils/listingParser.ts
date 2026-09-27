/**
 * Intelligent deterministic regex parsing engine for physical property registers
 * Parses commercial listing book rows into structured, typed property records.
 */

import { FloorCode, PropertyCategory } from '../data/gurgaonCatalog';

export interface ParsedListing {
  id: string;
  sector: string;
  sectorCode: string;
  project: string;
  unitNumber: string;
  carpetAreaSqFt: number;
  floor: string;
  floorCode: FloorCode;
  attributes: string[];
  category: PropertyCategory;
  status: string;
  tenancy: string;
  rentalYieldPct?: number;
  price: number;
  priceDisplay: string;
  pricePerSqFt: string;
  contactName: string;
  contactPhone: string;
  cleanPhone: string;
  confidenceScore: number; // 0 - 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  validationErrors: string[];
  imported?: boolean;
  published?: boolean;
  rawLine?: string;
}

const KNOWN_PROJECTS: { name: string; sector: string; sectorCode: string; builder: string }[] = [
  { name: 'SS Omnia', sector: 'Sector 86, New Gurgaon', sectorCode: '86', builder: 'SS Group' },
  { name: 'SS Highpoint', sector: 'Sector 86, New Gurgaon', sectorCode: '86', builder: 'SS Group' },
  { name: 'Signature Signum-88A', sector: 'Sector 88A, New Gurgaon', sectorCode: '88A', builder: 'Signature Global' },
  { name: 'Signature Signum 88A', sector: 'Sector 88A, New Gurgaon', sectorCode: '88A', builder: 'Signature Global' },
  { name: 'Orris Market 89', sector: 'Sector 89, New Gurgaon', sectorCode: '89', builder: 'Orris Infrastructure' },
  { name: 'Orris Market', sector: 'Sector 89, New Gurgaon', sectorCode: '89', builder: 'Orris Infrastructure' },
  { name: 'MRG Bazaar', sector: 'Sector 89, New Gurgaon', sectorCode: '89', builder: 'MRG Group' },
  { name: 'Adani Galleria', sector: 'Sector 89A, New Gurgaon', sectorCode: '89A', builder: 'Adani Realty' },
  { name: 'AIPL Joy District', sector: 'Sector 89A, New Gurgaon', sectorCode: '89A', builder: 'AIPL Group' },
  { name: 'Sapphire Ninety', sector: 'Sector 90, New Gurgaon', sectorCode: '90', builder: 'Ameya Group' },
  { name: 'DLF Regal Garden', sector: 'Sector 90, New Gurgaon', sectorCode: '90', builder: 'DLF India' },
  { name: 'DLF Garden City Commercial', sector: 'Sector 91, New Gurgaon', sectorCode: '91', builder: 'DLF India' },
  { name: 'DLF Garden City', sector: 'Sector 91, New Gurgaon', sectorCode: '91', builder: 'DLF India' },
  { name: 'Spaze Boulevard', sector: 'Sector 91, New Gurgaon', sectorCode: '91', builder: 'Spaze Group' },
  { name: 'Spaze Tristaar', sector: 'Sector 92, New Gurgaon', sectorCode: '92', builder: 'Spaze Group' },
  { name: 'Signature Global Signum 92', sector: 'Sector 92, New Gurgaon', sectorCode: '92', builder: 'Signature Global' },
  { name: 'Signature Global Signum 93', sector: 'Sector 93, New Gurgaon', sectorCode: '93', builder: 'Signature Global' },
  { name: 'MRG Meridian High Street', sector: 'Sector 93, New Gurgaon', sectorCode: '93', builder: 'MRG Group' },
  { name: 'MRG Meridian', sector: 'Sector 93, New Gurgaon', sectorCode: '93', builder: 'MRG Group' },
  { name: 'Lodha World One', sector: 'Worli & Prabhadevi', sectorCode: 'mumbai-luxury', builder: 'Lodha Group' },
  { name: 'Rustomjee Crown', sector: 'Prabhadevi, South Mumbai', sectorCode: 'mumbai-luxury', builder: 'Rustomjee' },
  { name: 'Oberoi Three Sixty West', sector: 'Worli, South Mumbai', sectorCode: 'mumbai-luxury', builder: 'Oberoi Realty' },
];

const KNOWN_CONTACTS = [
  'Deepak',
  'Ashwani',
  'Vineet',
  'Gaurav Kapoor',
  'Gaurav',
  'Sanjay Goyal',
  'Sanjay',
  'Rajesh Singhal',
  'Rajesh Sharma',
  'Rajesh',
  'Amit Sachdeva',
  'Amit',
  'Mohit Chawla',
  'Mohit',
  'Sunita Bansal',
  'Sunita',
  'Harish Mehta',
  'Harish',
];

const SECTOR_RATES: Record<string, number> = {
  '86': 16800,
  '88A': 17500,
  '89': 15900,
  '89A': 16400,
  '90': 18900,
  '91': 15200,
  '92': 14800,
  '93': 15500,
  'mumbai-luxury': 58000,
};

/**
 * Parses a single line from a physical register into a ParsedListing
 */
export function parseRegisterLine(line: string, index = 0): ParsedListing | null {
  const trimmed = line.trim();
  if (
    trimmed.length < 8 ||
    trimmed.startsWith('===') ||
    trimmed.startsWith('---') ||
    trimmed.startsWith('***') ||
    trimmed.toUpperCase().includes('COMMERCIAL PROPERTY REGISTER') ||
    trimmed.toUpperCase().includes('AUTHOR: COMMERCIAL ALLIANCE') ||
    trimmed.toUpperCase().includes('SR | SECTOR') ||
    trimmed.toUpperCase().includes('PAGE ')
  ) {
    return null;
  }

  let confidenceScore = 0;
  const validationErrors: string[] = [];
  const pipeParts = trimmed.split('|').map((s) => s.trim());

  // 1. Sector Extraction
  let sectorCode = '86';
  let sectorFound = false;
  const secRegex = /(?:Sector|Sec\.?|S)[-\s]*([0-9]{2,3}[A-Za-z]?)/i;
  const secMatch = trimmed.match(secRegex);
  if (secMatch) {
    sectorCode = secMatch[1].toUpperCase();
    sectorFound = true;
    confidenceScore += 20;
  } else if (pipeParts.length > 0) {
    const pSec = pipeParts[0].match(/([0-9]{2,3}[A-Za-z]?)/);
    if (pSec) {
      sectorCode = pSec[1].toUpperCase();
      sectorFound = true;
      confidenceScore += 15;
    }
  }

  let sector = `Sector ${sectorCode}, New Gurgaon`;
  if (sectorCode === 'MUMBAI-LUXURY' || /Mumbai|Worli|Prabhadevi/i.test(trimmed)) {
    sectorCode = 'mumbai-luxury';
    sector = 'Worli & Prabhadevi, Mumbai';
    sectorFound = true;
  }

  // 2. Project / Complex Extraction
  let project = 'Commercial Complex';
  let projectFound = false;
  for (const proj of KNOWN_PROJECTS) {
    if (trimmed.toLowerCase().includes(proj.name.toLowerCase())) {
      project = proj.name;
      sector = proj.sector;
      sectorCode = proj.sectorCode;
      projectFound = true;
      confidenceScore += 25;
      break;
    }
  }

  if (!projectFound && pipeParts.length >= 2) {
    // If not matched against known list, take second pipe segment if clean
    const candidate = pipeParts[1].replace(/^(?:Sec|Sector)[-\s]*\w+/i, '').trim();
    if (candidate.length > 2) {
      project = candidate;
      confidenceScore += 15;
    }
  }

  // 3. Unit / Shop Number Extraction
  let unitNumber = '';
  let unitFound = false;
  const unitRegex = /\b(G[- ]?\d+|SCO[- ]?\d+|Shop[- ]?(?:No[- ]?)?\d+|[A-Z][- ]?\d+|SF[- ]?\d+|FF[- ]?\d+|Food[- ]?\d+|LG[- ]?\d+|K[- ]?\d+|Unit[- ]?\d+|Tower[- ]?[A-Z0-9-]+)\b/i;
  const unitMatch = trimmed.match(unitRegex);
  if (unitMatch) {
    unitNumber = unitMatch[1].toUpperCase().replace(/\s+/g, '');
    unitFound = true;
    confidenceScore += 15;
  } else if (pipeParts.length >= 3 && pipeParts[2].length > 0) {
    unitNumber = pipeParts[2].trim().toUpperCase();
    unitFound = true;
    confidenceScore += 10;
  }

  if (!unitNumber) {
    unitNumber = `Shop-${index + 1}`;
    validationErrors.push('Unit number inferred from line sequence');
  }

  // 4. Floor & Attributes
  let floor = 'Ground Floor (GF)';
  let floorCode: FloorCode = 'GF';
  const attributes: string[] = [];

  if (/\b(FF|First\s*Floor)\b/i.test(trimmed)) {
    floor = 'First Floor (FF)';
    floorCode = 'FF';
  } else if (/\b(SF|Second\s*Floor)\b/i.test(trimmed)) {
    floor = 'Second Floor (SF)';
    floorCode = 'SF';
  } else if (/\b(LGF|LG|Lower\s*Ground)\b/i.test(trimmed)) {
    floor = 'Lower Ground Floor (LGF)';
    floorCode = 'LGF';
  } else {
    floor = 'Ground Floor (GF)';
    floorCode = 'GF';
  }

  if (/Corner/i.test(trimmed)) attributes.push('Corner Unit');
  if (/Double\s*Height/i.test(trimmed)) attributes.push('Double Height');
  if (/Front|Facing/i.test(trimmed)) attributes.push('Front Facing');
  if (/Plaza/i.test(trimmed)) attributes.push('Plaza Facing');
  if (/Atrium/i.test(trimmed)) attributes.push('Atrium Facing');
  if (attributes.length === 0) attributes.push('Prime Corridor');

  // 5. Carpet Area in sq.ft
  let carpetAreaSqFt = 450;
  let areaFound = false;
  const areaRegex = /(\d{2,5}(?:\.\d+)?)\s*(?:sq\.?ft|sqft|sq\s*feet|sft)/i;
  const areaMatch = trimmed.match(areaRegex);
  if (areaMatch) {
    carpetAreaSqFt = Math.round(parseFloat(areaMatch[1]));
    areaFound = true;
    confidenceScore += 15;
  } else {
    // Check if any pipe segment is a standalone 3-4 digit number
    for (const part of pipeParts) {
      const numMatch = part.match(/^\s*(\d{3,4})\s*$/);
      if (numMatch) {
        carpetAreaSqFt = parseInt(numMatch[1], 10);
        areaFound = true;
        confidenceScore += 10;
        break;
      }
    }
  }

  if (carpetAreaSqFt < 50 || carpetAreaSqFt > 50000) {
    validationErrors.push(`Area ${carpetAreaSqFt} sq.ft is outside standard commercial range (50-50,000 sq.ft)`);
  }

  // 6. Contact Phone & Name
  let contactPhone = '';
  let cleanPhone = '';
  let phoneFound = false;
  const phoneRegex = /(?:\+91[- ]?)?([6-9]\d{9})\b/;
  const phoneMatch = trimmed.match(phoneRegex);
  if (phoneMatch) {
    cleanPhone = phoneMatch[1];
    contactPhone = cleanPhone;
    phoneFound = true;
    confidenceScore += 25;
  } else {
    validationErrors.push('Missing or invalid 10-digit owner contact phone number');
  }

  let contactName = 'Commercial Broker';
  for (const name of KNOWN_CONTACTS) {
    if (trimmed.toLowerCase().includes(name.toLowerCase())) {
      contactName = name;
      break;
    }
  }
  if (contactName === 'Commercial Broker' && pipeParts.length >= 8) {
    const candidate = pipeParts[pipeParts.length - 2].trim();
    if (candidate.length > 2 && !/\d/.test(candidate)) {
      contactName = candidate;
    }
  }

  // 7. Status & Tenancy
  let status = 'Ready Shop';
  let tenancy = 'Vacant / Immediate Possession';
  let rentalYieldPct: number | undefined = undefined;

  if (/Under\s*Construction|U\/C/i.test(trimmed)) {
    status = 'Under Construction';
    tenancy = 'Under Construction (Possession Soon)';
  } else if (/Pre-Leased|Rented|Furnished\s*Rented/i.test(trimmed)) {
    status = 'Furnished Rented';
    const rentMatch = trimmed.match(/(?:Rented\s*@[^|,\n]*|Pre-Leased[^|,\n]*)/i);
    tenancy = rentMatch ? rentMatch[0].trim() : 'Pre-Leased (ROI Unit)';

    const yieldMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%\s*ROI/i);
    if (yieldMatch) {
      rentalYieldPct = parseFloat(yieldMatch[1]);
    } else {
      rentalYieldPct = 8.5;
    }
  }

  // 8. Category
  let category: PropertyCategory = 'Retail Shops';
  if (unitNumber.includes('SCO') || /SCO/i.test(trimmed)) {
    category = 'SCO Plots';
  } else if (unitNumber.includes('FOOD') || /Food\s*Court/i.test(trimmed)) {
    category = 'Food Court Units';
  } else if (status === 'Furnished Rented' || /ROI|Pre-Leased/i.test(trimmed)) {
    category = 'Pre-Leased Rented (ROI)';
  } else if (/Corporate|Office/i.test(trimmed) || sectorCode === 'mumbai-luxury') {
    category = 'Corporate Offices';
  }

  // 9. Pricing Calculation
  let price = 0;
  let priceDisplay = '';
  // Check for explicit price in line (e.g. ₹65.0 Lakh, ₹3.10 Cr, 1.05 Cr)
  const crMatch = trimmed.match(/₹?\s*(\d+(?:\.\d+)?)\s*Cr\b/i);
  const lakhMatch = trimmed.match(/₹?\s*(\d+(?:\.\d+)?)\s*(?:Lakh|Lac|L)\b/i);

  if (crMatch) {
    price = Math.round(parseFloat(crMatch[1]) * 10000000);
    priceDisplay = `₹ ${parseFloat(crMatch[1]).toFixed(2)} Cr`;
  } else if (lakhMatch) {
    price = Math.round(parseFloat(lakhMatch[1]) * 100000);
    priceDisplay = `₹ ${parseFloat(lakhMatch[1]).toFixed(1)} Lakh`;
  } else {
    const rate = SECTOR_RATES[sectorCode] || 16800;
    price = carpetAreaSqFt * rate;
    priceDisplay = price >= 10000000
      ? `₹ ${(price / 10000000).toFixed(2)} Cr`
      : `₹ ${(price / 100000).toFixed(1)} Lakh`;
  }

  const rateVal = Math.round(price / carpetAreaSqFt);
  const pricePerSqFt = `₹ ${rateVal.toLocaleString('en-IN')} / sq.ft`;

  // Normalize confidence rating
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    confidenceScore >= 85 ? 'HIGH' : confidenceScore >= 65 ? 'MEDIUM' : 'LOW';

  return {
    id: `scan-listing-${index + 1}-${Date.now()}`,
    sector,
    sectorCode,
    project,
    unitNumber,
    carpetAreaSqFt,
    floor,
    floorCode,
    attributes,
    category,
    status,
    tenancy,
    rentalYieldPct,
    price,
    priceDisplay,
    pricePerSqFt,
    contactName,
    contactPhone,
    cleanPhone,
    confidenceScore: Math.min(confidenceScore, 98),
    confidence,
    validationErrors,
    rawLine: trimmed,
  };
}

/**
 * Parses full raw text from register OCR or sample into structured ParsedListing array
 */
export function parseRegisterText(rawText: string): ParsedListing[] {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const results: ParsedListing[] = [];

  for (let i = 0; i < lines.length; i++) {
    const item = parseRegisterLine(lines[i], i);
    if (item) {
      results.push(item);
    }
  }

  return results;
}
