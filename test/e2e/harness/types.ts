/**
 * E2E Test Suite Type Definitions & Interface Contracts
 * Grounded in PROJECT.md § Interface Contracts & ORIGINAL_REQUEST.md
 */

export type ShiftStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

export interface AgentShift {
  id: string;
  userId: string;
  organizationId: string;
  punchInAt: string;
  punchOutAt?: string | null;
  status: ShiftStatus;
  pauseReason?: string | null;
  pausedAt?: string | null;
  totalMinutes: number;
  punchInLat?: number | null;
  punchInLng?: number | null;
  punchInAccuracy?: number | null;
  punchInAddress?: string | null;
  punchOutLat?: number | null;
  punchOutLng?: number | null;
  punchOutAccuracy?: number | null;
  punchOutAddress?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftLocation {
  id: string;
  shiftId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  source: string;
  capturedAt: string;
}

export interface ShiftInterval {
  id: string;
  shiftId: string;
  startTime: string;
  endTime?: string | null;
  status: 'ACTIVE' | 'PAUSED';
  reason?: string | null;
}

export interface TimelineEvent {
  id: string;
  type: 'PUNCH_IN' | 'LOCATION_CHECK' | 'PAUSE' | 'RESUME' | 'PUNCH_OUT';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
  reason?: string;
  notes?: string;
}

export interface TimelineResponse {
  agent: { id: string; name: string; email: string };
  date: string;
  shift: AgentShift | null;
  events: TimelineEvent[];
  summary: {
    activeMinutes: number;
    pausedMinutes: number;
  };
}

export interface ShiftStatusResponse {
  activeShift: AgentShift | null;
  todaySummary: {
    activeMinutes: number;
    pausedMinutes: number;
    checkpoints: number;
  };
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  totalWorkingMinutes: number;
  shiftsCount: number;
  lastActiveAt: string | null;
}

export interface TimeLoggingSummaryResponse {
  agents: AgentSummary[];
}

export type DateRangePreset = 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'custom' | 'ALL';

export interface FilterParams {
  datePreset?: DateRangePreset;
  from?: string;
  to?: string;
  status?: string;
  role?: string;
  search?: string;
  brokerId?: string;
  agentId?: string;
  selectedIds?: string[];
  format?: 'xlsx' | 'pdf' | 'csv';
}

export interface KycDocumentRecord {
  id: string;
  userId: string;
  organizationId: string;
  docType: string;
  fileUrl: string;
  docNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reviewNote?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
  };
  organization: {
    id: string;
    name: string;
    reraNumber?: string;
    verification: string;
  };
}

export interface TeamMemberRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  role: 'BROKER_ADMIN' | 'BROKER_AGENT';
  status: 'ACTIVE' | 'SUSPENDED';
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED';
  createdAt: string;
  lastLoginAt?: string | null;
  lastLocation?: {
    latitude: number;
    longitude: number;
    capturedAt: string;
  };
  stats?: {
    openLeads: number;
    won30d: number;
    activities30d: number;
  };
}
