/**
 * Property Inventory & Market Directory State Bridge
 * Connects AI Book Scanner extracted listings to:
 * 1. CRM Property Inventory (displayed in properties.tsx tab)
 * 2. Market Hub Directory (displayed in market-hub.tsx directory segment)
 * 3. NestJS Backend (http://10.0.2.2:3000/api/properties)
 */

import { useSyncExternalStore } from 'react';
import axios from 'axios';
import { MOCK_PROPERTIES, Property } from '../data/mockData';
import { GURGAON_PROPERTIES, MarketProperty } from '../data/gurgaonCatalog';
import { ParsedListing } from '../utils/listingParser';

// Internal module store state
let crmInventory: Property[] = [...MOCK_PROPERTIES];
let directoryCatalog: MarketProperty[] = [...GURGAON_PROPERTIES];
const importedListingIds = new Set<string>();
const publishedListingIds = new Set<string>();

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // safe
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const BUILDER_MAP: Record<string, string> = {
  'SS Omnia': 'SS Group',
  'SS Highpoint': 'SS Group',
  'Signature Signum-88A': 'Signature Global',
  'Signature Signum 88A': 'Signature Global',
  'Orris Market 89': 'Orris Infrastructure',
  'Orris Market': 'Orris Infrastructure',
  'MRG Bazaar': 'MRG Group',
  'Adani Galleria': 'Adani Realty',
  'AIPL Joy District': 'AIPL Group',
  'Sapphire Ninety': 'Ameya Group',
  'DLF Regal Garden': 'DLF India',
  'DLF Garden City Commercial': 'DLF India',
  'Spaze Boulevard': 'Spaze Group',
  'Spaze Tristaar': 'Spaze Group',
  'Signature Global Signum 92': 'Signature Global',
  'Signature Global Signum 93': 'Signature Global',
  'MRG Meridian High Street': 'MRG Group',
  'Lodha World One': 'Lodha Group',
  'Rustomjee Crown': 'Rustomjee',
  'Oberoi Three Sixty West': 'Oberoi Realty',
};

/**
 * Converts a parsed register listing or market unit into a CRM Property record
 */
export function convertListingToCRMProperty(listing: ParsedListing | MarketProperty): Property {
  const cleanPhone = 'cleanPhone' in listing && listing.cleanPhone ? listing.cleanPhone : listing.contactPhone.replace(/\D/g, '');
  const builder = BUILDER_MAP[listing.project] || 'Commercial Developer';
  const isRented = listing.status.toLowerCase().includes('rented') || listing.tenancy.toLowerCase().includes('rented');

  return {
    id: `prop-crm-${listing.unitNumber.replace(/[^A-Za-z0-9]/g, '')}-${Date.now()}`,
    title: `${listing.project} - ${listing.unitNumber}`,
    builder,
    location: listing.sector,
    subLocation: listing.project,
    price: listing.priceDisplay,
    pricePerSqFt: listing.pricePerSqFt,
    bhk: `Commercial ${listing.floorCode || 'Shop'}`,
    areaSqFt: listing.carpetAreaSqFt,
    possession: listing.status,
    reraId: `HRERA-GGM-${('sectorCode' in listing ? listing.sectorCode : '86')}-2026`,
    furnishing: isRented ? 'Fully-Furnished' : 'Unfurnished',
    type: 'Commercial Office',
    purpose: isRented ? 'Rent' : 'Sale',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80',
    matchingLeadsCount: Math.floor(Math.random() * 5) + 3,
    amenities: [
      'High-Speed Elevators',
      '100% Power Backup',
      '24x7 Multi-Tier Security',
      'Covered Parking',
      'Wide Corridor Frontage',
      'Fire Safety Compliance',
    ],
    description: `Digitized register entry: Unit ${listing.unitNumber} at ${listing.project} (${listing.sector}). ${listing.tenancy}. Verified owner contact: ${listing.contactName} (${cleanPhone}).`,
    contactPerson: `${listing.contactName} (Owner / Primary Broker) - +91 ${cleanPhone}`,
  };
}

/**
 * 1-Tap Import to My CRM Inventory
 */
export function importListingToCRM(listing: ParsedListing | MarketProperty): Property {
  const crmProp = convertListingToCRMProperty(listing);

  // Add to in-memory CRM inventory (prepended to top)
  crmInventory = [crmProp, ...crmInventory];
  importedListingIds.add(listing.id);
  notifyListeners();

  // Background sync attempt to local NestJS backend
  const backendPayload = {
    propertyType: 'COMMERCIAL',
    listingType: crmProp.purpose === 'Rent' ? 'RENT' : 'SALE',
    status: 'ACTIVE',
    price: listing.price || 7500000,
    carpetAreaSqFt: listing.carpetAreaSqFt || 500,
    furnishingStatus: crmProp.furnishing === 'Fully-Furnished' ? 'FURNISHED' : 'UNFURNISHED',
    parkingAvailable: true,
  };

  axios
    .post('http://10.0.2.2:3000/api/properties', backendPayload, { timeout: 3000 })
    .then((res) => {
      // Backend sync success
    })
    .catch(() => {
      // Offline fallback: purely local state maintained
    });

  return crmProp;
}

/**
 * Batch Import Multiple Listings to CRM Inventory
 */
export function importMultipleToCRM(listings: (ParsedListing | MarketProperty)[]): Property[] {
  const newProps = listings.map((l) => convertListingToCRMProperty(l));
  crmInventory = [...newProps, ...crmInventory];
  listings.forEach((l) => importedListingIds.add(l.id));
  notifyListeners();
  return newProps;
}

/**
 * 1-Tap Publish to Market Directory
 */
export function publishListingToDirectory(listing: ParsedListing): MarketProperty {
  const cleanPhone = listing.cleanPhone || listing.contactPhone.replace(/\D/g, '');

  const marketProp: MarketProperty = {
    id: `pub-${listing.id}`,
    sector: listing.sector,
    sectorCode: listing.sectorCode,
    project: listing.project,
    unitNumber: listing.unitNumber,
    carpetAreaSqFt: listing.carpetAreaSqFt,
    floor: listing.floor,
    floorCode: listing.floorCode,
    attributes: listing.attributes,
    category: listing.category,
    status: listing.status,
    tenancy: listing.tenancy,
    rentalYieldPct: listing.rentalYieldPct,
    price: listing.price,
    priceDisplay: listing.priceDisplay,
    pricePerSqFt: listing.pricePerSqFt,
    contactName: listing.contactName,
    contactPhone: listing.contactPhone,
    cleanPhone,
    notes: `Published from physical register scan on ${new Date().toLocaleDateString()}`,
  };

  directoryCatalog = [marketProp, ...directoryCatalog];
  publishedListingIds.add(listing.id);
  notifyListeners();

  return marketProp;
}

/**
 * Batch Publish Multiple Listings to Market Directory
 */
export function publishMultipleToDirectory(listings: ParsedListing[]): MarketProperty[] {
  const published = listings.map((l) => {
    publishedListingIds.add(l.id);
    const cleanPhone = l.cleanPhone || l.contactPhone.replace(/\D/g, '');
    return {
      id: `pub-${l.id}`,
      sector: l.sector,
      sectorCode: l.sectorCode,
      project: l.project,
      unitNumber: l.unitNumber,
      carpetAreaSqFt: l.carpetAreaSqFt,
      floor: l.floor,
      floorCode: l.floorCode,
      attributes: l.attributes,
      category: l.category,
      status: l.status,
      tenancy: l.tenancy,
      rentalYieldPct: l.rentalYieldPct,
      price: l.price,
      priceDisplay: l.priceDisplay,
      pricePerSqFt: l.pricePerSqFt,
      contactName: l.contactName,
      contactPhone: l.contactPhone,
      cleanPhone,
      notes: `Batch published from physical register scan`,
    } as MarketProperty;
  });

  directoryCatalog = [...published, ...directoryCatalog];
  notifyListeners();
  return published;
}

/**
 * Check if a listing ID has been imported into CRM
 */
export function isListingImported(id: string): boolean {
  return importedListingIds.has(id);
}

/**
 * Check if a listing ID has been published to Market Directory
 */
export function isListingPublished(id: string): boolean {
  return publishedListingIds.has(id);
}

/**
 * React Hook for CRM Property Inventory
 */
export function useCRMProperties(): {
  properties: Property[];
  addProperty: (prop: Property) => void;
  importListing: (listing: ParsedListing | MarketProperty) => Property;
  importMultiple: (listings: (ParsedListing | MarketProperty)[]) => Property[];
} {
  const properties = useSyncExternalStore(
    subscribe,
    () => crmInventory,
    () => crmInventory
  );

  const addProperty = (prop: Property) => {
    crmInventory = [prop, ...crmInventory];
    notifyListeners();
  };

  return {
    properties,
    addProperty,
    importListing: importListingToCRM,
    importMultiple: importMultipleToCRM,
  };
}

/**
 * React Hook for Market Directory Catalog
 */
export function useDirectoryProperties(): {
  directoryListings: MarketProperty[];
  publishListing: (listing: ParsedListing) => MarketProperty;
  publishMultiple: (listings: ParsedListing[]) => MarketProperty[];
  isImported: (id: string) => boolean;
  isPublished: (id: string) => boolean;
} {
  const directoryListings = useSyncExternalStore(
    subscribe,
    () => directoryCatalog,
    () => directoryCatalog
  );

  return {
    directoryListings,
    publishListing: publishListingToDirectory,
    publishMultiple: publishMultipleToDirectory,
    isImported: isListingImported,
    isPublished: isListingPublished,
  };
}
