# BrokerIQ manuals

The two copy files each contain Hindi and English editions. The renderer produces four A4 PDFs with linked contents and embedded BrokerIQ fonts. The supplied 12-page SoftLogic brochure informed the cover, section hierarchy, number markers and screenshot layout. The manuals use BrokerIQ product text and assets.

Use Python with ReportLab 4.4 or later and uharfbuzz for Devanagari shaping. Pass the release manifest for the intended version.

```sh
python3 ops/render-user-guides.py --release /path/to/release.json --output output/pdf --draft
```

Add `--captures /path/to/captures.json` for captured UI. The manifest is keyed by `broker/inventory`, `super-admin/records` and the other role/chapter IDs in the copy. Each entry contains `path`, `sha256`, `commit`, `privateDataMasked`, `surface` and `capturedAtIst`. Review the crop against the underlying role, source identity and private fields before setting the privacy flag. Keep unredacted source captures outside Git. Mobile captures must come from the matching release commit using the controlled QA capture build. The final renderer requires a reviewed capture for every chapter. Use `--draft` for work in progress with partial coverage.
