# Enterprise implementation — 17 October 2026

Implemented scope: original indigo/saffron identity; marketing `/`, consumer `/user` and Android User/Broker modes; open customer signup, invited brokers; rental/PG/commercial rental only; explicit inventory publication with Admin review; role-scoped dashboards. Future sale/billing/deals/agreements/referrals remain disabled.

## Delivered

- Shared brand/spacing/motion tokens, original house logo, architectural landing, portal links and animated wordmark footer. Android launcher, splash and workspace use the same identity.
- Canonical consumer web routes and compatible legacy redirects, public browsing, customer signup, saved properties/searches, requirements, enquiries/chat, visits, owner posting and account/privacy screens. Android restores the corresponding User mode alongside Broker mode.
- Public publication DTO allowlist, firm ownership/revision checks, availability and public-preview confirmations, idempotent inventory relation, Admin moderation and withdrawal propagation. Public reads also check linked inventory availability.
- Typed Admin/Broker/User reporting endpoints; current totals and period activity are separate. Date ranges use IST, validate real dates and cap at 366 days. Charts include accessible record summaries and scoped paginated drilldowns.
- Web/native dashboard layouts, compact property/floor/source presentation, conditional inventory fields and sticky save, directory provenance disclosure, automation recipe deduplication, permission loading/errors and distinct request/empty states.
- M_ID evidence traced to an extension-only stack. The historical record remains retained and auditable as BROWSER_EXTENSION; mixed/unknown/application stacks continue normal product error reporting.
- Native access is applied through navigator screen layouts, preserving navigator state while protected content waits for permissions. The reproduced cold-start navigation loop is fixed; query caches clear on account change without deleting disk drafts.
- Shutdown waits for domain handlers before Prisma disconnects. A regression test covers chained handlers; HTTP integration suites keep stable listeners during each suite.

## Verification and release boundary

Full API suite: 124 passed, 18 skipped. Separate BROKER_FIRST security/recovery suite: 21 passed. Shared: 28 passed; mobile unit suites: 9 passed; Playwright: 8 passed. Workspace typechecks, production builds and signed Android builds passed. See RELEASE_HANDOFF.md and evidence/enterprise-release-20261017.json for the final deployed identity and artifact.

Live staging browser checks covered landing, residential/commercial search and Admin/Broker dashboards at desktop and 390px widths; captured no page exceptions or unexpected API failures. Native upgrades preserve the existing encrypted draft; airplane-mode force-stop/restart recovery was verified. No new public listings or mock business data were added on staging.

This is a staging handoff, not full production acceptance. Physical-device verification, real provider delivery/sync and unresolved handwritten source review remain external acceptance gates. Existing pending drafts and page84 exclusions remain intact. Off-host checksum verification is distinct from a full restore on a separate host.

## Artwork

Built-in imagegen generated `apps/web/public/product/brokeriq-city.webp`: premium editorial architectural 3D illustration for BrokerIQ; miniature modern Indian neighborhood with ivory residential buildings, indigo glass tower and saffron terraces, soft studio lighting and pale lavender background; no text, people, numbers, logos or UI. Conceptual illustration only, never listing photography. Native icon assets are raster exports of the existing web house SVG.
