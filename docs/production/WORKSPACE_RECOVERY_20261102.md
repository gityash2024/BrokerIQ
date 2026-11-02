# Non-iCloud build workspace

macOS offloaded root `package.json`, `.prettierignore` and `pnpm-lock.yaml` in the Desktop checkout into compressed/dataless iCloud placeholders. Git blocked in mmap and pnpm blocked reading the manifest. Foundation download requests succeeded but the files remained unavailable. No placeholder was overwritten, no global iCloud/security preference was changed and no unrelated process was stopped.

A new branch `codex/release43-stabilization` was created from pushedb78abc5 in `/Users/yashjangid/.brokeriq-worktrees/release43`. Eleven pending follow-up/version/docs files were copied byte-for-byte, with hashes and a separate private recovery snapshot under `~/.brokeriq-private/workspace-recovery/followups-20261102/`. Original Desktop files remain present. The working branch is published forward to `origin/feat/production` after validation; do not force-reset the original dirty checkout to hide the handoff.

Dependencies were installed from the existing offline pnpm store with the frozen lockfile; a fresh Prisma client must be generated in this checkout before typechecking. The initial new-checkout typecheck failed because its generated Prisma client was absent; generation and the subsequent workspace typecheck passed. This was not treated as a source regression or as passing acceptance.

The retained signed Build42 APK matched its accepted SHA256 and was separately copied into `~/.brokeriq-private/releases/build42/` before removing only the old generated `apps/mobile/android/app/build` and `.cxx` directories. Versioned release APKs, keystore, private backups, source and customer data were preserved. No global Gradle/npm cache or other project's files were removed.

Downloads access was restored by the user. The re-downloaded Rahul ZIP was privately preserved at `~/.brokeriq-private/ai-evaluation/rahul-export-8b17a3736af8.zip`; SHA256 `8b17a3736af80d10d69f24d52f41b6c1df05894f39e5780d035425f66e899b08`. It contains1,354 parsed messages,37 photos and2 videos. This is source preservation, not a completed labelled AI evaluation. Raw messages/media are outside Git and have not been used to create production CRM rows.
