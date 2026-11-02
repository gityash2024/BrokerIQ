# Gmail CRM checkpoint — 2 November 2026

Source implementation and local evidence only. No production Gmail grant, provider send/receive, migration, signed APK or installed-device acceptance is claimed.

## Implementation

- Dedicated platform `gmail_oauth` client and organization-only encrypted `gmail` mailbox grant. Google sign-in and transactional Zoho/SMTP are separate capabilities; no organization inherits another firm's mailbox.
- Explicit current Broker Admin consent, ten-minute single-use hashed state, encrypted PKCE verifier, initiating device session/session-version and current membership/client fingerprint checks. Callback is fixed `/api/webhooks/gmail/callback`, no-store, no-referrer and a fixed application redirect. Expired authorizations are pruned by bounded maintenance.
- Only Gmail read and send scopes; no mailbox delete/modify, arbitrary recipient, attachment download or bulk mailbox import. Same active mailbox cannot be installed in two firms. Disconnect removes local access, invalidates pending grants and attempts provider revocation without exposing credentials.
- Lead Email action resolves its existing valid email into a separate owned EMAIL conversation. Agents require assignment; current firm/account, contact, restrictions and blocklist are checked again before provider dispatch. Conflicting existing contact bindings require review.
- Durable atomic Message/Job outbox, UUID request identity, stable MIME Message-ID and one provider attempt. Timeout/ambiguous acceptance remains uncertain for review rather than automatic resend. SENT means Gmail accepted, never fabricated delivery/read.
- Proper Unicode MIME and same-conversation reply headers/thread identity. Sync reconciles uncertain local Message-ID records; retries do not create repeated imported messages or notifications.
- Client-only from/to sync, 25-message provider pages with retained cursor, strict recipient checks including Cc/Bcc exclusion, explicit security-code/password exclusion in subject/body. Original provider timestamps retained. Plain mail or bounded local HTML-to-text conversion; no HTML renderer or remote image/network fetch.
- Every three minutes, at most ten eligible conversations enqueue durable sync work, ordered fairly by previous sync time. Timers never perform provider requests. Jobs recheck permissions and mailbox; generic errors never log provider bodies or tokens.
- Inbound activities, unread counters and generic notification/push destinations are scoped to active firm Admins and current assigned Agent. Content is not put in pushes. Current owned-notification navigation handles EMAIL threads.
- Web and mobile Inbox tabs, internal Lead actions, reply subject/context, manual sync, cursor history, retained retry drafts and connector controls. Web Follow-up, Visit and Pipeline action rows include Email alongside WhatsApp/SMS.

## Evidence

- Actual isolated NestJS/PostgreSQL integration tests and stub Google/Textbee HTTP boundaries: five suites, 35/35 passed. Gmail authorization/send/sync/queue/reply/privacy/device-revoke/cross-firm cases and client MIME/HTML tests are included. These are not live-provider tests.
- Earlier fresh isolated full API run before the final scheduler/body follow-up: 338 passed /25 configuration-dependent skips. The 35-case targeted result above is current; the earlier full result is not relabelled as current final release acceptance.
- All workspace typechecks pass. Scoped ESLint had zero errors, existing warnings remain. Mobile79/shared58 source tests and Android Metro/Hermes export passed at this module checkpoint; this is not a signed installed artifact.
- Actual Chrome localhost3311/API3099 isolated QA: four channel tabs, Lead SMS/Email actions stay inside Inbox, missing connections link to the correct Textbee/Gmail settings, and custom Gmail connector is visible. Private evidence: `output/playwright/{textbee-settings,sms-internal-setup-error,gmail-internal-setup-error,gmail-connectors}-local-20261102.png`. No real credentials installed in a QA database.

## Open gates / limits

1. Configure the dedicated Google OAuth project/client with exact production redirect URI, Gmail API and read/send scopes. Gmail read is a restricted scope: production verification/consent is an actual provider gate, not something source code satisfies. User completes credential creation/consent final steps. Never send client secrets or grants in chat.
2. Use the intended business mailbox; verify actual send, receipt, reply, revocation, quota/outage and background job recovery with an explicitly authorized diagnostic recipient. No actual Google grant was created by these tests.
3. Initial sync deliberately searches the linked contact from 30 days before conversation creation, bounded to the most recent90 days. Older history needs a reviewed date-range/backfill workflow. Attachments are not imported. This is not a complete historical mailbox import.
4. Complete channels in applicable automation/reminder/property-sharing processes, Super Admin explicit cross-firm drill-down, translations and installed mobile/browser return-from-consent behavior.
5. Activate selected transactional Zoho mail separately, verify actual login OTP/invitation/recovery application delivery, then enforce the email login factor in the coordinated release.
6. Apply additive migrations only through the verified backup/candidate release sequence; complete signed APK upgrade and production artifact matching before launch.

Official protocol references: https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/gmail/api/auth/scopes ; https://developers.google.com/workspace/gmail/api/guides/filtering ; https://developers.google.com/workspace/gmail/api/guides/sending . HTML conversion behavior was also checked against the installed mailparser source.
