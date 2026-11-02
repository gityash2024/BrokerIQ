# Reminder ownership and durable scheduling

Shipped in verified Build48 (256f508), after Build47. Physical/provider delivery acceptance remains open.

The old cron updated `reminderSentAt` before inserting a notification. A crash between those writes permanently lost the reminder. Two overlapping scans could also deliver twice, and a historical task assignee could receive client data after its lead moved to another Agent. Saved notification lists/counts/open operations only checked recipient identity, so old private lead details remained visible after reassignment/demotion.

The replacement locks Lead then task, rereads current state, and commits the reminder marker, durable in-app Notification and push Job together. A stale/inactive/out-of-firm Agent is never used; an eligible firm Admin receives the management fallback. Deleted leads/inactive firms do not generate client reminders. A transaction failure leaves the marker unset and inserts neither notification nor job. Visit mutations use the same Lead/task lock order as reassignment/reminder scheduling.

Dispatch checks the current firm, role, ownership, task status, exact schedule and claim again. Superseded/cancelled/completed work does not push; stale queued notices are removed. Current ownership also filters existing lead-linked notifications from list, unread count, cursor and open, including legacy `/broker/leads/:id` links and unassigned/null-owner records. SQL NULL does not grant access.

Visit-reminder rule scheduling is itself a durable job. Claim-specific action keys distinguish a rescheduled reminder, and delayed actions recheck the claim/status before execution. Existing enabled video-reminder titles/links are preserved.

Push jobs allow one provider attempt. A worker crash or partial provider acceptance is uncertain, so exhausted work remains FAILED for review; it is not automatically resent. The durable in-app notification remains. Expo HTTP/ticket errors and web-push rejection are recorded as failure for this outbox, with bounded provider timeouts. Successful HTTP/tickets mean provider acceptance only, not handset delivery. Existing ordinary notification callers keep their previous best-effort semantics. Full Expo receipt polling/device acceptance is still open.

Validation: four targeted real-PostgreSQL suites30/30 pass; Broker-first five suites34/34 pass. New coverage includes12 concurrent scans, transaction-trigger queue failure/rollback, service restart, stale ownership/completion/reschedule, cancelled visit, durable trigger, real dispatch code with a stubbed Expo429, and legacy list/count/open privacy after demotion. Workspace typechecks pass; changed-source ESLint has zero errors36 warnings. No provider message was sent by these tests, and no staging fixture was created. A new pinned release, fresh backup/regression, staged activation and native/device/provider acceptance remain required.
