# BrokerIQ — Android release और store handoff

वर्तमान product broker-first B2B workspace है। Consumer marketplace, tenant accounts और भविष्य के disabled modules को store listing में उपलब्ध सुविधा न बताएँ। यह guide publishing authorization या Play Console submission का प्रमाण नहीं है।

## वर्तमान artifact

Signed direct-install APK: `releases/BrokerIQ-v2.0.0-build16.apk`, versionName `2.0.0`, versionCode `16`। Download URL, SHA256 और verification limits [RELEASE_HANDOFF.md](RELEASE_HANDOFF.md) में हैं। इस release के लिए Play-upload AAB बनाया या upload नहीं किया गया है।

Upload key repo के बाहर `~/.brokeriq/android/` में है। `keystore.properties` या keystore/passwords को Git, APK download directory अथवा public documentation में न डालें। Current signing certificate SHA256:

```text
d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce
```

## Rebuild

पहले shared package build करें। `apps/mobile/app.config.ts` का versionCode बढ़ाएँ और existing native project में वही code रखें। Clean prebuild से पहले native configuration changes और signing plugin की जाँच करें।

```bash
pnpm --filter @brokeriq/shared build
cd apps/mobile/android
EXPO_PUBLIC_API_URL=https://brokeriqapi.mymultimeds.com/api ./gradlew assembleRelease
# केवल अलग से अधिकृत Play release के लिए: ./gradlew bundleRelease
```

Signing properties न मिलने पर release build fail होता है। Artifact को `apksigner verify --print-certs` से जाँचें; direct APK update के लिए certificate पिछले installed release से मिलना चाहिए। Upgrade के लिए app uninstall न करें: unsynced local drafts खो सकते हैं। अलग signature होने पर पहले account drafts/imports का recovery और synchronization सत्यापित करें।

## Broker-first listing draft

- नाम: BrokerIQ — Broker Workspace
- संक्षिप्त विवरण: Gurgaon brokers के लिए inventory, requirements, follow-ups और source capture।
- मुख्य workflow: आज का काम; Inventory और Area Directory; Leads & Requirements; Inbox; Automation & Housing।
- Share/Paste/Export से incoming information review queue में आती है। WhatsApp groups को स्वतः पढ़ने का दावा न करें। Provider credentials/configuration के बाद ही संबंधित connector चालू होता है।
- Area Directory public source identities दिखाती है। Registration या map position किसी unit की current availability या exhaustive city coverage की पुष्टि नहीं है।
- Launch login firm/admin द्वारा provision होता है; public signup बंद है। App screenshots वास्तविक current APK से लें।

## Store submission से पहले

Physical Android device acceptance, unresolved source review और live provider checks अभी खुले हैं; [RELEASE_HANDOFF.md](RELEASE_HANDOFF.md) देखें। यदि Play Console submission किया जाए तो reviewer account अलग, scoped और owner-authorized हो; super-admin credentials reviewer login के रूप में साझा न करें।

Data Safety, app access, privacy policy और account deletion declarations actual release manifest, enabled workflows, server retention और configured providers से मिलाकर भरें। पुराने consumer release की declarations reuse न करें। Current Android launch config contacts, fine/coarse location और microphone permissions block करता है; camera/notifications और system-selected uploads को actual merged manifest/runtime prompts से सत्यापित करें। Encryption-at-rest, free provider usage या third-party sharing के बारे में blanket claims न करें।

Public policy/deletion routes repository में मौजूद हैं; content और operational handling को launch review में जाँचना होगा। Store graphics, Console declarations और publishing इस checkpoint में submit नहीं हुए हैं।
