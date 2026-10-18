# BrokerIQ — Enterprise release handoff, 18 अक्टूबर 2026

Landing, User/Broker/Super Admin portals और signed Android build24 production पर उपलब्ध हैं। Source, isolated regression, emulator और live web evidence नीचे अलग हैं। Physical Android device और credential-dependent live provider delivery/sync acceptance अभी बाकी है।

| उपयोग | लिंक |
|---|---|
| Landing | https://brokeriq.mymultimeds.com |
| User Portal | https://brokeriq.mymultimeds.com/user |
| Broker Portal | https://brokeriq.mymultimeds.com/broker |
| Super Admin | https://brokeriq.mymultimeds.com/admin |
| Signed Android v2.1.0 build24 | https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.0-build24.apk |
| API health | https://brokeriqapi.mymultimeds.com/api/health |

`yash@brokeriq.com` Super Admin और `rahul@brokeriq.com` Olive State Broker Admin हैं। Existing passwords बदले नहीं गए हैं; वे Git में नहीं रखे गए। Customer signup खुला है; Broker onboarding invitation से है।

## Build24 — scanner, complete tool discovery और workspace refinement

- Web/native Broker Inventory और Requirements से Scanner/import, WhatsApp bulk TXT/ZIP/images और paste फिर सीधे उपलब्ध हैं। Multi-page document scanner, direct camera fallback, gallery, original-source review और पुराना public rental draft scanner सुरक्षित हैं। Destination review guidance है; extraction से अपने-आप inventory/public listing नहीं बनती।
- सभी signed-in roles में configured Coming soon catalog disabled रूप में दिखता है; presentation से permissions नहीं बदलतीं। Admin के पाँच primary sections के साथ System में 42 supporting tools खोजे जा सकते हैं।
- Shared headers, 44px controls, guarded sticky-save forms, complete mobile Admin record cards, role controls और permission/config/session states सुधरे हैं। Inventory में table/cards, readable floor/pricing/terms और सभी recorded source/media/contact facts के detail sections हैं।
- Directory के 1,122 exact source identities पर additional metadata लागू है: 860 HARERA detailed forms, 262 OSM records; 603 unit-mix tables और 860 approval/specification/facility tables जहाँ source ने दिया। एक verified Essel Towers photo, author/license/source credit और historical date caveat के साथ है। Missing facts/photos बनाए नहीं गए। 2,102 original identities और 1,237 mapped locations कायम हैं।
- Footer का Q पूरा, wordmark horizontally centered, scroll reveal/shimmer active और reduced motion पर animation बंद है। Landing screenshots इसी signed build24 के Inventory और Scanner workspace से हैं। Populated source-history mobile overflow और native requirement CTA wrapping का अंतिम regression fix भी शामिल है।

APK SHA256: `45e193323429d2c2471b6567c8f68ed171d1a5546579c20742e6a643f9cd98cf`। Package `com.brokeriq.app`, version2.1.0/code24; signing certificate पिछले builds वाला ही है। Existing credentials/passwords नहीं बदले; public landing/Git में passwords नहीं हैं।

Verification: shared31, full API127 passed/18 conditional skips; अलग Broker-first suites18 passed; native17; 12 browser journeys चार server groups में passed। अंतिम populated-source layout regression के बाद संबंधित दोनों browser journeys दोबारा passed। Web/API/native typechecks, API compile, production Next build और signed Android build passed। 91 static signed-in web routes (42 Admin/35 Broker/14 User, 13 future-disabled routes सहित) 390px पर audited हैं। यह हर possible populated interaction या physical-device certification का दावा नहीं है।

Emulator: build23→24 upgrade बिना uninstall/data-clear, old draft timestamp और पाँच visible fields सुरक्षित; final24 offline restart में भी वही fields। पाँच Broker tabs, rich property details, User browsing/overview, roadmap, camera/photo/file picker entry, Hindi/dark/130% font scale और तीन cold starts checked। Google document scanner component ने emulator पर “Try again later” दिया; direct camera fallback उपलब्ध और launch verified है। Real multi-page document capture की physical-device जाँच बाकी है।

Production: reviewed source `1f2b96c`; API `dist-product24-b22955d`, web `.next-product24-1f2b96c`। केवल `brokeriq-api` और `brokeriq-web` reload हुए। Public HTTPS API role checks, counts, source details/photo, new screenshots/download, 390/1440px footer/workspaces और reduced motion checked। Sanitized results: [Build24 evidence](evidence/product-release-build24.json)।

Data safety: `/opt/brokeriq/backups/checkpoints/20261018-055142-broker-first` में pre-release encrypted checkpoint है; scratch restore में counts/media hashes verified हैं। Metadata application से पहले exclusive fsynced snapshot `/opt/brokeriq/backups/product24/directory-before.json` बना। Inventory895 और page84 की 23 IGNORED entries सुरक्षित हैं। इस release में schema migration/reset/seed नहीं चला।

Rollback: `/opt/brokeriq/backups/product24/api-before.txt` और `web-before.txt` के previous dist targets restore करें; `web.env.before` restore करके केवल संबंधित BrokerIQ process reload करें। Original compiled builds और APK23 retained हैं। Code rollback के लिए DB restore की जरूरत नहीं है। Enrichment rollback चाहिए तो metadata snapshot और current row changes reconcile करें; whole database restore करके नई user writes न मिटाएँ।

## Build23 finishing — 17 अक्टूबर 2026

Footer के gradient glyph paint bounds सुधारे गए हैं; `Q` का दायाँ हिस्सा पूरा दिखता है। Wordmark centered है और scroll reveal/shimmer reduced-motion preference का सम्मान करते हैं। Landing की पुरानी Directory images अब इसी signed build23 से लिए गए dashboard और Directory screenshots से बदली गई हैं।

Native finishing में shared headers/cards/buttons/tabs, dashboard hierarchy और donut legend, Directory map/list/filter, property overview, grouped inventory forms, Automation controls/history और Inbox capture states शामिल हैं। Inbox route की गलत module mapping ठीक हुई; USER को Broker Inbox access नहीं दिया गया।

Build23 verification: mobile typecheck और 17 unit tests; shared 28 tests; landing typecheck और server production web build पास। Emulator पर पाँचों Broker tabs, Directory filters/map attribution, property details, execution history, User overview और Broker mode में वापसी जाँची। Existing encrypted draft और timestamp upgrade के बाद सुरक्षित रहे; airplane-mode restart में field fingerprint समान रहा। Hindi/dark/1.3 font scale और तीन cold starts जाँचे; OS/language preferences वापस कीं। Physical-device gate अभी खुला है। Native/landing visual patch के बाद अलग scheduler defect मिला; उसके fix के लिए full API और Broker-first suites दोबारा चलाई गईं, नीचे नई evidence है।

Web code `b9c7ad6` पर है; केवल `brokeriq-web` reload हुआ। `brokeriq-api` का PID/restart count अपरिवर्तित रहा। Web rollback: `/opt/brokeriq/backups/20261017-native23-b9c7ad6/` में पिछली `.next` symlink target और private web environment सुरक्षित हैं। पुराने `.next-landing-7e63906` को फिर link करके पिछला web environment restore और केवल web reload किया जा सकता है। इस patch में DB migration नहीं है। Android build22 retained है; uninstall/data-clear की आवश्यकता नहीं है। [Build23 evidence](evidence/native-finishing-build23.json)।

## Scheduler follow-up — `279745a`

Final log review में पाँच मिनट वाली job housekeeping के `CASE` expression पर PostgreSQL `42804` मिला: text result `JobStatus` enum column में assign हो रहा था। Result को explicit enum cast दिया; error reporting/history सुरक्षित है। Real isolated PostgreSQL regression पुराने SQL पर fail और fixed SQL पर pass हुआ। Stale retry recovery, exhausted attempts, fresh locks, pending jobs और finished-job retention जाँचे गए; test transaction rollback होता है।

Full API rerun: 125 passed / 18 conditional skips; अलग Broker-first/enterprise/recovery run: 22 passed। API typecheck और production compilation पास। Deployed database पर exact service query rollback transaction में सफल हुई; 895 active private inventory और 2 DONE jobs मिले। Fix के लिए केवल `brokeriq-api` reload किया; web process स्थिर रहा। नई API PID `1081461`, restart count22। कोई DB migration/reset या recipient send नहीं हुआ। पिछला compiled API `/opt/brokeriq/backups/jobs23-279745a/active-dist-before` में है; rollback के लिए उसे `apps/api/dist` पर restore करके केवल API reload करें।

## तैयार व्यवहार

Landing, web panels और Android में indigo/saffron और house identity लागू है। `/user` पर residential rent, PG और commercial rent flows हैं। पुराने `/rent`, `/property/...` और `/account/...` links canonical routes पर जाते हैं। Future modules disabled हैं; Broker/Admin की पाँच मुख्य sections बनी हुई हैं।

Private inventory अपने-आप public नहीं होती। Confirmed availability और explicit public preview के बाद submission PENDING_REVIEW होता है; Admin approval पर public होता है। Raw register, private contacts और internal notes copy नहीं होते। Linked inventory unavailable/archived होने पर public listing हटती है।

Dashboards वास्तविक counts/charts, 7/30/90/custom dates, IST boundaries, current-vs-period labels और scoped drilldowns देते हैं। Empty activity को fabricated trend/growth से नहीं भरा गया है।

## सत्यापन

- Shared tests: 28 passed। Full API: 124 passed, 18 conditionally skipped (ये BROKER_FIRST=true वाले अलग run में पास हैं)। BROKER_FIRST boundary/recovery run: 21 passed। Mobile unit: 9 passed। Playwright: 8 passed।
- Workspace typechecks, production API/web builds, Expo export और signed Android builds पास। Live browser checks में desktop/390px Admin/Broker dashboards, landing और consumer searches पर zero captured page exceptions/unexpected API failures मिले।
- Emulator पर existing install का upgrade हुआ; uninstall/data-clear नहीं किया गया। पुराने encrypted draft की state/values सुरक्षित रहीं; airplane mode में force-stop/restart के बाद restore जाँचा गया। Native User/Broker modes और dashboard navigation जाँचे गए। Hindi/English dashboard, dark theme और 1.3 font scale emulator पर जाँचे गए; OS preferences वापस की गईं। Physical-device acceptance अलग pending है।
- Screenshot वाला M_ID stack browser extension का है। Original error/notification/history retained हैं; exact historical record audit के साथ external origin में classified है। Application और mixed stacks की reporting चालू है।
- Native cold-start regression में navigator को permission gate से बार-बार unmount करने वाला loop reproduce हुआ। Gate अब screen content पर है; navigator mounted रहता है। Build22 पर repeated cold starts, tabs और offline draft recovery दोबारा जाँचे गए। Account switching पर in-memory queries साफ़ होती हैं; disk drafts सुरक्षित रहते हैं।
- एक full rerun में आए transport failures के बाद test listeners स्थिर किए गए। Shutdown race में pending notifications से पहले DB बंद हो रहा था; handler draining और delayed Prisma disconnect के बाद final full suite में वह error नहीं आया।

Historical build23 APK SHA256:

```text
54275ed9b073bcf04de8a7100b758c3c74bc43873135118eb106f195c5b2d3a5
```

Signing certificate SHA256: `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce` — पिछले builds वाला ही certificate। Package `com.brokeriq.app`, minSdk24, targetSdk36; contacts/location/microphone/overlay permissions absent हैं।

## Data, backup और rollback

Staging validation: 895 active private inventory, 1 soft-archived record, 0 public rentals और 1,053 pending source reviews। Page84 skip, original PDF/crops/transcriptions, correction history और SQLCipher drafts सुरक्षित हैं। Area Directory: 2,102 source identities / 1,237 mapped; exhaustive unique-project coverage का दावा नहीं है।

Pre-release checkpoint `/opt/brokeriq/backups/checkpoints/20261017-015455-broker-first` में encrypted DB/secrets/source/register evidence और media हैं। Scratch restore में table counts और active media/source hashes मिले। Private off-host copy का checksum अलग verify किया गया; अलग host पर full application restore अभी प्रमाणित नहीं है।

Additive migrations: `20261017001000_consumer_enterprise` (nullable unique inventory–listing relation, indexes, approved modules) और `20261017002000_error_attribution` (classification)। Destructive reset/drop नहीं चला। Runtime changes केवल `/opt/brokeriq`, `brokeriq-api`, `brokeriq-web` तक सीमित हैं।

Rollback: checkpoint का code commit और encrypted secrets सुरक्षित हैं। केवल BrokerIQ के API/web processes रोककर उसी release/config को restore करें; schema additions रहने दें। DB restore सामान्य code rollback का हिस्सा नहीं है—नई user writes होने पर पहले incremental export/reconciliation करें। जरूरत पड़ने पर checkpoint restore को पहले scratch DB में जाँचें। पुराने build16 को upgrade fallback के रूप में सुरक्षित रखा गया है; app uninstall न करें।

## बाकी acceptance gates

- Housing credentials से real sync; WhatsApp credentials और explicitly authorized recipient से send/receive/delivery। इस release में किसी real recipient को test message नहीं भेजा गया।
- SMTP-dependent password recovery/email delivery और enabled optional providers की live verification। Missing credentials UI में स्पष्ट हैं।
- Physical Android device पर install/upgrade, sharing/camera, keyboard/font scaling, reconnect/queued operations और Hindi/light/dark की जाँच।
- 1,053 uncertain source entries का broker review और public publishing से पहले availability/details confirmation।

Before/after screenshots और local verification artifacts `releases/enterprise-evidence/` में हैं; मशीन paths, raw register files और private credentials public landing पर नहीं हैं। [Implementation detail](ENTERPRISE_IMPLEMENTATION.md), [release evidence](evidence/enterprise-release-20261017.json) और [register reconciliation](REGISTER_RECONCILIATION.md) साथ उपलब्ध हैं।
