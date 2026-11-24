# BrokerIQ automation verification

Baseline Web revision `bdbbd540d04e61b4bae9e0f46c3acddea620d79b`. Released Android baseline Build 98. The pre-change inventory contains 208 Web route-related files, 106 Mobile route-related files and 56 API controller entry points. A source file count does not establish interaction coverage. Each row below records checked behavior and outstanding acceptance.

## Automation brief acceptance

| Section | Acceptance check | Evidence and outstanding work |
| --- | --- | --- |
| 1 | Build on the existing API, shared models and clients | Workspace typecheck and migrations on isolated PostgreSQL. |
| 2 | Separate Connect Android app and product entry | Signed pilot APK with Web and Mobile profile links. Android 16 emulator launch. |
| 3 | Kotlin, Compose, Room, WorkManager and Android Keystore | Release Gradle build and signature verification. |
| 4 | Private download and update status | Download URL and version settings are configurable. Private HTTPS or authorized Drive distribution remains pending. |
| 5 | Link multiple devices, renew and revoke sessions | API test verified session-bound linking and revocation of one device. Native end-to-end linking is pending. |
| 6 | Separate controls and device consent | Consent and allowlist enforced by the API. OEM permissions and reporting remain to be checked. |
| 7 | Calling interface and device metadata | Native dialer launch, known-lead call detection and direction. SIM, duration, outcomes and full recent history require handset verification and completion. |
| 8 | Match assigned lead by normalized phone | Canonical call event and assignment scope implemented. Ambiguous matches need a native review flow. |
| 9 | Authorized recording access | Android document picker and share entry. OEM folder discovery and automatic MediaStore capture remain pending. |
| 10 | Private upload and recording association | Explicit call selection, encrypted queue and hash deduplication. Long uploads and automatic matching need additional acceptance. |
| 11 | Approved business conversations, new notifications only | Package and allowlist checks, timestamp cutoff, sensitive-text filtering and dedupe. Muted, truncated and missing notifications require device checks. |
| 12 | Promote verified WhatsApp demand in CRM | Scoped lead and requirement creation after structured validation. Real WhatsApp ingestion and update review remain pending. |
| 13 | Create reviewed property drafts | Structured WhatsApp offer can create a private inventory draft. Real messages and updates of existing properties remain pending. |
| 14 | Timestamped Hindi, English and Hinglish transcription | Faster Whisper worker integration. Audio sample, long call and speaker acceptance remain pending. |
| 15 | Extract evidence and next steps | Structured proposal and transcript surfaces available. Real call accuracy remains unverified. Quota-based retries defer to the provider window without consuming the ordinary retry budget. |
| 16 | Fill current Survey and Call fields by firm schema | An exact address, live assignment and linked visit can supply a Survey draft with evidence-supported BHK, floor or purpose. Conflicting prior values are preserved and visible. Arbitrary firm-defined fields remain pending. |
| 17 | Apply validated brokerage actions | Firm-level controls default to review. Authorized reviewers can mark or dismiss suggestions. Task creation, visit suggestions, stale alerts and approval integrations remain incomplete. |
| 18 | Web and Mobile profiles, activity and private playback | Both clients have UI and authenticated playback. Real recordings remain to be checked on Android and iOS. |
| 19 | Connect app workspaces and device statuses | Compose navigation and sign-in screen verified on emulator. Functional screens require pilot credentials and a configured backend. |
| 20 | Offline retry, Wi-Fi-only and recovery | Persisted encrypted WorkManager queue. Interrupted upload and OEM recovery remain to be checked. |
| 21 | Super Admin Supply workspace | Admin route, filters and scope. |
| 22 | Discover property supply from permitted sources | JSON API, RSS and HTML JSON-LD adapters. A live source permitting collection and broker redistribution remains unverified. |
| 23 | Normalize Gurugram locations | Automated normalization check for Sector 30 and rejection of Noida. Ambiguous projects are review candidates. |
| 24 | Classify owner evidence and transactions | Ownership, purpose and categories supported. Actual source classification accuracy remains to be checked. |
| 25 | Extract structured supply record | Data schema and detail view. Field completeness needs comparison against a live feed. |
| 26 | Run nightly discovery and report results | Configurable IST launch and 07:00 notification. Independent processing windows and a production timing run remain pending. |
| 27 | Use bounded structured AI and review | Free-model option and field validation. Real-feed AI evaluation remains pending. |
| 28 | Deduplicate references and reposts | Source identity, property key, audit and transfer uniqueness. Live source variation remains to be checked. |
| 29 | Filter and inspect Supply in Super Admin | Admin list, filtering, source references and transfer history implemented. |
| 30 | Preview and distribute sector Supply | Manual preview, multi-firm selection and filtered transfer implemented. Live distribution remains off. |
| 31 | Open transferred Supply in the firm ledger | Existing inventory service writes and attribution used. Live Supply transfer on both clients remains pending. |
| 32 | Super Admin Demand workspace | Admin route, list and detail. |
| 33 | Discover buyers and tenants from permitted sources | Shared source registry and Demand adapters. A live authorized feed remains unverified. |
| 34 | Classify genuine buyer and tenant intent | Validation and priority logic implemented. Real-feed accuracy remains pending. |
| 35 | Capture location, budget and preferences | Structured Demand fields and operator review. Field completeness remains to be checked with a live source. |
| 36 | Run Demand daily in IST | Independent enable setting and schedule. Live run remains pending. |
| 37 | Deduplicate buyer and tenant leads | Organic keys, verified phone scope and shared per-firm transfer key. |
| 38 | Score lead priority | Deterministic priority and confidence. Calibrating with actual conversion outcomes remains pending. |
| 39 | Filter and inspect Demand in Super Admin | Demand workspace, filters, review and transfer. |
| 40 | Transfer selected records to selected firms | Canonical CRM write, duplicate and foreign-firm tests. Live transfer remains off. |
| 41 | Use received lead in standard CRM | Isolated database check verified the Lead, lead requirement, assignee and source attribution. |
| 42 | Match Supply to Demand | Existing ledger match logic and paired transfer hook. Real matched-feed acceptance remains pending. |
| 43 | Configure schedules, run, retry and report | Per-kind controls, run records and delivery retry. Live jobs and production notification timing remain pending. |
| 44 | Record source permission and health | Permission link, explicit approval, disable control, status and independent cursors. Verify distribution rights before enabling a feed. |
| 45 | Use additive database migrations and existing jobs | Migrations, durable retries and Prisma constraints checked in local test databases. |
| 46 | Enforce firm and role scope | Chat, PDF, delivery, Inventory and delegated permission tests. A complete module-by-module mutation audit remains open. |
| 47 | Privacy and account isolation | Private media, consent, redaction, event scope and ACL checks. Connect captures can be deleted by authorized firm administrators. Automated retention policies and operational acceptance remain open. |
| 48 | Keep new AI on free models | Free OpenRouter filtering and database-backed 1,000-attempt ceiling. Real provider capacity and model quality remain to be measured. |
| 49 | Validate separate environments | Isolated PostgreSQL, local Web and Android emulator. Dev, Staging, UAT, physical hardware and release approval remain open. |
| 50 | Run complete automation workflows | Local PDF ingestion, Demand delivery and Connect capture API verified. Live Connect, organic sources and production delivery remain pending. |
| 51 | Test both clients, roles and hardware | Automated suites and targeted permission tests. Full manual route, role and action traversal and four handset checks remain open. |
| 52 | Preserve workflows and ship in verifiable steps | Module commits pushed to the integration branch. Production activation and WhatsApp cutover remain gated on pilot acceptance. |

## Additional requests

| Workflow | Acceptance evidence |
| --- | --- |
| Video Back navigation | Web browser verified the assigned agent’s Follow-ups category after Back and Forward. Mobile stack and route-scoped state are implemented. Android hardware Back and the iOS gesture remain pending on device. |
| Inventory and Survey folders | Firm-scoped sector and custom folders persist. Inventory, Survey and Scanner accept a newly created folder. An approved register scan kept its selected custom folder, sector and source entry. Sector aliases resolve to the same folder. |
| Olive Estate correction | Only BIQ-001266 through BIQ-001274 from the 24 Nov Survey batch moved from Sector 34 to Sector 30. Record IDs remained the same. The audited before/after comparison excluded only sector, revision and update time. |
| Separate PDF Inventory | The supplied PDF produced 214 candidates from pages 4–6, with 32 marked for review. Pages 1–3 produced zero inventory rows. Same-file dedupe, filtering, editing and firm isolation were checked through the running API. All 214 source line references matched the supplied PDF. Field-level review of ambiguous shorthand remains open. |
| Daily Lead Delivery | Super Admin chooses firm, recipient and IST time. The first preview and delivery include eligible leads from the preceding 24 hours, then use the last successful cutoff. Local test verified eligibility, notification, retries, a single canonical Lead and firm isolation. |
| Agent Chat | Existing agents start enabled. Broker Admin can revoke and restore through Team. Browser verified immediate redirect and sidebar changes without login. Mobile component test verified tab removal and restoration. API verified scope, notifications and old access tokens. |
| Edit and delete | Inventory, PDF Inventory, Requirements, Follow-ups, visits and deals have permission-aware actions. Sub-Broker Admin needs both view and the mutation grant. Deal and visit cancellations preserve records. Review remaining surfaces individually before claiming full coverage. |

## Role and route checks

| Role | Web routes and actions checked | Mobile and shared evidence |
| --- | --- | --- |
| Public / Guest | Landing, property search and entry links | Existing route policy and mobile tests. |
| User | Discovery, saved, enquiries, messages, privacy and denial on broker routes | Existing native route and session tests. Gesture acceptance remains open. |
| Property Owner | Existing owner property endpoints and source acceptance; Connect profile placement | Existing owner release/API tests. Device walkthrough remains open. |
| Broker Admin | Today, team member edit, grant changes, Inbox, ledgers, PDF and approvals | Native types and suites, API persistence and confirmed package launch for Connect. |
| Broker Agent | Live Inbox revocation/restoration, direct path and assigned lead checks | Native tab regression, server scope and local auth refresh code. |
| Sub-Broker Admin | Granted workspace, denied controls, lead assignment and view requirements | API/API guard and native delegated tab tests. |
| Super Admin | Organic Supply, Demand, Sources and Delivery; admin sidebar and auth | Admin tooling is on Web. Existing native route policy tests. |
| Platform staff | Existing route policy and API tests | Manual per-route execution remains open. |

Local typecheck passed across the five workspaces. The fresh PostgreSQL API regression passed 603 tests, with 34 configuration-dependent skips. The Connect pilot cases passed with both local flags enabled. The Mobile suite passed 166 tests. All 33 Web tests passed in a single run on a separately seeded database, including the active workspace sweep at phone width. Browser tests used the baseline’s current routes and labels. Device-level coverage and visual baselines for every interaction remain open.

## Pilot configuration

- PDF extraction needs Poppler and Tesseract on the worker. Audio transcription additionally needs Faster Whisper and an explicitly configured local model. Provider API credentials remain in encrypted settings.
- Connect and WhatsApp cutover have separate environment flags. Both default to false. Link the signed APK to the chosen HTTPS test API and verify physical devices before enabling cutover. Existing upload IDs can resume after cutover.
- Organic discovery and delivery require enabled schedules and a running durable job worker. Register approved source evidence in Super Admin before enabling collection or redistribution.

## Continuation and rollout verification

| Workflow | Result |
| --- | --- |
| Nightly Organic discovery | Independent default IST phases at 00:00 collection, 05:00 classification, 06:00 results and 07:00 notification. PostgreSQL checks covered concurrent scheduling, resume, a failed source alongside a successful source, the previous-day cutoff and retry without duplicate records. |
| Live Gurugram source | [reale.in's CC BY 4.0 API](https://reale.in/data) supplied 40 real project registrations. The isolated BrokerIQ worker saved all 40 with source attribution and no contact data. They are reference records, with transfer approval blocked until a separate property listing is verified. Provider terms and available feeds have yet to establish an eligible free source of current direct-owner offers or consented buyer and tenant demand. |
| Delivery consent | The preview excludes leads that lack an enabled source. The transfer checks the publisher that provided the phone before writing a tenant or buyer lead in a recipient firm. If that permission has been withdrawn, a separately eligible record can still transfer as a contactless requirement. |
| Organic default views | Supply opens on confirmed direct owners. Demand opens on buyer, tenant, commercial, investor and relocation intent. Supply can show uncertain owners separately. Both workspaces also offer all records, and the same API filter applies to the list and filtered transfer. Four PostgreSQL tests and the two browser workspace checks passed. |
| BrokerIQ Connect 1.2.0 | Signed APK version code 3, min API 30, target API 36. Android 16 emulator installed 1.2.0 on top of the previous signed Connect installation and launched the main activity. The pilot adds persistent user-selected recording folders, matching only a unique same-device call for automatic sync, and a local encrypted review for ambiguous lead matches. |
| Transcription and CRM actions | Faster Whisper base at revision `ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66` ran locally offline on a controlled English sample and the supplied Hindi video audio. The worker bounds timestamps to the source duration. Connect recommendations open the existing editable Follow-up and Site Visit forms. Form submission remains under the broker's control. Device recordings, longer calls, Hinglish accuracy, speaker attribution and arbitrary firm fields require additional acceptance or implementation. |
| Connect retention | An explicit Broker Admin policy expires captures after 30, 90, 180 or 365 days. The default is manual deletion. The isolated PostgreSQL test verified a single audit record and purge job, with newer captures and the other firm preserved. An older policy client keeps a retention choice it cannot display. |
| Free AI | The connected key returned a successful metadata response. The configured text and vision model identifiers both end in `:free`. The continuation adds the free router fallback to explicitly free-only workflows and preserves the provider retry window for scheduled classifications. A subsequent contact-free Hinglish extraction returned the expected intent, budget, sector and BHK through both the configured free model and the free router. OpenRouter reported zero cost for both calls. |
| Expanded access and Back checks | Web exercised all five Agent Assignments drill-through categories, browser Back and Forward, page 2 and dialog scroll. A separate browser test returned from Inventory edit through detail to the same selected custom folder and search. Owners and Leases now offer permission-aware editing and confirmation, with protections for existing owner links and lifecycle history. |
| Record dialogs and invoices | Web Back, Forward and Close restore the PDF Inventory sector filter and the Organic record search. The invoice browser test verified due-date editing, return to the Pending filter and retention in Cancelled history. The 33-case Growth API suite verified separate delegated Edit and Cancel grants, concurrent cancellation with one audit entry, cross-firm denial and no payment link for a cancelled invoice. Web and Mobile use the existing Deals module policy. |
| Scheduled delivery recovery | PostgreSQL verified that concurrent workers leave one completed run, one CRM write and one notification. A paused schedule rejects work already fetched by a worker. After the retry limit is reached, the following daily window keeps the previous cursor and delivers the outstanding eligible records together with newer ones. The previous partial run remains in history. |
| iOS native simulator | The first Xcode 27 build crashed at startup on iPadOS 27.2 because the generated app lacked UIKit scene support. The Expo SDK 57 build-properties setting now enables its single-scene delegate at clean prebuild. The corrected native debug build installed and rendered the marketplace on the same iPad simulator with an isolated local API. A custom-scheme deep link opened Login. The 166-case Mobile suite passed again. Authenticated iOS Back acceptance, a distribution-signed iOS build, Apple push registration and physical iPhone or iPad acceptance remain open. |
| Local regression | 33 Web tests passed in one run, followed by the expanded navigation test. 166 Mobile tests and workspace typechecks passed. The pinned release API run passed 605 tests with 36 conditional skips. The isolated flags-on pilot passed six cases. Additional AI fallback and job tests passed 46 cases. The Web production build and Expo iOS JavaScript export completed locally. The API route audit enumerated 626 routes. It verified 2,326 expected denials and 920 static GETs across five roles, with zero unexpected server failures. The Web phone-width audit visited 91 workspace routes with zero captured errors. |
| Connected staging capacity | Inactive webpack caches and unused Docker build cache were removed. Free storage recovered from about 6.3 GiB to 24.2 GiB before candidate compilation. The cleanup verified the same active release, process IDs, restart counts, Docker images, containers and volumes. Poppler is present and Tesseract 4.1.1 with English and script-detection data was installed. |
| Restore and migration rehearsal | A fresh encrypted off-host backup chain was authenticated and restored in scratch. 106 tables, 2,152 files and 30 private KYC documents matched. All eight additive migrations ran in scratch, preserving the existing data digest on all 105 business tables. Existing users retained enabled Chat access by default. No app ran against the restore. |

The Connect APK is distributed through the owner's restricted Drive file. At the user's direction, physical testing will occur later. Connect pilot acceptance and the WhatsApp ZIP cutover remain pending until then.

## Connected staging release

On 24 November 2026 at 15:02:51 IST, the Web and API release switched to immutable commit `3241dfe3f954a15ef09a7f4d5e7418c3745f1947`. Android v2.3.58 Build 99 uses the same commit. The [published staging manifest](./staging-build99-20261124/release-manifest.json) records the APK size of 189,380,117 bytes and SHA-256 `c5bdc436399bf2127cf968ba67494719b099e8ea896990058b32a70c9b4dac61`.

- The Android certificate matches Build 98. The four-architecture build passed signing and 16 KiB checks. Android 16 emulator upgraded Build 98 in place and kept the first-install timestamp. The released activity remained in the foreground after boot.
- Both public and origin API health and Web identities matched the pinned commit. The full public APK downloaded and matched the signed artifact. The update link now advertises 2.3.58, with minimum 2.3.0 and email OTP still required. All 30 old APK paths were carried over. Build 98 separately returned HTTP 200.
- Eight rehearsed additive migrations applied. The server verified the nine active Olive Estate inventory records still resolve to Sector 30. PDF Inventory, Connect profile and Organic records returned HTTP 401 without a session.
- Six public pages on desktop and narrow Chrome, 12 views in total, matched their prior route, title, rendered headings and overflow status, with zero captured page errors. This covers those structural checks only. Nine unrelated PM2 services retained their PIDs, state and restart counts across activation. The cleanup subsequently reclaimed about 1 GiB from generated Android compiler objects and rechecked the serving APK and API health.
- Connect capture and WhatsApp ZIP cutover are disabled on connected staging. A separate production release, signed iOS distribution, physical-device acceptance and end-to-end delivery from an authorized live lead feed remain open.

Later work for Connect transcription limits, local lead review, retention, free-model deferral, source-specific contact permissions, Organic defaults and delivery recovery, invoice controls, dialog navigation and UIKit scene support is on the integration branch or in the separate Connect pilot APK as applicable. Those changes were made after the Build 99 pin.

## Android-first Build 100 follow-up

- The first Android v2.3.59 build attempt used `117beb4226c0c1d1d0ef619f4e97cf72927af28a`. It included invoice Edit/Cancel, PDF and Organic dialog history, Daily Lead Delivery retries and Connect's firm-specific Survey fields. The signing gate rejected the discrepancy between the version code in the manifest and the embedded Expo configuration. The replacement build uses one version code for both and was signed from `03c4013c19a11f3dcbae8f7e721872f2a107d0e0`.
- Firm admins can configure required or optional text, number and yes/no Survey fields in Connect on Web and Mobile. Evidence-backed proposals resolve to an existing, uniquely matched Survey record. Conflicts and missing required fields go to review. Policy may fill empty, unverified Survey drafts with confident evidence while preserving existing values. The stored response is displayed with the record in the firm's workspace.
- A full browser run passed 35 tests, including 91 phone-width workspace routes without overflow or unexpected errors. The API regression passed 608 tests with 37 conditional skips. The Connect-enabled acceptance suite passed four tests, and Mobile passed 166 tests. A separate active-role API audit covered 626 routes, 1,054 denied role requests and 920 static GETs across the five active roles. Authorized mutations use separate workflow tests. These results do not establish successful Edit/Delete and Back on every record surface and device.
- The backup from 24 November at 15:28 IST authenticated two encrypted archives and restored 117 tables, 2,242 objects and 30 private KYC documents. The new migration ran in an isolated restore with no application processes. All 116 pre-existing business table digests matched when the added column was excluded from the comparison. Existing inventory custom Survey values initialized as empty.
- The [360Ghar crawler policy](https://360ghar.com/for-ai) provides discovery files and attribution instructions. Its [Terms of Service](https://360ghar.com/policies/terms-of-service) require written consent for commercial reuse. [PropInventory's free plan](https://propinventory.in/pricing) is for its private broker network and lists API access on Enterprise. [SpaceSeeks](https://www.spaceseeks.com/partner-with-us) offers free partner enrollment, with lead plans handled through its partnership team. None provides verified permission and a working free feed for ingesting and distributing current Gurugram Supply and Demand through BrokerIQ.

## Follow-up changes included in replacement Build 100

- PDF Inventory now sends rows with unknown availability or an incomplete address to review on new imports. The supplied PDF still produces 72, 74 and 68 source-matched rows on pages 4, 5 and 6. Availability remained unknown on 213 rows, which are now flagged for review. Earlier imports keep their recorded values.
- The Lead detail in both clients now exposes contact editing to Broker Admin and to delegates with Leads view and edit grants. A contact patch preserves unrelated stage, source and tags. Mobile Lead deletion asks for confirmation, respects delegated Delete grants and returns to its actual source. The API soft-deletes within the firm and records one audit entry. Web Lead Edit uses browser Back and Forward, and creating a linked requirement restores the source tab.
- The follow-up branch passed 615 API tests with 37 conditional skips and 166 Mobile tests. The 35 browser tests also passed with `BROKER_FIRST=true`, covering 91 phone-width screens with no overflow or captured errors. The authorized mutation tests cover the named workflows rather than every record variation.

## Repeat Survey from the broker's audio feedback

- The Web and Mobile Survey forms check for existing entries by sector and house number. Quick Survey phone entry uses the same lookup. The result identifies individual floors or units and shows whether each entry is in Survey, Available Inventory or All Inventory.
- Returning an eligible historical record to Survey uses its existing Property ID. It preserves the source, original date, status, availability and media. The repeat Survey date controls Survey date filters. Available properties and open marketplace listings stay protected. A later availability confirmation or rented outcome clears the repeat Survey marker.
- The isolated API test verifies sector aliases, multiple units, firm and agent scope, concurrent repeat requests, audit history and completion. Browser coverage verifies both entry forms at phone width. A Mobile test verifies the correct unit is queued only after confirmation. An unavailable lookup still allows the existing offline draft flow.
- This feature and its additive migration were added after the replacement Build 100 pin.

## WhatsApp property picker feedback

- Web and Mobile show an inline Photos label in property sharing before selection and in the selected preview. The label uses the existing gallery photo eligibility and record access rules. The Site Visit picker, search, pagination, draft and send behaviour retain their existing paths.
- The isolated WhatsApp Web thread test verified rows with and without photos and the selected preview. Mobile verified the sharing and visit modes. Shared verification covered empty media, private URLs, expired access and cover-only records. This change was added after the replacement Build 100 pin.

## Connected staging Build 100

- Published on 24 November at 18:12:25 IST. The Web and API revision and the fully downloaded, verified signed APK match [the release manifest](./staging-build100-20261124/release-manifest.json). The manifest records 189,403,617 bytes. Build 99 and all earlier download URLs remain available.
- Android 16 emulator upgraded from Build 99 with the original installation timestamp, launched MainActivity and retained the secure window. The package verification covered signing identity, native libraries and embedded Expo version and source metadata.
- The expected Connect Survey fields migration applied. A read-only check verified all nine corrected Olive Estate records in Sector 30. API health and database status are healthy. Signed-in access remains required for PDF Inventory, Connect and Organic. Connect and WhatsApp cutover remain disabled pending the pilot. Invoice editing and cancellation follow the current Deals module policy, which is Coming Soon in connected staging. The minimum Android version remains 2.3.0 and email OTP is still required.
- Six public pages at desktop and phone widths matched headings, routes, title and overflow after hydration, with zero captured page errors. The nine unrelated PM2 services kept their process IDs, states and restart counts.
- Staging space was recovered by deduplicating 17 checksum-identical old APK copies, removing installed toolchain download archives after verification, and retaining the retired source archive as an authenticated encrypted off-host copy. User records, uploaded documents, active download links and rollback builds were preserved.

## Android Build 101 follow-up preparation

- Revision `9c802371a8a2a2c2d9a2fe13f790a8da4249b636` pins Android v2.3.60 with the Repeat Survey and WhatsApp photo indicator changes for Web and Mobile. The isolated API regression passed 616 tests with 37 conditional skips. All 37 browser scenarios passed across the full run and two successful retries after an interrupted browser session. The Mobile suite passed 168 checks and the shared suite passed 93.
- The 18:12 IST staging snapshot was authenticated off-host and restored into a new local database. All 117 tables, 2,251 storage objects and 30 private KYC documents matched. The Repeat Survey migration alone applied to the restore, with matching pre-existing content digests across 116 business tables and no prior entry marked for Repeat Survey. No application started against the restored database.

## Property walkthrough photos

- Editable property detail and editor flows retain regular photo upload and offer video extraction in Web and Mobile. The worker samples across the walkthrough and can present up to eight distinct frames. Free vision can select representative views of different rooms. The user confirms the selected frames before they enter the property gallery.
- The existing photo endpoint accepts either one regular photo or one atomic set of approved frames. The API test reviewed eight distinct fixture scenes, saved three selected frames alongside a prior photo, rejected another firm and verified that concurrent retries only added one set. The browser verified real video upload and approval on an empty gallery as well as normal photo upload. The Native verification covered the file upload, frame selection and batch attachment.

## BrokerIQ Connect download and linking

- The connected staging API now exposes the owner's restricted Drive link for Connect 1.2.0 Build 3. The setting was absent when the main app showed that the download was unavailable. The verified APK has 20,901,983 bytes and SHA-256 `36d164e90402fb37c523b974091f045c885a8eebeee7b9facd5d06e20147dcad`.
- The next API release can serve the verified APK from private storage through a five-minute, session-bound link. Signed-in Web and Mobile users obtain a fresh download link on click. Download availability is separate from the device linking status. Invalid, expired and revoked tickets return HTTP 404.
- Broker Agent handset endpoints now honor the active Connect service and existing device, consent and CRM checks in broker-first mode. Firm policy remains admin-only. The download and enabled pilot suites passed five API checks. Target handset and live consent acceptance remain open. WhatsApp ZIP cutover remains disabled.

## Connected staging Build 101

- Published on 24 November at 19:21:59 IST. The exact Web and API revision and a full download of the 189,403,225-byte signed APK match [the release manifest](./staging-build101-20261124/release-manifest.json). The Android 16 emulator upgraded from Build 100 in place, launched the activity and kept its installation timestamp.
- The one reviewed Repeat Survey migration applied. The read-only check again found all nine Olive Estate records in Sector 30. The twelve public Web observations matched the previous hydrated layout checks and produced no page errors. Historical APK links and the existing minimum version and email OTP policy remain available.
- The isolated staging Faster Whisper runtime verified the offline English sample and returned bounded timestamps plus the expected sector and rent. The runtime path is loaded by the active API. Connect Build 3's restricted Drive link survived the release. The new BrokerIQ session-based download is in Build 102.
- The Web and Mobile walkthrough changes and Connect role checks were validated before Build 102 packaging. The complete isolated API run passed 617 tests with 37 conditional skips. Five broker-first Connect checks passed with local pilot flags enabled, 38 completed browser checks included the walkthrough, and 169 Mobile tests passed.

## Connected staging Build 102

- Published on 24 November at 20:34:57 IST. The exact Web and API revision and a full public download of the 189,410,005-byte signed APK match [the release manifest](./staging-build102-20261124/release-manifest.json). The Android 16 emulator upgraded from Build 101 in place, launched MainActivity and retained its secure window. The 62 checked 64-bit native libraries passed alignment checks.
- Connected staging now serves the Video to Photos and Connect changes from the same Web and API pin. In isolated Chrome, clicking Connect Download downloaded the actual signed Build 3 APK and matched its checksum. The active staging API denied a signed-out Profile request and a forged installer link. The Connect pilot is enabled, with all capture controls still requiring device consent. WhatsApp ZIP cutover is off. The separately tested offline transcription runtime is configured.
- The release kept the database schema and all 33 historical Android links. The encrypted off-host restore verified 117 tables, 2,308 storage objects and 30 private KYC assets. The read-only live check verified the nine Olive Estate records in Sector 30. Twelve public Web views matched their hydrated structural baseline with no captured page errors. Nine unrelated PM2 services kept their process IDs, states and restart counts.
- Invoice changes are deployed under the existing Deals module policy, which remains Coming Soon on staging. Staging has zero enabled Organic sources and zero enabled Organic delivery schedules. Live authorized lead delivery, physical device pilot and WhatsApp cutover, iOS release and separate production acceptance remain open.
