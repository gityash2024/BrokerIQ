import { Role } from '../enums';
import { Permission } from '../constants';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  name?: string;
  role: Role;
  activeRole?: Role;
  availableRoles?: Role[];
  permissions?: (Permission | string)[];
  organizationId?: string | null;
  portalUrl?: string;
  avatar?: string | null;
  iat?: number;
  exp?: number;
}

export interface UserSession {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  role: Role;
  activeRole?: Role;
  availableRoles?: Role[];
  permissions?: (Permission | string)[];
  organizationId?: string | null;
  avatar?: string | null;
  portalUrl?: string;
}

