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
| BrokerIQ Connect 1.2.0 | Signed APK version code 3, min API 30, target API 36. Android 16 emulator installed 1.2.0 on top of the previous signed Connect installation and launched the main activity. The pilot adds persistent user-selected recording folders, matching only a unique same-device call for automatic sync, and a local encrypted review for ambiguous lead matches. |
| Transcription and CRM actions | Faster Whisper base at revision `ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66` ran locally offline on a controlled English sample and the supplied Hindi video audio. The worker bounds timestamps to the source duration. Connect recommendations open the existing editable Follow-up and Site Visit forms. Form submission remains under the broker's control. Device recordings, longer calls, Hinglish accuracy, speaker attribution and arbitrary firm fields require additional acceptance or implementation. |
| Free AI | The connected key returned a successful metadata response. The configured text and vision model identifiers both end in `:free`. The continuation adds the free router fallback to explicitly free-only workflows and preserves the provider retry window for scheduled classifications. The OpenRouter key check did not submit a chat completion. |
| Expanded access and Back checks | Web exercised all five Agent Assignments drill-through categories, browser Back and Forward, page 2 and dialog scroll. Owners and Leases now offer permission-aware editing and confirmation, with protections for existing owner links and lifecycle history. |
| Local regression | 33 Web tests passed in one run, followed by the expanded navigation test. 166 Mobile tests and workspace typechecks passed. The pinned release API run passed 605 tests with 36 conditional skips. The isolated flags-on pilot passed six cases. Additional AI fallback and job tests passed 46 cases. The Web production build and Expo iOS JavaScript export completed locally. |
| Connected staging capacity | Inactive webpack caches and unused Docker build cache were removed. Free storage recovered from about 6.3 GiB to 24.2 GiB before candidate compilation. The cleanup verified the same active release, process IDs, restart counts, Docker images, containers and volumes. Poppler is present and Tesseract 4.1.1 with English and script-detection data was installed. |
| Restore and migration rehearsal | A fresh encrypted off-host backup chain was authenticated and restored in scratch. 106 tables, 2,152 files and 30 private KYC documents matched. All eight additive migrations ran in scratch, preserving the existing data digest on all 105 business tables. Existing users retained enabled Chat access by default. No app ran against the restore. |

The Connect APK is distributed through the owner's restricted Drive file. At the user's direction, physical testing will occur later. Connect pilot acceptance and the WhatsApp ZIP cutover remain pending until then.
