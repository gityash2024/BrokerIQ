import { z } from 'zod';
import { PropertyType } from './enums';

const text = z.string().trim().min(1).max(300);
const price = z.number().nonnegative().max(10_000_000_000);
const url = z.url({ protocol: /^https$/ }).max(1000);
export const organicKind = z.enum(['SUPPLY', 'DEMAND']);
export const organicStatus = z.enum(['NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']);
export const organicRecordInput = z.object({
  externalId: text.optional(),
  kind: organicKind,
  title: text,
  url,
  description: z.string().trim().max(4000).optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  purpose: z.enum(['RENT', 'SALE', 'LEASE']).optional(),
  propertyType: z.enum(PropertyType).optional(),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'LAND']).optional(),
  city: text.optional(),
  sectors: z.array(text).max(30).default([]),
  locality: text.optional(),
  society: text.optional(),
  address: text.optional(),
  bhk: z.number().int().min(1).max(100).optional(),
  price: price.optional(),
  minBudget: price.optional(),
  maxBudget: price.optional(),
  deposit: price.optional(),
  maintenance: price.optional(),
  areaSqft: price.optional(),
  carpetAreaSqft: price.optional(),
  builtUpAreaSqft: price.optional(),
  superBuiltUpAreaSqft: price.optional(),
  floor: text.optional(),
  facing: text.optional(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional(),
  parking: text.optional(),
  amenities: z.array(text).max(30).default([]),
  availability: z.enum(['AVAILABLE', 'UNKNOWN', 'CLOSED', 'STALE']).default('UNKNOWN'),
  possession: text.optional(),
  timeline: text.optional(),
  urgency: z.enum(['IMMEDIATE', 'SOON', 'FLEXIBLE']).optional(),
  ownership: z.enum(['OWNER_CONFIRMED', 'OWNER_LIKELY', 'BROKER', 'DEVELOPER', 'UNKNOWN']).optional(),
  intent: z.enum(['BUYER', 'TENANT', 'COMMERCIAL_BUYER', 'COMMERCIAL_TENANT', 'INVESTOR', 'RELOCATION', 'BROKER', 'UNKNOWN']).optional(),
  displayName: text.optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  contactUrl: url.optional(),
  contactSourceId: text.optional(),
  registryRegistration: text.optional(),
  registryRegisteredAt: z.iso.date().optional(),
  registryReference: z.boolean().optional(),
  modelEvidence: z.string().trim().min(3).max(220).optional(),
});
export type OrganicRecordInput = z.infer<typeof organicRecordInput>;
export const organicSourceInput = z.object({
  name: text.max(100),
  url,
  permissionUrl: url,
  format: z.enum(['JSON', 'RSS', 'HTML', 'RERA_PROJECTS']),
  supports: z.array(organicKind).min(1).max(2),
  enabled: z.boolean().default(false),
  contactRedistribution: z.boolean().default(false),
  itemsPath: z.string().regex(/^[a-zA-Z0-9_.]*$/).max(100).default(''),
  minIntervalMinutes: z.number().int().min(15).max(1440).default(60),
  priority: z.number().int().min(0).max(100).default(50),
});
export type OrganicSourceInput = z.infer<typeof organicSourceInput>;
export const realeGurugramSource: OrganicSourceInput = {
  name: 'reale.in · Gurugram RERA projects (CC BY 4.0)',
  url: 'https://reale.in/api/v1/projects?state=HR&district=gurugram&sort=newest&page=1',
  permissionUrl: 'https://reale.in/data',
  format: 'RERA_PROJECTS',
  supports: ['SUPPLY'],
  enabled: false,
  contactRedistribution: false,
  itemsPath: 'projects',
  minIntervalMinutes: 1440,
  priority: 25,
};
export const organicDeliveryInput = z.object({
  organizationId: z.string().min(1).max(80),
  brokerAdminId: z.string().min(1).max(80),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  enabled: z.boolean(),
  sectors: z.array(text).max(30).default([]),
  leadType: z.enum(['ALL', 'BUYER', 'TENANT']).default('ALL'),
});
export type OrganicDeliveryInput = z.infer<typeof organicDeliveryInput>;
export const organicQuery = z.object({
  kind: organicKind, page: z.coerce.number().int().min(1).max(10000).default(1),
  view: z.enum(['DIRECT_OWNERS', 'OWNER_REVIEW', 'GENUINE_DEMAND', 'ALL']).optional(),
  status: organicStatus.optional(), sourceId: z.string().max(80).optional(),
  since: z.iso.date().optional(), until: z.iso.date().optional(), dateField: z.enum(['PUBLISHED', 'DISCOVERED', 'UNKNOWN']).default('PUBLISHED'),
  sectors: z.string().max(1500).optional(), locality: text.optional(), society: text.optional(), propertyType: text.optional(),
  purpose: organicRecordInput.shape.purpose, category: organicRecordInput.shape.category, intent: organicRecordInput.shape.intent,
  bhk: z.coerce.number().int().min(1).max(100).optional(), furnishing: organicRecordInput.shape.furnishing,
  ownership: organicRecordInput.shape.ownership, urgency: organicRecordInput.shape.urgency,
  availability: organicRecordInput.shape.availability.unwrap().optional(),
  minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(),
  minArea: z.coerce.number().min(0).optional(), maxArea: z.coerce.number().min(0).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW', 'REVIEW']).optional(), minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  delivered: z.enum(['yes', 'no']).optional(), organizationId: z.string().max(80).optional(), search: text.optional(),
});
export const organicTarget = organicDeliveryInput.pick({ organizationId: true, brokerAdminId: true });
export type OrganicQuery = z.infer<typeof organicQuery>;
export type OrganicTarget = z.infer<typeof organicTarget>;
