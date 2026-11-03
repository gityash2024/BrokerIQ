# Follow-up submission, assignment and automation atomicity

Creation previously wrote the task, timeline activity and Lead.nextFollowUpAt separately, without a submission identity. Request interruption/retry could duplicate tasks/activities or leave inconsistent next-action data. Creation also checked ownership before the write; reassignment updated the lead and pending tasks in separate transactions.

The optional bounded clientMutationId and requestHash use an additive nullable-column/unique-index migration; old installed clients still create normally without an identity. New web lead/task forms and native lead sheet retain a submission identity for the same form payload through transport retries, and reset it after success. Offset-aware valid timestamps are required; malformed/rollover/timezone-free inputs fail before writing. Form identity currently survives retries within that mounted form, not process restart; durable offline task-form recovery remains open.

Creation serializes the submission key and locks the lead, rechecks current firm/Agent ownership and active-member assignment, and atomically commits one task, activity and next-follow-up pointer. Changed payload or actor under the same identity conflicts. Same semantic timestamp with a different timezone spelling is an identical retry. Lead reassignment now locks the same lead and commits all pending-task ownership with the assignment/activity. Automated assignment requires its explicit firm; round-robin and explicit action call sites supply it. Automated follow-up insertion and the next pointer also share the lead lock/transaction, preserving the existing execution-key idempotency.

Six new real PostgreSQL cases include20 simultaneous retries, unchanged response/activity count, timestamp normalization, changed-body/actor conflict, peer/foreign ownership denial, active-member validation, invalid timestamps, old-client compatibility, actual database-trigger-induced activity-write failure and a concurrent assignment/create race. The trigger is confined to the isolated test database and removed in finally. Failure leaves neither task nor pointer change. No fixture touched connected staging.

Validation: targeted21/21; full isolated API367 passed/27 configuration skips,50 suites passed/4 skipped,42.469s. Mobile82/82, shared65/65 (including the separate recruitment classifier regression), workspace types pass. This migration and source are AFTER Build45 and have NOT been deployed. A new backed-up, restored, pinned release is required before claiming shipped retry protection. Full reminder/provider/offline lifecycle acceptance remains open.


## SMS and Email scheduled-task parity

FollowUpType now includes SMS via additive enum migration20261102133000; web Lead/follow-up/automation forms and native Lead sheet expose CALL/WHATSAPP/MEETING/EMAIL/SMS/OTHER consistently. This only schedules a task; it never sends a message or enables provider/inbound access. Existing enum values and old clients remain compatible. A new real-PostgreSQL case verifies SMS and EMAIL create PENDING tasks while creating zero conversation messages. The two focused API suites pass9/9; workspace typechecks pass; native tests82/82; scoped ESLint has zero errors (98 existing warnings). The first mobile command passed an extra separator and discovered no tests; the corrected direct Jest invocation ran all82 successfully. Source is after Build45 and not yet deployed. Real SMS delivery/reply, channel automation dispatch and durable offline task-form recovery remain open.


Release inclusion checkpoint: the above source is included in pinned Build46/e0442ad and its exact public bytes are verified. This supersedes historical not-yet-deployed wording only; unresolved provider/semantic/visual/device/flow gates remain open. See STAGING_ACCEPTANCE_20261102.md.

## Native retry after restart

Native Lead forms now store the validated submission and its mutation ID in the encrypted account/firm/role SQLite queue before sending. Saved Drafts shows failed or queued tasks. A corrected submission can start after setting a failed original aside. An interrupted send reuses its original payload and ID. The client schedules a local reminder only after server confirmation in the active account scope.

Validation covered an interrupted send and replay, scope isolation, immutable failure recovery and the active-slot constraint using SQLite. All 106 native tests and the native typecheck passed. Scoped lint reported zero errors. This change is after the Build 52 pin and awaits a signed release and installed-device acceptance.

## Web retry after refresh

The two Lead task forms, Follow-ups dialog and Visits dialog now persist the shared-schema payload in encrypted IndexedDB before submission. Select the same lead and choose **Retry saved** to resend the original payload and ID. Account, firm and role are checked during storage and the HTTP request. Concurrent claims share the active draft and an earlier acknowledgement cannot delete a newer draft. A validation rejection releases the slot after retaining the rejected payload in encrypted storage. The original input remains visible in the current form for correction.

Validation: 22 storage/HTTP contract tests and web typecheck passed. Scoped lint reported zero errors. Browser UI and staging verification for this change remain open.
