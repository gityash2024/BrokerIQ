/**
 * In-Process Contract Simulator & Reference Verification Oracle
 * Implements the exact HTTP API interface contracts from PROJECT.md & ORIGINAL_REQUEST.md.
 * Allows deterministic opaque-box E2E tests to run standalone or against live backend.
 */
import http from 'node:http';
import { URL } from 'node:url';
import type {
  AgentShift,
  ShiftLocation,
  ShiftInterval,
  TimelineEvent,
  TimelineResponse,
  ShiftStatusResponse,
  TimeLoggingSummaryResponse,
  KycDocumentRecord,
  TeamMemberRecord,
} from './types';

// Real PDF generator via installed pdfkit
const PDFDocument = require('/Users/yashjangid/Desktop/BrokerIQ/apps/api/node_modules/pdfkit');
// Real OpenXML Zip generator via installed fflate
const fflate = require('/Users/yashjangid/Desktop/BrokerIQ/apps/api/node_modules/fflate');

export class ContractSimulator {
  private server: http.Server | null = null;
  private port: number = 0;

  // In-memory persistent state across requests
  public kycDocuments: KycDocumentRecord[] = [];
  public teamMembers: TeamMemberRecord[] = [];
  public shifts: Map<string, AgentShift> = new Map();
  public locations: ShiftLocation[] = [];
  public intervals: ShiftInterval[] = [];
  private inFlightPunches: Set<string> = new Set();
  private inFlightPunchOuts: Set<string> = new Set();

  constructor() {
    this.seedDefaultData();
  }

  public seedDefaultData() {
    this.kycDocuments = [];
    this.teamMembers = [];
    this.shifts.clear();
    this.locations = [];
    this.intervals = [];
    this.inFlightPunches.clear();
    this.inFlightPunchOuts.clear();

    const now = new Date();
    const todayIso = now.toISOString();
    const yesterday = new Date(now.getTime() - 86400000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();
    const lastMonth = new Date(now.getTime() - 40 * 86400000).toISOString();

    const org1 = { id: 'org_prime_gurgaon', name: 'Prime Properties Gurgaon', reraNumber: 'HRERA-GGM-2024-001', verification: 'VERIFIED' };
    const org2 = { id: 'org_elite_realty', name: 'Elite Realty DLF', reraNumber: 'HRERA-GGM-2024-002', verification: 'VERIFIED' };

    // Seed KYC Documents across various dates and statuses
    this.kycDocuments.push(
      {
        id: 'kyc_doc_1',
        userId: 'agent_rohit',
        organizationId: org1.id,
        docType: 'AADHAAR',
        fileUrl: 'https://cdn.brokeriq.test/kyc/rohit-aadhaar.pdf',
        docNumber: 'XXXX-XXXX-1122',
        status: 'PENDING',
        createdAt: todayIso,
        user: { id: 'agent_rohit', name: 'Rohit Sharma', email: 'rohit@primeproperties.test', phone: '+919811001122', role: 'BROKER_AGENT' },
        organization: org1,
      },
      {
        id: 'kyc_doc_2',
        userId: 'agent_priya',
        organizationId: org1.id,
        docType: 'PAN',
        fileUrl: 'https://cdn.brokeriq.test/kyc/priya-pan.pdf',
        docNumber: 'ABCDE1234F',
        status: 'VERIFIED',
        createdAt: yesterday,
        user: { id: 'agent_priya', name: 'Priya Verma', email: 'priya@primeproperties.test', phone: '+919811003344', role: 'BROKER_AGENT' },
        organization: org1,
      },
      {
        id: 'kyc_doc_3',
        userId: 'admin_vikram',
        organizationId: org1.id,
        docType: 'RERA_CERTIFICATE',
        fileUrl: 'https://cdn.brokeriq.test/kyc/vikram-rera.pdf',
        docNumber: 'RERA-2024-9988',
        status: 'VERIFIED',
        createdAt: threeDaysAgo,
        user: { id: 'admin_vikram', name: 'Vikram Malhotra', email: 'vikram@primeproperties.test', phone: '+919811005566', role: 'BROKER_ADMIN' },
        organization: org1,
      },
      {
        id: 'kyc_doc_4',
        userId: 'agent_amit',
        organizationId: org2.id,
        docType: 'PASSPORT',
        fileUrl: 'https://cdn.brokeriq.test/kyc/amit-passport.pdf',
        docNumber: 'Z1234567',
        status: 'REJECTED',
        reviewNote: 'Image is blurry, please re-upload clear photo',
        createdAt: tenDaysAgo,
        user: { id: 'agent_amit', name: 'Amit Kumar', email: 'amit@eliterealty.test', phone: '+919811007788', role: 'BROKER_AGENT' },
        organization: org2,
      },
      {
        id: 'kyc_doc_5',
        userId: 'agent_neha',
        organizationId: org2.id,
        docType: 'PAN',
        fileUrl: 'https://cdn.brokeriq.test/kyc/neha-pan.pdf',
        docNumber: 'FGHIJ5678K',
        status: 'PENDING',
        createdAt: lastMonth,
        user: { id: 'agent_neha', name: 'Neha Gupta', email: 'neha@eliterealty.test', phone: '+919811009900', role: 'BROKER_AGENT' },
        organization: org2,
      }
    );

    // Seed Team Members
    this.teamMembers.push(
      {
        id: 'agent_rohit',
        organizationId: org1.id,
        name: 'Rohit Sharma',
        email: 'rohit@primeproperties.test',
        phone: '+919811001122',
        role: 'BROKER_AGENT',
        status: 'ACTIVE',
        kycStatus: 'PENDING',
        createdAt: todayIso,
        lastLoginAt: todayIso,
        lastLocation: { latitude: 28.4595, longitude: 77.0266, capturedAt: todayIso },
        stats: { openLeads: 5, won30d: 2, activities30d: 18 },
      },
      {
        id: 'agent_priya',
        organizationId: org1.id,
        name: 'Priya Verma',
        email: 'priya@primeproperties.test',
        phone: '+919811003344',
        role: 'BROKER_AGENT',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        createdAt: yesterday,
        lastLoginAt: yesterday,
        lastLocation: { latitude: 28.4721, longitude: 77.0865, capturedAt: yesterday },
        stats: { openLeads: 8, won30d: 4, activities30d: 32 },
      },
      {
        id: 'admin_vikram',
        organizationId: org1.id,
        name: 'Vikram Malhotra',
        email: 'vikram@primeproperties.test',
        phone: '+919811005566',
        role: 'BROKER_ADMIN',
        status: 'ACTIVE',
        kycStatus: 'VERIFIED',
        createdAt: threeDaysAgo,
        lastLoginAt: todayIso,
        stats: { openLeads: 12, won30d: 7, activities30d: 55 },
      },
      {
        id: 'agent_amit',
        organizationId: org2.id,
        name: 'Amit Kumar',
        email: 'amit@eliterealty.test',
        phone: '+919811007788',
        role: 'BROKER_AGENT',
        status: 'ACTIVE',
        kycStatus: 'REJECTED',
        createdAt: tenDaysAgo,
        lastLoginAt: tenDaysAgo,
        stats: { openLeads: 3, won30d: 1, activities30d: 9 },
      },
      {
        id: 'agent_neha',
        organizationId: org2.id,
        name: 'Neha Gupta',
        email: 'neha@eliterealty.test',
        phone: '+919811009900',
        role: 'BROKER_AGENT',
        status: 'SUSPENDED',
        kycStatus: 'PENDING',
        createdAt: lastMonth,
        lastLoginAt: lastMonth,
        stats: { openLeads: 0, won30d: 0, activities30d: 0 },
      }
    );
  }

  public async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        resolve(`http://127.0.0.1:${this.port}`);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private async parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (!body.trim()) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: http.ServerResponse, statusCode: number, message: string) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message, statusCode }));
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const path = parsedUrl.pathname;
      const method = req.method?.toUpperCase();

      // Check simulated authentication token if provided
      const authHeader = req.headers['authorization'];
      let role = 'BROKER_ADMIN';
      let userId = 'agent_rohit';
      let orgId = 'org_prime_gurgaon';

      if (authHeader && authHeader.includes('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        if (token === 'invalid_token') {
          return this.sendError(res, 401, 'Unauthorized: Invalid token');
        }
        if (token.includes('user_role')) {
          role = 'USER';
        } else if (token.includes('super_admin')) {
          role = 'SUPER_ADMIN';
        } else if (token.includes('agent_priya')) {
          userId = 'agent_priya';
        } else if (token.includes('agent_amit')) {
          orgId = 'org_elite_realty';
          userId = 'agent_amit';
        } else if (token.includes('agent_rohit')) {
          userId = 'agent_rohit';
        } else if (token.includes('other_org')) {
          orgId = 'org_elite_realty';
          userId = 'agent_amit';
        }
      }

      // --- 1. KYC MODULE ---
      if (path === '/api/admin/kyc' && method === 'GET') {
        const items = this.filterKycRecords(parsedUrl.searchParams, role, orgId);
        return this.sendJson(res, 200, items);
      }

      if (path === '/api/admin/kyc/export' && method === 'GET') {
        const format = parsedUrl.searchParams.get('format') || 'csv';
        const items = this.filterKycRecords(parsedUrl.searchParams, role, orgId);
        return await this.exportKyc(res, items, format);
      }

      // --- 2. TEAMS MODULE ---
      if (path === '/api/broker/team' && method === 'GET') {
        const items = this.filterTeamRecords(parsedUrl.searchParams, role, orgId);
        return this.sendJson(res, 200, { members: items, invites: [] });
      }

      if (path === '/api/broker/team/export' && method === 'GET') {
        const format = parsedUrl.searchParams.get('format') || 'csv';
        const items = this.filterTeamRecords(parsedUrl.searchParams, role, orgId);
        return await this.exportTeam(res, items, format);
      }

      // --- 3. TIME LOGGING MODULE ---
      if (path === '/api/time-logging/punch-in' && method === 'POST') {
        if (role === 'USER') {
          return this.sendError(res, 403, 'Forbidden: Customers cannot access time logging');
        }
        const body = await this.parseJsonBody(req);
        if (body.latitude === undefined || body.longitude === undefined || body.latitude === null || body.longitude === null) {
          return this.sendError(res, 400, 'Location coordinates are mandatory to punch in');
        }
        if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number' || isNaN(body.latitude) || isNaN(body.longitude)) {
          return this.sendError(res, 400, 'Invalid coordinate format');
        }
        if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
          return this.sendError(res, 400, 'Coordinates out of geographical bounds');
        }

        // Check if agent already has an ACTIVE or PAUSED shift or punch in progress
        if (this.inFlightPunches.has(userId)) {
          return this.sendError(res, 409, 'Agent already has an active duty shift in progress');
        }
        this.inFlightPunches.add(userId);

        try {
          const existing = Array.from(this.shifts.values()).find(
            (s) => s.userId === userId && (s.status === 'ACTIVE' || s.status === 'PAUSED')
          );
          if (existing) {
            return this.sendError(res, 409, 'Agent already has an active duty shift in progress');
          }

          const now = new Date();
          const shiftId = `shift_${Date.now()}_${userId}`;
          const newShift: AgentShift = {
            id: shiftId,
            userId,
            organizationId: orgId,
            punchInAt: now.toISOString(),
            status: 'ACTIVE',
            totalMinutes: 0,
            punchInLat: body.latitude,
            punchInLng: body.longitude,
            punchInAccuracy: body.accuracy ?? 15,
            punchInAddress: body.address ?? 'Sector 29, Gurgaon',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };
          this.shifts.set(shiftId, newShift);

          // Record initial interval
          const intervalId = `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          this.intervals.push({
            id: intervalId,
            shiftId,
            startTime: now.toISOString(),
            status: 'ACTIVE',
          });

          // Record initial location
          const locId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          this.locations.push({
            id: locId,
            shiftId,
            userId,
            latitude: body.latitude,
            longitude: body.longitude,
            accuracy: body.accuracy ?? 15,
            address: body.address ?? 'Sector 29, Gurgaon',
            source: 'MOBILE',
            capturedAt: now.toISOString(),
          });

          return this.sendJson(res, 201, { shift: newShift, status: 'ACTIVE' });
        } finally {
          this.inFlightPunches.delete(userId);
        }
      }

      if (path === '/api/time-logging/punch-out' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (this.inFlightPunchOuts.has(userId)) {
          return this.sendError(res, 400, 'Punch out already in progress');
        }
        this.inFlightPunchOuts.add(userId);

        try {
          // Find active or paused shift
          const activeShift = Array.from(this.shifts.values()).find(
            (s) => s.userId === userId && (s.status === 'ACTIVE' || s.status === 'PAUSED')
          );
          if (!activeShift) {
            return this.sendError(res, 400, 'No active shift found to punch out');
          }

          const now = new Date();
          // Close ongoing active/paused interval
          const openInterval = this.intervals.find((i) => i.shiftId === activeShift.id && !i.endTime);
          if (openInterval) {
            openInterval.endTime = now.toISOString();
          }

          // Calculate total working minutes across all ACTIVE intervals
          let totalActiveMs = 0;
          const shiftIntervals = this.intervals.filter((i) => i.shiftId === activeShift.id);
          for (const intv of shiftIntervals) {
            if (intv.status === 'ACTIVE') {
              const start = new Date(intv.startTime).getTime();
              const end = intv.endTime ? new Date(intv.endTime).getTime() : now.getTime();
              totalActiveMs += Math.max(0, end - start);
            }
          }
          // At least 1 minute or duration
          const totalMinutes = Math.max(1, Math.round(totalActiveMs / 60000));

          activeShift.punchOutAt = now.toISOString();
          activeShift.status = 'COMPLETED';
          activeShift.totalMinutes = totalMinutes;
          activeShift.punchOutLat = body.latitude ?? activeShift.punchInLat;
          activeShift.punchOutLng = body.longitude ?? activeShift.punchInLng;
          activeShift.punchOutAccuracy = body.accuracy ?? 15;
          activeShift.punchOutAddress = body.address ?? 'Golf Course Road, Gurgaon';
          activeShift.updatedAt = now.toISOString();

          return this.sendJson(res, 200, { shift: activeShift, status: 'COMPLETED', totalMinutes });
        } finally {
          this.inFlightPunchOuts.delete(userId);
        }
      }

      if (path === '/api/time-logging/location' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.shiftId || body.latitude === undefined || body.longitude === undefined) {
          return this.sendError(res, 400, 'shiftId, latitude, and longitude are required');
        }
        const shift = this.shifts.get(body.shiftId);
        if (!shift) {
          return this.sendError(res, 404, 'Shift not found');
        }
        if (shift.status === 'COMPLETED') {
          return this.sendError(res, 400, 'Cannot record location for a completed shift');
        }

        const now = new Date().toISOString();
        const locId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.locations.push({
          id: locId,
          shiftId: shift.id,
          userId: shift.userId,
          latitude: body.latitude,
          longitude: body.longitude,
          accuracy: body.accuracy ?? 15,
          address: body.address ?? 'Gurgaon Checkpoint',
          source: 'MOBILE',
          capturedAt: now,
        });

        // Automatic resumption if shift was paused due to GPS loss
        if (shift.status === 'PAUSED') {
          // Close paused interval
          const pausedIntv = this.intervals.find((i) => i.shiftId === shift.id && !i.endTime);
          if (pausedIntv) pausedIntv.endTime = now;
          // Open active interval
          this.intervals.push({
            id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            shiftId: shift.id,
            startTime: now,
            status: 'ACTIVE',
          });
          shift.status = 'ACTIVE';
          shift.pauseReason = null;
          shift.pausedAt = null;
        }

        return this.sendJson(res, 200, { success: true, locationId: locId, status: shift.status });
      }

      if (path === '/api/time-logging/pause' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.shiftId) {
          return this.sendError(res, 400, 'shiftId is required');
        }
        const shift = this.shifts.get(body.shiftId);
        if (!shift) {
          return this.sendError(res, 404, 'Shift not found');
        }
        if (shift.status === 'COMPLETED') {
          return this.sendError(res, 400, 'Cannot pause a completed shift');
        }

        const now = new Date().toISOString();
        // Close current active interval
        const activeIntv = this.intervals.find((i) => i.shiftId === shift.id && i.status === 'ACTIVE' && !i.endTime);
        if (activeIntv) {
          activeIntv.endTime = now;
        }

        // Start paused interval
        this.intervals.push({
          id: `int_${Date.now()}`,
          shiftId: shift.id,
          startTime: now,
          status: 'PAUSED',
          reason: body.reason || 'GPS_DISABLED',
        });

        shift.status = 'PAUSED';
        shift.pauseReason = body.reason || 'GPS_DISABLED';
        shift.pausedAt = now;

        return this.sendJson(res, 200, { shiftId: shift.id, status: 'PAUSED' });
      }

      if (path === '/api/time-logging/resume' && method === 'POST') {
        const body = await this.parseJsonBody(req);
        if (!body.shiftId) {
          return this.sendError(res, 400, 'shiftId is required');
        }
        const shift = this.shifts.get(body.shiftId);
        if (!shift) {
          return this.sendError(res, 404, 'Shift not found');
        }
        if (shift.status !== 'PAUSED') {
          return this.sendError(res, 400, 'Shift is not paused');
        }

        const now = new Date().toISOString();
        // Close paused interval
        const pausedIntv = this.intervals.find((i) => i.shiftId === shift.id && i.status === 'PAUSED' && !i.endTime);
        if (pausedIntv) {
          pausedIntv.endTime = now;
        }

        // Start new active interval
        this.intervals.push({
          id: `int_${Date.now()}`,
          shiftId: shift.id,
          startTime: now,
          status: 'ACTIVE',
        });

        if (body.latitude !== undefined && body.longitude !== undefined) {
          this.locations.push({
            id: `loc_${Date.now()}`,
            shiftId: shift.id,
            userId: shift.userId,
            latitude: body.latitude,
            longitude: body.longitude,
            accuracy: body.accuracy ?? 15,
            address: body.address ?? 'Resumed Position',
            source: 'MOBILE',
            capturedAt: now,
          });
        }

        shift.status = 'ACTIVE';
        shift.pauseReason = null;
        shift.pausedAt = null;

        return this.sendJson(res, 200, { shiftId: shift.id, status: 'ACTIVE' });
      }

      if (path === '/api/time-logging/status' && method === 'GET') {
        const targetAgentId = parsedUrl.searchParams.get('agentId') || userId;
        if (targetAgentId !== userId && role !== 'SUPER_ADMIN') {
          const targetMem = this.teamMembers.find((m) => m.id === targetAgentId);
          if (!targetMem || targetMem.organizationId !== orgId) {
            return this.sendError(res, 403, 'Forbidden: Cannot access agent from another organization');
          }
        }

        const activeShift =
          Array.from(this.shifts.values()).find(
            (s) => s.userId === targetAgentId && (s.status === 'ACTIVE' || s.status === 'PAUSED')
          ) || null;

        const checkpoints = activeShift ? this.locations.filter((l) => l.shiftId === activeShift.id).length : 0;
        const resp: ShiftStatusResponse = {
          activeShift,
          todaySummary: {
            activeMinutes: activeShift ? 185 : 0,
            pausedMinutes: activeShift && activeShift.status === 'PAUSED' ? 25 : 0,
            checkpoints,
          },
        };
        return this.sendJson(res, 200, resp);
      }

      if (path === '/api/time-logging/timeline' && method === 'GET') {
        const targetAgentId = parsedUrl.searchParams.get('agentId') || userId;
        const targetDate = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

        if (targetAgentId !== userId && role !== 'SUPER_ADMIN') {
          const targetMem = this.teamMembers.find((m) => m.id === targetAgentId);
          if (!targetMem || targetMem.organizationId !== orgId) {
            return this.sendError(res, 403, 'Forbidden: Cannot access agent from another organization');
          }
        }

        const member = this.teamMembers.find((m) => m.id === targetAgentId) || {
          id: targetAgentId,
          name: 'Rohit Sharma',
          email: 'rohit@primeproperties.test',
        };

        const agentShifts = Array.from(this.shifts.values()).filter(
          (s) => s.userId === targetAgentId && s.punchInAt.startsWith(targetDate)
        );
        const currentShift = agentShifts[agentShifts.length - 1] || null;

        // Build chronological events
        const events: TimelineEvent[] = [];
        if (currentShift) {
          events.push({
            id: `ev_punch_in`,
            type: 'PUNCH_IN',
            timestamp: currentShift.punchInAt,
            latitude: currentShift.punchInLat || 28.4595,
            longitude: currentShift.punchInLng || 77.0266,
            address: currentShift.punchInAddress || 'Sector 29, Gurgaon',
          });

          // Checkpoints
          const locs = this.locations.filter((l) => l.shiftId === currentShift.id);
          for (const l of locs) {
            events.push({
              id: `ev_loc_${l.id}`,
              type: 'LOCATION_CHECK',
              timestamp: l.capturedAt,
              latitude: l.latitude,
              longitude: l.longitude,
              accuracy: l.accuracy,
              address: l.address,
            });
          }

          // Intervals (pauses & resumes)
          const shiftIntvs = this.intervals.filter((i) => i.shiftId === currentShift.id);
          for (const intv of shiftIntvs) {
            if (intv.status === 'PAUSED') {
              events.push({
                id: `ev_pause_${intv.id}`,
                type: 'PAUSE',
                timestamp: intv.startTime,
                reason: intv.reason || 'GPS_DISABLED',
              });
              if (intv.endTime) {
                events.push({
                  id: `ev_resume_${intv.id}`,
                  type: 'RESUME',
                  timestamp: intv.endTime,
                });
              }
            }
          }

          if (currentShift.punchOutAt) {
            events.push({
              id: `ev_punch_out`,
              type: 'PUNCH_OUT',
              timestamp: currentShift.punchOutAt,
              latitude: currentShift.punchOutLat || undefined,
              longitude: currentShift.punchOutLng || undefined,
              address: currentShift.punchOutAddress || undefined,
            });
          }
        }

        // Sort events chronologically
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const resp: TimelineResponse = {
          agent: { id: member.id, name: member.name, email: member.email },
          date: targetDate,
          shift: currentShift,
          events,
          summary: {
            activeMinutes: currentShift?.totalMinutes || 240,
            pausedMinutes: 30,
          },
        };
        return this.sendJson(res, 200, resp);
      }

      if (path === '/api/time-logging/history' && method === 'GET') {
        const targetAgentId = parsedUrl.searchParams.get('agentId') || userId;
        if (targetAgentId !== userId && role !== 'SUPER_ADMIN') {
          const targetMem = this.teamMembers.find((m) => m.id === targetAgentId);
          if (!targetMem || targetMem.organizationId !== orgId) {
            return this.sendError(res, 403, 'Forbidden: Cannot access agent from another organization');
          }
        }

        const points = this.locations
          .filter((l) => l.userId === targetAgentId)
          .map((l) => ({
            id: l.id,
            latitude: l.latitude,
            longitude: l.longitude,
            accuracy: l.accuracy,
            address: l.address,
            capturedAt: l.capturedAt,
          }));
        return this.sendJson(res, 200, { points });
      }

      if (path === '/api/time-logging/summary' && method === 'GET') {
        const brokerId = role === 'SUPER_ADMIN' ? (parsedUrl.searchParams.get('brokerId') || orgId) : orgId;
        const members = this.teamMembers.filter((m) => (role === 'SUPER_ADMIN' ? (brokerId ? m.organizationId === brokerId : true) : m.organizationId === brokerId));

        const agents = members.map((m) => {
          const agentShifts = Array.from(this.shifts.values()).filter((s) => s.userId === m.id);
          const totalWorkingMinutes = agentShifts.reduce((acc, s) => acc + (s.totalMinutes || 0), 0) || 420;
          return {
            id: m.id,
            name: m.name,
            role: m.role,
            totalWorkingMinutes,
            shiftsCount: agentShifts.length || 1,
            lastActiveAt: m.lastLoginAt || new Date().toISOString(),
          };
        });

        const resp: TimeLoggingSummaryResponse = { agents };
        return this.sendJson(res, 200, resp);
      }

      // Default 404
      return this.sendError(res, 404, `Endpoint ${method} ${path} not found`);
    } catch (err: any) {
      return this.sendError(res, 500, err?.message || 'Internal simulator error');
    }
  }

  // --- Filtering Helpers ---

  private filterKycRecords(params: URLSearchParams, role: string, orgId: string): KycDocumentRecord[] {
    let list = [...this.kycDocuments];

    // Tenant / Organization scope
    if (role !== 'SUPER_ADMIN') {
      list = list.filter((d) => d.organizationId === orgId);
    } else if (params.get('brokerId')) {
      const bId = params.get('brokerId')!;
      list = list.filter((d) => d.organizationId === bId);
    }

    if (params.get('agentId')) {
      const aId = params.get('agentId')!;
      list = list.filter((d) => d.userId === aId);
    }

    // Status filter
    const status = params.get('status');
    if (status && status !== 'ALL') {
      list = list.filter((d) => d.status.toUpperCase() === status.toUpperCase());
    }

    // Role filter
    const roleParam = params.get('role');
    if (roleParam && roleParam !== 'ALL') {
      list = list.filter((d) => d.user.role.toUpperCase() === roleParam.toUpperCase());
    }

    // Search query (name, email, phone, docNumber, reraNumber)
    const search = params.get('search');
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.user.name.toLowerCase().includes(q) ||
          d.user.email.toLowerCase().includes(q) ||
          (d.user.phone && d.user.phone.toLowerCase().includes(q)) ||
          (d.docNumber && d.docNumber.toLowerCase().includes(q)) ||
          (d.organization.reraNumber && d.organization.reraNumber.toLowerCase().includes(q))
      );
    }

    // Date Range Presets
    const datePreset = params.get('datePreset');
    const from = params.get('from');
    const to = params.get('to');
    list = this.applyDateFilter(list, datePreset, from, to, (item) => item.createdAt);

    // Explicit row selections
    const selectedIds = (params.get('selectedIds') || params.get('ids'))?.split(',').filter(Boolean);
    if (selectedIds && selectedIds.length > 0) {
      if (role !== 'SUPER_ADMIN') {
        list = this.kycDocuments.filter((d) => selectedIds.includes(d.id) && d.organizationId === orgId);
      } else {
        list = this.kycDocuments.filter((d) => selectedIds.includes(d.id));
      }
    }

    return list;
  }

  private filterTeamRecords(params: URLSearchParams, role: string, orgId: string): TeamMemberRecord[] {
    let list = [...this.teamMembers];

    if (role !== 'SUPER_ADMIN') {
      list = list.filter((m) => m.organizationId === orgId);
    } else if (params.get('brokerId')) {
      const bId = params.get('brokerId')!;
      list = list.filter((m) => m.organizationId === bId);
    }

    if (params.get('agentId')) {
      const aId = params.get('agentId')!;
      list = list.filter((m) => m.id === aId);
    }

    const status = params.get('status');
    if (status && status !== 'ALL') {
      list = list.filter((m) => m.status.toUpperCase() === status.toUpperCase());
    }

    const roleParam = params.get('role');
    if (roleParam && roleParam !== 'ALL') {
      list = list.filter((m) => m.role.toUpperCase() === roleParam.toUpperCase());
    }

    const search = params.get('search');
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.phone && m.phone.toLowerCase().includes(q))
      );
    }

    const datePreset = params.get('datePreset');
    const from = params.get('from');
    const to = params.get('to');
    list = this.applyDateFilter(list, datePreset, from, to, (item) => item.createdAt);

    const selectedIds = (params.get('selectedIds') || params.get('ids'))?.split(',').filter(Boolean);
    if (selectedIds && selectedIds.length > 0) {
      if (role !== 'SUPER_ADMIN') {
        list = this.teamMembers.filter((m) => selectedIds.includes(m.id) && m.organizationId === orgId);
      } else {
        list = this.teamMembers.filter((m) => selectedIds.includes(m.id));
      }
    }

    return list;
  }

  private applyDateFilter<T>(
    items: T[],
    datePreset: string | null,
    from: string | null,
    to: string | null,
    getDateStr: (item: T) => string
  ): T[] {
    if (!datePreset || datePreset === 'ALL') {
      if (!from && !to) return items;
    }

    const now = new Date();
    // Indian Standard Time (UTC + 5:30)
    const istOffset = 5.5 * 3600 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istMidnightToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - istOffset);
    const istEndOfToday = new Date(istMidnightToday.getTime() + 86400000 - 1);

    let start = 0;
    let end = Number.MAX_SAFE_INTEGER;

    if (datePreset === 'today') {
      start = istMidnightToday.getTime();
      end = istEndOfToday.getTime();
    } else if (datePreset === 'yesterday') {
      start = istMidnightToday.getTime() - 86400000;
      end = istMidnightToday.getTime() - 1;
    } else if (datePreset === 'last_7_days') {
      start = istMidnightToday.getTime() - 6 * 86400000;
      end = istEndOfToday.getTime();
    } else if (datePreset === 'this_month') {
      const istMonthStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - istOffset);
      start = istMonthStart.getTime();
      end = istEndOfToday.getTime();
    } else if (datePreset === 'custom' || from || to) {
      if (from) start = new Date(from).getTime();
      if (to) end = new Date(to).getTime();
    }

    return items.filter((item) => {
      const t = new Date(getDateStr(item)).getTime();
      return t >= start && t <= end;
    });
  }

  // --- Export Generators ---

  private async exportKyc(res: http.ServerResponse, items: KycDocumentRecord[], format: string) {
    if (format === 'csv') {
      const csv = this.generateKycCsv(items);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kyc-documents.csv"',
      });
      return res.end(csv);
    }

    if (format === 'pdf') {
      const pdfBuffer = await this.generateKycPdf(items);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="kyc-report.pdf"',
      });
      return res.end(pdfBuffer);
    }

    if (format === 'xlsx') {
      const xlsxBuffer = await this.generateKycExcel(items);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="kyc-report.xlsx"',
      });
      return res.end(xlsxBuffer);
    }

    return this.sendError(res, 400, `Unsupported export format: ${format}`);
  }

  private async exportTeam(res: http.ServerResponse, items: TeamMemberRecord[], format: string) {
    if (format === 'csv') {
      const csv = this.generateTeamCsv(items);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="team-roster.csv"',
      });
      return res.end(csv);
    }

    if (format === 'pdf') {
      const pdfBuffer = await this.generateTeamPdf(items);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="team-report.pdf"',
      });
      return res.end(pdfBuffer);
    }

    if (format === 'xlsx') {
      const xlsxBuffer = await this.generateTeamExcel(items);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="team-roster.xlsx"',
      });
      return res.end(xlsxBuffer);
    }

    return this.sendError(res, 400, `Unsupported export format: ${format}`);
  }

  // --- CSV Helpers with UTF-8 BOM ---

  private generateKycCsv(items: KycDocumentRecord[]): Buffer {
    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const headers = ['ID', 'User Name', 'Email', 'Phone', 'Role', 'Document Type', 'Document Number', 'Status', 'Submitted At'];
    const rows = items.map((i) => [
      i.id,
      `"${i.user.name.replace(/"/g, '""')}"`,
      i.user.email,
      i.user.phone || '',
      i.user.role,
      i.docType,
      i.docNumber,
      i.status,
      i.createdAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return Buffer.concat([BOM, Buffer.from(csvContent, 'utf-8')]);
  }

  private generateTeamCsv(items: TeamMemberRecord[]): Buffer {
    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'KYC Status', 'Open Leads', 'Won (30d)', 'Joined At'];
    const rows = items.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      i.email,
      i.phone,
      i.role,
      i.status,
      i.kycStatus,
      i.stats?.openLeads ?? 0,
      i.stats?.won30d ?? 0,
      i.createdAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return Buffer.concat([BOM, Buffer.from(csvContent, 'utf-8')]);
  }

  // --- Real PDF Generation via PDFKit ---

  private async generateKycPdf(items: KycDocumentRecord[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Title & Metadata
      doc.fontSize(18).text('BrokerIQ KYC Verification Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()} | Total Records: ${items.length}`, { align: 'center' });
      doc.moveDown(1.5);

      // Table Header
      doc.fontSize(10).fillColor('#1e293b');
      doc.text('Name / Email                  Role             Doc Type       Status       Submitted', 40, doc.y);
      doc.moveDown(0.3);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Rows
      for (const item of items) {
        const line = `${item.user.name.padEnd(25)} ${item.user.role.padEnd(16)} ${item.docType.padEnd(14)} ${item.status.padEnd(12)} ${item.createdAt.slice(0, 10)}`;
        doc.fontSize(9).fillColor('#334155').text(line, 40, doc.y);
        doc.moveDown(0.4);
      }

      // Summary Totals
      doc.moveDown(1);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      const pendingCount = items.filter((i) => i.status === 'PENDING').length;
      const verifiedCount = items.filter((i) => i.status === 'VERIFIED').length;
      const rejectedCount = items.filter((i) => i.status === 'REJECTED').length;
      doc.fontSize(10).fillColor('#0f172a').text(
        `Summary Counts: Pending: ${pendingCount} | Verified: ${verifiedCount} | Rejected: ${rejectedCount}`,
        { align: 'right' }
      );

      doc.end();
    });
  }

  private async generateTeamPdf(items: TeamMemberRecord[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text('BrokerIQ Team Roster & Performance Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()} | Total Members: ${items.length}`, { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(10).fillColor('#1e293b');
      doc.text('Member Name                   Role             Status       KYC Status     Leads / Won', 40, doc.y);
      doc.moveDown(0.3);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      let totalLeads = 0;
      let totalWon = 0;

      for (const item of items) {
        const leads = item.stats?.openLeads ?? 0;
        const won = item.stats?.won30d ?? 0;
        totalLeads += leads;
        totalWon += won;
        const line = `${item.name.padEnd(28)} ${item.role.padEnd(16)} ${item.status.padEnd(12)} ${item.kycStatus.padEnd(14)} ${leads} leads / ${won} won`;
        doc.fontSize(9).fillColor('#334155').text(line, 40, doc.y);
        doc.moveDown(0.4);
      }

      doc.moveDown(1);
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#0f172a').text(
        `Totals: Open Leads: ${totalLeads} | Deals Won (30d): ${totalWon}`,
        { align: 'right' }
      );

      doc.end();
    });
  }

  // --- Real OpenXML Excel (.xlsx) Package Generator via fflate ---

  private async generateKycExcel(items: KycDocumentRecord[]): Promise<Buffer> {
    const sheetData = items
      .map(
        (i, idx) => `
    <row r="${idx + 2}">
      <c r="A${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.id)}</t></is></c>
      <c r="B${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.user.name)}</t></is></c>
      <c r="C${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.user.email)}</t></is></c>
      <c r="D${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.user.role)}</t></is></c>
      <c r="E${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.docType)}</t></is></c>
      <c r="F${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.status)}</t></is></c>
      <c r="G${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.createdAt)}</t></is></c>
    </row>`
      )
      .join('');

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>ID</t></is></c>
      <c r="B1" t="inlineStr"><is><t>User Name</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Email</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Role</t></is></c>
      <c r="E1" t="inlineStr"><is><t>Doc Type</t></is></c>
      <c r="F1" t="inlineStr"><is><t>Status</t></is></c>
      <c r="G1" t="inlineStr"><is><t>Submitted At</t></is></c>
    </row>
    ${sheetData}
  </sheetData>
</worksheet>`;

    return this.createOpenXmlPackage(sheetXml);
  }

  private async generateTeamExcel(items: TeamMemberRecord[]): Promise<Buffer> {
    const sheetData = items
      .map(
        (i, idx) => `
    <row r="${idx + 2}">
      <c r="A${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.id)}</t></is></c>
      <c r="B${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.name)}</t></is></c>
      <c r="C${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.email)}</t></is></c>
      <c r="D${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.role)}</t></is></c>
      <c r="E${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.status)}</t></is></c>
      <c r="F${idx + 2}" t="inlineStr"><is><t>${this.xmlEscape(i.kycStatus)}</t></is></c>
      <c r="G${idx + 2}"><v>${i.stats?.openLeads ?? 0}</v></c>
      <c r="H${idx + 2}"><v>${i.stats?.won30d ?? 0}</v></c>
    </row>`
      )
      .join('');

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>ID</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Name</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Email</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Role</t></is></c>
      <c r="E1" t="inlineStr"><is><t>Status</t></is></c>
      <c r="F1" t="inlineStr"><is><t>KYC Status</t></is></c>
      <c r="G1"><is><t>Open Leads</t></is></c>
      <c r="H1"><is><t>Won (30d)</t></is></c>
    </row>
    ${sheetData}
  </sheetData>
</worksheet>`;

    return this.createOpenXmlPackage(sheetXml);
  }

  private createOpenXmlPackage(sheet1Xml: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const files: Record<string, Uint8Array> = {
        '[Content_Types].xml': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
        '_rels/.rels': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
        'xl/workbook.xml': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
        'xl/_rels/workbook.xml.rels': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
        'xl/worksheets/sheet1.xml': fflate.strToU8(sheet1Xml),
      };

      fflate.zip(files, (err: any, out: Uint8Array) => {
        if (err) return reject(err);
        resolve(Buffer.from(out));
      });
    });
  }

  private xmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
