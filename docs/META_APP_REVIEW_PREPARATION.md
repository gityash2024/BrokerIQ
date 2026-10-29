# BrokerIQ / Yarvix — Meta review preparation

Live status checked 27 October 2026. Business verification is complete; App Review is not submitted and the app remains Unpublished. No approval, live Rahul connection or delivered WhatsApp test is claimed.

## Confirmed app identity

- App: BrokerIQ — 1470434228288427.
- Business portfolio: 1829084052117633, YARVIX TECHNOLOGIES PRIVATE LIMITED.
- Company/contact information is user-supplied; existing developer contact is yash@yarvixhq.com.
- Existing owned product icon: `apps/mobile/assets/icon.png` (1024 × 1024 PNG).
- Proposed category: Business and pages.
- Candidate privacy URL: https://brokeriq.mymultimeds.com/p/privacy — verify its current live content and Meta-specific disclosures before saving.
- Existing client number: Rahul's WhatsApp Business app, +91 9899980802. Use only supported Coexistence onboarding; do not delete, deregister, migrate or replace the Business app account.
- Consenting test recipient supplied by the user: Indian local number 9193706926, E.164 +919193706926. Never use actual Housing leads for test messages.

## Proposed permission explanations — drafts, not submitted attestations

### whatsapp_business_messaging

BrokerIQ is a real-estate customer relationship management product operated by YARVIX TECHNOLOGIES PRIVATE LIMITED. A brokerage's authorized administrators connect its WhatsApp Business Account to manage property enquiries in a firm-scoped inbox. We request this permission to send and receive customer-service messages, receive delivery/read status updates, and send approved templates for opted-in property enquiries, follow-ups and site-visit communication. Access is limited to the business account authorized by that brokerage. Messages are associated with the firm's conversations and leads, and credentials are stored encrypted on the server. This is the intended integration; the reviewer recording must demonstrate the actual implemented send/receive experience before submission.

### whatsapp_business_management

BrokerIQ requests this permission to identify the brokerage-authorized WhatsApp Business Account and phone-number assets, read account/number information, and synchronize its existing message templates into the CRM for selection in approved template messaging. The current implementation reads/synchronizes templates; do not claim template creation in BrokerIQ unless that feature is actually implemented and demonstrated. Business account identifiers, template metadata and credentials remain firm-scoped and are used to provide the requested CRM integration.

### public_profile

Use the minimum Facebook identity information needed to identify the administrator authorizing the WhatsApp business connection through Facebook Login for Business. Do not request social posts, friend lists or unrelated profile data. The current product does not yet implement an Embedded Signup callback; do not describe that connection UI as completed.

## Evidence still required by the live Meta form

1. Save an owned app icon, privacy policy URL and app category.
2. Supply each permission's actual allowed-use description and required API test calls.
3. Record genuine end-to-end screencasts: authorized account configuration, BrokerIQ inbox/template synchronization, a test message to the consenting recipient, and receipt/reply visible in WhatsApp. Never fabricate a delivery or use screenshots of another product.
4. Supply reviewer access/instructions for the actual working deployment; use a dedicated authorized review account, not Rahul's credentials or customer records.
5. Complete data-handling questions using confirmed practices: downstream processors, legal data controller/country, national-security disclosures in the past 12 months, and public-authority request policies actually in place.
6. Submit only after fields and evidence are complete and the user approves the external submission. Meta makes the approval decision.

## Data-handling answers requiring the business owner's confirmation

- Whether Meta-derived personal data has been disclosed in response to national-security requests in the previous 12 months.
- Which public-authority request procedures actually exist: legality review, challenging unlawful requests, minimum disclosure, and documentation; otherwise select None of the above truthfully.
- Confirm all providers that can process Meta-derived data. The deployment uses DigitalOcean hosting and Cloudflare; optional AI/email/storage providers must be included only if enabled and actually receiving that data. Do not answer No processors merely because the database is self-hosted.

## Connection and automation acceptance

After Meta permits the intended onboarding and Rahul authorizes Coexistence: obtain the resulting phone-number/WABA identifiers and token via the supported flow, save them in encrypted broker OrgSetting, configure and verify the correct signed webhook, subscribe the app, and check number/account status. Keep the Yarvix provider app separate from Rahul's business ownership.

Test inbound WhatsApp → firm inbox → lead linking → reply and status updates with the consenting recipient. Test Housing ingestion/deduplication and a specifically scoped automation on a controlled internal lead; do not enable broad outbound messages to existing leads as a test. A Housing lead alone does not open a WhatsApp customer-service window: outside the eligible window, use an approved template and appropriate consent. Validate failure/retry/idempotency and confirm no duplicate customer messages before expanding automation.
