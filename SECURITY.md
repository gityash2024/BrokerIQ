# BrokerIQ — Security, Cryptography & Threat Mitigation Specification

## 1. Security Architecture & Threat Model

BrokerIQ handles high-value commercial and residential real-estate transaction records, sensitive financial documents, and customer lead data. The system is engineered around **Defense-in-Depth**, **Zero-Trust Network Assumptions**, and the **Principle of Least Privilege**.

### Threat Matrix & Mitigations

| Threat Category | Potential Attack Vector | BrokerIQ Defense Mechanism |
|---|---|---|
| **Cross-Tenant Leakage** | Tenant A attempts to read/modify Tenant B's leads | Mandatory `organizationId` foreign keys, `TenantGuard` JWT validation, automated Prisma query scoping |
| **Credential Theft** | Compromise of third-party API keys (Housing.com, Meta, Razorpay) | AES-256-GCM authenticated encryption at rest; secrets never returned unmasked in API responses |
| **Token Hijacking** | Interception or replay of client JWT tokens | 15-minute access token lifespan, Refresh Token Family Rotation with automatic reuse breach detection |
| **Brute Force & OTP Abuse** | Automated scripts guessing 6-digit SMS OTPs | Redis-backed rate limiting (1 OTP/60s), 3-attempt lockout, 5-minute strict TTL |
| **Privilege Escalation** | Broker staff user attempting administrative configuration | Strict `@Roles()` decorator enforcement, hierarchical RBAC guards at controller boundary |
| **Injection & Malicious Input** | SQL injection, XSS, malformed JSON payloads | Prisma parameterized queries, strict Zod schema validation filters, Helmet security headers |

---

## 2. Authentication & Identity Architecture

BrokerIQ supports dual login paths tailored to Indian broker preferences:
1. **Email & Password Login**: Used primarily by agency principals and administrators accessing the web portal.
2. **Phone Number & 6-Digit OTP Login**: Primary path for mobile brokers operating in the field.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Broker Mobile App
    participant API as NestJS Auth Controller
    participant Redis as Redis 7 In-Memory Store
    participant SMS as SMS / WhatsApp Gateway
    participant DB as PostgreSQL 16

    Note over Client,API: Flow A: OTP Request
    Client->>API: POST /api/v1/auth/otp/send { phone: "+919876543210" }
    API->>Redis: Check Cooldown Key: `otp_cooldown:+919876543210`
    alt Cooldown Active (<60s)
        API-->>Client: HTTP 429 Too Many Requests { retryAfter: 45 }
    else Allowed
        API->>API: Generate Cryptographic 6-Digit Code (crypto.randomInt)
        API->>Redis: SET `otp:+919876543210` = { codeHash, attempts: 0 } EX 300
        API->>Redis: SET `otp_cooldown:+919876543210` = 1 EX 60
        API->>SMS: Dispatch OTP via WhatsApp / SMS
        API-->>Client: HTTP 200 OK { message: "OTP Sent", expiresIn: 300 }
    end

    Note over Client,API: Flow B: OTP Verification & Token Issue
    Client->>API: POST /api/v1/auth/otp/verify { phone: "+919876543210", code: "492815" }
    API->>Redis: GET `otp:+919876543210`
    alt OTP Not Found / Expired
        API-->>Client: HTTP 400 Bad Request { error: "OTP_EXPIRED" }
    else OTP Found
        alt Attempts >= 3
            API->>Redis: DEL `otp:+919876543210`
            API-->>Client: HTTP 403 Forbidden { error: "TOO_MANY_FAILED_ATTEMPTS" }
        else Verify Code Hash
            alt Code Matches
                API->>Redis: DEL `otp:+919876543210`
                API->>DB: Find or Create User by Phone
                API->>API: Issue Access Token (15m) & Refresh Token (7d)
                API->>Redis: Store Token Family Root
                API-->>Client: HTTP 200 OK { accessToken, refreshToken, user }
            else Code Invalid
                API->>Redis: INCR attempts
                API-->>Client: HTTP 400 Bad Request { error: "INVALID_OTP", remainingAttempts: 2 }
            end
        end
    end
```

### Password Hashing Standards
For email/password authentication, passwords are encrypted using **Argon2id** (memory cost: 65,536 KiB, iterations: 3, parallelism: 4) or **bcrypt** with a work factor of **12**. Plaintext passwords are never logged, cached, or persisted.

---

## 3. Token Family Rotation & Reuse Detection

To neutralize the risk of stolen refresh tokens, BrokerIQ implements **Refresh Token Family Rotation**:

```
Client has Token R1 (Family F1)
  │
  ├─► Valid Exchange: Client presents R1
  │     Backend invalidates R1
  │     Backend issues Access Token A2 + Refresh Token R2 (Family F1)
  │
  └─► Attack Scenario (Token Reuse):
        Attacker attempts to present already-used Token R1
        Backend detects reuse of R1 in Family F1!
        BREACH ACTION:
          1. Immediately invalidate ALL tokens in Family F1 (R1, R2, etc.)
          2. Revoke active access sessions for that User
          3. Write high-severity event to AuditLog
          4. Force immediate re-authentication across all user devices
```

### Expiration Lifespans
- **Access Tokens**: Short-lived (**15 minutes**), containing user identity, role, and organization ID claims.
- **Refresh Tokens**: Long-lived (**7 days**), stored as high-entropy cryptographically random strings in Redis with automated sliding expiration.

---

## 4. Role-Based Access Control (RBAC) Matrix

BrokerIQ defines 3 distinct hierarchical system roles:
1. `SUPER_ADMIN`: BrokerIQ platform operator. Access restricted to Next.js Super Admin portal.
2. `BROKER_ADMIN`: Real estate agency principal or managing broker. Full control over their organization.
3. `BROKER_STAFF`: Field agent or sales representative. Access restricted to assigned leads, properties, and visits.

### Granular Permission Matrix

| Module & Functional Area | Action | SUPER_ADMIN | BROKER_ADMIN | BROKER_STAFF |
|---|---|---|---|---|
| **System Settings & Flags** | Global CRUD | Allowed | Denied | Denied |
| **Credential Vault** | Edit Third-Party Keys | Allowed | Denied | Denied |
| **Organizations** | Create / Suspend Org | Allowed | Denied | Denied |
| **Organizations** | Update Own Agency Info | Allowed | Allowed | Denied |
| **Team Management** | Invite / Remove Staff | Allowed | Allowed | Denied |
| **Plans & Billing** | Manage Plans & Pricing | Allowed | Denied | Denied |
| **Subscriptions** | Upgrade / Renew / Pay | Allowed | Allowed | Denied |
| **Leads Pipeline** | View All Agency Leads | Allowed | Allowed | View Assigned Only |
| **Leads Pipeline** | Create / Edit / Stage Move | Allowed | Allowed | Allowed |
| **Leads Pipeline** | Reassign Lead Agent | Allowed | Allowed | Denied |
| **Property Inventory** | Add / Edit Properties | Allowed | Allowed | Allowed |
| **Property Inventory** | Delete Property | Allowed | Allowed | Denied |
| **Follow-Ups & Site Visits**| Manage Own Tasks | Allowed | Allowed | Allowed |
| **WhatsApp Chat** | Send Message / Template | Allowed | Allowed | Allowed |
| **AI Assistant** | Use AI Suggestions | Allowed | Allowed | Allowed |
| **Audit Logs** | View Audit History | Global View | Agency View | Denied |
| **Analytics** | View Financial KPIs | Global Platform | Agency Level | Personal Metrics |

Controllers enforce these rules via `@Roles(Role.BROKER_ADMIN)` decorators paired with `RolesGuard`.

---

## 5. AES-256-GCM Encrypted Credential Vault

Third-party API keys (Groq AI, Meta WhatsApp, Housing.com, Razorpay, DigitalOcean Spaces) are stored in the `Integration` table using **AES-256-GCM** (Galois/Counter Mode) authenticated encryption.

### 5.1 Ciphertext Storage Format
All encrypted secrets are serialized into a standardized 3-part hex-delimited string:
```
{initialization_vector}:{authentication_tag}:{ciphertext}
```
- **Initialization Vector (IV)**: 12 bytes (96 bits) of cryptographically secure random bytes generated uniquely per encryption operation via `crypto.randomBytes(12)`. IVs are NEVER reused.
- **Authentication Tag (AuthTag)**: 16 bytes (128 bits) produced by the GCM cipher, providing mathematical verification that ciphertext has not been tampered with.
- **Ciphertext**: The encrypted plaintext secret.

### 5.2 Encryption Implementation Blueprint

```typescript
// apps/api/src/common/services/encryption.service.ts
import * as crypto from 'node:crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer;

  constructor(masterKeyHex: string) {
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    if (this.masterKey.length !== 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be exactly 32 bytes (256 bits)');
    }
  }

  public encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  public decrypt(encryptedPayload: string): string {
    const [ivHex, authTagHex, cipherTextHex] = encryptedPayload.split(':');
    if (!ivHex || !authTagHex || !cipherTextHex) {
      throw new Error('Malformed encrypted payload format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 5.3 Secret Masking Protocol
API responses returning integration status to web and mobile clients NEVER include plaintext secrets. Secrets are sanitized using strict masking:
```
Original: "sk_live_98a7b6c5d4e3f2a10987654321"
Masked:   "••••••••••••4321"
```

---

## 6. HTTP Security Headers, CORS & Rate Limiting

### 6.1 Helmet Security Headers
The NestJS application bootstrap (`apps/api/src/main.ts`) initializes **Helmet** middleware to configure strict HTTP response headers:
- `Content-Security-Policy (CSP)`: Enforces default `'self'`, disallowing unsafe inline scripts and untrusted frame sources.
- `Strict-Transport-Security (HSTS)`: `max-age=31536000; includeSubDomains; preload` forcing all browser communication over HTTPS.
- `X-Frame-Options`: Set to `DENY` to prevent clickjacking in iframe environments.
- `X-Content-Type-Options`: Set to `nosniff` preventing MIME-type confusion attacks.
- `X-XSS-Protection`: Enabled in blocking mode.

### 6.2 CORS Origin Whitelisting
CORS is dynamically configured to reject unauthorized origins:
- Mobile client traffic (origin header absent in native requests) is validated via custom app secret headers.
- Web traffic is restricted strictly to verified frontend domains (`ADMIN_APP_URL` and `BROKER_WEB_URL`).

### 6.3 Throttler Rate Limiting
API endpoints are protected against Denial-of-Service and credential stuffing via `@nestjs/throttler` backed by Redis:
- **Global API Default**: 100 requests per 60-second sliding window per IP.
- **Authentication Endpoints (`/auth/login`, `/auth/otp`)**: Strict limit of **5 requests per 60 seconds** per IP/Phone.
- **AI Inference Endpoints (`/ai/*`)**: Tier-based burst limit of **20 requests per minute**.

---

## 7. Immutable Audit Trail Architecture

All administrative, security, and financial operations generate permanent entries in the `AuditLog` table. Audit logs are append-only; update and delete operations are rejected at the database level.

### Audited Operational Categories
1. **Authentication Events**: Successful logins, failed attempts, OTP lockouts, token revocations.
2. **Credential Modifications**: Updates to third-party integration keys in the Credential Center.
3. **Subscription Adjustments**: Plan tier upgrades, manual billing settlements, trial extensions.
4. **Organization Lifecycle Changes**: Suspensions, reactivations, soft deletions.
5. **Data Export Events**: Bulk CSV exports of customer or lead registries.
