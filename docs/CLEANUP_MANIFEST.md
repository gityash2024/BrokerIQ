# Private archive and cleanup

Obsolete extraction datasets, page renders, one-off patch/repair scripts, original register PDF and prior APKs were copied to a private archive outside the repository. Every archived file was SHA256-compared before removal.

Local archive: `~/Library/Application Support/BrokerIQ/archive/2026-10-15-prelaunch`. Its private `manifest.json` records all source paths, sizes and checksums. Original PDF remains available there and fresh OCR/page evidence remains in the private imports directory. No business data belongs in Git. Product code, legacy feature implementations, migrations, deployment scripts, current release outputs and external signing material are preserved.

Archived files: 330. Signing material was not moved. The existing Git history is unchanged; tracked historical datasets are removed from the current tree. The local releases directory retains only the current build 16 APK; builds 10–15 are in the checksum-verified private archive.

Server APK cleanup (16 October 2026): builds 10–15 were moved from public downloads to `/opt/brokeriq/storage/archive/apks` with SHA256 verification and a private manifest. Only build 16 remains publicly downloadable. Register originals, all 117 page images/transcripts, corrections and operator verification scripts are retained in `/opt/brokeriq/storage/register-source` and included in encrypted, restore-verified checkpoints. Sensitive inputs are excluded from Git; the published reconciliation evidence contains aggregate counts only.

Later checkpoints: build13 and build14 were privately archived under `~/Library/Application Support/BrokerIQ/archive/2026-10-16-build13` and `.../2026-10-16-build14`, each with its own checksum manifest. Later local build15 is also retained in a separate verified private archive. These are separate from the initial 330-file cleanup manifest.
