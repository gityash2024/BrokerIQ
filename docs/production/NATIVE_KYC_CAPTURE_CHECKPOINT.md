# Native guided KYC capture — source/build checkpoint, 1 November 2026

Not deployed and not an installed-device acceptance result. The public download remains Build 40.

## Implementation

Tracked local Expo Android module `apps/mobile/modules/brokeriq-face-capture` autolinks from `./modules`; no implementation depends on ignored generated `MainActivity.kt`. CameraX opens the front camera in a non-exported native Activity with its own FLAG_SECURE. Bundled ML Kit performs face detection on device; camera frames are not sent to an AI provider. Only the three user-accepted photographs are uploaded through the existing private KYC transport.

Capture requires one complete, sufficiently large face, limited roll, an open/closed/open blink and a continuous 750ms hold in the requested straight/left/right pose. A gap over 300ms restarts the hold; stale frames cannot enable capture. The final still is checked again before review. Each pose has accept/retake and the final summary permits per-pose retake. Camera use stops on pause, review, completion and cancellation; background return requires another blink. Detector or camera errors fail closed, with no gallery fallback. These capture-quality checks do not establish identity or automatically approve KYC.

Private cache paths are limited to this module's owner folder. Owner identity includes account, role and firm; JS validates ordered unique file URIs. Partial upload failures retain successful upload results for retry. Session reset cancels native capture and clears pending files; account/role/firm changes reject late captures/uploads. General web/mobile API requests also reject a late response when the initiating account's role or firm changed, while retaining existing anonymous public-listing access.

## Verification

- Android Gradle compilation and JUnit: 9/9 pose gate cases passed, including lost/stale frames, discontinuous holds, wrong-side pose, multiple faces and background reset.
- Mobile Jest: 79/79 passed. New native bridge tests cover ordered uploads, partial retry, canceled/malformed output, account/role/firm changes and pending-file cleanup. These use native/upload boundary stubs and are not camera-hardware tests.
- Workspace typechecks passed; scoped ESLint has zero errors (existing type warnings remain).
- Expo Android Metro/Hermes export passed to `/tmp/brokeriq-guided-face-android-export`.
- Installed Expo autolinking resolves the local module. Native test build used JDK17, SDK `/Users/yashjangid/Library/Android/sdk`, two workers and bounded Gradle heap.
- Downloaded ML Kit face-detection 16.1.7 AAR SHA-256: `3d8556a418b5474598d7f747f8e235de8f5da23ae529e3b0a2d8d4dbe83f6ded`. Actual ARM64 and x86_64 ELF LOAD segments have 0x4000 alignment. 32-bit ARM/x86 have 0x1000 alignment. This is not a full final-APK native-library/ZIP-alignment audit.

## Required before launch

Real phone checks remain: left/right sign and mirrored preview orientation, blink performance in representative light/skin tones/accessories, multiple-face behavior, preview/still crop alignment, interruption/cancel/restart, all three review images, upload retry, private-media access and screenshot/recording/recents protection. No physical Android device was attached at this checkpoint. Complete all enabled language copy, fresh clean prebuild, signed APK upgrade, final packaged-library compatibility and release-commit identity checks. Unsupported app builds/platforms show an explicit update-required capture error; full platform minimum-client gating remains a separate release item.
