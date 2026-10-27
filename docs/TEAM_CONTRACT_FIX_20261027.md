# Team screen contract correction — 27 October 2026

Live reproduction: `/broker/team` threw `Cannot read properties of undefined (reading 'openLeads')` in the browser. The Team UI and native build 26 shared a hook that fetched `/leads/assignees`, which returned only basic members. The screens required member performance stats and pending invitations. The earlier API-only team lifecycle checks did not catch this screen/endpoint mismatch.

Correction:

- Dedicated Team query uses `/broker/team`, a shared validated response contract, and a separate cache key from assignee pickers.
- Assignment forms keep the active-member endpoint; their queries cannot replace the Team overview cache.
- Both routes use one firm-scoped reader. The assignee route includes stats and admin-only pending invitations for compatibility with already-installed build 26. Suspended users remain excluded from assignee pickers and visible in Team management.
- Invite responses allowlist their fields; neither token hashes nor raw tokens appear in team lists. Agents receive no pending invitations. Missing response metrics produce a handled query error, not invented zeros or a render crash.
- No listing editor, database migration, signing key, credentials or APK binary changes are needed for this server compatibility fix. Mobile source also uses the dedicated typed queries for subsequent builds.

Validation before deployment:

- API team and broker-mode regression: 2 suites, 9 tests passed, including both endpoint contracts, pending invites, member stats, agent restrictions and suspended-member filtering.
- Shared tests: 42 passed, including rejection of the exact incomplete assignee shape that caused the crash.
- API/web production builds and web/mobile typechecks passed.
- Local browser: logged in to an isolated fixture, opened Leads then Team, rendered member metrics, created an invitation, saw the share link and pending invitation. No fixture was inserted in staging. A repeatable Playwright journey was added; the interactive browser journey was the executed UI verification.
- Narrow-width inspection also found the pending-invitation grid expanding beyond the viewport. An explicit single-column minmax grid and non-shrinking cancel action keep the card inside the page, while the member table retains its internal horizontal scroll.
- Local Chrome emitted hydration warnings identifying injected `chrome-extension://.../executors/200.js` attributes. These were kept separate from first-party Team exceptions; no error reporting was suppressed.

Staging code/compiled/env/process backup: `/opt/brokeriq/backups/team-contract-20261027`. Deployment is limited to BrokerIQ API/shared/web. APK build 26 remains byte-identical, with its existing download link and signing identity.

Post-deploy verification: Rahul's existing browser session rendered Team and real metrics, opened the invite dialog with Agent/Admin roles, and navigated through Leads, Pipeline, Follow-ups and Automations without a new Team render exception. Local accepted-agent fixtures also rendered the two-member ranking. The narrow-width pending-invite card measured document width equal to viewport width after correction. API/database health, both environment checksums, unchanged APK checksum and all unrelated process IDs/restart counts were verified. A physical phone UI check was not performed; the installed build's exact `/leads/assignees` response contract is covered by API regression tests. Restarting the app clears any pre-fix in-memory query cache.
