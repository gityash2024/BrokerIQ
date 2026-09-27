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
  role: 'SUPER_ADMIN' | 'BROKER_ADMIN' | 'BROKER_AGENT' | 'USER';
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

export interface JwtPayload {
  sub: string;
  role: AuthUser['role'];
  orgId: string | null;
  email: string;
}
