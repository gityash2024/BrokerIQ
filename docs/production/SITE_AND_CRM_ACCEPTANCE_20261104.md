# Landing, guides and CRM acceptance

## Landing and guides

Commit `1aa0f01` adds separate product galleries for the Customer portal, Broker workspace, Android and Super Admin. The seven current web images came from isolated workspaces running the Build 55 UI. The four Android images are archived captures from Builds 23 and 24 and carry those build numbers on the page and in the manuals. Obtain current Android screenshots from a controlled capture build before production sign-off.

The four linked A4 manuals are in `apps/web/public/guides/`. The English and Hindi Broker manuals have 12 pages each and the Super Admin manuals have 9 pages each. Each manual includes linked contents, role-specific steps and redacted screenshots.

All eight local Chrome smoke checks passed, including all 11 image URLs, four PDF signatures, canonical Terms and Privacy redirects and landing width at 360 px. The Build 56 staging handoff verifies the gallery, PDF signatures and public legal routes on the private candidate before activation. The current public release must be checked independently after the switch.

## Client communications

Both Gmail and SMS suites passed all 16 checks against real isolated NestJS and PostgreSQL. HTTP responses at the provider boundary were controlled. Prior live provider tests established standalone delivery evidence for the approved test mail and SMS. A linked CRM send, reply and timeline check is still open for each channel.

The latest approved email and phone each matched an existing Olive Estate CRM lead. The lookup was read-only and returned only counts. No test lead was created and no live message was sent during this check. Use alternate approved test contacts that do not collide with existing leads. Confirm the Textbee device receives only the test number before enabling inbound replies. The staging Gmail testing grant and production Gmail approval are separate gates.

## Extraction

Commit `bc9301c` splits explicit rent or sale lists when each numbered row has its own property marker and locality. Shared or ambiguous facts stay in a review item tied to the original message. All 67 shared tests passed. This commit follows the Build 56 release pin.

On 12 frozen catalog groups, both the baseline and revised deterministic parsers yielded 48 offer candidates for 101 annotated offers. The resulting record-count ceiling is 47.52%. It gives no measured field precision or recall. The full independent field and media review, capable provider evaluation, 95% precision and 90% recall are still open.
