# Local QA resources

The BrokerIQ QA Next.js server on port 3311 accumulated approximately 10 GiB under `apps/web/.next/dev/cache` during the long audit session. The Mac reached 251,310,080 usable free bytes and full swap usage.

Confirmed the listener's working directory was this repository's `apps/web`, stopped only that QA listener, and removed only its regenerable `.next/dev/cache`. Actual available-space increase: **7,148,896,256 bytes**. Available afterwards: **7,400,206,336 bytes**. Source, evidence screenshots, verified encrypted backups, databases and other projects were retained. The QA API on port 3099 was not stopped. The local QA web server remains stopped until another browser check needs it.

Next.js 16.3's installed documentation specifies `experimental.turbopackFileSystemCacheForDev`. `BROKERIQ_DISABLE_DEV_CACHE=1` now disables just that persistent dev cache for local QA. Production build caching is unchanged. Use the flag when restarting the QA web server and monitor disk/memory before Android builds; do not clear an active server's cache.
