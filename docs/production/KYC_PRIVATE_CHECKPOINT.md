# KYC private transport and immutable reviews — source checkpoint

This checkpoint is not deployed. Full KYC/native capture and production privacy acceptance remain open.

## Corrected source defects

- KYC was absent from private local storage kinds; Cloudinary public upload took priority. New KYC uploads now require encrypted local storage, use the actual uploading user as owner, and allow JPEG/PNG/WebP/PDF only.
- Agent firm status returned firm-wide personal documents. It now returns only firm identity/status, no firm document numbers, images or editing powers. A Broker Admin can review current-firm Agents, but cannot inspect another Admin's identity documents or self-approve. Super Admin retains authorized visibility.
- KYC serialization now returns an authenticated document-ID proxy, removing original provider URLs, storage keys and content hashes from client responses. Web previews fetch authorized in-memory blobs; native previews fetch authorized in-memory page images with no image cache. No bearer token is sent to an external provider URL by SourceImage.
- Both raw upload previews and document-ID previews check current subject/firm ownership. Signed PUT replay preserves bytes; a still-valid upload token cannot replace a submitted file.
- Personal review requires the exact current document IDs. Retried review/submission is idempotent. Rejected/replaced records are superseded, retained and available through authorized paginated history. Verified identity fields remain locked in the API and both clients.
- Personal KYC never verifies a firm. Only current firm-only documents can do so, after all are verified. A rejection requires a typed reason; Android's invented default rejection note was removed. One verified Aadhaar no longer marks a five-document personal submission complete.
- Private PDF rasterization uses local `pdfinfo`/`pdftoppm`, no external viewer or plaintext temporary files: at most two concurrent renders, 15 seconds per subprocess, one bounded 1800px page, at most 100 pages, bounded stdout. Original PDF bytes remain available through the authenticated proxy. Both binaries exist locally; **production lacks them and requires poppler-utils before candidate activation**.
- Native KYC workspace navigation now opens the existing Broker Admin team/firm management screen; Admin has a separate My KYC entry. KYC notification member/firm routes and own-identity destinations are preserved. UI review requests include current document IDs.
- Web pose capture no longer silently allows manual upload when the detector fails. It detects a second face, requires an open/closed/open blink before capture, retains review/retake, and closes late-arriving camera streams after navigation. These are capture checks, not automatic identity approval. Native on-device pose detection is still a separate unfinished item.

## Evidence

- Eight real Nest/PostgreSQL/encrypted-file tests passed in Broker-first mode: foreign URLs, repeated captures, peer/other-firm access, immutable PUT, stale review, self-review, Admin privacy, retained history, concurrent resubmission, firm approval hierarchy, repeated notification prevention and two-page PDF rendering/page bounds.
- Fresh historical-platform full regression: 303 passed, two export unit assertions failed, 25 configuration skips. Failures were the newly added superseded-record filter and an incomplete one-document fixture incorrectly expecting VERIFIED. Updated those assertions/fixture and added the partial-KYC negative case: both affected suites passed, 20 tests. The failing Broker-first attempt to run historical coming-soon suites is not release acceptance.
- Shared 58 tests, mobile 68 tests, all workspace typechecks and Android JavaScript export passed. Scoped lint: zero errors (existing/general type warnings remain).
- Actual Chrome/local API/private database: Agent's three face preview fixtures loaded as authenticated blob URLs; Aadhaar preview opened in a dialog. Evidence: `output/playwright/kyc-private-preview-local.png`. Fixture artwork explicitly says LOCAL QA ONLY / No identity data. This does not validate real face/pose quality or production documents.

## Required release gates

1. Preserve and migrate the ten existing public Cloudinary personal documents with original-byte hashes. Retain a verified backup/restore first; do not delete originals. Then revoke old public delivery and verify CDN invalidation. Merely changing database URLs is insufficient.
2. Complete actual native face/pose/blink capture and device camera lifecycle acceptance; complete member detail/date/export parity and remaining languages.
3. Old clients cannot display authenticated media as ordinary public images. Coordinate the API, web, signed upgrade APK and explicit old-client update behavior before public media retirement.
4. Validate the installed APK, current Admin/Super Admin browser journeys, PDF runtime preflight, production role-negative tests and final media counts/hash evidence. No production completion claim until these pass.
