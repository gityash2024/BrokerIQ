# BrokerIQ — release handoff, 16 अक्टूबर 2026

Broker-first implementation और fresh database staging पर live हैं। पूरी production acceptance अभी बाकी है: handwritten register की unresolved entries, live providers और physical Android device की जाँच खुली है।

| उपयोग | लिंक |
|---|---|
| Website | https://brokeriq.mymultimeds.com |
| Panel login | https://brokeriq.mymultimeds.com/login |
| Super Admin integrations | https://brokeriq.mymultimeds.com/admin/settings |
| Broker inventory | https://brokeriq.mymultimeds.com/broker/inventory |
| API health | https://brokeriqapi.mymultimeds.com/api/health |
| Signed Android APK | https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.0.0-build16.apk |

Accounts: `yash@brokeriq.com` → SUPER_ADMIN; `rahul@brokeriq.com` → BROKER_ADMIN, Olive State। Passwords private bootstrap से लगाए गए हैं; इस document/Git में नहीं रखे गए। Public signup बंद है।

## तैयार workflows

Web/Android के पाँच sections: आज का काम, Inventory, Leads & Requirements, Inbox, Automation & Housing। Area Directory Inventory के अंदर है। Shared module permissions navigation, direct routes, APIs और jobs पर लागू हैं; future modules का code सुरक्षित है और upcoming catalog disabled है।

Inventory में typed rent/sale prices, area units, multiple contacts/units, shared filters, pagination, controlled bulk updates और source-linked review है। Incoming text/image/chat exports durable queue में जाते हैं; broker approval के बाद records बनते हैं। Review में default “Pending only” है; “All entries” से approved/history records मिलते हैं। Offline drafts/imports SQLite में account के अनुसार सुरक्षित हैं। Landing page actual app screenshots, login और signed APK देता है।

## Register evidence

सभी 117 pages की पहली visual transcription: **1,933 source groups → 851 approved groups → 895 ledger records**। **1,051 groups अभी unresolved**; 16 groups repeated scan के हैं और दूसरी inventory नहीं बनाते। Today के 1,053 pending groups में PDF के 1,051 तथा दो अन्य वास्तविक Share/Paste captures शामिल हैं। आपके निर्देश पर पेज 84 के 15 groups skip हैं; उसका एक पुराना record recoverably archived है और source सुरक्षित है। सभी imported records की current availability UNKNOWN है। यह unique physical properties का अंतिम count नहीं है और पुराने 1,698 count से जबरन नहीं मिलाया गया है।

पेज 8 Sri Lanka / Sector 43; पेज 17 top Sector43 और body Sector28; Pragati Vihar / DLF Phase4; पेज24 divider के बाद और pages25–27 Sushant Lok1; pages42–46 Sector57 की confirmations लागू हैं। BHK+1 एक additional room/space है; उसका उपयोग अनिश्चित रहता है। TF का अर्थ Top Floor है, कोई numeric level नहीं। CNP historical Call Not Picked है। NC/PD से structured facts नहीं बनते।

[पूरी per-page reconciliation](REGISTER_RECONCILIATION.md) और [PII-free counts](evidence/register-reconciliation-20261016.json) देखें। Original PDF, images, crops, raw transcription और correction/audit history private हैं। बाद की broker corrections replay पर overwrite नहीं होतीं।

## सत्यापन

- Shared tests: 23 passed। Full API suite: 123 passed, 12 skipped; broker-first/recovery suites: 15 passed। Workspace typechecks और production API/web builds पास। Latest app deployment: `e7b163d`; source-review CLI: `49bbbc9`।
- सभी 117 pages के replay ने zero new approvals/duplicates बनाए। Context amendment replays भी no-op रहे। Latest HTTPS smoke में Inventory/Today/database के counts 895 मिले; broker→admin और disabled module 403, unauthenticated source 401 मिला।
- पाँच confirmed Top Floor entries में numeric floor नहीं बनाया गया। दोनों initial roles और सभी user-confirmed locality corrections database में जाँची गईं।
- Latest runtime पर isolated PostgreSQL और enabled queue के साथ सभी 12 Playwright journeys पास। Android emulator checks: Hindi/English login, native text/image sharing, filter safe area, directory map/list, offline draft recovery after restart। Build15 के live PDF review में pending/all counts 1,065/1,933 (पेज84 skip से पहले) और Hindi/English labels जाँचे गए। Build16 इसी UI का permission cleanup है; overlay/contacts/location/microphone permissions APK manifest में absent हैं। Build16 पर cold restart के बाद authenticated source view और पेज84 skip के बाद 1,051 pending groups भी जाँचे गए। Physical Android device अभी नहीं जाँचा गया है।
- Housing/WhatsApp के real credentials अभी नहीं मिले। Real sync और authorized test-number send/receive/delivery का दावा नहीं है। Missing configuration visible है; paid AI fallback नहीं है।
- Directory: 2,102 source identities, 1,237 mapped; यह unique societies की exhaustive सूची नहीं है। [Sources और limitations](DIRECTORY_SOURCES.md)।

APK build16 SHA256:

```text
ef2bd27e235b88b014bf229a68d44637bbb9b2f0b611d90f051274f14295fc33
```

Password recovery में single-use OTP consumption, capped attempts, atomic password/refresh revocation और session versions जाँचे गए हैं। पुराने access/refresh tokens तथा sockets reset के बाद बंद होते हैं; current login चलता है। Socket rooms वर्तमान firm/role से तय होते हैं। Email delivery के लिए configured SMTP जरूरी है; provider delivery इस isolated test का हिस्सा नहीं है।

## Backup और recovery

Verified server checkpoint: `/opt/brokeriq/backups/checkpoints/20261016-175009-broker-first`। इसमें 895 active ledger records तथा पेज84 का archived record, encrypted DB/secrets/source, private media और सभी register inputs/operator amendments हैं। वास्तविक scratch restore में exact table counts मिले; media तथा decrypted/extracted register evidence के SHA256 मिले। `RESTORE_VERIFIED.txt` और `SHA256SUMS` प्रमाण हैं।

Off-server encrypted copy: `~/Library/Application Support/BrokerIQ/backups/20261016-175009-broker-first`। सभी 129 manifest files के SHA256 और exact table-count evidence स्थानीय copy में मिले। Backup decryption key इस directory में नहीं रखी गई है। Local copy पर encrypted secrets archive की readability भी जाँची गई; पूरा off-server database restore नहीं चलाया गया। वास्तविक restore server के isolated scratch database में किया गया था।

Deploy, non-live restore और पुराने pre-cutover state पर rollback के निर्देश [DEPLOYMENT.md](DEPLOYMENT.md) में हैं। पुराने `/opt/brokeriq/app` और original database सुरक्षित हैं। केवल BrokerIQ paths/processes बदले गए हैं। [Cleanup manifest](CLEANUP_MANIFEST.md) में private archive और पुराने APKs का विवरण है।

## बची हुई acceptance

Register review queue में unclear digits, unit boundaries, conflicting prices और possible repeated-property observations की पुष्टि करें। User Settings में provider credentials जोड़ेंगे और WhatsApp test recipient की स्पष्ट अनुमति देंगे। Physical Android device पर installation और पाँचों workflows का acceptance बाकी है। इन सीमाओं के रहते release को पूरी तरह production-verified न मानें।
