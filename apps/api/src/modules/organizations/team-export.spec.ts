import { OrganizationsController } from './organizations.controller';
import type { RequestUser } from '../../common/decorators';

describe('OrganizationsController - Team Filtering & Multi-Format Export', () => {
  let controller: OrganizationsController;
  let mockPrisma: any;
  let mockAuth: any;
  let mockUsage: any;
  let mockMail: any;
  let mockAudit: any;
  let mockNotifications: any;
  let mockFeatures: any;
  let mockAccess: any;

  const mockAdminUser: RequestUser = {
    id: 'user_admin',
    role: 'BROKER_ADMIN',
    orgId: 'org_1',
    email: 'admin@broker.test',
  };

  const sampleMembers = [
    {
      id: 'agent_1',
      name: 'Deepak Verma',
      email: 'deepak@broker.test',
      phone: '+919811122233',
      role: 'BROKER_AGENT',
      status: 'ACTIVE',
      avatarUrl: null,
      lastLoginAt: new Date(),
      createdAt: new Date('2026-10-01T09:00:00Z'),
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(sampleMembers),
      },
      invite: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orgSetting: {
        findUnique: jest.fn().mockResolvedValue({
          value: {
            agent_1: { monthlyDeals: 10, monthlyRevenue: 1000000, monthlyLeads: 50, commissionPct: 15 },
          },
        }),
      },
      lead: {
        count: jest.fn().mockResolvedValue(5),
      },
      activity: {
        count: jest.fn().mockResolvedValue(12),
      },
      kycDocument: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'kyc_1', docType: 'AADHAAR', docNumber: '1111-2222', status: 'VERIFIED' },
        ]),
      },
      userLocation: {
        findFirst: jest.fn().mockResolvedValue({
          latitude: 28.45,
          longitude: 77.05,
          accuracy: 10,
          source: 'MOBILE',
          capturedAt: new Date(),
        }),
      },
    };

    mockAuth = {};
    mockUsage = {};
    mockMail = {};
    mockAudit = {};
    mockNotifications = {};
    mockFeatures = {};
    mockAccess = {};

    controller = new OrganizationsController(
      mockAccess,
      mockPrisma,
      mockAuth,
      mockUsage,
      mockMail,
      mockAudit,
      mockNotifications,
      mockFeatures,
    );
  });

  describe('team query filtering', () => {
    it('passes filters down to readBrokerTeam', async () => {
      const res = await controller.team(
        mockAdminUser,
        undefined,
        'BROKER_AGENT',
        'ACTIVE',
        'Deepak',
        'agent_1',
        'last_7_days',
      );

      expect(res.organizationId).toBe('org_1');
      expect(res.members.length).toBe(1);
      expect(res.members[0].name).toBe('Deepak Verma');
      expect(res.members[0].kycStatus).toBe('VERIFIED');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org_1',
            role: 'BROKER_AGENT',
            status: 'ACTIVE',
            id: 'agent_1',
            createdAt: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('exportTeam', () => {
    let mockRes: any;

    beforeEach(() => {
      mockRes = {
        headers: {} as Record<string, string>,
        setHeader: jest.fn((k: string, v: string) => {
          mockRes.headers[k.toLowerCase()] = v;
        }),
        send: jest.fn(),
      };
    });

    it('exports team roster as XLSX spreadsheet', async () => {
      await controller.exportTeam(mockAdminUser, 'xlsx', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.xlsx'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const buffer = mockRes.send.mock.calls[0][0];
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x50); // ZIP PK header
    });

    it('exports team roster as PDF report', async () => {
      await controller.exportTeam(mockAdminUser, 'pdf', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.pdf'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const buffer = mockRes.send.mock.calls[0][0];
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('exports team roster as CSV with UTF-8 BOM', async () => {
      await controller.exportTeam(mockAdminUser, 'csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.csv'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const csvStr = mockRes.send.mock.calls[0][0];
      expect(csvStr.startsWith('\ufeff')).toBe(true);
      expect(csvStr).toContain('Deepak Verma');
    });

    it('filters specifically by ids when provided', async () => {
      await controller.exportTeam(mockAdminUser, 'csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'agent_1', mockRes);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['agent_1'] },
          }),
        }),
      );
    });
  });

  describe('Multi-Tenant BOLA / IDOR Defense', () => {
    it('ignores ?orgId= override for BROKER_ADMIN and scopes strictly to caller organization', async () => {
      const res = await controller.team(
        mockAdminUser, // orgId: 'org_1'
        'org_competing_firm', // Attempted cross-tenant IDOR
      );

      expect(res.organizationId).toBe('org_1');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org_1',
          }),
        }),
      );
    });

    it('ignores ?orgId= override on exportTeam for BROKER_ADMIN and exports only caller organization', async () => {
      const mockRes: any = {
        headers: {},
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.exportTeam(
        mockAdminUser, // orgId: 'org_1'
        'csv',
        'org_competing_firm', // Attempted cross-tenant IDOR
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockRes,
      );

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org_1',
          }),
        }),
      );
    });

    it('allows SUPER_ADMIN to query with explicit overrideOrgId', async () => {
      const superAdminUser: RequestUser = {
        id: 'super_admin_1',
        role: 'SUPER_ADMIN',
        orgId: null,
        email: 'super@brokeriq.test',
      };

      const res = await controller.team(
        superAdminUser,
        'org_target_firm',
      );

      expect(res.organizationId).toBe('org_target_firm');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org_target_firm',
          }),
        }),
      );
    });
  });
});
