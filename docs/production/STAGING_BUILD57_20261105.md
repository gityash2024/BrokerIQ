# Build 57 staging release — 5 November 2026

Version **2.3.16 / 57** published at **10:44:25 IST**, pinned to `58bd4eaf73b4351053219f3acc8ff7f6316f46c4`. Independent Mac verification downloaded all 186,569,090 public APK bytes and matched SHA-256 `392ca1d7906c05807872bec4671527c95c2543388e2e3e0816cbe42839d6b579`. API, web manifest, runtime update and APK source identities agree. All three landing timestamps agree with actual publication; all 11 gallery assets, four PDF signatures and legal/support routes were fetched successfully. Eight unrelated PM2 services retained their PID, status and restart count. Build 56 remains the preceding rollback release.

The shared native header now keeps its controls in one row. Compact screens retain 44 dp notification and More controls; the menu contains theme, language, Profile and any module-specific action. Title/subtitle line counts are bounded. The password visibility control and inline email-OTP step ship on web and mobile. Google-only login configurations retain the verification step. SMS unknown-delivery events retain an uncertain state without automatic resend.

Validation comprises all workspace typechecks, 122 mobile component/source tests and eight focused real PostgreSQL SMS cases. Artifact checks verify the unchanged signing certificate, secure flags in both activities, required permissions and 60 aligned 64-bit native libraries. These are not measured native-layout or physical-device acceptance. The new controlled debug screenshot build is separate from the public signed APK.

Native compilation succeeded after 1 h 16 min 55 s. A private build-script substitution had incorrectly changed SHA-256 identifiers to SHA-257 and stopped post-build verification. Correcting that private script allowed the existing compiled artifact to pass the original certificate/hash checks; no weaker signing check or debug-signed replacement was used. Verified generated build caches were removed before candidate activation, leaving 21,896,432 KiB usable at the recorded post-activation check. Source, uploads, databases, secrets, models and rollback APKs were retained.

The release used the verified encrypted base/delta restore for `production-20261104T120232Z`: 101 tables, 679 media files, 10 private KYC documents, matching database content and media checksums. No schema migration or live test seed ran during activation.

## Remaining acceptance

- The user deferred the SMS incoming-reply test until the end. Both outgoing messages on the authorized replacement test lead are delivered; no incoming reply was present in either scoped Textbee history or CRM at the latest check.
- The original Gmail thread remains retained. On 5 November the user authorized a replacement test recipient. The real Broker Admin browser sent the new message, Gmail accepted it, and the user's `CRM QA OK` reply reached the same CRM conversation. Inbox and lead timeline render it, the notification links to that conversation and only the firm Admin receives it for this unassigned lead. Repeated sync leaves exactly one incoming message. This proves the scoped live client send/reply journey; it does not establish Google production approval or physical mobile push delivery.
- The four public manuals and gallery remain available. Their screenshot editions are explicit: current web captures are Build 55 and Android captures are archived Builds 23/24. Same-build Android documentation captures are still required.
- Capable free-provider qualification, independent AI precision/recall, Gmail production approval, representative staging capacity, and physical Android upgrade/camera/push/background-location acceptance remain open. Source provenance covers 154 requests and does not close their workflow acceptance.

Evidence: `../evidence/staging-build57-20261105/`.

## 10 November follow-up

The public Build 56 and Build 57 APKs matched their published checksums. Both launched on an isolated Android 36 ARM64 emulator. Android accepted Build 57 via `adb install -r` over Build 56 and reported the same first-install timestamp. Build 57 rendered the marketplace and the active MainActivity window reported `SECURE`. The existing emulator had insufficient install storage, so this check used a new QA emulator. Authenticated layouts, physical hardware and application data retention remain separate checks.

The focused Gmail, SMS and AI suites passed all 35 cases together under the broker-first environment, and API typecheck passed. The AI suite now sets the expected provider mode explicitly for each case. A follow-up synthetic probe to the selected free endpoint returned HTTP 400 before extraction. The controlled Android screenshot build hit its memory limit and resumed incrementally with a smaller JVM heap.

## Corrections identified after the release pin

The live reply exposed a stale lead `lastActivityAt` despite its new email timeline entry. Subsequent source changes update Gmail send/sync and SMS receive activity monotonically, preserve provider timestamps in incoming timeline entries and prevent delayed sends/history from replacing a newer conversation preview. Seventeen Gmail/SMS real PostgreSQL contracts pass after one initial SMS pagination authentication failure; the isolated SMS rerun and combined rerun both pass. The initial failure is retained in private logs and is not reported as a clean first run.

OpenRouter request routing now explicitly denies provider data collection and caps input/output endpoint prices at zero in broker-first mode. Eighteen adapter tests pass, including preservation of these restrictions through fallback. The new account has no purchased credits/payment method. Free model availability and semantic quality remain separate: some endpoints refuse the data policy or are rate-limited, and a developer probe returned a crore amount without INR scaling. The credential is retained privately, not enabled for automatic production imports. These changes are after Build 57 and need a subsequent verified release.
