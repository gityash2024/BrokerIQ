import { z } from 'zod';
import { Role } from '../enums';
import { REGEX_PATTERNS } from '../constants';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number (+91 or 10 digits)').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone must be provided',
  path: ['email'],
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.nativeEnum(Role).optional().default(Role.BROKER_ADMIN),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').optional(),
});

export const otpSendSchema = z.object({
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number'),
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(REGEX_PATTERNS.INDIAN_PHONE, 'Invalid Indian phone number'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const switchRoleSchema = z.object({
  targetRole: z.nativeEnum(Role),
  organizationId: z.string().optional().nullable(),
});

export const demoLoginSchema = z.object({
  role: z.nativeEnum(Role),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type OtpSendDto = z.infer<typeof otpSendSchema>;
export type OtpVerifyDto = z.infer<typeof otpVerifySchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type SwitchRoleDto = z.infer<typeof switchRoleSchema>;
export type DemoLoginDto = z.infer<typeof demoLoginSchema>;

