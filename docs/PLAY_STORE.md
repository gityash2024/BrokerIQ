# BrokerIQ — Google Play release guide (v1.3.0)

## 1. Files

| File | Use |
| --- | --- |
| `releases/BrokerIQ-v1.3.0.aab` | **Play Console upload** (Android App Bundle) |
| `releases/BrokerIQ-v1.3.0.apk` | Direct install / testing (same signature) |

Both are signed with the **BrokerIQ upload key**:

- Keystore: `~/.brokeriq/android/brokeriq-upload.keystore` (alias `brokeriq-upload`)
- Passwords: `~/.brokeriq/android/keystore.properties` (never in git)
- **Backup both files now** (password manager + offline copy). If the upload key is lost you must request an upload-key reset from Google (takes days).
- Use **Play App Signing** (default): Google keeps the app signing key, you keep only this upload key.

> Earlier APKs (≤ 1.2.2) were signed with the debug key. Phones that have that APK must **uninstall it once** before installing 1.3.0 — Android refuses an update signed with a different key.

### Rebuilding

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://brokeriqapi.mymultimeds.com/api npx expo prebuild -p android --clean --no-install
cd android && ./gradlew assembleRelease bundleRelease
# outputs: app/build/outputs/apk/release/app-release.apk, app/build/outputs/bundle/release/app-release.aab
```

Bump `version` and `android.versionCode` in `apps/mobile/app.config.ts` for every Play upload (versionCode must always increase). Signing comes from `apps/mobile/plugins/with-release-signing.js`; another machine can point `BROKERIQ_SIGNING_PROPERTIES` at a copy of `keystore.properties`.

## 2. Store listing

- **App name:** BrokerIQ — Rent homes in Gurgaon
- **Short description (80):** Verified rental homes in Gurgaon. Talk to brokers directly. Free CRM for brokers.
- **Full description:**

  BrokerIQ helps you find a rental home in Gurgaon without the runaround.

  For tenants
  • Verified listings with real photos, rent, deposit and brokerage shown upfront
  • Search by sector, budget, BHK, furnishing — or ask the AI assistant in your language
  • Book a site visit or a video visit in the broker's free slots
  • Is the rent fair? See the typical rent for any sector and BHK
  • Compare homes side by side and share your shortlist with family
  • Rent reminders, UPI payment to the owner and monthly rent receipts (HRA)
  • Move-in / move-out checklist confirmed by both sides — no deposit fights
  • Available in 13 Indian languages

  For brokers (free)
  • Lead CRM: all portal, WhatsApp, website and call leads in one inbox, with a hot/warm/cold score
  • Follow-ups, site visits, pipeline, deals, commission, invoices and GST reports
  • WhatsApp broadcasts from your own number, digital visiting card, photo watermark
  • Auto-post new listings to your Facebook Page and Instagram
  • Owner reports, rent agreements with OTP signing, co-broking network

- **Category:** House & Home · **Tags:** Real estate, Rentals
- **Contact email:** support address from Super Admin → App settings
- **Privacy policy URL:** `https://brokeriq.mymultimeds.com/p/privacy`
- **Account deletion URL:** `https://brokeriq.mymultimeds.com/account-deletion`

### Graphics checklist

- [ ] App icon 512×512 (from `apps/mobile/assets/icon.png`)
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots (min 2, 1080×1920 or similar): Home, Search results, Property, Visit booking, My rent, Broker leads, Broker lead detail, Campaigns
- [ ] Optional: 7" and 10" tablet screenshots

## 3. App content answers

| Section | Answer |
| --- | --- |
| Privacy policy | URL above |
| App access | Most features need no login. For review give a test tenant login and a test broker login (create them on production, note them in Play Console → App access) |
| Ads | **No ads** |
| Content rating | Questionnaire → category "Utility/Productivity"; no violence, no gambling, user-generated content: **yes** (reviews, listings) with reporting and moderation |
| Target audience | 18+ |
| News app | No |
| Government app | No |
| Financial features | None (no payments processed in the app; UPI opens the user's own UPI app) |
| Health | No |

### Data safety

Data is **encrypted in transit** (HTTPS). Users can **request deletion** (in-app Profile → Account delete, or the URL above).

| Data type | Collected | Shared* | Purpose | Optional |
| --- | --- | --- | --- | --- |
| Name, email, phone | Yes | No | Account, communication with brokers | Phone optional |
| Precise / approximate location | Yes | No | Nearby homes, visit check-in | Yes (permission) |
| Contacts | Yes | No | Only after explicit in-app opt-in (Profile → Privacy) | Yes |
| Photos | Yes | No | Listing photos, KYC (brokers) | Yes |
| Audio | Yes (processed, not stored) | No | Voice input to the AI assistant | Yes |
| App interactions, in-app search history | Yes | No | Saved searches, recommendations | — |
| Crash logs / diagnostics | Yes | No | App stability (own error log) | — |
| Device or other IDs | Yes (push token) | No | Notifications | — |
| Messages (chat with brokers) | Yes | No | App functionality | — |

\* AI and email providers only *process* data on BrokerIQ's behalf (service providers) — not "sharing" under Play's definition. No data is sold.

### Permissions declared

`CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `READ_CONTACTS` (prominent disclosure + opt-in shown before the system prompt), `RECORD_AUDIO`.

For `READ_CONTACTS` Play may ask for a declaration video: record Profile → Privacy & data sharing → disclosure → Allow.

## 4. Release steps

1. Play Console → Create app → fill the store listing and app content above.
2. Testing → **Internal testing** → Create release → upload `BrokerIQ-v1.3.0.aab` → add testers' emails → roll out.
3. Install from the internal-testing link on 2–3 phones; check login, search, visit booking, broker CRM, push notifications.
4. **Closed testing** (new personal developer accounts need 12+ testers for 14 days before production).
5. Production → Create release → promote the same build → staged rollout 20% → 100%.

## 5. Before going live (owner checklist)

- [ ] Legal review of Terms and Privacy pages (seeded drafts; edit in Admin → Pages)
- [ ] SMTP (e.g. Brevo free) in Admin → Integrations — needed for OTP, receipts, agreement signing
- [ ] OpenRouter free API key in Admin → Integrations → AI
- [ ] Keystore backup done (section 1)
- [ ] Rotate the Housing.com Profile ID / Encryption key that was shared in chat earlier
