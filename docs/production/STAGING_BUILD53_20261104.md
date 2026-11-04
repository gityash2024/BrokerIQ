# Build 53 staging publication

Build **2.3.12 / 53** published on **4 November 2026 at 09:07 IST** from commit `127f9b51d22f4f9e4cd9f194662987453ab1547c`. The landing page, public manifest, API identity and PM2 executable paths match. The runtime update link points to Build 53. Email OTP remains required.

The signed APK is 186,646,198 bytes and SHA-256 `209f5d00b32dcd10bfa710d698ba2f214e8ff5a5286324c618f86d064685c54c`. Local download, retained artifact and independent public stream match. The signing certificate matches Build 52. Native verification checks 60 64-bit libraries and the secure window flag in both the main and face-capture activities. The temporary signing directory was removed.

The candidate passed private API/database, manifest, landing and unauthenticated access checks with its jobs disabled. The encrypted off-host delta was restored into a separate scratch database with 101 tables, 664 media files, 2,480,648,901 media bytes and 10 private KYC records verified. The rollback to Build 52 and the reviewed compatibility releases remain available. Activation compared eight unrelated PM2 processes and found matching PIDs, restart counters and states. It left 28,306,739,200 usable bytes, above the 20 GiB gate.

During the Linux build Hermes spent hours in reclaim at the previous soft memory threshold. Adjusting the owned build unit's `MemoryHigh` from 2,800 MiB to 3 GiB let it finish. The 3 GiB hard ceiling and CPU quota stayed in place. Gradle packaged the existing four ABI set and passed native verification. Next.js indexed the new file after a refresh of the old BrokerIQ web worker, then the activation gate verified its public bytes before switching the API/web pair.

Chrome opened the populated Broker Admin Inventory and the Dashboard, Leads, Requirements, Pipeline, Follow-ups, Visits, Inbox and Notifications screens. The notification bell's list link worked. An attempted Super Admin Business records URL redirected the Broker Admin to their workspace. An older Admin tab also re-scoped after the browser account changed. These were read-only journeys. Browser and mobile negative/positive workflow coverage remains open for other roles.

This release includes the bounded WhatsApp photo/OCR and historical-preview work, encrypted follow-up and visit queues, account-bound replay, invoice scope and pagination, realtime assignment checks, private device-read scope, batched Team metrics, export scoping and atomic lead-stage changes. Later Inbox pagination, property sharing, Inventory idempotency and onboarding role changes are pushed to source and require a subsequent signed release.

Four A4 Hindi/English guide previews use the SoftLogic reference layout, linked contents and Build 53 web captures where reviewed. Final mobile captures and complete screen illustrations remain open. The landing page's Android screenshot gallery awaits same-release captures. Physical upgrade, capture protection, camera, push and background GPS acceptance remain deferred until the user's device is available. Full product sign-off remains open.

See `docs/evidence/staging-build53-20261104/` for artifact, restore, browser and release evidence. Live Gmail and Textbee provider checks are recorded in `PROVIDER_AND_ROUTE_CHECKPOINT_20261104.md`.
