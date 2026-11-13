# Photo workflows and acceptance boundaries

Source changes add photo upload directly to existing web and mobile property details, with the existing account-scoped upload pipeline, a 50-image bound and optimistic revision checking. The assigned agent and authorized administrators can save photos for future use. Profile uploads retain account identity across asynchronous picking and uploading.

The client property-share composer can include selected property photo links for WhatsApp, email or SMS. It remains an editable, manually sent draft. Only complete HTTPS links are included, and private import, KYC and inspection source URLs are excluded. This is link sharing; it is not a claim of native image attachments on every channel.

ZIP photo extraction now uses the same explicitly approved free vision path as standalone image imports, once per unique image hash. Photo proposals remain separate from captions and require review. Original attachments and OCR survive a provider failure. No existing approved record is re-extracted or overwritten.

## Verification

- Real PostgreSQL and Nest API: 8 tests passed, including actual image upload and download, property persistence, unchanged price/assignment, stale revision rejection, cross-firm rejection, and own-profile avatar persistence.
- ZIP archive tests: 2 passed for hash deduplication, exact attachment association, original OCR preservation and vision outage recovery.
- All five workspace typechecks passed.

## Open acceptance

Physical Android acceptance remains user-deferred. SMS incoming-reply acceptance remains user-deferred. Google branding is verified but restricted Gmail scope review/approval is external and must not be represented as approved. The sampled free Vision responses remain below the full quality gate; do not enable automatic image imports from this diagnostic result.

Chat-import AI is now connected through a separate exact-model evaluation gate. Duplicate forwarded text reuses a draft; each import makes at most 100 logical AI requests and preserves every remaining source for rule/manual review. Metadata records the actual request and draft-message counts. A provider outage cannot mark a source as approved or discard its text. The same evaluated model must be configured; an unevaluated free fallback cannot silently take over capture extraction.

Additional validation: 29 AI/import unit tests and all 10 real PostgreSQL source-ledger tests passed, including the 300 MB resumable import journey. Landing controls passed six viewport checks (320, 360, 390, 768, 1024 and 1440 px), Hindi translation, theme switching and reload persistence. Uploaded property-photo rendering and details-dialog bounds passed four viewport checks. Four PDF guides include a visually reviewed Build 61 supplement with original screenshot provenance retained.
