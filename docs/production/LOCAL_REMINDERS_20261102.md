# Native local reminder lifecycle

Shipped in pinned Build49, d70af6f/v2.3.8, with matching public APK and landing identity. Actual phone and full workflow acceptance remain OPEN.

Old local notifications held only Lead ID and client text. Completing/rescheduling a task did not cancel its OS alert, and tapping verified only the Lead rather than the task. Logout token-removal failure could also exit cleanup before cancelling scheduled/displayed alerts.

New local reminders carry exact task kind/ID, schedule, recipient and role/firm scope. Stable serialized identifiers suppress duplicate scheduling. Foreground/resume and a foreground-only60-second sync recheck the current authorized Lead task: completed/deleted/reassigned work is cancelled, reschedules replace the old alert, and stale presented alerts are dismissed. Successful task mutations trigger that same reconciliation. Notification taps check task state/time again before navigating to the existing Lead screen. Legacy unbound alerts are retired because their task state cannot be verified; no business task/Lead is deleted.

Offline alerts remain supported, with generic content rather than stale client identity. The phone cannot obtain updated assignment/task state while disconnected. A network outage preserves a generic alert;401/403/404 removes access-bound work. Role/account/firm reset invalidates late OS scheduling, cancels local alerts and dismisses old OS previews; permitted history stays in the server inbox. An old-scope reconciliation request cannot block the next role/account or cancel its new alert. Push-token removal failure no longer prevents local cleanup.

The two new generic notification strings have entries in all13 existing dictionaries. This does not certify the remaining translation catalog or physical font/layout rendering.

All mobile suites92/92 pass (11 suites), workspace typechecks pass, changed-source ESLint has zero errors32 warnings. New cases cover serialized scheduling, task completion/time/ownership, cancellation, rescheduling, offline/forbidden distinction, legacy private previews, late native completion, stale-scope requests and token-cleanup outage. These use explicit OS/API boundaries in tests, not a real handset. Signed APK upgrade, actual foreground/background/killed behavior, delivery receipts, battery/permissions and complete notification-role journeys remain OPEN.
