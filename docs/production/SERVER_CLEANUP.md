# Production server cleanup — 1 November 2026

Removed only unused Docker build cache not used in the previous seven days, using Docker's own builder prune command. Docker reported 58.86 GB cache reclaimed; shared accounting means actual disk change is measured separately.

- Before: 98% used; 2,497,273,856 bytes available.
- After: 53% used; 58,795,962,368 bytes available (58.80 GB / 54.76 GiB).
- Measured available-space increase: 56,298,688,512 bytes (56.30 GB).
- All 10 PM2 entries retained their process IDs, restart counters, status and working directories.
- All four production containers retained IDs, images, start times, mounts and healthy state.
- BrokerIQ API/database and existing Qwen health passed.
- No images, containers, volumes, running releases, frontend roots, runtime dependencies, source data, uploads, secrets, models or backups were deleted. Other projects' reserved rollback copies were retained.
- Package/log cache deletion was unnecessary after recovering sufficient space. BrokerIQ's only release directory is active despite its historical directory name and was retained.

Machine-readable before/after inventories: ../evidence/production-20261101/server-cleanup-before.json and server-cleanup-after.json.
