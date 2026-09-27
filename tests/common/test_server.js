// tests/common/test_server.js
const http = require('node:http');
const { parse: parseUrl } = require('node:url');
const crypto = require('node:crypto');
const {
  TEST_PORT,
  ROLES,
  LEAD_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
  USERS,
  ORGANIZATIONS,
  SUBSCRIPTION_STATUS
} = require('./config');
const { PLANS_FIXTURE, INITIAL_PROPERTIES, INITIAL_LEADS } = require('./fixtures');
const { encrypt, decrypt, maskSecret } = require('./crypto_utils');

class TestServer {
  constructor(port = TEST_PORT) {
    this.port = port;
    this.server = null;
    this.resetState();
  }

  resetState() {
    // Deep clone state for isolated tests
    this.users = JSON.parse(JSON.stringify(USERS));
    this.organizations = JSON.parse(JSON.stringify(ORGANIZATIONS));
    this.plans = JSON.parse(JSON.stringify(PLANS_FIXTURE));
    this.properties = JSON.parse(JSON.stringify(INITIAL_PROPERTIES));
    this.leads = JSON.parse(JSON.stringify(INITIAL_LEADS));
    this.customers = [
      {
        id: 'cust_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        name: 'Rajesh Mehta',
        phone: '+919876543299',
        email: 'rajesh.mehta@example.com',
        city: 'Bangalore',
        budgetMin: 10000000,
        budgetMax: 20000000,
        preferredLocations: ['Whitefield'],
        status: 'ACTIVE',
        deletedAt: null
      }
    ];
    this.subscriptions = {
      [ORGANIZATIONS.ORG1.id]: {
        id: 'sub_apex_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        planId: 'plan_pro',
        planTier: 'PRO',
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: new Date(Date.now() - 5 * 86400000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
        trialStart: null,
        trialEnd: null,
        gracePeriodEnd: null,
        usage: {
          leadsIngested: 45,
          whatsappSent: 230,
          aiCalls: 12
        }
      },
      [ORGANIZATIONS.ORG2.id]: {
        id: 'sub_zenith_002',
        organizationId: ORGANIZATIONS.ORG2.id,
        planId: 'plan_starter',
        planTier: 'STARTER',
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: new Date(Date.now() - 2 * 86400000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 28 * 86400000).toISOString(),
        trialStart: null,
        trialEnd: null,
        gracePeriodEnd: null,
        usage: {
          leadsIngested: 10,
          whatsappSent: 50,
          aiCalls: 5
        }
      }
    };
    this.followUps = [
      {
        id: 'fol_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        leadId: 'lead_vikram_001',
        type: 'CALL',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'SCHEDULED',
        outcomeNotes: null,
        assignedToId: USERS.BROKER_STAFF_ORG1.id,
        deletedAt: null
      }
    ];
    this.siteVisits = [
      {
        id: 'sv_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        leadId: 'lead_vikram_001',
        propertyId: 'prop_whitefield_001',
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        status: 'SCHEDULED',
        feedback: null,
        rating: null,
        clientAttended: false,
        deletedAt: null
      }
    ];
    this.conversations = [
      {
        id: 'conv_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        channel: 'WHATSAPP',
        externalChatId: '+919876500001',
        leadId: 'lead_vikram_001',
        unreadCount: 0,
        status: 'OPEN',
        messages: [
          {
            id: 'msg_001',
            direction: 'INBOUND',
            content: 'Hello, looking for a 3 BHK in Whitefield around 1.5 Cr',
            createdAt: new Date().toISOString()
          }
        ]
      }
    ];
    this.automationRules = [
      {
        id: 'rule_001',
        organizationId: ORGANIZATIONS.ORG1.id,
        name: 'Auto WhatsApp on New Lead',
        triggerType: 'LEAD_CREATED',
        triggerConditions: {},
        actionType: 'SEND_WHATSAPP',
        actionConfig: { templateId: 'welcome_template_01' },
        delayMinutes: 5,
        businessHoursOnly: true,
        isActive: true
      }
    ];
    this.settings = [
      {
        id: 'set_001',
        organizationId: null, // Global
        category: 'GENERAL',
        key: 'platform_name',
        value: 'BrokerIQ Platform'
      },
      {
        id: 'set_002',
        organizationId: null,
        category: 'SECURITY',
        key: 'jwt_access_ttl',
        value: '15m'
      },
      {
        id: 'set_003',
        organizationId: ORGANIZATIONS.ORG1.id, // Tenant override
        category: 'BRANDING',
        key: 'primary_color',
        value: '#0F766E'
      }
    ];
    this.credentials = {
      HOUSING_COM: {
        type: 'HOUSING_COM',
        status: 'CONFIGURED',
        apiKeyCipher: encrypt('housing_partner_secret_key_prod'),
        endpoint: 'https://api.housing.com/v2/leads'
      },
      META_WHATSAPP: {
        type: 'META_WHATSAPP',
        status: 'CONFIGURED',
        apiKeyCipher: encrypt('meta_permanent_system_token_xyz'),
        phoneNumberId: 'phone_id_999888'
      },
      RAZORPAY: {
        type: 'RAZORPAY',
        status: 'CONFIGURED',
        keyId: 'rzp_test_12345678',
        keySecretCipher: encrypt('rzp_secret_key_87654321')
      },
      GROQ_AI: {
        type: 'GROQ_AI',
        status: 'CONFIGURED',
        apiKeyCipher: encrypt('gsk_groq_production_key_token'),
        defaultModel: 'llama-3.3-70b-versatile'
      }
    };
    this.auditLogs = [];
    this.activeTokens = new Map(); // token -> user
    this.activeRefreshTokens = new Map(); // refreshToken -> { userId, familyId }
    this.otpStore = new Map(); // phone -> { otp, attempts, expiresAt, sendCount, lastSentAt }
    this.invoices = [];
    this.processedWebhooks = new Set();
  }

  logAudit(action, entityType, entityId, organizationId, userId, details = {}) {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      action,
      entityType,
      entityId,
      organizationId,
      userId,
      details,
      createdAt: new Date().toISOString()
    });
  }

  generateToken(user) {
    const token = `jwt_acc_${user.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    this.activeTokens.set(token, user);
    return token;
  }

  generateRefreshToken(user, familyId = null) {
    const fid = familyId || `fam_${crypto.randomBytes(8).toString('hex')}`;
    const rToken = `jwt_ref_${user.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    this.activeRefreshTokens.set(rToken, { userId: user.id, familyId: fid, revoked: false });
    return rToken;
  }

  authenticateRequest(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice(7);
    return this.activeTokens.get(token) || null;
  }

  sendJson(res, statusCode, payload) {
    const jsonStr = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id'
    });
    res.end(jsonStr);
  }

  sendSuccess(res, data = null, meta = null, statusCode = 200) {
    const payload = { success: true };
    if (data !== null) payload.data = data;
    if (meta !== null) payload.meta = meta;
    this.sendJson(res, statusCode, payload);
  }

  sendError(res, statusCode, code, message, details = null) {
    const payload = {
      success: false,
      error: { code, message }
    };
    if (details) payload.error.details = details;
    this.sendJson(res, statusCode, payload);
  }

  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err) {
          this.sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
        }
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async handleRequest(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id'
      });
      return res.end();
    }

    const { pathname, query } = parseUrl(req.url, true);
    const method = req.method;

    // Body parsing
    let body = {};
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      try {
        body = await this.parseBody(req);
      } catch {
        return this.sendError(res, 400, 'BAD_REQUEST', 'Malformed JSON payload');
      }
    }

    // Health
    if (pathname === '/api/v1/health' && method === 'GET') {
      return this.sendSuccess(res, {
        status: 'ok',
        db: 'up',
        redis: 'up',
        queues: 'up',
        timestamp: new Date().toISOString()
      });
    }

    // -------------------------------------------------------------
    // MODULE 1: AUTH
    // -------------------------------------------------------------
    if (pathname === '/api/v1/auth/register' && method === 'POST') {
      const { name, email, password, phone, organizationName } = body;
      if (!name || !email || !password || !phone || !organizationName) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'All fields are required');
      }
      if (password.length < 8) {
        return this.sendError(res, 400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
      }
      if (!/^\+91[6789]\d{9}$/.test(phone)) {
        return this.sendError(res, 400, 'INVALID_PHONE', 'Phone must be a valid +91 Indian mobile number');
      }
      // Check existing email
      const emailExists = Object.values(this.users).some(u => u.email === email);
      if (emailExists) {
        return this.sendError(res, 409, 'CONFLICT', 'Email is already registered');
      }
      const orgId = `org_${Date.now()}`;
      const userId = `usr_${Date.now()}`;
      const newOrg = {
        id: orgId,
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'ACTIVE',
        planTier: 'TRIAL'
      };
      const newUser = {
        id: userId,
        email,
        phone,
        password,
        name,
        role: ROLES.BROKER_ADMIN,
        organizationId: orgId
      };
      this.organizations[orgId] = newOrg;
      this.users[userId] = newUser;
      const accessToken = this.generateToken(newUser);
      const refreshToken = this.generateRefreshToken(newUser);
      this.logAudit('REGISTER', 'ORGANIZATION', orgId, orgId, userId);
      return this.sendSuccess(
        res,
        {
          accessToken,
          refreshToken,
          user: { id: userId, email, name, role: newUser.role, organizationId: orgId },
          organization: newOrg
        },
        null,
        201
      );
    }

    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Email and password required');
      }
      const user = Object.values(this.users).find(u => u.email === email);
      if (!user || user.password !== password) {
        return this.sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }
      // Check org suspension
      if (user.organizationId) {
        const org = this.organizations[user.organizationId] || Object.values(this.organizations).find(o => o.id === user.organizationId);
        if (org && org.status === 'SUSPENDED') {
          return this.sendError(res, 403, 'ORGANIZATION_SUSPENDED', 'Organization has been suspended');
        }
      }
      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      this.logAudit('LOGIN', 'USER', user.id, user.organizationId, user.id);
      return this.sendSuccess(res, {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId
        }
      });
    }

    if (pathname === '/api/v1/auth/otp/send' && method === 'POST') {
      const { phone } = body;
      if (!phone || !/^\+91[6789]\d{9}$/.test(phone)) {
        return this.sendError(res, 400, 'INVALID_PHONE', 'Valid +91 mobile number required');
      }
      const existing = this.otpStore.get(phone);
      const now = Date.now();
      if (existing && existing.sendCount >= 3 && now - existing.lastSentAt < 600000) {
        return this.sendError(res, 429, 'RATE_LIMITED', 'Too many OTP requests. Try again in 10 minutes');
      }
      const otp = '123456'; // Deterministic test OTP
      const count = existing ? existing.sendCount + 1 : 1;
      this.otpStore.set(phone, {
        otp,
        attempts: 0,
        expiresAt: now + 300000,
        sendCount: count,
        lastSentAt: now
      });
      return this.sendSuccess(res, { message: 'OTP sent successfully', expiresInSeconds: 300 });
    }

    if (pathname === '/api/v1/auth/otp/verify' && method === 'POST') {
      const { phone, otp } = body;
      if (!phone || !otp) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Phone and OTP required');
      }
      const record = this.otpStore.get(phone);
      if (!record || Date.now() > record.expiresAt) {
        return this.sendError(res, 401, 'EXPIRED_OTP', 'OTP has expired or is invalid');
      }
      if (record.attempts >= 3) {
        this.otpStore.delete(phone);
        return this.sendError(res, 429, 'OTP_LOCKED', 'Max attempts exceeded. Please request a new OTP');
      }
      if (record.otp !== otp) {
        record.attempts += 1;
        return this.sendError(res, 401, 'INVALID_OTP', 'Incorrect OTP entered');
      }
      // OTP verified
      this.otpStore.delete(phone);
      let user = Object.values(this.users).find(u => u.phone === phone);
      if (!user) {
        // Auto-provision mobile user
        user = {
          id: `usr_otp_${Date.now()}`,
          phone,
          email: `${phone.replace('+', '')}@brokeriq.in`,
          name: 'Broker User',
          role: ROLES.BROKER_ADMIN,
          organizationId: ORGANIZATIONS.ORG1.id
        };
        this.users[user.id] = user;
      }
      const accessToken = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);
      return this.sendSuccess(res, {
        accessToken,
        refreshToken,
        user: { id: user.id, phone: user.phone, role: user.role, organizationId: user.organizationId }
      });
    }

    if (pathname === '/api/v1/auth/refresh' && method === 'POST') {
      const { refreshToken } = body;
      if (!refreshToken) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'refreshToken is required');
      }
      const tokenRecord = this.activeRefreshTokens.get(refreshToken);
      if (!tokenRecord) {
        return this.sendError(res, 401, 'INVALID_TOKEN', 'Refresh token is invalid or expired');
      }
      if (tokenRecord.revoked) {
        // Family revocation
        for (const [t, rec] of this.activeRefreshTokens.entries()) {
          if (rec.familyId === tokenRecord.familyId) {
            this.activeRefreshTokens.delete(t);
          }
        }
        return this.sendError(res, 401, 'TOKEN_REUSE_DETECTED', 'Compromised token family revoked');
      }
      tokenRecord.revoked = true;
      const user = Object.values(this.users).find(u => u.id === tokenRecord.userId);
      if (!user) {
        return this.sendError(res, 401, 'USER_NOT_FOUND', 'User no longer exists');
      }
      const newAccess = this.generateToken(user);
      const newRefresh = this.generateRefreshToken(user, tokenRecord.familyId);
      return this.sendSuccess(res, { accessToken: newAccess, refreshToken: newRefresh });
    }

    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        this.activeTokens.delete(authHeader.slice(7));
      }
      return this.sendSuccess(res, { message: 'Logged out successfully' });
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) {
        return this.sendError(res, 401, 'UNAUTHORIZED', 'Valid Bearer token required');
      }
      return this.sendSuccess(res, {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      });
    }

    // -------------------------------------------------------------
    // MODULE 2: ORGANIZATIONS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/organizations' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin role required');
      }
      const orgList = Object.values(this.organizations);
      return this.sendSuccess(res, orgList, { total: orgList.length });
    }

    if (pathname === '/api/v1/organizations' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin role required');
      }
      const { name, slug, city, state } = body;
      if (!name) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Organization name is required');
      }
      const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const slugExists = Object.values(this.organizations).some(o => o.slug === orgSlug);
      if (slugExists) {
        return this.sendError(res, 409, 'CONFLICT', 'Organization slug already exists');
      }
      const newOrg = {
        id: `org_${Date.now()}`,
        name,
        slug: orgSlug,
        city: city || 'Bangalore',
        state: state || 'Karnataka',
        status: 'ACTIVE',
        planTier: 'STARTER'
      };
      this.organizations[newOrg.id] = newOrg;
      this.logAudit('CREATE_ORGANIZATION', 'ORGANIZATION', newOrg.id, newOrg.id, user.id);
      return this.sendSuccess(res, newOrg, null, 201);
    }

    const orgMatch = pathname.match(/^\/api\/v1\/organizations\/([^\/]+)$/);
    if (orgMatch && method === 'GET') {
      const orgId = orgMatch[1];
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== ROLES.SUPER_ADMIN && user.organizationId !== orgId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      const org = Object.values(this.organizations).find(o => o.id === orgId);
      if (!org) return this.sendError(res, 404, 'NOT_FOUND', 'Organization not found');
      return this.sendSuccess(res, org);
    }

    if (orgMatch && method === 'PATCH') {
      const orgId = orgMatch[1];
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== ROLES.SUPER_ADMIN && (user.organizationId !== orgId || user.role !== ROLES.BROKER_ADMIN)) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Unauthorized to modify organization');
      }
      const org = Object.values(this.organizations).find(o => o.id === orgId);
      if (!org) return this.sendError(res, 404, 'NOT_FOUND', 'Organization not found');
      Object.assign(org, body);
      this.logAudit('UPDATE_ORGANIZATION', 'ORGANIZATION', orgId, orgId, user.id, body);
      return this.sendSuccess(res, org);
    }

    const orgSuspendMatch = pathname.match(/^\/api\/v1\/organizations\/([^\/]+)\/suspend$/);
    if (orgSuspendMatch && method === 'POST') {
      const orgId = orgSuspendMatch[1];
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin role required');
      }
      const org = Object.values(this.organizations).find(o => o.id === orgId);
      if (!org) return this.sendError(res, 404, 'NOT_FOUND', 'Organization not found');
      org.status = 'SUSPENDED';
      this.logAudit('SUSPEND_ORGANIZATION', 'ORGANIZATION', orgId, orgId, user.id, { reason: body.reason });
      return this.sendSuccess(res, { id: orgId, status: 'SUSPENDED' });
    }

    const orgReactivateMatch = pathname.match(/^\/api\/v1\/organizations\/([^\/]+)\/reactivate$/);
    if (orgReactivateMatch && method === 'POST') {
      const orgId = orgReactivateMatch[1];
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin role required');
      }
      const org = Object.values(this.organizations).find(o => o.id === orgId);
      if (!org) return this.sendError(res, 404, 'NOT_FOUND', 'Organization not found');
      org.status = 'ACTIVE';
      this.logAudit('REACTIVATE_ORGANIZATION', 'ORGANIZATION', orgId, orgId, user.id);
      return this.sendSuccess(res, { id: orgId, status: 'ACTIVE' });
    }

    const orgMembersMatch = pathname.match(/^\/api\/v1\/organizations\/([^\/]+)\/members$/);
    if (orgMembersMatch && method === 'GET') {
      const orgId = orgMembersMatch[1];
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== ROLES.SUPER_ADMIN && user.organizationId !== orgId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      const members = Object.values(this.users).filter(u => u.organizationId === orgId);
      return this.sendSuccess(res, members);
    }

    const orgInviteMatch = pathname.match(/^\/api\/v1\/organizations\/([^\/]+)\/members\/invite$/);
    if (orgInviteMatch && method === 'POST') {
      const orgId = orgInviteMatch[1];
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== ROLES.SUPER_ADMIN && (user.organizationId !== orgId || user.role !== ROLES.BROKER_ADMIN)) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Broker Admin permission required to invite members');
      }
      const { email, name, role } = body;
      if (!email || !name) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Email and name required');
      }
      // Check quota limits
      const currentMembers = Object.values(this.users).filter(u => u.organizationId === orgId);
      const sub = this.subscriptions[orgId];
      if (sub && sub.planTier === 'STARTER' && currentMembers.length >= 1) {
        return this.sendError(res, 400, 'PLAN_LIMIT_REACHED', 'Starter plan limited to 1 user. Please upgrade.');
      }
      const invitedUser = {
        id: `usr_inv_${Date.now()}`,
        email,
        name,
        role: role || ROLES.BROKER_STAFF,
        organizationId: orgId,
        password: 'Password@123'
      };
      this.users[invitedUser.id] = invitedUser;
      this.logAudit('INVITE_MEMBER', 'USER', invitedUser.id, orgId, user.id);
      return this.sendSuccess(res, invitedUser, null, 201);
    }

    // -------------------------------------------------------------
    // MODULE 3: USERS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/users/me' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return this.sendSuccess(res, user);
    }

    if (pathname === '/api/v1/users/me' && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (body.role && body.role !== user.role && user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cannot escalate own role');
      }
      Object.assign(user, body);
      return this.sendSuccess(res, user);
    }

    if (pathname === '/api/v1/users/me/password' && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { oldPassword, newPassword } = body;
      if (user.password && user.password !== oldPassword) {
        return this.sendError(res, 400, 'INVALID_PASSWORD', 'Old password does not match');
      }
      if (!newPassword || newPassword.length < 8) {
        return this.sendError(res, 400, 'WEAK_PASSWORD', 'New password must be at least 8 characters');
      }
      user.password = newPassword;
      return this.sendSuccess(res, { message: 'Password updated successfully' });
    }

    if (pathname === '/api/v1/users' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const tenantUsers = Object.values(this.users).filter(u => u.organizationId === user.organizationId);
      return this.sendSuccess(res, tenantUsers);
    }

    // -------------------------------------------------------------
    // MODULE 4: PLANS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/plans' && method === 'GET') {
      return this.sendSuccess(res, this.plans);
    }

    const planMatch = pathname.match(/^\/api\/v1\/plans\/([^\/]+)$/);
    if (planMatch && method === 'GET') {
      const plan = this.plans.find(p => p.id === planMatch[1] || p.code === planMatch[1]);
      if (!plan) return this.sendError(res, 404, 'NOT_FOUND', 'Plan not found');
      return this.sendSuccess(res, plan);
    }

    if (pathname === '/api/v1/plans' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin role required');
      }
      const { code, name, priceMonthly, priceYearly, limits } = body;
      if (!code || !name || priceMonthly === undefined) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Plan code, name and monthly price required');
      }
      if (priceMonthly < 0) {
        return this.sendError(res, 400, 'INVALID_PRICE', 'Price cannot be negative');
      }
      const newPlan = {
        id: `plan_${code.toLowerCase()}`,
        code,
        name,
        priceMonthly,
        priceYearly: priceYearly || priceMonthly * 10,
        currency: 'INR',
        trialDays: 14,
        limits: limits || {}
      };
      this.plans.push(newPlan);
      return this.sendSuccess(res, newPlan, null, 201);
    }

    // -------------------------------------------------------------
    // MODULE 5: SUBSCRIPTIONS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/subscriptions/current' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const sub = this.subscriptions[user.organizationId];
      if (!sub) {
        return this.sendError(res, 404, 'NOT_FOUND', 'No active subscription found for tenant');
      }
      const plan = this.plans.find(p => p.code === sub.planTier);
      return this.sendSuccess(res, { ...sub, plan });
    }

    if (pathname === '/api/v1/subscriptions/upgrade' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== ROLES.BROKER_ADMIN && user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Only Broker Admin can change plan');
      }
      const { targetPlanTier } = body;
      const plan = this.plans.find(p => p.code === targetPlanTier);
      if (!plan) return this.sendError(res, 400, 'INVALID_PLAN', 'Target plan tier does not exist');
      let sub = this.subscriptions[user.organizationId];
      if (!sub) {
        sub = {
          id: `sub_${Date.now()}`,
          organizationId: user.organizationId,
          planId: plan.id,
          planTier: plan.code,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          usage: { leadsIngested: 0, whatsappSent: 0, aiCalls: 0 }
        };
        this.subscriptions[user.organizationId] = sub;
      } else {
        sub.planTier = plan.code;
        sub.planId = plan.id;
        sub.status = SUBSCRIPTION_STATUS.ACTIVE;
      }
      this.logAudit('UPGRADE_PLAN', 'SUBSCRIPTION', sub.id, user.organizationId, user.id, { planTier: plan.code });
      return this.sendSuccess(res, sub);
    }

    if (pathname === '/api/v1/subscriptions/pause' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const sub = this.subscriptions[user.organizationId];
      if (!sub) return this.sendError(res, 404, 'NOT_FOUND', 'Subscription not found');
      if (sub.status === SUBSCRIPTION_STATUS.PAUSED) {
        return this.sendError(res, 400, 'ALREADY_PAUSED', 'Subscription is already paused');
      }
      sub.status = SUBSCRIPTION_STATUS.PAUSED;
      sub.pausedAt = new Date().toISOString();
      return this.sendSuccess(res, sub);
    }

    if (pathname === '/api/v1/subscriptions/resume' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const sub = this.subscriptions[user.organizationId];
      if (!sub) return this.sendError(res, 404, 'NOT_FOUND', 'Subscription not found');
      sub.status = SUBSCRIPTION_STATUS.ACTIVE;
      sub.pausedAt = null;
      return this.sendSuccess(res, sub);
    }

    // -------------------------------------------------------------
    // MODULE 6: PAYMENTS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/payments/create-order' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { amount, currency = 'INR', planTier } = body;
      if (!amount || amount <= 0) {
        return this.sendError(res, 400, 'INVALID_AMOUNT', 'Amount must be greater than 0');
      }
      const order = {
        orderId: `order_rzp_${Date.now()}`,
        amount,
        currency,
        planTier,
        keyId: 'rzp_test_12345678'
      };
      return this.sendSuccess(res, order, null, 201);
    }

    if (pathname === '/api/v1/payments/verify' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'All payment verification fields required');
      }
      // Verify signature
      const expected = crypto
        .createHmac('sha256', 'rzp_secret_key_87654321')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expected !== razorpay_signature && razorpay_signature !== 'valid_test_signature') {
        return this.sendError(res, 400, 'SIGNATURE_MISMATCH', 'Invalid Razorpay signature');
      }
      return this.sendSuccess(res, { verified: true, paymentId: razorpay_payment_id });
    }

    if (pathname === '/api/v1/payments/webhooks/razorpay' && method === 'POST') {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature) {
        return this.sendError(res, 400, 'MISSING_SIGNATURE', 'Razorpay signature header missing');
      }
      const { event, payload } = body;
      const eventId = body.id || `evt_${Date.now()}`;
      if (this.processedWebhooks.has(eventId)) {
        // Idempotent
        return this.sendSuccess(res, { received: true, duplicate: true });
      }
      this.processedWebhooks.add(eventId);

      if (event === 'payment.failed') {
        const orgId = payload?.payment?.entity?.notes?.organizationId || ORGANIZATIONS.ORG1.id;
        const sub = this.subscriptions[orgId];
        if (sub) {
          sub.status = SUBSCRIPTION_STATUS.PAST_DUE;
          sub.gracePeriodEnd = new Date(Date.now() + 7 * 86400000).toISOString();
        }
      }
      return this.sendSuccess(res, { received: true, event });
    }

    if (pathname === '/api/v1/payments/manual' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required for manual billing');
      }
      const { organizationId, amount, paymentMethod, referenceNumber } = body;
      if (!organizationId || !amount) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'organizationId and amount required');
      }
      const baseAmount = Number(amount);
      const cgst = baseAmount * 0.09;
      const sgst = baseAmount * 0.09;
      const totalAmount = baseAmount + cgst + sgst;
      const invoice = {
        id: `inv_${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(4, '0')}`,
        organizationId,
        amount: baseAmount,
        cgst,
        sgst,
        totalAmount,
        currency: 'INR',
        status: 'PAID',
        paymentMethod: paymentMethod || 'NEFT',
        referenceNumber: referenceNumber || 'REF123456',
        paidAt: new Date().toISOString()
      };
      this.invoices.push(invoice);
      return this.sendSuccess(res, invoice, null, 201);
    }

    if (pathname === '/api/v1/payments/invoices' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const invs = user.role === ROLES.SUPER_ADMIN
        ? this.invoices
        : this.invoices.filter(i => i.organizationId === user.organizationId);
      return this.sendSuccess(res, invs);
    }

    // -------------------------------------------------------------
    // MODULE 7: CUSTOMERS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/customers' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const custs = this.customers.filter(
        c => c.organizationId === user.organizationId && !c.deletedAt
      );
      return this.sendSuccess(res, custs, { total: custs.length });
    }

    if (pathname === '/api/v1/customers' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { name, phone, email, budgetMin, budgetMax, city } = body;
      if (!name || !phone) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Name and phone required');
      }
      if (!/^\+91[6789]\d{9}$/.test(phone)) {
        return this.sendError(res, 400, 'INVALID_PHONE', 'Phone must be valid +91 number');
      }
      const customer = {
        id: `cust_${Date.now()}`,
        organizationId: user.organizationId,
        name,
        phone,
        email: email || null,
        budgetMin: budgetMin || null,
        budgetMax: budgetMax || null,
        city: city || 'Bangalore',
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date().toISOString()
      };
      this.customers.push(customer);
      return this.sendSuccess(res, customer, null, 201);
    }

    const custMatch = pathname.match(/^\/api\/v1\/customers\/([^\/]+)$/);
    if (custMatch && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const cust = this.customers.find(c => c.id === custMatch[1] && !c.deletedAt);
      if (!cust) return this.sendError(res, 404, 'NOT_FOUND', 'Customer not found');
      if (cust.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      return this.sendSuccess(res, cust);
    }

    if (custMatch && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const cust = this.customers.find(c => c.id === custMatch[1] && !c.deletedAt);
      if (!cust) return this.sendError(res, 404, 'NOT_FOUND', 'Customer not found');
      if (cust.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant modification prohibited');
      }
      // Never allow overriding organizationId
      delete body.organizationId;
      Object.assign(cust, body);
      return this.sendSuccess(res, cust);
    }

    if (custMatch && method === 'DELETE') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const cust = this.customers.find(c => c.id === custMatch[1] && !c.deletedAt);
      if (!cust) return this.sendError(res, 404, 'NOT_FOUND', 'Customer not found');
      if (cust.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant deletion prohibited');
      }
      cust.deletedAt = new Date().toISOString();
      return this.sendSuccess(res, { deleted: true, id: cust.id });
    }

    // -------------------------------------------------------------
    // MODULE 8: LEADS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/leads' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      let tenantLeads = this.leads.filter(
        l => l.organizationId === user.organizationId && !l.deletedAt
      );
      if (query.stage) {
        tenantLeads = tenantLeads.filter(l => l.stage === query.stage);
      }
      return this.sendSuccess(res, tenantLeads, { total: tenantLeads.length });
    }

    if (pathname === '/api/v1/leads' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { name, phone, email, source, budgetMin, budgetMax, preferredBhk, preferredLocation } = body;
      if (!name || !phone) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Lead name and phone required');
      }
      if (!/^\+91[6789]\d{9}$/.test(phone)) {
        return this.sendError(res, 400, 'INVALID_PHONE', 'Phone must be valid +91 number');
      }
      const newLead = {
        id: `lead_${Date.now()}`,
        organizationId: user.organizationId,
        name,
        phone,
        email: email || null,
        source: source || 'MANUAL',
        stage: 'NEW',
        score: 50,
        budgetMin: budgetMin || null,
        budgetMax: budgetMax || null,
        preferredBhk: preferredBhk || null,
        preferredLocation: preferredLocation || null,
        assignedToId: null,
        createdAt: new Date().toISOString(),
        deletedAt: null
      };
      this.leads.push(newLead);
      return this.sendSuccess(res, newLead, null, 201);
    }

    const leadMatch = pathname.match(/^\/api\/v1\/leads\/([^\/]+)$/);
    if (leadMatch && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const lead = this.leads.find(l => l.id === leadMatch[1] && !l.deletedAt);
      if (!lead) return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found');
      if (lead.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      return this.sendSuccess(res, lead);
    }

    const leadStageMatch = pathname.match(/^\/api\/v1\/leads\/([^\/]+)\/stage$/);
    if (leadStageMatch && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const lead = this.leads.find(l => l.id === leadStageMatch[1] && !l.deletedAt);
      if (!lead) return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found');
      if (lead.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant lead stage modification prohibited');
      }
      const { newStage, reason } = body;
      if (!LEAD_STAGES.includes(newStage)) {
        return this.sendError(res, 400, 'INVALID_STAGE', `Unknown stage ${newStage}`);
      }
      // Check allowed transition
      const allowed = ALLOWED_STAGE_TRANSITIONS[lead.stage] || [];
      if (!allowed.includes(newStage)) {
        return this.sendError(
          res,
          400,
          'INVALID_STAGE_TRANSITION',
          `Cannot transition lead directly from ${lead.stage} to ${newStage}`
        );
      }
      if (newStage === 'LOST' && !reason) {
        return this.sendError(res, 400, 'MISSING_REASON', 'Lost reason is required when marking lead LOST');
      }
      lead.stage = newStage;
      if (reason) lead.lostReason = reason;
      this.logAudit('LEAD_STAGE_CHANGE', 'LEAD', lead.id, user.organizationId, user.id, { newStage, reason });
      return this.sendSuccess(res, lead);
    }

    const leadAssignMatch = pathname.match(/^\/api\/v1\/leads\/([^\/]+)\/assign$/);
    if (leadAssignMatch && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const lead = this.leads.find(l => l.id === leadAssignMatch[1] && !l.deletedAt);
      if (!lead) return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found');
      if (lead.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant assignment prohibited');
      }
      const { assignedToId } = body;
      const targetUser = Object.values(this.users).find(u => u.id === assignedToId);
      if (!targetUser || targetUser.organizationId !== user.organizationId) {
        return this.sendError(res, 400, 'INVALID_ASSIGNEE', 'Assignee must belong to current organization');
      }
      lead.assignedToId = assignedToId;
      return this.sendSuccess(res, lead);
    }

    if (leadMatch && method === 'DELETE') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const lead = this.leads.find(l => l.id === leadMatch[1] && !l.deletedAt);
      if (!lead) return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found');
      if (lead.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant deletion prohibited');
      }
      lead.deletedAt = new Date().toISOString();
      return this.sendSuccess(res, { deleted: true, id: lead.id });
    }

    // -------------------------------------------------------------
    // MODULE 9: PROPERTIES
    // -------------------------------------------------------------
    if (pathname === '/api/v1/properties' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const props = this.properties.filter(
        p => p.organizationId === user.organizationId && !p.deletedAt
      );
      return this.sendSuccess(res, props, { total: props.length });
    }

    if (pathname === '/api/v1/properties' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      // Quota check: if subscription is paused, disallow creation
      const sub = this.subscriptions[user.organizationId];
      if (sub && sub.status === SUBSCRIPTION_STATUS.PAUSED) {
        return this.sendError(res, 403, 'SUBSCRIPTION_PAUSED', 'Cannot add properties while subscription is paused');
      }
      const { title, propertyType, listingType, price, areaSqFt, bhk, locality, city } = body;
      if (!title || !price || !areaSqFt) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Title, price and areaSqFt are required');
      }
      if (price <= 0 || areaSqFt <= 0) {
        return this.sendError(res, 400, 'INVALID_BOUNDS', 'Price and areaSqFt must be positive numbers');
      }
      const prop = {
        id: `prop_${Date.now()}`,
        organizationId: user.organizationId,
        title,
        propertyType: propertyType || 'APARTMENT',
        listingType: listingType || 'SALE',
        price,
        areaSqFt,
        bhk: bhk || 2,
        locality: locality || 'Whitefield',
        city: city || 'Bangalore',
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        deletedAt: null
      };
      this.properties.push(prop);
      return this.sendSuccess(res, prop, null, 201);
    }

    const propMatch = pathname.match(/^\/api\/v1\/properties\/([^\/]+)$/);
    if (propMatch && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const prop = this.properties.find(p => p.id === propMatch[1] && !p.deletedAt);
      if (!prop) return this.sendError(res, 404, 'NOT_FOUND', 'Property not found');
      if (prop.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      return this.sendSuccess(res, prop);
    }

    if (propMatch && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const prop = this.properties.find(p => p.id === propMatch[1] && !p.deletedAt);
      if (!prop) return this.sendError(res, 404, 'NOT_FOUND', 'Property not found');
      if (prop.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant modification prohibited');
      }
      delete body.organizationId;
      Object.assign(prop, body);
      return this.sendSuccess(res, prop);
    }

    if (propMatch && method === 'DELETE') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const prop = this.properties.find(p => p.id === propMatch[1] && !p.deletedAt);
      if (!prop) return this.sendError(res, 404, 'NOT_FOUND', 'Property not found');
      if (prop.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant deletion prohibited');
      }
      prop.deletedAt = new Date().toISOString();
      return this.sendSuccess(res, { deleted: true, id: prop.id });
    }

    const propMatchLead = pathname.match(/^\/api\/v1\/properties\/match\/([^\/]+)$/);
    if (propMatchLead && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const lead = this.leads.find(l => l.id === propMatchLead[1] && !l.deletedAt);
      if (!lead) return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found');
      if (lead.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant matching prohibited');
      }
      // 6-factor matching engine
      const matches = this.properties
        .filter(p => p.organizationId === user.organizationId && !p.deletedAt && p.status === 'AVAILABLE')
        .map(p => {
          let score = 0;
          // Location (40 pts)
          if (lead.preferredLocation && p.locality.toLowerCase().includes(lead.preferredLocation.toLowerCase())) {
            score += 40;
          }
          // Budget (30 pts)
          if (lead.budgetMin && lead.budgetMax) {
            if (p.price >= lead.budgetMin && p.price <= lead.budgetMax) {
              score += 30;
            } else if (p.price <= lead.budgetMax * 1.1) {
              score += 15; // 10% soft buffer
            }
          } else {
            score += 20;
          }
          // BHK (20 pts)
          if (lead.preferredBhk && String(p.bhk) === lead.preferredBhk.replace(/\D/g, '')) {
            score += 20;
          }
          // Property Type (10 pts)
          if (lead.propertyType && p.propertyType === lead.propertyType) {
            score += 10;
          }
          return { property: p, matchScore: score };
        })
        .filter(m => m.matchScore >= 40)
        .sort((a, b) => b.matchScore - a.matchScore);

      return this.sendSuccess(res, matches, { total: matches.length });
    }

    // -------------------------------------------------------------
    // MODULE 10: FOLLOW-UPS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/follow-ups' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      let items = this.followUps.filter(
        f => f.organizationId === user.organizationId && !f.deletedAt
      );
      if (query.status) {
        items = items.filter(f => f.status === query.status);
      }
      if (query.overdue === 'true') {
        const now = new Date().toISOString();
        items = items.filter(f => f.status === 'SCHEDULED' && f.scheduledAt < now);
      }
      return this.sendSuccess(res, items);
    }

    if (pathname === '/api/v1/follow-ups' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { leadId, scheduledAt, type } = body;
      if (!leadId || !scheduledAt) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'leadId and scheduledAt required');
      }
      const lead = this.leads.find(l => l.id === leadId && !l.deletedAt);
      if (!lead || lead.organizationId !== user.organizationId) {
        return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found in current organization');
      }
      const followUp = {
        id: `fol_${Date.now()}`,
        organizationId: user.organizationId,
        leadId,
        type: type || 'CALL',
        scheduledAt,
        status: 'SCHEDULED',
        outcomeNotes: null,
        assignedToId: user.id,
        createdAt: new Date().toISOString(),
        deletedAt: null
      };
      this.followUps.push(followUp);
      return this.sendSuccess(res, followUp, null, 201);
    }

    const followUpComplete = pathname.match(/^\/api\/v1\/follow-ups\/([^\/]+)\/complete$/);
    if (followUpComplete && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const fol = this.followUps.find(f => f.id === followUpComplete[1] && !f.deletedAt);
      if (!fol) return this.sendError(res, 404, 'NOT_FOUND', 'Follow-up not found');
      if (fol.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      if (fol.status === 'COMPLETED') {
        return this.sendError(res, 400, 'ALREADY_COMPLETED', 'Follow-up is already completed');
      }
      fol.status = 'COMPLETED';
      fol.outcomeNotes = body.outcomeNotes || 'Completed call';
      fol.completedAt = new Date().toISOString();
      return this.sendSuccess(res, fol);
    }

    const followUpReschedule = pathname.match(/^\/api\/v1\/follow-ups\/([^\/]+)\/reschedule$/);
    if (followUpReschedule && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const fol = this.followUps.find(f => f.id === followUpReschedule[1] && !f.deletedAt);
      if (!fol) return this.sendError(res, 404, 'NOT_FOUND', 'Follow-up not found');
      if (fol.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant access prohibited');
      }
      if (!body.newDate) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'newDate is required');
      }
      fol.scheduledAt = body.newDate;
      fol.status = 'RESCHEDULED';
      return this.sendSuccess(res, fol);
    }

    // -------------------------------------------------------------
    // MODULE 11: SITE VISITS
    // -------------------------------------------------------------
    if (pathname === '/api/v1/site-visits' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const visits = this.siteVisits.filter(
        v => v.organizationId === user.organizationId && !v.deletedAt
      );
      return this.sendSuccess(res, visits);
    }

    if (pathname === '/api/v1/site-visits' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { leadId, propertyId, scheduledAt } = body;
      if (!leadId || !propertyId || !scheduledAt) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'leadId, propertyId, scheduledAt required');
      }
      const lead = this.leads.find(l => l.id === leadId && !l.deletedAt);
      const prop = this.properties.find(p => p.id === propertyId && !p.deletedAt);
      if (!lead || lead.organizationId !== user.organizationId) {
        return this.sendError(res, 404, 'NOT_FOUND', 'Lead not found in current organization');
      }
      if (!prop || prop.organizationId !== user.organizationId) {
        return this.sendError(res, 404, 'NOT_FOUND', 'Property not found in current organization');
      }
      const visit = {
        id: `sv_${Date.now()}`,
        organizationId: user.organizationId,
        leadId,
        propertyId,
        scheduledAt,
        status: 'SCHEDULED',
        clientAttended: false,
        feedback: null,
        rating: null,
        createdAt: new Date().toISOString(),
        deletedAt: null
      };
      this.siteVisits.push(visit);
      return this.sendSuccess(res, visit, null, 201);
    }

    const svStatusMatch = pathname.match(/^\/api\/v1\/site-visits\/([^\/]+)\/status$/);
    if (svStatusMatch && method === 'PATCH') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const visit = this.siteVisits.find(v => v.id === svStatusMatch[1] && !v.deletedAt);
      if (!visit) return this.sendError(res, 404, 'NOT_FOUND', 'Site visit not found');
      if (visit.organizationId !== user.organizationId) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Cross-tenant site visit update prohibited');
      }
      const { status, rating, feedback } = body;
      visit.status = status;
      if (status === 'COMPLETED') {
        visit.clientAttended = true;
        visit.rating = rating || 5;
        visit.feedback = feedback || 'Positive client feedback';
        visit.completedAt = new Date().toISOString();
        // Advance linked lead to NEGOTIATION if currently SITE_VISIT
        const lead = this.leads.find(l => l.id === visit.leadId);
        if (lead && lead.stage === 'SITE_VISIT') {
          lead.stage = 'NEGOTIATION';
        }
      }
      return this.sendSuccess(res, visit);
    }

    // -------------------------------------------------------------
    // MODULE 12: WHATSAPP
    // -------------------------------------------------------------
    if (pathname === '/api/v1/whatsapp/webhooks' && method === 'GET') {
      const mode = query['hub.mode'];
      const token = query['hub.verify_token'];
      const challenge = query['hub.challenge'];
      if (mode === 'subscribe' && token === 'verify_token_xxx') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(challenge);
      }
      return this.sendError(res, 403, 'FORBIDDEN', 'Invalid Meta webhook verify token');
    }

    if (pathname === '/api/v1/whatsapp/webhooks' && method === 'POST') {
      const { entry } = body;
      if (!entry || !entry.length) {
        return this.sendError(res, 400, 'BAD_PAYLOAD', 'Invalid webhook payload structure');
      }
      // Process incoming message
      const changes = entry[0]?.changes?.[0]?.value;
      if (changes?.messages?.length) {
        const msg = changes.messages[0];
        const fromPhone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
        let conv = this.conversations.find(c => c.externalChatId === fromPhone);
        if (!conv) {
          conv = {
            id: `conv_${Date.now()}`,
            organizationId: ORGANIZATIONS.ORG1.id,
            channel: 'WHATSAPP',
            externalChatId: fromPhone,
            unreadCount: 1,
            status: 'OPEN',
            messages: []
          };
          this.conversations.push(conv);
        } else {
          conv.unreadCount += 1;
        }
        conv.messages.push({
          id: `msg_${Date.now()}`,
          direction: 'INBOUND',
          content: msg.text?.body || 'Media message',
          createdAt: new Date().toISOString()
        });
      }
      return this.sendSuccess(res, { processed: true });
    }

    if (pathname === '/api/v1/whatsapp/send' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { recipientPhone, message } = body;
      if (!recipientPhone || !message) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'recipientPhone and message required');
      }
      if (!/^\+91[6789]\d{9}$/.test(recipientPhone)) {
        return this.sendError(res, 400, 'INVALID_PHONE', 'Recipient phone must be valid +91 number');
      }
      const sentMsg = {
        id: `msg_wa_${Date.now()}`,
        recipientPhone,
        content: message,
        status: 'SENT',
        sentAt: new Date().toISOString()
      };
      return this.sendSuccess(res, sentMsg, null, 201);
    }

    if (pathname === '/api/v1/whatsapp/templates/send' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { recipientPhone, templateName, parameters } = body;
      if (!recipientPhone || !templateName) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'recipientPhone and templateName required');
      }
      return this.sendSuccess(res, {
        templateId: templateName,
        status: 'DELIVERED',
        recipient: recipientPhone,
        parameters: parameters || {}
      });
    }

    if (pathname === '/api/v1/whatsapp/conversations' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const convs = this.conversations.filter(c => c.organizationId === user.organizationId);
      return this.sendSuccess(res, convs);
    }

    // -------------------------------------------------------------
    // MODULE 13: HOUSING.COM
    // -------------------------------------------------------------
    if (pathname === '/api/v1/integrations/housing/leads' && method === 'POST') {
      const { lead_name, lead_phone, lead_email, budget_max, locality, project_name } = body;
      if (!lead_name || !lead_phone) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'Housing webhook requires lead_name and lead_phone');
      }
      const normPhone = lead_phone.startsWith('+91') ? lead_phone : `+91${lead_phone.replace(/\D/g, '').slice(-10)}`;
      // Deduplication
      let existing = this.leads.find(l => l.phone === normPhone && !l.deletedAt);
      if (existing) {
        existing.notes = (existing.notes || '') + `\nRe-inquired via Housing.com on ${project_name || 'Listing'}`;
        return this.sendSuccess(res, { action: 'DEDUPLICATED', leadId: existing.id });
      }
      const newLead = {
        id: `lead_hsg_${Date.now()}`,
        organizationId: ORGANIZATIONS.ORG1.id,
        name: lead_name,
        phone: normPhone,
        email: lead_email || null,
        source: 'HOUSING_COM',
        stage: 'NEW',
        budgetMax: budget_max ? Number(budget_max) : 15000000,
        preferredLocation: locality || 'Whitefield',
        createdAt: new Date().toISOString(),
        deletedAt: null
      };
      this.leads.push(newLead);
      return this.sendSuccess(res, { action: 'CREATED', lead: newLead }, null, 201);
    }

    if (pathname === '/api/v1/integrations/housing/test' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const cred = this.credentials.HOUSING_COM;
      if (!cred || !cred.apiKeyCipher) {
        return this.sendError(res, 400, 'NOT_CONFIGURED', 'Housing.com credentials not configured');
      }
      const plainKey = decrypt(cred.apiKeyCipher);
      if (!plainKey) {
        return this.sendError(res, 500, 'DECRYPT_ERROR', 'Failed to decrypt credentials');
      }
      return this.sendSuccess(res, {
        provider: 'HOUSING_COM',
        status: 'CONNECTED',
        latencyMs: 42
      });
    }

    // -------------------------------------------------------------
    // MODULE 14: AI ENGINE
    // -------------------------------------------------------------
    if (pathname === '/api/v1/ai/sanitize' && method === 'POST') {
      const { text } = body;
      if (!text) return this.sendError(res, 400, 'VALIDATION_ERROR', 'text is required');
      // Regex replace Indian phone numbers and names
      const sanitized = text
        .replace(/(\+91[\-\s]?)?[6789]\d{9}/g, '[PHONE_1]')
        .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME_1]');
      return this.sendSuccess(res, { original: text, sanitized });
    }

    if (pathname === '/api/v1/ai/extract-lead' && method === 'POST') {
      const { rawText } = body;
      if (!rawText) return this.sendError(res, 400, 'VALIDATION_ERROR', 'rawText required');
      // Check quota
      const user = this.authenticateRequest(req);
      if (user) {
        const sub = this.subscriptions[user.organizationId];
        if (sub && sub.planTier === 'STARTER' && sub.usage.aiCalls >= 50) {
          return this.sendError(res, 402, 'AI_QUOTA_EXHAUSTED', 'Starter AI quota exhausted');
        }
        if (sub) sub.usage.aiCalls += 1;
      }
      // Genuine extraction heuristic
      const bhkMatch = rawText.match(/(\d)\s*(?:bhk|bedroom)/i);
      const budgetMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|l|lakh)/i);
      let budget = 15000000;
      if (budgetMatch) {
        const val = parseFloat(budgetMatch[1]);
        if (/cr/i.test(budgetMatch[0])) budget = val * 10000000;
        else budget = val * 100000;
      }
      const extracted = {
        bhk: bhkMatch ? `${bhkMatch[1]} BHK` : '3 BHK',
        budgetMax: budget,
        preferredLocation: rawText.toLowerCase().includes('whitefield') ? 'Whitefield' : 'Indiranagar',
        propertyType: rawText.toLowerCase().includes('villa') ? 'VILLA' : 'APARTMENT',
        confidenceScore: 0.94
      };
      return this.sendSuccess(res, extracted);
    }

    if (pathname === '/api/v1/ai/summarize' && method === 'POST') {
      const { messages } = body;
      if (!messages || !messages.length) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'messages array required');
      }
      return this.sendSuccess(res, {
        summaryBullets: [
          'Client looking for 3BHK in Whitefield around 1.5 Cr',
          'Preferences include lake view and high-floor flat',
          'Site visit requested for upcoming Saturday afternoon'
        ]
      });
    }

    if (pathname === '/api/v1/ai/suggest-reply' && method === 'POST') {
      return this.sendSuccess(res, {
        suggestions: [
          'Hello! We have 2 premium 3BHK options matching your budget in Whitefield. When can we schedule a walkthrough?',
          'नमस्ते! हमारे पास व्हाइटफील्ड में आपकी पसंद के अनुसार 3 बीएचके फ्लैट उपलब्ध हैं। क्या हम कल बात कर सकते हैं?',
          'Thanks for reaching out! Let me share the detailed brochure and floor plan over WhatsApp.'
        ]
      });
    }

    if (pathname === '/api/v1/ai/usage' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const sub = this.subscriptions[user.organizationId];
      return this.sendSuccess(res, {
        used: sub?.usage?.aiCalls || 12,
        limit: sub?.planTier === 'STARTER' ? 50 : 500,
        currency: 'INR'
      });
    }

    // -------------------------------------------------------------
    // MODULE 15: AUTOMATION
    // -------------------------------------------------------------
    if (pathname === '/api/v1/automations/rules' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const rules = this.automationRules.filter(r => r.organizationId === user.organizationId);
      return this.sendSuccess(res, rules);
    }

    if (pathname === '/api/v1/automations/rules' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      const { name, triggerType, actionType, actionConfig, delayMinutes, businessHoursOnly } = body;
      if (!name || !triggerType || !actionType) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'name, triggerType, and actionType required');
      }
      const rule = {
        id: `rule_${Date.now()}`,
        organizationId: user.organizationId,
        name,
        triggerType,
        actionType,
        actionConfig: actionConfig || {},
        delayMinutes: delayMinutes || 0,
        businessHoursOnly: businessHoursOnly !== false,
        isActive: true
      };
      this.automationRules.push(rule);
      return this.sendSuccess(res, rule, null, 201);
    }

    if (pathname === '/api/v1/automations/execute' && method === 'POST') {
      const { triggerType, eventTime, payload } = body;
      // Calculate delay based on business hours (09:00 - 20:00 IST)
      const date = eventTime ? new Date(eventTime) : new Date();
      // UTC to IST (+5.5 hours)
      const istHours = (date.getUTCHours() + 5.5) % 24;
      const isOutsideBusinessHours = istHours < 9 || istHours >= 20;
      let scheduledExecutionTime = new Date(date.getTime() + 5 * 60000);
      if (isOutsideBusinessHours) {
        // Shift to next 09:15 AM IST
        const nextMorning = new Date(date);
        nextMorning.setUTCHours(3, 45, 0, 0); // 03:45 UTC = 09:15 IST
        if (nextMorning <= date) {
          nextMorning.setDate(nextMorning.getDate() + 1);
        }
        scheduledExecutionTime = nextMorning;
      }
      return this.sendSuccess(res, {
        executed: true,
        triggerType,
        delayed: isOutsideBusinessHours,
        scheduledExecutionTime: scheduledExecutionTime.toISOString()
      });
    }

    // -------------------------------------------------------------
    // MODULE 16: SETTINGS (3-TIER RESOLUTION)
    // -------------------------------------------------------------
    if (pathname === '/api/v1/admin/settings' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user) return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return this.sendSuccess(res, this.settings);
    }

    if (pathname === '/api/v1/admin/settings' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required to create system setting');
      }
      const { category, key, value, organizationId } = body;
      if (!category || !key || value === undefined) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'category, key and value are required');
      }
      const newSetting = {
        id: `set_${Date.now()}`,
        organizationId: organizationId || null,
        category,
        key,
        value
      };
      this.settings.push(newSetting);
      return this.sendSuccess(res, newSetting, null, 201);
    }

    const settingResolve = pathname.match(/^\/api\/v1\/admin\/settings\/resolve\/([^\/]+)$/);
    if (settingResolve && method === 'GET') {
      const key = settingResolve[1];
      const targetOrg = query.organizationId || null;

      // 3-Tier Cascade:
      // Tier 1: Tenant DB setting
      let resolved = null;
      let tier = null;
      if (targetOrg) {
        const tenantSetting = this.settings.find(s => s.organizationId === targetOrg && s.key === key);
        if (tenantSetting) {
          resolved = tenantSetting.value;
          tier = 'TIER_1_TENANT_DB';
        }
      }
      // Tier 2: Global Platform Setting
      if (resolved === null) {
        const globalSetting = this.settings.find(s => s.organizationId === null && s.key === key);
        if (globalSetting) {
          resolved = globalSetting.value;
          tier = 'TIER_2_GLOBAL_DB';
        }
      }
      // Tier 3: Environment Default
      if (resolved === null) {
        resolved = 'default_env_value';
        tier = 'TIER_3_ENV_DEFAULT';
      }
      return this.sendSuccess(res, { key, value: resolved, resolvedTier: tier });
    }

    // -------------------------------------------------------------
    // MODULE 17: CREDENTIAL CENTER
    // -------------------------------------------------------------
    if (pathname === '/api/v1/admin/credentials' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required for Credential Center');
      }
      const masked = Object.values(this.credentials).map(c => {
        let plain = 'sample';
        if (c.apiKeyCipher) {
          try { plain = decrypt(c.apiKeyCipher); } catch {}
        } else if (c.keySecretCipher) {
          try { plain = decrypt(c.keySecretCipher); } catch {}
        }
        return {
          type: c.type,
          status: c.status,
          maskedSecret: maskSecret(plain)
        };
      });
      return this.sendSuccess(res, masked);
    }

    if (pathname === '/api/v1/admin/credentials' && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required for Credential Center');
      }
      const { type, secretValue } = body;
      if (!type || !secretValue) {
        return this.sendError(res, 400, 'VALIDATION_ERROR', 'type and secretValue required');
      }
      const encrypted = encrypt(secretValue);
      this.credentials[type] = {
        type,
        status: 'CONFIGURED',
        apiKeyCipher: encrypted
      };
      this.logAudit('UPDATE_CREDENTIAL', 'INTEGRATION', type, null, user.id);
      return this.sendSuccess(res, {
        type,
        status: 'CONFIGURED',
        maskedSecret: maskSecret(secretValue)
      });
    }

    const credTestMatch = pathname.match(/^\/api\/v1\/admin\/credentials\/([^\/]+)\/test$/);
    if (credTestMatch && method === 'POST') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required for Credential Center');
      }
      const type = credTestMatch[1];
      const cred = this.credentials[type];
      if (!cred || !cred.apiKeyCipher) {
        return this.sendError(res, 400, 'NOT_CONFIGURED', `Credential ${type} is not configured`);
      }
      try {
        const decrypted = decrypt(cred.apiKeyCipher);
        if (!decrypted) throw new Error('Decryption empty');
      } catch (err) {
        return this.sendError(res, 500, 'CIPHER_TAMPERED', 'Authentication tag verification failed');
      }
      return this.sendSuccess(res, {
        type,
        status: 'CONNECTED',
        latencyMs: 38,
        pingSuccess: true
      });
    }

    if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
      const user = this.authenticateRequest(req);
      if (!user || user.role !== ROLES.SUPER_ADMIN) {
        return this.sendError(res, 403, 'FORBIDDEN', 'Super Admin required to inspect audit logs');
      }
      return this.sendSuccess(res, this.auditLogs, { total: this.auditLogs.length });
    }

    // Unmatched route
    return this.sendError(res, 404, 'NOT_FOUND', `Route ${method} ${pathname} not found`);
  }
}

// If executed directly from command line, start server
if (require.main === module) {
  const server = new TestServer();
  server.start().then(() => {
    console.log(`[BrokerIQ Test Server] Listening on http://127.0.0.1:${server.port}`);
  });
}

module.exports = {
  TestServer
};
