# SMS/Textbee implementation checkpoint — 1 November 2026

Source and isolated database validation only. No production deployment, actual BrokerIQ SMS, SIM verification or physical-device acceptance is claimed.

## Provider setup observed

User selected Rahul / Olive Estate's existing WhatsApp SIM +919899980802. Chrome's Textbee dashboard showed one online Redmi 24115RA8EI device, app2.9.0/build20, one active masked API key, 50/day and300/month limits, and one previously sent SMS. The existing key menu exposes rename/revoke, not full-key recovery. No key was created/revoked, no webhook was saved and no SMS was sent through that dashboard by this checkpoint. Browser access subsequently became disabled; the user's reconnection reply did not yet restore the existing browser tool's access.

## Implemented

- Organization-only encrypted Textbee settings, registry-driven Hindi instructions, explicit device/business-number/current-SIM selection and read-only device/SIM connectivity test. Textbee never inherits a shared platform sender. A database unique index prevents enabling the same physical device across firms. Broker Agent cannot read/write the connectors configuration; authorized messaging status exposes no key or webhook secret.
- Separate SMS conversations linked to existing owned Leads. Housing-only WhatsApp filtering remains unchanged. Agent's other-assignee/foreign-firm reads/sends are denied. Lead phone changes, blocked conversations, deleted Leads, revoked assignments, suspended users, inactive firms, chat restrictions and blocklists are rechecked before dispatch.
- Durable SMS request ID, message and single-attempt dispatch job committed atomically. Concurrent taps/retries create one message/job; concurrent workers call the provider once. The attempt marker precedes the provider call. Timeout/uncertain responses retain an explicit uncertain state; no blind retry or paid fallback. Provider acceptance remains QUEUED until carrier events establish SENT/DELIVERED/FAILED. Final delivered/failed statuses do not regress.
- Exact raw-body HMAC-SHA256 verification, configured subscription/device/SIM validation, durable event deduplication and timestamp-based status handling. Incoming sender must be a linked numeric business contact; OTP/password/security-code text and unrelated/system senders are ignored before their content is persisted. Inbound is disabled by default. Missing event timestamps are rejected rather than invented.
- Incoming business SMS creates one Lead activity/unread increment and durable notifications only for active firm Admins/current assigned Agent. Push content is generic, without SMS text. Existing owned-notification deep-link pipeline opens the SMS thread. Physical push acceptance remains pending.
- Web SMS tab/thread, queue/error display, retained draft/request ID, encrypted native request draft, mobile SMS tab/thread, Lead SMS actions, and web Follow-up/Visit/Pipeline SMS actions. Native Website Chat now opens its actual chat route.
- Stable complete message pagination beyond60 using time+ID cursor; rejects foreign cursors and preserves ties. Web SMS and native messaging expose load-older controls. Existing last-page message API remains compatible for older callers.
- Web and mobile Textbee credential forms use existing encrypted OrgSetting flow. Callback URLs are labelled for Textbee. No email connector or SMS automation is silently enabled by these UI additions.

## Evidence

- Fresh migrated/master-seeded isolated DB `brokeriq_test_sms_full2_20261101`, Node22.17: full API regression325 passed,25 configuration skips. A previous run with globally enabled MEDIA_ROOT had323 passes and one expected missing-storage assertion failure; it is not a successful full run.
- Subsequent updated targeted real API/PostgreSQL, Inbox regression and Textbee HTTP boundary suites:20/20 passed. Includes concurrent sends/dispatch, encrypted settings, Admin-only configuration, assignment change, ambiguous timeout, HMAC/device/SIM filtering, OTP exclusion, duplicate notification prevention, full equal-timestamp pagination and terminal delivery semantics. Provider HTTP is stubbed; these are not live-provider delivery tests.
- Mobile79/79, shared58/58, workspace typechecks pass. Scoped ESLint: zero errors, existing/general type warnings remain. Android Metro/Hermes export passed; final refresh after pagination is tracked in the build log, not a signed APK claim.

## Open production gates

1. Restore Chrome access and verify actual form/navigation in browser. Do not put real API credentials into isolated QA databases.
2. Obtain the existing full API key through the authorized secure settings flow; if unrecoverable, user creates a dedicated new key and saves it directly. Never request a key in chat.
3. Verify actual chosen physical SIM and current subscription ID. On the Android phone configure business-only incoming filters before enabling forwarding. An empty Textbee allowlist forwards everything; it is not safe isolation. Keep Receive SMS off until explicit rules are present.
4. Configure production signed webhook after candidate API activation, authorize an exact diagnostic recipient, verify actual send/carrier callback/phone receipt/business reply, quota errors and background/phone-offline recovery. Manual provider-history reconciliation for ambiguous sends and missing/late webhooks remains an operational gate.
5. Finish Gmail channel and applicable automation/reminder/property-sharing integrations; their addition is not implied by this SMS checkpoint. Super Admin cross-firm messaging drill-down, full language coverage, installed-device navigation/push and final release identity remain open.

Official protocol sources: https://textbee.dev/docs/api-reference ; https://textbee.dev/docs/webhooks ; https://textbee.dev/docs/webhooks/events ; https://textbee.dev/docs/receiving-sms/sms-filters .
