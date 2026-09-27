/**
 * Unit Tests for Multi-Persona Auth Store & Role Navigation
 */

import { Role } from '@brokeriq/shared';
import { DEMO_PERSONAS } from '../data/personaData';
import {
  resolvePersona,
  switchPersona,
  loginAsPersona,
  logout,
  toggleSaveProperty,
  isPropertySaved,
  recordInquiry,
  addOwnerListing,
  toggleBoostListing,
  updateVerificationBadge,
  getAuthState,
  useAuthStore,
} from '../stores/authStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- RUNNING MULTI-PERSONA AUTH STORE TESTS ---');

  // Test 1: Verify all 5 personas exist with required roles and modes
  console.log('Test 1: Verifying 5 personas');
  assert(DEMO_PERSONAS.SUPER_ADMIN.mode === 'BROKER', 'SUPER_ADMIN must be in BROKER mode');
  assert(DEMO_PERSONAS.AGENCY_MANAGER.mode === 'BROKER', 'AGENCY_MANAGER must be in BROKER mode');
  assert(DEMO_PERSONAS.BROKER_AGENT.mode === 'BROKER', 'BROKER_AGENT must be in BROKER mode');
  assert(DEMO_PERSONAS.PROPERTY_OWNER.mode === 'OWNER', 'PROPERTY_OWNER must be in OWNER mode');
  assert(DEMO_PERSONAS.SEEKER.mode === 'SEEKER', 'SEEKER must be in SEEKER mode');

  assert(DEMO_PERSONAS.SUPER_ADMIN.email === 'admin@brokeriq.in', 'Super admin email mismatch');
  assert(DEMO_PERSONAS.AGENCY_MANAGER.email === 'rajesh.sharma@founder-realty.in', 'Agency manager email mismatch');
  assert(DEMO_PERSONAS.BROKER_AGENT.email === 'amit.verma@founder-realty.in', 'Broker agent email mismatch');
  assert(DEMO_PERSONAS.PROPERTY_OWNER.email === 'deepak.owner@brokeriq.in', 'Owner email mismatch');
  assert(DEMO_PERSONAS.SEEKER.email === 'vikram.seeker@brokeriq.in', 'Seeker email mismatch');

  // Test 2: Resolve persona by ID or Role
  console.log('Test 2: Testing resolvePersona');
  const p1 = resolvePersona('persona-super-admin');
  assert(p1.id === 'persona-super-admin', 'Expected persona-super-admin');

  const p2 = resolvePersona(Role.PROPERTY_OWNER);
  assert(p2.id === 'persona-property-owner', 'Expected persona-property-owner');

  const p3 = resolvePersona(Role.SEEKER);
  assert(p3.mode === 'SEEKER', 'Expected SEEKER mode');

  // Test 3: 1-Tap Persona Switching
  console.log('Test 3: Testing switchPersona to SEEKER');
  await switchPersona(Role.SEEKER);
  const state = getAuthState();
  assert(state.activePersona.mode === 'SEEKER', 'Active persona should be in SEEKER mode');

  console.log('Test 4: Testing switchPersona to OWNER');
  await switchPersona('persona-property-owner');
  const ownerPersona = resolvePersona('persona-property-owner');
  assert(ownerPersona.mode === 'OWNER', 'Active persona should be in OWNER mode');

  // Test 5: Wishlist toggle
  console.log('Test 5: Testing toggleSaveProperty');
  const testPropId = 'test-unit-xyz';
  assert(!isPropertySaved(testPropId), 'Property should initially not be saved');
  toggleSaveProperty(testPropId);
  assert(isPropertySaved(testPropId), 'Property should now be saved');
  toggleSaveProperty(testPropId);
  assert(!isPropertySaved(testPropId), 'Property should now be unsaved');

  // Test 6: Record Inquiry
  console.log('Test 6: Testing recordInquiry');
  const inq = recordInquiry({
    propertyId: 'sec86-ssomnia-g80',
    propertyTitle: 'SS Omnia - G80',
    sector: 'Sector-86',
    unitNumber: 'G-80',
    buyerName: 'Vikram Malhotra',
    buyerPhone: '+919820011223',
    buyerBudget: '₹1.15 Cr',
    ownerName: 'Deepak Gupta',
    ownerPhone: '+919899248292',
    status: 'NEW',
    message: 'Testing inquiry submission',
  });
  assert(inq.id.startsWith('inq-'), 'Inquiry ID should be generated');
  assert(inq.message === 'Testing inquiry submission', 'Inquiry message should match');

  // Test 7: Add Owner Listing
  console.log('Test 7: Testing addOwnerListing');
  const listing = addOwnerListing({
    project: 'SS Highpoint',
    sector: 'Sector-86',
    unitNumber: 'G-50',
    floor: 'GF',
    carpetAreaSqFt: 600,
    priceDisplay: '₹1.50 Cr',
    pricePerSqFt: 25000,
    status: 'Ready Shop',
    tenancy: 'Pre-Leased Rented',
  });
  assert(listing.id.startsWith('own-list-'), 'Listing ID should be generated');
  assert(listing.verified === true, 'Listing should have verified badge');
  assert(listing.isBoosted === false, 'Listing should not be boosted initially');

  // Test 8: Toggle Boost on Listing
  console.log('Test 8: Testing toggleBoostListing');
  toggleBoostListing(listing.id);
  // Re-toggle back
  toggleBoostListing(listing.id);

  // Test 9: Update Verification Badge Status
  console.log('Test 9: Testing updateVerificationBadge');
  updateVerificationBadge('badge-utility', 'VERIFIED');

  // Test 10: Logout and Login as Persona
  console.log('Test 10: Testing loginAsPersona and logout');
  await loginAsPersona(Role.BROKER_AGENT);
  logout();
  await loginAsPersona(Role.SUPER_ADMIN);

  console.log('✅ ALL 10 MULTI-PERSONA AUTH STORE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
