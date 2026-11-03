# Private mobile draft ownership and transition fences

Shipped in pinned Build50,7ce7194/v2.3.9, with independently matching public APK/landing/runtime identity. Physical SQLCipher upgrade/recovery and the WEB counterpart remain OPEN.

Root cause: local mutation/message drafts used only user ID, the pump adopted anonymous rows automatically, and screen content was keyed only by user ID. A user moving firms or losing Admin privileges could retain a private form or replay old queued content using their new session. API requests checked the scope string but could accept an old response after A → B → A. A chunk callback captured only user ID, so its next request could use the new firm.

New API AccountContext includes user, role, firm and a process-local epoch. Scope changes increment the epoch; transparent token refresh does not. Original-context requests fail before sending and after receiving, including stale401 before refresh. Old refresh completion cannot restore an earlier firm. A new workspace can refresh without waiting for an old workspace's refresh. Upload signing and every resumable-import chunk use the original context.

A nullable owner_scope column and index are added to the existing keyed database without changing legacy payloads, file references or ownership. New mutation rows and a separate scoped Inbox table use exact account/role/firm ownership. Legacy message storage is untouched. Reads, saves, queue/retry, completion and sync are guarded. A scope transition stops the pump, retaining unfinished originals rather than sending the next row. Work in another scope is not blocked by the old scope's queue. Protected form content remounts on scope/epoch change, and the pump responds to firm/role changes.

Legacy unscoped rows are not assigned an invented role or firm. Metadata-only warnings explain the preserved rows. A matching legacy editor is not silently replaced by an empty form: the user can explicitly start a separate draft. New guest captures require an explicit workspace-choice button before adoption; legacy anonymous captures are never auto-adopted. Old Inbox bodies are not read into a newly assigned workspace. Human ownership recovery of existing handset data remains an open device/support workflow, not a completed automatic migration.

Inbox moves copy before deleting and verify the exact destination body. Interruption or a conflicting destination preserves the source. No asynchronous connection-wide SQLite transaction is used, because unrelated saves on that connection could otherwise join and be rolled back. Moving a draft onto itself does not delete it. The Saved drafts list now uses stable50-row keyset pages instead of hiding all rows after100.

Validation: full mobile104/104 across12 suites; all workspace typechecks pass. Changed-file ESLint has zero errors with existing/style warnings retained. Real SQLite tests cover additive legacy preservation, same-user firm/role separation, A → B → A rejection, guest adoption boundaries, mid-queue/mid-chunk scope changes,121-row pagination, non-destructive Inbox conflicts/interruption/self-move and transparent/concurrent refresh. OS/file/encryption boundaries remain mocked: this does not prove installed upgrade, latest unsaved keystrokes during a process kill, physical SQLCipher behavior or full product acceptance. Follow-up/visit form restart persistence remains separate unfinished work.

## Device privacy operations

Location reads, contacts pages, consent and disclosure acknowledgements now carry their initiating account/firm/role context. Permission dialogs and device reads are followed by context checks before any upload. Contact pagination stops when that context changes. Disclosure and sync timestamps use workspace-specific hashed SecureStore keys, preserving the earlier global entries. This does not enable the dormant automatic privacy-sync hook.

All 111 native tests passed, including five new permission/read/firm-switch/storage boundary cases. Device APIs are stubbed in those cases. Physical permission dialogs, phonebook and GPS acceptance remain open. Source is after Build52.
