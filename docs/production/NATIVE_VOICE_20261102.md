# Native voice manifest and reviewed transcription

Source audit found that the visible assistant microphone used expo-audio and requested permission, while app.config.ts explicitly blocked Android RECORD_AUDIO. The block was introduced byf02daa4 before this stabilization audit; Build45 retains it. Thus a UI/source handler existed but clean release generation removed its required permission. This is a source/configuration gap, not evidence that Antigravity intentionally skipped an artifact.

RECORD_AUDIO is now an explicit tracked Android permission, with the existing purpose disclosure/runtime permission prompt. The audio plugin explicitly disables background recording/playback. Stopping recording and closing the sheet release recording mode; closing also stops an active recorder. A successful transcript populates the editable composer for human review instead of automatically sending the transcription to the assistant. Denial/failure remains visible and no message is claimed sent.

Workspace typecheck and all82 native tests pass. The reproducible release script now also fails if the actual signed manifest lacks camera, microphone, notification or shift-location permissions; a fresh signed manifest must pass for the next pin. Actual phone microphone/permission/review/cancel and capable free transcription-provider acceptance remain OPEN. The currently loaded local Qwen is text-only and is not being called an audio provider. No new OS permission was approved silently and no audio was recorded by this source change.


Release inclusion checkpoint: the above source is included in pinned Build46/e0442ad and its exact public bytes are verified. This supersedes historical not-yet-deployed wording only; unresolved provider/semantic/visual/device/flow gates remain open. See STAGING_ACCEPTANCE_20261102.md.
