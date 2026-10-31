import { AdminUsersController } from './admin-users.controller';
import type { RequestUser } from '../../common/decorators';

describe('AdminUsersController - KYC Filtering & Multi-Format Export', () => {
  let controller: AdminUsersController;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNotifications: any;
  let mockAuth: any;

  const mockAdminUser: RequestUser = {
    id: 'admin_1',
    role: 'SUPER_ADMIN',
    orgId: 'org_1',
    email: 'admin@brokeriq.test',
  };

  const sampleDocs = [
    {
      id: 'doc_1',
      docType: 'AADHAAR',
      docNumber: '1234-5678-9012',
      status: 'VERIFIED',
      reviewNote: 'All good',
      createdAt: new Date('2026-10-25T10:00:00Z'),
      user: { id: 'u1', name: 'Vikram Singh', email: 'vikram@broker.test', phone: '+919876543210', role: 'BROKER_AGENT' },
      organization: { id: 'org_1', name: 'Singh Properties', reraNumber: 'HRERA-1234', verification: 'VERIFIED' },
    },
    {
      id: 'doc_2',
      docType: 'RERA_CERTIFICATE',
      docNumber: 'RERA-FIRM-99',
      status: 'PENDING',
      reviewNote: null,
      createdAt: new Date('2026-10-28T12:00:00Z'),
      user: null,
      organization: { id: 'org_2', name: 'Prime Realty', reraNumber: 'HRERA-9999', verification: 'PENDING' },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      kycDocument: {
        findMany: jest.fn().mockResolvedValue(sampleDocs),
        update: jest.fn(),
      },
      user: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    mockAudit = { log: jest.fn() };
    mockNotifications = { notify: jest.fn() };
    mockAuth = { revokeAll: jest.fn() };

    controller = new AdminUsersController(mockPrisma, mockAudit, mockNotifications, mockAuth);
  });

  describe('kyc query filtering', () => {
    it('filters by status, role, search, datePreset and brokerId', async () => {
      await controller.kyc('VERIFIED', 'BROKER_AGENT', 'Vikram', 'org_1', 'u1', 'last_7_days');

      expect(mockPrisma.kycDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'VERIFIED',
            OR: [
              { organizationId: 'org_1' },
              { user: { organizationId: 'org_1' } },
            ],
            userId: 'u1',
            user: { role: 'BROKER_AGENT' },
            createdAt: expect.any(Object),
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ docNumber: { contains: 'Vikram', mode: 'insensitive' } }),
                  expect.objectContaining({ user: { name: { contains: 'Vikram', mode: 'insensitive' } } }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('does not filter by status when status is ALL', async () => {
      await controller.kyc('ALL');
      const call = mockPrisma.kycDocument.findMany.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
    });
  });

  describe('exportKyc', () => {
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

    it('exports as XLSX spreadsheet with correct headers', async () => {
      await controller.exportKyc('xlsx', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.xlsx'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const sentBuffer = mockRes.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sentBuffer)).toBe(true);
      expect(sentBuffer[0]).toBe(0x50); // ZIP PK header
    });

    it('exports as PDF report with correct headers', async () => {
      await controller.exportKyc('pdf', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.pdf'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const sentBuffer = mockRes.send.mock.calls[0][0];
      expect(Buffer.isBuffer(sentBuffer)).toBe(true);
      expect(sentBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('exports as CSV with UTF-8 BOM and correct headers', async () => {
      await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.csv'),
      );
      expect(mockRes.send).toHaveBeenCalled();
      const sentCsv = mockRes.send.mock.calls[0][0];
      expect(typeof sentCsv).toBe('string');
      expect(sentCsv.startsWith('\ufeff')).toBe(true);
      expect(sentCsv).toContain('Vikram Singh');
    });

    it('filters specifically by ids when provided', async () => {
      await controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'doc_1,doc_2', mockRes);

      expect(mockPrisma.kycDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['doc_1', 'doc_2'] } },
        }),
      );
    });

    describe('Multi-tenant security & IDOR prevention', () => {
      it('enforces organizationId scoping on BROKER_ADMIN even when ids is provided (cross-tenant IDOR protection)', async () => {
        const attackerUser: RequestUser = {
          id: 'attacker_broker_id',
          role: 'BROKER_ADMIN',
          orgId: 'org_attacker_firm',
          email: 'attacker@firm.test',
        };

        // Attacker attempts to exfiltrate doc_victim_99 belonging to another firm
        await controller.exportKyc(
          'csv',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'doc_victim_99',
          mockRes,
          attackerUser,
        );

        expect(mockPrisma.kycDocument.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: { in: ['doc_victim_99'] },
              OR: [
                { organizationId: 'org_attacker_firm' },
                { user: { organizationId: 'org_attacker_firm' } },
              ],
            }),
          }),
        );

        const callArgs = mockPrisma.kycDocument.findMany.mock.calls[0][0];
        expect(callArgs.where.organizationId).toBeUndefined();
        expect(callArgs.where.id).toEqual({ in: ['doc_victim_99'] });
        expect(callArgs.where.OR).toEqual([
          { organizationId: 'org_attacker_firm' },
          { user: { organizationId: 'org_attacker_firm' } },
        ]);
      });

      it('prevents BROKER_ADMIN from overriding tenant scope via brokerId query parameter (spoofing protection)', async () => {
        const brokerUser: RequestUser = {
          id: 'admin_firm_a',
          role: 'BROKER_ADMIN',
          orgId: 'org_firm_a',
          email: 'admin@firma.test',
        };

        // Attacker attempts to pass a foreign brokerId in query param
        await controller.exportKyc(
          'csv',
          undefined,
          undefined,
          undefined,
          'org_foreign_victim', // spoofed query param
          undefined,
          undefined,
          undefined,
          undefined,
          'doc_1',
          mockRes,
          brokerUser,
        );

        const callArgs = mockPrisma.kycDocument.findMany.mock.calls[0][0];
        expect(callArgs.where.organizationId).toBeUndefined();
        expect(callArgs.where.OR).toEqual([
          { organizationId: 'org_firm_a' },
          { user: { organizationId: 'org_firm_a' } },
        ]);
        expect(callArgs.where.OR).not.toContainEqual({ organizationId: 'org_foreign_victim' });
      });

      it('throws ForbiddenException when a non-SUPER_ADMIN user has no orgId context', async () => {
        const badUser: RequestUser = {
          id: 'admin_no_org',
          role: 'BROKER_ADMIN',
          orgId: undefined as any,
          email: 'no_org@test.com',
        };

        await expect(
          controller.exportKyc('csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockRes, badUser),
        ).rejects.toThrow();
      });

      it('allows SUPER_ADMIN to export globally or target specific brokerId without enforcement of user.orgId', async () => {
        const superAdminUser: RequestUser = {
          id: 'super_admin',
          role: 'SUPER_ADMIN',
          orgId: 'super_org',
          email: 'super@brokeriq.test',
        };

        // SUPER_ADMIN queries doc_1 across any organization
        await controller.exportKyc(
          'csv',
          undefined,
          undefined,
          undefined,
          undefined, // no brokerId constraint
          undefined,
          undefined,
          undefined,
          undefined,
          'doc_1',
          mockRes,
          superAdminUser,
        );

        const callArgs = mockPrisma.kycDocument.findMany.mock.calls[0][0];
        expect(callArgs.where.id).toEqual({ in: ['doc_1'] });
        expect(callArgs.where.organizationId).toBeUndefined();
        expect(callArgs.where.OR).toBeUndefined();
      });

      it('includes agent KYC documents via user.organizationId mapping in where.OR clause', async () => {
        const brokerUser: RequestUser = {
          id: 'admin_firm_a',
          role: 'BROKER_ADMIN',
          orgId: 'org_firm_a',
          email: 'admin@firma.test',
        };

        await controller.exportKyc(
          'csv',
          'ALL',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          mockRes,
          brokerUser,
        );

        const callArgs = mockPrisma.kycDocument.findMany.mock.calls[0][0];
        expect(callArgs.where.OR).toBeDefined();
        const matchesAgentDocs = callArgs.where.OR.some(
          (cond: any) => cond.user?.organizationId === 'org_firm_a',
        );
        expect(matchesAgentDocs).toBe(true);
      });
    });
  });
});
