# BrokerIQ build 26 — 26 October 2026

Scope: property editing/data preservation, 300 MB WhatsApp exports, broker team invitations/sub-agent workspaces, and the matching staging release links. Existing service boundaries, credentials and business records are retained.

## Defect and correction

The actual source-register API response for House 1994 contains `clientMutationId: null`. The build 25 editor copied that database metadata into a strict optional-string write field. The earlier regression fixture covered a null date/contact role but omitted the actual failing field.

Editors now select writable fields, omit null identity metadata, and generate a sparse PATCH against the loaded revision. Unchanged fields/contacts/media are omitted. Explicit nulls and empty arrays clear only the intended value. Numeric zero/boolean false survive. Detailed-field updates merge with stored siblings; clearing monthly rent also clears its legacy alias and derived price. Old queued property drafts use the same normalization. Failed server sync remains visible instead of being reported as server success.

## Team

Team & agents is active under Product features and Profile/Settings. Firm admins create expiring invite links, optionally emailed when SMTP is available. A new member signs up using the invited email, returns to the invite, accepts, then logs in as BROKER_AGENT or the invited admin role. Signup/login now preserve invite destinations. Acceptance is transactional and single-use; platform-staff/cross-firm joins are rejected.

Agents can use their firm inventory/capture workspace and assigned leads/follow-ups/visits. They cannot manage invitations, change member roles, administer integrations or open Super Admin. Lead assignment is admin-only. Suspension/removal/role changes invalidate existing access and refresh sessions. The additive migration updates the team policy and explicitly supported agent module roles, preserving hidden states and unrelated modules.

## Verification

- Shared: 40 tests passed.
- Mobile: 17 tests passed; TypeScript passed; signed release Gradle build passed.
- API legacy/full regression: 21 suites, 133 tests passed (24 mode-specific tests skipped).
- Broker-mode final regression (27 October): five suites, 28 tests passed, covering actual imported-record shape, sparse writes and clearing, publishing/customer boundaries, team lifecycle and permissions, recovery and cross-firm isolation. Agent query filters cannot override lead/follow-up scope; task assignment also validates active firm membership and prevents agents assigning other members.
- The 300 MB test sends all 300 one-megabyte chunks through HTTP, resumes after interruption, extracts all 31 messages, retains attachment/original context, verifies idempotent completion and rejects >300 MB and cross-firm upload access.
- Production and tests share the same body-parser configuration, including raw bytes for signed webhooks. Production already had the larger parser; moving it into shared configuration corrected a test setup discrepancy.
- Android ZIP MIME aliases/extensionless shared ZIP signatures normalize to the canonical content type, including previously queued captures.
- One final combined test run saw a loopback ECONNRESET during the full-size upload; the isolated upload rerun passed. The upload test now holds one loopback listener rather than letting Supertest reopen one per chunk; the final combined five-suite run passed with all 300 chunks.
- Web production build and API build passed. Workspace/API/web/mobile typechecks passed.
- Emulator: same-certificate upgrade from build 24 to build 26 without uninstall/data-clear retained Rahul's login. Saving the imported House 1994 displayed `Property saved`. Before/after server fingerprints of all property/contact facts were identical; only revision/update time changed. Scanner/import controls and 300 MB copy were inspected. Fresh inventory and scanner screenshots are included on landing.

## Artifact

- Package: `com.brokeriq.app`; version `2.1.2`; versionCode `26`.
- APK SHA256: `a23276f349f8225302ce3f828025ea31eccf3f6b0978081bd8ad7608beaa3d78`.
- Signing certificate SHA256: `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce` (unchanged).
- Download: `https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.2-build26.apk`.
- Landing publication timestamp: `2026-10-27T01:40:51Z` (27 Oct, 7:10 AM IST), reflecting the completed staging release. The APK itself was built on 26 October; publication metadata does not imply a new binary rebuild.
- Final signed APK installed successfully over the existing emulator app without uninstalling. Public HTTPS download checksum matches the artifact above.

## External/physical acceptance

On 27 October, the live BrokerIQ Meta submission page still showed **Unpublished**, a disabled Submit for review button and “You must complete all steps before you can submit for review”, including remaining app settings/reviewer requirements. Business verification/full business-asset access does not mean WhatsApp messaging/management App Review is approved. Rahul's existing number, groups/chats and Business app were not migrated or deleted. Live WhatsApp delivery/coexistence remains incomplete pending that setup/review; no completion claim is made.

A physical Android phone and the client's real group-export archive remain user acceptance checks. Emulator and isolated full-size HTTP tests are recorded separately from those checks.

## Staging recovery

Pre-deploy encrypted checkpoint: `/opt/brokeriq/backups/checkpoints/20261026-171742-broker-first`, including verified restore/table counts, encrypted source/media, secrets and previous source identity. Deploy/reload is limited to BrokerIQ web/API. Previous APKs remain downloadable. For code rollback restore the previous compiled BrokerIQ targets and previous Android release URL/hash; preserve new user writes rather than restoring the entire database. Team policy changes may be reverted from the saved policy snapshot without deleting members or data.

Build 26 staging deployment applied the additive team migration and reloaded only brokeriq-api/brokeriq-web. API/database health passed; API environment checksum and all unrelated process IDs/restart counts matched the pre-deploy snapshot. Live landing showed build 26 screenshots, the new APK link and matching portal timestamps.
