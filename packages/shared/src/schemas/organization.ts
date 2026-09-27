import { z } from 'zod';
import { OrganizationStatus, Role } from '../enums';
import { REGEX_PATTERNS } from '../constants';

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  domain: z.string().optional().nullable(),
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number').optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  address: z.string().optional().nullable(),
  logo: z.string().url().optional().nullable(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  status: z.nativeEnum(OrganizationStatus).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number').optional().nullable(),
  role: z.enum([Role.BROKER_ADMIN, Role.BROKER_STAFF]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum([Role.BROKER_ADMIN, Role.BROKER_STAFF]),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
