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

## 2 November: unpublished candidate only

Build52 cleanup removed only `/opt/brokeriq/releases/rc-2c9241fa206f` after process/config/symlink reference checks. Apparent size1,845,742,754 bytes; measured available space increased407,183,360 bytes, from46,198,923,264 to46,606,106,624. Shared files explain the difference. Current Build51 remained healthy during cleanup; backups/uploads/secrets/models/published APKs and protected rollback dependencies were retained. Later Build52 publication and unrelated-service observations are separately recorded in staging-build52 evidence.

## 4 November 2026, Build 55 preparation

Removed generated `app/build`, `app/.cxx` and Android-project `.gradle` from the exact Build 53 and 54 checkouts after verifying their retained signed download copies. The cleanup confirmed those paths were Git-ignored, contained zero tracked files and had no process using them as its working directory. Live web/API paths, the Build 53 rollback, release manifests, backups and provider data stayed in place. Before and after available disk were 21,598,172 KiB and 22,885,172 KiB. Net free space increased by 1,287,000 KiB (1,317,888,000 bytes) during the measurement, with Build 55 compilation running in a separate checkout. Loopback API health and release manifest remained reachable.

Two subsequent Build 55 checks removed twelve generated CMake directories and ten generated native package build directories, limited to the Build 53 and 54 checkouts. The two measured net gains were 2,522,076 KiB and 3,306,856 KiB while the candidate was running. The staging system had 23,403,132 KiB available at 81% used after activation. Both BrokerIQ services and eight unrelated PM2 services passed the post-activation checks.
