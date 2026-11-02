# Evidence-based root causes and current limits

This records proven causes; it does not attribute intentional skipping or claim the complete old-conversation audit has closed.

| Finding | Proven cause | Correction / evidence | Still required |
|---|---|---|---|
| Older APK despite later web work | Server/local40 bytes matched while later mobile/shared commits existed | Pinned fresh41–46, complete canonical SHA verification and embedded app.config | Installed upgrade preserving old data |
| Capture restriction disappeared | FLAG_SECURE edited only in generated Git-ignored Activity | Tracked Expo plugin, clean prebuild and actual46 DEX flags in both activities | Physical capture/recents/recording tests |
| Voice button cannot record | f02daa4 blocked RECORD_AUDIO in tracked config; actual45 APK lacked permission | a99406d restores foreground permission; actual46 manifest verified; no background audio services; editable transcript | Free transcription provider and physical mic/review/cancel |
| Latest timestamp but stale screenshots | Old captures relabelled with newer captions | Release manifest excludes unaccepted old screenshots | Real masked46 screenshots / four manuals |
| Duplicate/inconsistent follow-ups | Separate writes, no submission identity and assignment races | bfba3a1 transactions, request identity, same Lead lock; real concurrency/rollback tests | Durable process-restart form recovery, full reminder delivery |
| Native cannot schedule Email/SMS tasks | Native sheet had only3 values; SMS absent shared/DB enum | 7672830 additive SMS type and six native choices; pending task creates no message | Provider delivery and complete automation channel dispatch |
| Sale price appears monthly in AI card | slimListing renamed every amount to rent; legacy search omitted purpose | 63e4564 purpose-aware price fields/cards and explicit search filters | Live capable tool model semantic acceptance |
| Local capture schema fails before generation | Output schema conversion cannot represent phone transforms; inline input grammar19,303 bytes exceeded16KB | e00f46b input+references gives12,666 bytes, independent Zod validation intact | Local model still failed real structured probes; free fallback and100-record holdout |
| Recruitment becomes property requirement | Keyword Requirement/salary parsed as demand/budget | cc1fb7f unrelated recruitment classification; original source539 rechecked, no approved data overwritten | Full manually labelled real export evaluation |
| Receipt goes to wrong firm / fake message | Unknown receipt searched contact globally then first active firm, invented message text | 2e091d1 removes guesses, retains unmatched durable event for retry, exact firm/platform origin and row lock | Real provider callbacks/echo lifecycle |
| READ regresses / delayed failure overwrites delivery | Read/check/write not serialized and FAILED bypassed monotonic checks | Real20-callback PostgreSQL race and retained-event replay cases pass | Provider/device lifecycle |
| PM2 online but old API still executing | Reload retained old absolute executable path | Programmatic exact-path BrokerIQ-only activation; final46 strict proof | Add persistent release-path monitoring |
| Automatic rollback command fails | PM2 CLI did not parse .cjs config, despite Node require validating it | Scoped helper loads reviewed JS object and verifies target paths | Rehearse full incident drill |
| Old backend cannot read new SMS task | Prisma45 enum lacks new database SMS value | Actual isolated failure reproduced; protected45 wrapper uses generated46 client, jobs/sensitive writes paused | Complete future-client/rollback compatibility matrix |
| Update link advanced before accepted activation | Separate non-fail-fast update ran during failed verification | Explicitly restored45 link; final46 update only after passed strict check | Use sequential activation/update runbook on every release |

The original154-row reconciliation ledger currently maps52 requirements to source files;102 still need implementation mapping/audit. Every referenced path is present at the46 pin; this proves file inclusion only. Source tests, real database tests, staging runtime/artifact evidence, provider delivery and physical device acceptance remain distinct. No complete-product sign-off is claimed.
