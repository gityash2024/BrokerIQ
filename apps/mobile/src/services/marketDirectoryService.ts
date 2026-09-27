/**
 * Market Directory & Scan Extraction Hybrid Service
 * 
 * Provides hybrid data fetching connecting to the local NestJS backend at
 * http://10.0.2.2:3000/api (or http://localhost:3000/api) with transparent,
 * fail-safe fallback to the offline bundled catalog (gurgaonCatalog.ts)
 * and client-side deterministic regex parser (listingParser.ts).
 */

import { apiClient } from '../api/client';
import {
  GURGAON_PROPERTIES,
  GURGAON_SECTORS,
  GURGAON_SAMPLE_REGISTER_TEXT,
  MarketProperty,
  SectorData,
  PropertyCategory,
  FloorCode,
} from '../data/gurgaonCatalog';
import { ParsedListing, parseRegisterText } from '../utils/listingParser';

export interface MarketDirectoryQueryParams {
  sector?: string;
  category?: string;
  floor?: string;
  search?: string;
}

export interface MarketDirectorySummary {
  totalProperties: number;
  totalSectors: number;
  totalProjects?: number;
  avgRatePerSqFt: number;
  avgRateDisplay: string;
  rentalYieldRange: {
    min: number;
    max: number;
    label: string;
  };
  activeUnitsCount: number;
}

export interface MarketDirectoryResult {
  success: boolean;
  isLive: boolean;
  source: 'live_backend' | 'offline_cache';
  summary: MarketDirectorySummary;
  sectors: SectorData[];
  properties: MarketProperty[];
  timestamp?: string;
}

export interface ScanExtractDto {
  rawText?: string;
  imageBase64?: string;
  sampleId?: string;
}

export interface ScanExtractResult {
  success: boolean;
  isLive: boolean;
  source: string;
  confidenceScore: number;
  totalExtracted: number;
  rawText?: string;
  items: ParsedListing[];
}

/**
 * Client-side parsing fallback using deterministic regex parser
 */
export const parseListingLines = (text?: string): ParsedListing[] => {
  if (!text || !text.trim()) {
    return parseRegisterText(GURGAON_SAMPLE_REGISTER_TEXT);
  }
  return parseRegisterText(text);
};

/**
 * Normalizes backend property objects to adhere to the strict MarketProperty interface
 */
function normalizeBackendProperty(it: any): MarketProperty {
  const cleanPhone = (it.cleanPhone || it.contactPhone || '').replace(/\D/g, '');
  const rateVal = it.pricePerSqFt || (it.carpetAreaSqFt && it.price ? Math.round(it.price / it.carpetAreaSqFt) : 16800);
  const priceDisplay = it.priceDisplay || (it.price >= 10000000
    ? `₹ ${(it.price / 10000000).toFixed(2)} Cr`
    : `₹ ${(it.price / 100000).toFixed(1)} Lakh`);

  return {
    id: it.id || `prop-${it.unitNumber || 'unit'}-${Date.now()}`,
    sector: it.sector || 'Sector 86, New Gurgaon',
    sectorCode: it.sectorCode || '86',
    project: it.project || 'SS Omnia',
    unitNumber: it.unitNumber || 'G80',
    carpetAreaSqFt: it.carpetAreaSqFt || 500,
    floor: it.floor || 'Ground Floor (GF)',
    floorCode: (it.floorCode as FloorCode) || 'GF',
    attributes: Array.isArray(it.attributes) ? it.attributes : ['Corner Unit'],
    category: (it.category as PropertyCategory) || 'Retail Shops',
    status: it.status || 'Ready Shop',
    tenancy: it.tenancy || 'Vacant / Ready to Move',
    rentalYieldPct: it.rentalYield || it.rentalYieldPct || 8.5,
    price: it.price || 7500000,
    priceDisplay,
    pricePerSqFt: it.pricePerSqFtDisplay || `₹ ${rateVal.toLocaleString('en-IN')} / sq.ft`,
    contactName: it.contactName || 'Deepak',
    contactPhone: it.contactPhone || '9899248292',
    cleanPhone: cleanPhone.length === 10 ? cleanPhone : '9899248292',
    notes: it.notes || (Array.isArray(it.infrastructureHighlights) ? it.infrastructureHighlights.join(' • ') : undefined),
  };
}

/**
 * Filters the offline bundled catalog based on query parameters with dynamic analytics
 */
export function filterLocalCatalog(
  params?: MarketDirectoryQueryParams,
  catalog: MarketProperty[] = GURGAON_PROPERTIES
): {
  properties: MarketProperty[];
  sectors: SectorData[];
  summary: MarketDirectorySummary;
} {
  const filtered = catalog.filter((prop) => {
    // Sector filter
    if (params?.sector && params.sector !== 'all') {
      const pSec = prop.sectorCode.toLowerCase();
      const qSec = params.sector.toLowerCase().replace(/^sec-?/, '');
      if (pSec !== qSec && !prop.sector.toLowerCase().includes(qSec)) {
        return false;
      }
    }

    // Category filter
    if (params?.category && params.category !== 'All') {
      if (prop.category !== params.category) {
        return false;
      }
    }

    // Floor filter
    if (params?.floor && params.floor !== 'All') {
      if (params.floor === 'Corner') {
        if (!prop.attributes.includes('Corner') && !prop.attributes.includes('Corner Unit') && prop.floorCode !== 'Corner') {
          return false;
        }
      } else if (prop.floorCode !== params.floor) {
        return false;
      }
    }

    // Search query
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      const matchesProject = prop.project.toLowerCase().includes(q);
      const matchesUnit = prop.unitNumber.toLowerCase().includes(q);
      const matchesSector = prop.sector.toLowerCase().includes(q);
      const matchesContact = prop.contactName.toLowerCase().includes(q);
      const matchesPhone = prop.contactPhone.includes(q) || prop.cleanPhone.includes(q);
      const matchesTenancy = prop.tenancy.toLowerCase().includes(q);

      if (
        !matchesProject &&
        !matchesUnit &&
        !matchesSector &&
        !matchesContact &&
        !matchesPhone &&
        !matchesTenancy
      ) {
        return false;
      }
    }

    return true;
  });

  // Calculate dynamic financial metrics
  const totalArea = filtered.reduce((sum, p) => sum + p.carpetAreaSqFt, 0);
  const totalPrice = filtered.reduce((sum, p) => sum + p.price, 0);
  const avgRatePerSqFt = totalArea > 0 ? Math.round(totalPrice / totalArea) : 17200;

  const yields = filtered.map((p) => p.rentalYieldPct || 8.5).filter(Boolean);
  const minYield = yields.length > 0 ? Math.min(...yields) : 7.5;
  const maxYield = yields.length > 0 ? Math.max(...yields) : 9.2;

  const uniqueSectors = new Set(filtered.map((p) => p.sectorCode));

  let relevantSectors = GURGAON_SECTORS;
  if (params?.sector && params.sector !== 'all') {
    const matched = GURGAON_SECTORS.filter(
      (s) => s.code.toLowerCase() === params.sector!.toLowerCase().replace(/^sec-?/, '')
    );
    if (matched.length > 0) {
      relevantSectors = matched;
    }
  }

  return {
    properties: filtered,
    sectors: relevantSectors,
    summary: {
      totalProperties: filtered.length,
      totalSectors: uniqueSectors.size,
      avgRatePerSqFt,
      avgRateDisplay: `₹ ${avgRatePerSqFt.toLocaleString('en-IN')} / sq.ft`,
      rentalYieldRange: {
        min: minYield,
        max: maxYield,
        label: `${minYield.toFixed(1)}% – ${maxYield.toFixed(1)}% ROI`,
      },
      activeUnitsCount: filtered.length,
    },
  };
}

/**
 * Fetches market directory from backend API with transparent fallback to local cache
 */
export async function fetchMarketDirectory(
  params?: MarketDirectoryQueryParams,
  customCatalog?: MarketProperty[]
): Promise<MarketDirectoryResult> {
  try {
    const queryParams: Record<string, string> = {};
    if (params?.sector && params.sector !== 'all') queryParams.sector = params.sector;
    if (params?.category && params.category !== 'All') queryParams.category = params.category;
    if (params?.floor && params.floor !== 'All') queryParams.floor = params.floor;
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();

    const response = await apiClient.get('/properties/market-directory', {
      params: queryParams,
    });

    if (
      response.data &&
      (response.data.success === true || Array.isArray(response.data.properties))
    ) {
      const rawProps: any[] = response.data.properties || [];
      const normalizedProperties: MarketProperty[] = rawProps.map(normalizeBackendProperty);

      // If customCatalog has newly published user units not yet on backend, merge them
      let mergedProperties = normalizedProperties;
      if (customCatalog && customCatalog.length > 0) {
        const publishedLocals = customCatalog.filter((p) => p.id.startsWith('pub-'));
        if (publishedLocals.length > 0) {
          const backendIds = new Set(normalizedProperties.map((p) => p.id));
          const newLocals = publishedLocals.filter((p) => !backendIds.has(p.id));
          mergedProperties = [...newLocals, ...normalizedProperties];
        }
      }

      return {
        success: true,
        isLive: true,
        source: 'live_backend',
        summary: response.data.summary || {
          totalProperties: mergedProperties.length,
          totalSectors: response.data.sectors?.length || 9,
          avgRatePerSqFt: 17850,
          avgRateDisplay: '₹ 17,850 / sq.ft',
          rentalYieldRange: { min: 7.5, max: 9.2, label: '7.5% – 9.2% ROI' },
          activeUnitsCount: mergedProperties.length,
        },
        sectors: response.data.sectors || GURGAON_SECTORS,
        properties: mergedProperties,
        timestamp: response.data.timestamp || new Date().toISOString(),
      };
    }
  } catch {
    // Network failure, timeout, or backend offline -> continue to offline fallback
  }

  // Transparent Offline Cache Fallback
  const baseCatalog = customCatalog || GURGAON_PROPERTIES;
  const fallback = filterLocalCatalog(params, baseCatalog);

  return {
    success: true,
    isLive: false,
    source: 'offline_cache',
    summary: fallback.summary,
    sectors: fallback.sectors,
    properties: fallback.properties,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Requests OCR scan extraction from backend with transparent client-side regex fallback
 */
export async function requestScanExtract(
  dto: ScanExtractDto
): Promise<ScanExtractResult> {
  try {
    const payload: ScanExtractDto = {
      sampleId: dto.sampleId || (!dto.rawText && !dto.imageBase64 ? 'gurgaon-catalog-sample-1' : undefined),
      rawText: dto.rawText,
      imageBase64: dto.imageBase64,
    };

    const response = await apiClient.post('/properties/scan-extract', payload);

    if (response.data && response.data.success && Array.isArray(response.data.items)) {
      const normalizedItems: ParsedListing[] = response.data.items.map((it: any, index: number) => {
        const cleanPhone = (it.cleanPhone || it.contactPhone || '').replace(/\D/g, '');
        const confidenceVal = typeof it.confidenceScore === 'number' ? it.confidenceScore : 98;
        const confidenceRating: 'HIGH' | 'MEDIUM' | 'LOW' =
          confidenceVal >= 85 ? 'HIGH' : confidenceVal >= 65 ? 'MEDIUM' : 'LOW';

        return {
          id: it.id || `scan-ext-${index + 1}-${Date.now()}`,
          sector: it.sector || 'Sector 86, New Gurgaon',
          sectorCode: it.sectorCode || '86',
          project: it.project || 'SS Omnia',
          unitNumber: it.unitNumber || `G${80 + index}`,
          carpetAreaSqFt: it.carpetAreaSqFt || 450,
          floor: it.floor || 'Ground Floor (GF)',
          floorCode: (it.floorCode as FloorCode) || 'GF',
          attributes: Array.isArray(it.attributes) ? it.attributes : ['Corner Unit'],
          category: (it.category as PropertyCategory) || 'Retail Shops',
          status: it.status || 'Ready Shop',
          tenancy: it.tenancy || 'Vacant / Ready to Move',
          rentalYieldPct: it.rentalYieldPct || it.rentalYield,
          price: it.price || 7500000,
          priceDisplay: it.priceDisplay || `₹ ${(it.price ? it.price / 100000 : 75).toFixed(1)} Lakh`,
          pricePerSqFt: it.pricePerSqFt || it.pricePerSqFtDisplay || '₹ 16,800 / sq.ft',
          contactName: it.contactName || 'Deepak',
          contactPhone: it.contactPhone || '9899248292',
          cleanPhone: cleanPhone.length === 10 ? cleanPhone : '9899248292',
          confidenceScore: confidenceVal,
          confidence: it.confidence || confidenceRating,
          validationErrors: Array.isArray(it.validationErrors) ? it.validationErrors : [],
          rawLine: it.rawLine,
        };
      });

      return {
        success: true,
        isLive: true,
        source: response.data.source || 'live_backend',
        confidenceScore: response.data.confidenceScore || 0.98,
        totalExtracted: normalizedItems.length,
        rawText: response.data.rawText || dto.rawText,
        items: normalizedItems,
      };
    }
  } catch {
    // Network failure, timeout, or backend offline -> continue to client parser fallback
  }

  // Deterministic Client-Side Heuristic Fallback
  const fallbackItems = parseListingLines(dto.rawText);

  return {
    success: true,
    isLive: false,
    source: dto.rawText ? 'offline_client_parser' : 'offline_sample_catalog',
    confidenceScore: dto.rawText ? (fallbackItems.length > 0 ? 0.92 : 0.6) : 0.98,
    totalExtracted: fallbackItems.length,
    rawText: dto.rawText || GURGAON_SAMPLE_REGISTER_TEXT,
    items: fallbackItems,
  };
}

export const marketDirectoryService = {
  fetchMarketDirectory,
  requestScanExtract,
  parseListingLines,
  filterLocalCatalog,
};

export default marketDirectoryService;
