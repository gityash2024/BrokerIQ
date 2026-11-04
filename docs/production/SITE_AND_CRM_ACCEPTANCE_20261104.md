# Landing, guides and CRM acceptance

## Landing and guides

Commit `1aa0f01` adds separate product galleries for the Customer portal, Broker workspace, Android and Super Admin. The seven current web images came from isolated workspaces running the Build 55 UI. The four Android images are archived captures from Builds 23 and 24 and carry those build numbers on the page and in the manuals. Obtain current Android screenshots from a controlled capture build before production sign-off.

The four linked A4 manuals are in `apps/web/public/guides/`. The English and Hindi Broker manuals have 12 pages each and the Super Admin manuals have 9 pages each. Each manual includes linked contents, role-specific steps and redacted screenshots.

All eight local Chrome smoke checks passed, including all 11 image URLs, four PDF signatures, canonical Terms and Privacy redirects and landing width at 360 px. Build 56 (2.3.15, commit `4a0c8f145c3f1e97160baaaffad214e4bae07e64`) published to staging on 4 November 2026 at 16:38:58 IST. The private candidate passed gallery, guides and legal checks before the switch. Public verification fetched all 11 images, four PDF signatures and legal routes, matched all three landing timestamps, and independently hashed the 186,565,570-byte signed APK to `bf87a2f9fbeefdae1d9fcb317687e1a3d93faade541fd8110f91856d61f1fae8`. The live API commit and the runtime update link match Build 56. Device acceptance and production sign-off remain open.

The initial activation stopped at the disk guard. Removing only generated Android directories in the completed candidate restored more than 20 GiB available. The signed candidate and published download bytes were rechecked. No schema migrations were applied during activation.

## Client communications

Both Gmail and SMS suites passed all 16 checks against real isolated NestJS and PostgreSQL. HTTP responses at the provider boundary were controlled. Prior live provider tests established standalone delivery evidence for the approved test mail and SMS. A linked CRM send, reply and timeline check is still open for each channel.

The authorized Broker Admin created a separate Olive Estate QA lead after a read-only collision check. The staging Inbox recorded one Gmail send at 16:14 IST as `SENT`, with a provider ID, and one Textbee SMS at 16:15 IST as `DELIVERED`, with a signed provider receipt. Gmail sync completed without an error and returned no reply for the thread. The outbound checks are complete. Inbound acceptance remains open for both channels.

For the scoped SMS reply check, the existing signed Textbee webhook briefly included `MESSAGE_RECEIVED` and the CRM inbound switch was enabled. The test handset was unavailable. The original outgoing event list and inbound-off setting were both restored and verified. The available alternate number belongs to an archived lead, which stayed archived. The staging Gmail testing grant and production Gmail approval are separate gates.

## Web sign-in

Commit `ef65466` adds an accessible password visibility toggle and uses the login layout for both email OTP paths. Local Chrome against isolated NestJS and PostgreSQL verified the toggle, 360 px layout, invalid OTP feedback, resend cooldown, back navigation, successful verification and post-login redirect. Both password followed by OTP and email-only OTP were exercised. This commit follows the Build 56 release pin.

## Extraction

Commit `bc9301c` splits explicit rent or sale lists when each numbered row has its own property marker and locality. Shared or ambiguous facts stay in a review item tied to the original message. All 67 shared tests passed. This commit follows the Build 56 release pin.

On 12 frozen catalog groups, both the baseline and revised deterministic parsers yielded 48 offer candidates for 101 annotated offers. The resulting record-count ceiling is 47.52%. It gives no measured field precision or recall. The full independent field and media review, capable provider evaluation, 95% precision and 90% recall are still open.
