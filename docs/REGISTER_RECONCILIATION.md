# Register reconciliation — 16 October 2026

Status: **INCOMPLETE**. This report distinguishes visually examined source groups from approved ledger records. It is not a final count of unique physical properties.

- Original PDF: 117 pages; SHA256 `46173d8bb00bf10253c3fbb8c72941b69b5793c008c60fff9dc5824c5091764f`.
- Pages 1–18 visually examined; 99 pages still need full entry review.
- 292 source groups examined; 81 approved groups produced 90 ledger records, including independent floors.
- 211 examined groups remain unresolved; 1,249 original OCR candidate blocks remain on unexamined pages.
- All 90 approved records have UNKNOWN current availability. Historical rented/sold/NO notes are evidence only.
- Page 8 locality was confirmed by the user as Sushant Lok (phase unspecified) and applied through version-checked source review. Its other uncertainties remain pending. Page 17 locality is still unconfirmed and null; neither page has approved entries yet.
- Original PDF/page images and source observations are retained privately; superseded OCR blocks are hidden from the review list, never deleted.

| PDF page | Source groups | Approved groups | Unresolved groups | Ledger records |
|---|---:|---:|---:|---:|
| 1 | 16 | 7 | 9 | 7 |
| 2 | 15 | 7 | 8 | 7 |
| 3 | 20 | 5 | 15 | 5 |
| 4 | 15 | 3 | 12 | 4 |
| 5 | 17 | 4 | 13 | 5 |
| 6 | 17 | 5 | 12 | 5 |
| 7 | 15 | 5 | 10 | 5 |
| 8 | 8 | 0 | 8 | 0 |
| 9 | 32 | 8 | 24 | 8 |
| 10 | 17 | 3 | 14 | 3 |
| 11 | 18 | 7 | 11 | 7 |
| 12 | 17 | 6 | 11 | 8 |
| 13 | 16 | 3 | 13 | 3 |
| 14 | 17 | 3 | 14 | 3 |
| 15 | 3 | 1 | 2 | 1 |
| 16 | 16 | 5 | 11 | 5 |
| 17 | 12 | 0 | 12 | 0 |
| 18 | 21 | 9 | 12 | 14 |

## Reproduce current counts

From `apps/api`, use the active BrokerIQ environment and built code:

```sh
node --env-file=/opt/brokeriq/secrets/api.env dist/prisma/report-register-review.js rahul@brokeriq.com 46173d8bb00bf10253c3fbb8c72941b69b5793c008c60fff9dc5824c5091764f
```

This read-only command emits no owner names, phones, raw transcriptions or credentials. Counts come from current source review states and undeleted source-linked inventory. A report stays incomplete until every page is examined and no source review remains pending.

User-confirmed glossary: FFD = fully furnished; SFD = semi furnished; SF = second floor; FF = first floor; bare 2+1 = two months security plus one month advance; 2B = two bathrooms. A bare +1 is not assigned a bathroom count. The meanings of 1+1 and 3+1 still await confirmation. Amounts in months are separate from rupee deposits. Other unresolved notation remains in source review.
