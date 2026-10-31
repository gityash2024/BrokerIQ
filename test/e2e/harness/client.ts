/**
 * Opaque-box E2E HTTP Client Adapter
 * Supports targeting external live servers via E2E_API_URL or the local ContractSimulator.
 */
import { ContractSimulator } from './contract-simulator';
import type {
  FilterParams,
  KycDocumentRecord,
  TeamMemberRecord,
  ShiftStatusResponse,
  TimelineResponse,
  TimeLoggingSummaryResponse,
  AgentShift,
} from './types';

export interface E2EResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  body: T;
  rawBuffer?: Buffer;
}

export class E2EClient {
  private baseUrl: string;
  private simulator: ContractSimulator | null = null;

  constructor(baseUrl: string, simulator: ContractSimulator | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.simulator = simulator;
  }

  public static async create(): Promise<E2EClient> {
    if (process.env.E2E_API_URL) {
      return new E2EClient(process.env.E2E_API_URL);
    }
    const simulator = new ContractSimulator();
    const url = await simulator.start();
    return new E2EClient(url, simulator);
  }

  public async close(): Promise<void> {
    if (this.simulator) {
      await this.simulator.stop();
    }
  }

  public getSimulator(): ContractSimulator | null {
    return this.simulator;
  }

  private async request<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: any,
    headers: Record<string, string> = {},
    isBinary: boolean = false
  ): Promise<E2EResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const reqHeaders: Record<string, string> = {
      ...headers,
    };

    let reqBody: string | undefined = undefined;
    if (body !== undefined && body !== null) {
      reqHeaders['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(body);
    }

    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: reqBody,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      resHeaders[key.toLowerCase()] = value;
    });

    if (isBinary) {
      const arrayBuf = await res.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuf);
      return {
        status: res.status,
        headers: resHeaders,
        body: null as any,
        rawBuffer,
      };
    }

    const text = await res.text();
    let parsedBody: any = text;
    try {
      parsedBody = JSON.parse(text);
    } catch {
      // Return raw string if not JSON
    }

    return {
      status: res.status,
      headers: resHeaders,
      body: parsedBody,
    };
  }

  // --- KYC Endpoints ---

  public async getKyc(params: FilterParams = {}, token?: string): Promise<E2EResponse<KycDocumentRecord[]>> {
    const query = this.buildQuery(params);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<KycDocumentRecord[]>(`/api/admin/kyc${query}`, 'GET', undefined, headers);
  }

  public async exportKyc(params: FilterParams = {}, token?: string): Promise<E2EResponse<null>> {
    const query = this.buildQuery(params);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<null>(`/api/admin/kyc/export${query}`, 'GET', undefined, headers, true);
  }

  // --- Teams Endpoints ---

  public async getTeam(params: FilterParams = {}, token?: string): Promise<E2EResponse<{ members: TeamMemberRecord[]; invites: any[] }>> {
    const query = this.buildQuery(params);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ members: TeamMemberRecord[]; invites: any[] }>(`/api/broker/team${query}`, 'GET', undefined, headers);
  }

  public async exportTeam(params: FilterParams = {}, token?: string): Promise<E2EResponse<null>> {
    const query = this.buildQuery(params);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<null>(`/api/broker/team/export${query}`, 'GET', undefined, headers, true);
  }

  // --- Time Logging Endpoints ---

  public async punchIn(
    coords: { latitude?: any; longitude?: any; accuracy?: number; address?: string },
    token?: string
  ): Promise<E2EResponse<{ shift: AgentShift; status: string }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ shift: AgentShift; status: string }>('/api/time-logging/punch-in', 'POST', coords, headers);
  }

  public async punchOut(
    coords: { latitude?: number; longitude?: number; accuracy?: number; address?: string } = {},
    token?: string
  ): Promise<E2EResponse<{ shift: AgentShift; status: string; totalMinutes: number }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ shift: AgentShift; status: string; totalMinutes: number }>('/api/time-logging/punch-out', 'POST', coords, headers);
  }

  public async recordLocation(
    data: { shiftId: string; latitude: number; longitude: number; accuracy?: number; address?: string },
    token?: string
  ): Promise<E2EResponse<{ success: boolean; locationId: string; status: string }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ success: boolean; locationId: string; status: string }>('/api/time-logging/location', 'POST', data, headers);
  }

  public async pauseShift(
    data: { shiftId: string; reason?: string },
    token?: string
  ): Promise<E2EResponse<{ shiftId: string; status: string }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ shiftId: string; status: string }>('/api/time-logging/pause', 'POST', data, headers);
  }

  public async resumeShift(
    data: { shiftId: string; latitude?: number; longitude?: number },
    token?: string
  ): Promise<E2EResponse<{ shiftId: string; status: string }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ shiftId: string; status: string }>('/api/time-logging/resume', 'POST', data, headers);
  }

  public async getShiftStatus(token?: string, agentId?: string): Promise<E2EResponse<ShiftStatusResponse>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
    return this.request<ShiftStatusResponse>(`/api/time-logging/status${query}`, 'GET', undefined, headers);
  }

  public async getTimeline(agentId: string, date: string, token?: string): Promise<E2EResponse<TimelineResponse>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<TimelineResponse>(`/api/time-logging/timeline?agentId=${encodeURIComponent(agentId)}&date=${encodeURIComponent(date)}`, 'GET', undefined, headers);
  }

  public async getHistory(agentId: string, date: string, token?: string): Promise<E2EResponse<{ points: any[] }>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<{ points: any[] }>(`/api/time-logging/history?agentId=${encodeURIComponent(agentId)}&date=${encodeURIComponent(date)}`, 'GET', undefined, headers);
  }

  public async getSummary(params: { brokerId?: string; agentId?: string } = {}, token?: string): Promise<E2EResponse<TimeLoggingSummaryResponse>> {
    const query = this.buildQuery(params);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.request<TimeLoggingSummaryResponse>(`/api/time-logging/summary${query}`, 'GET', undefined, headers);
  }

  private buildQuery(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    const qStr = searchParams.toString();
    return qStr ? `?${qStr}` : '';
  }
}
