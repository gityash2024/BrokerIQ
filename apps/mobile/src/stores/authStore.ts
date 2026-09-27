/**
 * Reactive Auth & Multi-Persona Store
 * Powered by React 18/19 useSyncExternalStore for instant, tear-free UI state updates.
 */

import { useSyncExternalStore } from 'react';
import { Role } from '@brokeriq/shared';
import axios from 'axios';
import {
  DEMO_PERSONAS,
  PersonaConfig,
  SavedPropertyItem,
  InquiryItem,
  OwnerListingItem,
  VerificationBadgeItem,
  INITIAL_SAVED_PROPERTIES,
  INITIAL_INQUIRIES,
  INITIAL_OWNER_LISTINGS,
  INITIAL_VERIFICATION_BADGES,
} from '../data/personaData';

export interface AuthState {
  isAuthenticated: boolean;
  activePersona: PersonaConfig;
  token: string | null;
  savedPropertyIds: Set<string>;
  inquiries: InquiryItem[];
  ownerListings: OwnerListingItem[];
  verificationBadges: VerificationBadgeItem[];
}

// Initial Singleton State in module scope
let authState: AuthState = {
  isAuthenticated: true,
  activePersona: DEMO_PERSONAS.BROKER_AGENT,
  token: 'jwt-brokeriq-demo-broker-agent',
  savedPropertyIds: new Set(INITIAL_SAVED_PROPERTIES.map((p) => p.id)),
  inquiries: [...INITIAL_INQUIRIES],
  ownerListings: [...INITIAL_OWNER_LISTINGS],
  verificationBadges: [...INITIAL_VERIFICATION_BADGES],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // safe error boundary
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthState(): AuthState {
  return authState;
}

export const getSnapshot = getAuthState;

/**
 * Finds a persona configuration by role or ID.
 */
export function resolvePersona(roleOrId: Role | string): PersonaConfig {
  const match = Object.values(DEMO_PERSONAS).find(
    (p) =>
      p.id === roleOrId ||
      p.role === roleOrId ||
      p.role.toString().toLowerCase() === roleOrId.toString().toLowerCase()
  );
  return match || DEMO_PERSONAS.BROKER_AGENT;
}

const API_BASE_URL = 'http://10.0.2.2:3000/api';

/**
 * 1-Tap Persona Switching
 * Instant synchronous UI update + background API synchronization.
 */
export async function switchPersona(targetRoleOrId: Role | string): Promise<void> {
  const target = resolvePersona(targetRoleOrId);

  // Synchronous immediate reactive state transition
  authState = {
    ...authState,
    activePersona: target,
    token: `jwt-brokeriq-demo-${target.id}`,
  };
  notify();

  // Background API notification with graceful offline fallback
  try {
    await axios.post(
      `${API_BASE_URL}/auth/switch-role`,
      { targetRole: target.role },
      { timeout: 3000 }
    );
  } catch {
    // Graceful offline fallback: local state is already live and active
  }
}

/**
 * 1-Tap Demo Quick-Login
 */
export async function loginAsPersona(targetRoleOrId: Role | string): Promise<void> {
  const target = resolvePersona(targetRoleOrId);

  authState = {
    ...authState,
    isAuthenticated: true,
    activePersona: target,
    token: `jwt-brokeriq-demo-${target.id}`,
  };
  notify();

  try {
    await axios.post(
      `${API_BASE_URL}/auth/demo-login`,
      { role: target.role },
      { timeout: 3000 }
    );
  } catch {
    // Offline resilience
  }
}

/**
 * Sign out
 */
export function logout(): void {
  authState = {
    ...authState,
    isAuthenticated: false,
    token: null,
  };
  notify();

  axios.post(`${API_BASE_URL}/auth/logout`, {}, { timeout: 2000 }).catch(() => {});
}

/**
 * Wishlist Toggle for Seekers
 */
export function toggleSaveProperty(propertyId: string): void {
  const newSet = new Set(authState.savedPropertyIds);
  if (newSet.has(propertyId)) {
    newSet.delete(propertyId);
  } else {
    newSet.add(propertyId);
  }
  authState = {
    ...authState,
    savedPropertyIds: newSet,
  };
  notify();
}

export function isPropertySaved(propertyId: string): boolean {
  return authState.savedPropertyIds.has(propertyId);
}

/**
 * Record an inquiry
 */
export function recordInquiry(inquiry: Omit<InquiryItem, 'id' | 'createdAt' | 'lastInteraction'>): InquiryItem {
  const newInquiry: InquiryItem = {
    ...inquiry,
    id: `inq-${Date.now()}`,
    createdAt: 'Just now',
    lastInteraction: 'Inquiry submitted successfully',
  };

  authState = {
    ...authState,
    inquiries: [newInquiry, ...authState.inquiries],
  };
  notify();
  return newInquiry;
}

/**
 * Owner: Add New Listing
 */
export function addOwnerListing(
  listing: Omit<OwnerListingItem, 'id' | 'postedDate' | 'viewsCount' | 'inquiriesCount' | 'isBoosted' | 'verified'>
): OwnerListingItem {
  const newListing: OwnerListingItem = {
    ...listing,
    id: `own-list-${Date.now()}`,
    viewsCount: 1,
    inquiriesCount: 0,
    isBoosted: false,
    verified: true,
    postedDate: 'Today',
  };

  authState = {
    ...authState,
    ownerListings: [newListing, ...authState.ownerListings],
  };
  notify();
  return newListing;
}

/**
 * Owner: Toggle Boost on Listing
 */
export function toggleBoostListing(listingId: string): void {
  authState = {
    ...authState,
    ownerListings: authState.ownerListings.map((l) =>
      l.id === listingId ? { ...l, isBoosted: !l.isBoosted } : l
    ),
  };
  notify();
}

/**
 * Owner: Update Verification Badge Status
 */
export function updateVerificationBadge(badgeId: string, status: 'VERIFIED' | 'PENDING' | 'REQUIRED'): void {
  authState = {
    ...authState,
    verificationBadges: authState.verificationBadges.map((b) =>
      b.id === badgeId ? { ...b, status, verifiedDate: status === 'VERIFIED' ? 'Just now' : undefined } : b
    ),
  };
  notify();
}

/**
 * React Hook for Auth & Multi-Persona Store
 */
export function useAuthStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...state,
    switchPersona,
    loginAsPersona,
    logout,
    toggleSaveProperty,
    isPropertySaved,
    recordInquiry,
    addOwnerListing,
    toggleBoostListing,
    updateVerificationBadge,
  };
}

export const useAuth = useAuthStore;
export default useAuthStore;
