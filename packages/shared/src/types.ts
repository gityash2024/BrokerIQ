export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT' | 'BROKER_ADMIN' | 'BROKER_AGENT' | 'USER';
  organizationId: string | null;
  emailVerified: boolean;
  locale: string;
  organization?: { id: string; name: string; slug: string; logoUrl: string | null; onboarded: boolean } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

/** Short-lived, login-authenticated selection; it grants no CRM access. */
export interface SessionLimitChallenge {
  challenge: string;
  sessions: { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string; expiresAt: string }[];
}

/** Grants no API access. A future verified-phone factor can extend requiredFactors. */
export interface LoginOtpChallenge {
  challenge: string;
  requiredFactors: ('EMAIL' | 'SMS')[];
  destination: string;
  expiresAt: string;
  resendAt: string;
  /** Only returned outside production when no email provider is configured. */
  devCode?: string;
}

export interface JwtPayload {
  sub: string;
  role: AuthUser['role'];
  orgId: string | null;
  email: string;
}
