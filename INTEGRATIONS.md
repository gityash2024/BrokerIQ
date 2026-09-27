# BrokerIQ — Third-Party Integrations Technical Specification

## 1. Integration Ecosystem Overview

BrokerIQ serves as the central nervous system for Indian real-estate brokers. To automate the end-to-end transaction lifecycle, the platform integrates with leading third-party enterprise services:

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    BROKERIQ PLATFORM                   │
                               └───────┬────────────┬────────────┬───────────┬──────────┘
                                       │            │            │           │
                    ┌──────────────────▼──┐  ┌──────▼──────┐  ┌──▼───────────▼──┐
                    │ Property Portals    │  │ Messaging   │  │ Payment Gateway │
                    │ - Housing.com       │  │ - Meta Cloud│  │ - Razorpay      │
                    │   (Webhook/Polling) │  │   WhatsApp  │  │   (UPI/Cards)   │
                    └─────────────────────┘  └─────────────┘  └─────────────────┘
                                       │            │            │
                    ┌──────────────────▼──┐  ┌──────▼──────┐  ┌──▼──────────────┐
                    │ AI & Intelligence   │  │ Push Alerts │  │ Cloud Storage   │
                    │ - Groq LPU Engine   │  │ - Firebase  │  │ - DigitalOcean  │
                    │   (Llama 3.3/Mixtral│  │   FCM Cloud │  │   Spaces (S3)   │
                    └─────────────────────┘  └─────────────┘  └─────────────────┘
```

---

## 2. Housing.com Integration Engine

Housing.com is one of India's largest property listing portals. BrokerIQ ingests buyer leads generated from listed properties via a dual webhook-and-polling ingestion engine.

### 2.1 Webhook Lead Ingestion Specification
- **Ingestion Endpoint**: `POST /api/v1/integrations/housing/webhook`
- **Signature Security**: Housing.com sends an HMAC-SHA256 signature in the `X-Housing-Signature` header computed with the agency's shared secret.

#### Webhook Payload Schema:
```json
{
  "lead_id": "hs_lead_98234120",
  "listing_id": "hs_prop_77412",
  "lead_name": "Vikram Malhotra",
  "lead_phone": "+919876500001",
  "lead_email": "vikram.m@example.com",
  "property_title": "3 BHK Luxury Apartment, Whitefield",
  "locality": "Whitefield",
  "city": "Bangalore",
  "budget_min": 14000000,
  "budget_max": 17000000,
  "currency": "INR",
  "timestamp": "2026-09-26T09:30:00Z"
}
```

### 2.2 Deduplication & Pipeline Assignment
1. **Deduplication Check**: Upon receipt, the system inspects existing leads within the tenant organization:
   - Query: `WHERE organization_id = :orgId AND (phone = :phone OR (email = :email AND email IS NOT NULL))`
2. **Existing Lead Handling**: If a match is found, BrokerIQ updates `Lead.score` (+10 points for renewed intent), attaches an `Activity` record (`INQUIRY_RECEIVED`), and leaves current stage intact.
3. **New Lead Handling**: If new, inserts a `Lead` record with `stage = 'NEW'`, `source = 'HOUSING_COM'`, runs the automated 6-factor property matching engine, and dispatches an FCM push alert to on-duty staff.

### 2.3 Fallback Polling Engine
Portals occasionally suffer webhook delivery outages. BrokerIQ runs a background BullMQ cron job (`lead-sync:housing-poll`) every 15 minutes:
- Calls `GET https://api.housing.com/v2/leads?since={lastSyncTimestamp}`.
- Authenticates using AES-256-GCM decrypted API credentials stored in `Integration`.
- Idempotently merges new leads using the unique `lead_id` constraint in `WebhookEvent`.

---

## 3. Meta WhatsApp Business Cloud API Integration

WhatsApp is the primary medium for client communication in Indian real estate. BrokerIQ integrates directly with the **Meta WhatsApp Business Cloud API (Graph API v18.0)**.

### 3.1 Webhook Verification Handshake
Meta requires an initial GET challenge handshake during webhook registration:
- **Endpoint**: `GET /api/v1/whatsapp/webhooks`
- **Validation**:
  ```typescript
  @Get('webhooks')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expectedToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    throw new ForbiddenException('Verification token mismatch');
  }
  ```

### 3.2 Inbound Message Processing
Meta delivers incoming customer messages via `POST /api/v1/whatsapp/webhooks`.
- **Signature Verification**: Validates `X-Hub-Signature-256` header against `META_APP_SECRET`.
- **Payload Extraction**: Parses message type (`text`, `image`, `document`, `audio`, `interactive`).
- **Real-Time Notification**: Pushes message payload to the broker's mobile screen over Socket.io (`whatsapp:incoming`).
- **AI Auto-Suggestion**: If tenant has `ai_reply_suggestion` enabled, enqueues background job to Groq for reply generation.

### 3.3 Outbound Approved Template Messages
Meta enforces strict restrictions: outside a 24-hour customer-initiated conversation window, brokers may only send pre-approved template messages.
- **Endpoint**: `POST /api/v1/whatsapp/send-template`
- **Payload**:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "+919876543210",
    "type": "template",
    "template": {
      "name": "property_site_visit_reminder",
      "language": { "code": "en" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Vikram" },
            { "type": "text", "text": "Sobha Dream Acres, Whitefield" },
            { "type": "text", "text": "Saturday at 11:00 AM" }
          ]
        }
      ]
    }
  }
  ```

---

## 4. Groq AI Integration (LPU Inference Engine)

BrokerIQ leverages **Groq Cloud API** for ultra-low latency inference on state-of-the-art open models (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`).

### 4.1 REST Client Configuration
- **Base URL**: `https://api.groq.com/openai/v1`
- **Headers**:
  - `Authorization: Bearer <GROQ_API_KEY>`
  - `Content-Type: application/json`
- **Timeout**: Strict 5000ms timeout with automated retry on HTTP 429 (Rate Limit) and 503 (Service Unavailable).

### 4.2 Latency Benchmark Standards
| Task | Target Latency | P95 Latency | Fallback Model |
|---|---|---|---|
| Reply Suggestion | < 300ms | < 450ms | `mixtral-8x7b-32768` |
| Feature Extraction | < 250ms | < 350ms | Rule-based regex parser |
| Conversation Summary | < 500ms | < 750ms | None (Queue retry) |

---

## 5. Razorpay Payments Integration

Razorpay powers automated subscription billing, recurring card/UPI mandates, and tax invoicing.

### 5.1 Order Creation & Checkout Initialization
- **Endpoint**: `POST /api/v1/payments/create-order`
- **API Call to Razorpay**:
  ```typescript
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `receipt_${organizationId}_${Date.now()}`,
    notes: {
      organizationId,
      planTier: 'PRO',
      billingCycle: 'MONTHLY'
    }
  });
  ```
- **Response**: Returns `order_id` and public `key_id` to initialize the client checkout widget.

### 5.2 Razorpay Webhook Events
BrokerIQ listens for critical lifecycle events on `/api/v1/payments/webhooks/razorpay`:
- `order.paid`: Marks payment successful, issues GST invoice.
- `payment.failed`: Triggers dunning notification and grace period timer.
- `subscription.charged`: Extends SaaS access period automatically.

---

## 6. Firebase Cloud Messaging (FCM) Push Notifications

Mobile brokers must be notified instantly when high-intent leads arrive. BrokerIQ uses FCM HTTP v1 API.

### 6.1 Service Account Initialization
- Initialized via Google Application Default Credentials or encrypted JSON key stored in Credential Center.
- Scoped to `https://www.googleapis.com/auth/firebase.messaging`.

### 6.2 Priority Notification Payload
```json
{
  "message": {
    "token": "dK4...device_fcm_token...",
    "notification": {
      "title": "🔥 Hot Lead Assigned: Vikram Malhotra",
      "body": "Budget: ₹1.5 Cr | 3 BHK Whitefield | Inquired on Housing.com"
    },
    "data": {
      "leadId": "lead_vikram_001",
      "type": "LEAD_ASSIGNED",
      "action": "OPEN_LEAD_DETAILS"
    },
    "android": {
      "priority": "high",
      "notification": {
        "channel_id": "leads_urgent",
        "color": "#059669"
      }
    }
  }
}
```

---

## 7. DigitalOcean Spaces (S3-Compatible Object Storage)

Property photos, floor plans, and generated tax invoices are stored in **DigitalOcean Spaces** backed by a global CDN.

### 7.1 Architecture & Presigned URLs
To eliminate server bandwidth bottlenecks, the mobile client uploads media files directly to Spaces using **Presigned PUT URLs**:

```
Mobile Client ──► 1. POST /api/v1/storage/presigned-url { fileName, fileType }
                  ◄── 2. Returns { uploadUrl: "https://brokeriq.blr1.digitaloceanspaces.com/...", cdnUrl }
Mobile Client ──► 3. PUT raw image directly to uploadUrl
Mobile Client ──► 4. POST /api/v1/properties/:id/images { cdnUrl }
```

### 7.2 Configuration Parameters
- **Endpoint**: `https://blr1.digitaloceanspaces.com` (Bangalore datacenter for minimal domestic latency)
- **CDN Base URL**: `https://cdn.brokeriq.in/`
- **Bucket**: `brokeriq-media-prod`
- **Object Access**: Private by default; public-read only for approved property listing images.
