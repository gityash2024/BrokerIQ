# BrokerIQ — REST & WebSocket API Specification Reference

## 1. Global Standards & Protocol Architecture

All external and internal communication with the BrokerIQ backend (`apps/api`) conforms to strict RESTful and WebSocket standards.

### 1.1 Base URL & Versioning
- **Current Stable Version**: `v1`
- **Base REST Endpoint**: `https://api.brokeriq.in/api/v1` (Production) / `http://localhost:4000/api/v1` (Local)
- **Interactive OpenAPI / Swagger Documentation**: Available at `/api/docs`

### 1.2 Authentication & Security Headers
Every authenticated request must provide a valid JWT access token:
```http
Authorization: Bearer <access_jwt_token>
```
Super Administrators accessing the API on behalf of a tenant may optionally provide:
```http
X-Tenant-Id: <target_organization_id>
```

### 1.3 Standard JSON Response Envelope
All REST endpoints return a unified response envelope:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;       // e.g. "VALIDATION_FAILED", "UNAUTHORIZED", "QUOTA_EXCEEDED"
    message: string;    // Human-readable error message
    details?: any;      // Validation error array or contextual metadata
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
```

### 1.4 Standard HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Input validation failed (Zod validation error).
- `401 Unauthorized`: Token missing, expired, or invalid.
- `402 Payment Required`: Plan limit / quota reached.
- `403 Forbidden`: Insufficient role privileges or cross-tenant violation.
- `404 Not Found`: Resource does not exist or belongs to another tenant.
- `409 Conflict`: Unique constraint violation (e.g. email or phone exists).
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Pagination, Sorting & Filtering Query Standard

List endpoints support standardized query parameters:
- `page`: 1-based page index (Default: `1`).
- `limit`: Items per page (Default: `20`, Max: `100`).
- `sortBy`: Model column name to sort by (Default: `createdAt`).
- `sortOrder`: Sorting direction: `asc` or `desc` (Default: `desc`).
- `search`: Case-insensitive text query matching name, phone, or title.

---

## 3. Comprehensive Endpoints Catalog (21 Feature Modules)

### 3.1 Auth Module (`/auth`)
- `POST /auth/login`: Authenticate via email & password. Returns tokens & profile.
- `POST /auth/register`: Create new broker organization & founder user.
- `POST /auth/refresh`: Exchange refresh token for new access & refresh tokens.
- `POST /auth/logout`: Revoke active refresh token family.
- `POST /auth/otp/send`: Request 6-digit phone OTP (rate-limited).
- `POST /auth/otp/verify`: Submit 6-digit OTP to login / register.

### 3.2 Organizations Module (`/organizations`)
- `GET /organizations`: [SUPER_ADMIN] List all platform organizations.
- `POST /organizations`: [SUPER_ADMIN] Provision new organization.
- `GET /organizations/:id`: Retrieve organization profile & limits.
- `PUT /organizations/:id`: Update organization details (Name, GSTIN, Logo).
- `POST /organizations/:id/suspend`: [SUPER_ADMIN] Suspend organization access.
- `POST /organizations/:id/reactivate`: [SUPER_ADMIN] Reactivate organization.
- `GET /organizations/:id/members`: List team members in organization.
- `POST /organizations/:id/members/invite`: Invite broker staff agent.

### 3.3 Users Module (`/users`)
- `GET /users/me`: Fetch current authenticated user profile.
- `PUT /users/me`: Update profile (Name, Avatar URL).
- `PUT /users/:id/role`: [BROKER_ADMIN] Change team member role (`BROKER_STAFF` <-> `BROKER_ADMIN`).
- `DELETE /users/:id`: [BROKER_ADMIN] Remove user from organization.

### 3.4 Plans Module (`/plans`)
- `GET /plans`: List all active public plans (FOUNDER, STARTER, PRO, BUSINESS).
- `GET /plans/:id`: Retrieve plan details, limits, and pricing.
- `POST /plans`: [SUPER_ADMIN] Create new subscription plan tier.
- `PUT /plans/:id`: [SUPER_ADMIN] Update pricing or limit defaults.

### 3.5 Subscriptions Module (`/subscriptions`)
- `GET /subscriptions/current`: Retrieve active organization subscription & usage meters.
- `GET /subscriptions`: [SUPER_ADMIN] List all global tenant subscriptions.
- `POST /subscriptions/upgrade`: Request upgrade to higher plan tier.
- `POST /subscriptions/cancel`: Schedule subscription cancellation at period end.
- `POST /subscriptions/pause`: Temporarily pause active subscription.
- `POST /subscriptions/resume`: Resume paused subscription.

### 3.6 Payments Module (`/payments`)
- `POST /payments/create-order`: Initialize Razorpay payment order for subscription.
- `POST /payments/verify`: Submit client payment signature for verification.
- `POST /payments/webhooks/razorpay`: Public webhook endpoint for Razorpay events.
- `POST /payments/manual`: [SUPER_ADMIN] Record offline settlement (NEFT/Cheque/Cash).
- `GET /payments/invoices`: List organization tax invoices.
- `GET /payments/invoices/:id/download`: Generate and download PDF tax invoice.

### 3.7 Customers Module (`/customers`)
- `GET /customers`: List tenant customer contacts (paginated, searchable).
- `POST /customers`: Create customer contact with budget & preferences.
- `GET /customers/:id`: Retrieve customer profile, leads, and visit history.
- `PUT /customers/:id`: Update customer contact information.
- `DELETE /customers/:id`: Soft delete customer record.

### 3.8 Leads Module (`/leads`)
- `GET /leads`: List leads with stage, priority, and assigned staff filters.
- `POST /leads`: Ingest new lead manually.
- `GET /leads/:id`: Get full lead dossier, activities, and matched properties.
- `PUT /leads/:id`: Update lead details, budget, or preferred locality.
- `PATCH /leads/:id/stage`: Transition lead stage (validated via state machine).
- `PATCH /leads/:id/assign`: Assign lead to broker staff agent.
- `DELETE /leads/:id`: Soft delete lead.

### 3.9 Properties Module (`/properties`)
- `GET /properties`: List properties with BHK, price, and locality filters.
- `POST /properties`: Create new property listing.
- `GET /properties/:id`: Retrieve property specifications, photos, and owner info.
- `PUT /properties/:id`: Update listing price, status, or description.
- `DELETE /properties/:id`: Soft delete property.
- `GET /properties/match/:leadId`: Run 6-factor matching engine for a specific lead.

### 3.10 Follow-ups Module (`/follow-ups`)
- `GET /follow-ups`: List follow-ups (filters: `TODAY`, `OVERDUE`, `UPCOMING`).
- `POST /follow-ups`: Schedule actionable follow-up task.
- `PATCH /follow-ups/:id/complete`: Mark follow-up as completed with notes.
- `PATCH /follow-ups/:id/reschedule`: Reschedule follow-up to future date.

### 3.11 Site Visits Module (`/site-visits`)
- `GET /site-visits`: List scheduled client property walkthroughs.
- `POST /site-visits`: Book a new site visit appointment.
- `PATCH /site-visits/:id/status`: Update status (`CONFIRMED`, `COMPLETED`, `NO_SHOW`, `CANCELLED`).
- `POST /site-visits/:id/feedback`: Record client visit feedback and rating (1-5).

### 3.12 WhatsApp Module (`/whatsapp`)
- `GET /whatsapp/conversations`: List active chat threads with unread counters.
- `GET /whatsapp/conversations/:id/messages`: Retrieve chat message history.
- `POST /whatsapp/send`: Send direct text message to contact.
- `POST /whatsapp/send-template`: Dispatch approved Meta template message.
- `GET /whatsapp/webhooks`: Meta webhook verification challenge.
- `POST /whatsapp/webhooks`: Meta incoming webhook receiver.

### 3.13 Housing.com Module (`/integrations/housing`)
- `POST /integrations/housing/webhook`: Ingest incoming lead webhook.
- `POST /integrations/housing/test`: Test credential connection to Housing API.
- `POST /integrations/housing/sync-now`: Force immediate manual poll for leads.

### 3.14 AI Module (`/ai`)
- `POST /ai/extract-lead`: Parse unstructured text into structured lead JSON.
- `POST /ai/suggest-reply`: Generate 3 contextual WhatsApp reply suggestions.
- `POST /ai/summarize`: Generate executive summary of conversation thread.
- `GET /ai/usage`: Retrieve current billing period token consumption.

### 3.15 Automations Module (`/automations`)
- `GET /automations/rules`: List configured workflow automation rules.
- `POST /automations/rules`: Create event-condition-action rule.
- `PUT /automations/rules/:id`: Update rule status or delay settings.
- `DELETE /automations/rules/:id`: Remove automation rule.

### 3.16 Analytics Module (`/analytics`)
- `GET /analytics/broker/dashboard`: Real-time broker KPIs (Leads, visits, overdue tasks).
- `GET /analytics/broker/conversion`: Pipeline stage conversion velocity and drop-off.
- `GET /analytics/admin/overview`: [SUPER_ADMIN] Platform MRR, active orgs, system throughput.

### 3.17 Notifications Module (`/notifications`)
- `GET /notifications`: List user notifications (unread first).
- `PATCH /notifications/:id/read`: Mark notification as read.
- `POST /notifications/devices`: Register mobile device FCM token.

### 3.18 Admin Settings Module (`/admin/settings`)
- `GET /admin/settings`: [SUPER_ADMIN] Retrieve all global system settings.
- `PUT /admin/settings/:category`: [SUPER_ADMIN] Update settings for a category.
- `GET /admin/settings/tenant`: Retrieve effective settings for current tenant.

### 3.19 Credential Center Module (`/admin/credentials`)
- `GET /admin/credentials`: [SUPER_ADMIN] List all integrations with masked secrets.
- `PUT /admin/credentials/:type`: [SUPER_ADMIN] Encrypt and store third-party credentials.
- `POST /admin/credentials/:type/test`: [SUPER_ADMIN] Live health ping to external provider.

### 3.20 Audit Logs Module (`/admin/audit-logs`)
- `GET /admin/audit-logs`: [SUPER_ADMIN] Search and filter immutable security audit trail.
- `GET /admin/audit-logs/:id`: View detailed state diff before/after modification.

### 3.21 Health Module (`/health`)
- `GET /health`: Basic liveness probe (Returns HTTP 200 `{ status: "ok" }`).
- `GET /health/ready`: Comprehensive readiness probe verifying PostgreSQL, Redis, and BullMQ connectivity.

---

## 4. WebSocket Gateway Protocol (`/ws` Namespace)

Real-time bi-directional synchronization is delivered via Socket.io at path `/socket.io/` on namespace `/ws`.

### 4.1 Connection Handshake
```javascript
const socket = io('https://api.brokeriq.in/ws', {
  auth: {
    token: 'jwt_access_token_here'
  },
  transports: ['websocket']
});
```

### 4.2 Real-Time Events Specification

| Event Name | Direction | Payload Schema | Description |
|---|---|---|---|
| `lead:new` | Server -> Client | `LeadEntity` | Broadcasts new lead arrival to organization |
| `lead:stage_changed` | Server -> Client | `{ leadId, from, to, updatedBy }` | Updates pipeline boards across active sessions |
| `whatsapp:incoming` | Server -> Client | `MessageEntity` | Delivers real-time customer chat message |
| `whatsapp:status` | Server -> Client | `{ messageId, status: 'DELIVERED' \| 'READ' }` | Message delivery and read receipts |
| `notification:push` | Server -> Client | `NotificationEntity` | In-app push notification trigger |
