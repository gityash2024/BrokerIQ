# Private archive and cleanup

Obsolete extraction datasets, page renders, one-off patch/repair scripts, original register PDF and prior APKs were copied to a private archive outside the repository. Every archived file was SHA256-compared before removal.

Local archive: `~/Library/Application Support/BrokerIQ/archive/2026-10-15-prelaunch`. Its private `manifest.json` records all source paths, sizes and checksums. Original PDF remains available there and fresh OCR/page evidence remains in the private imports directory. No business data belongs in Git. Product code, legacy feature implementations, migrations, deployment scripts, current release outputs and external signing material are preserved.

Archived files: 327. Signing material was not moved. The existing Git history is unchanged; tracked historical datasets are removed from the current tree.
