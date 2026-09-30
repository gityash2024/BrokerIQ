# BrokerIQ — UI writing & code style guide

यह guide web (site, account, broker CRM, admin) और mobile app — दोनों पर लागू है। नई screen या नया text लिखते समय इसे follow करें ताकि पूरा product एक आवाज़ में बोले और 13 भाषाओं का translation सही बैठे।

## 1. भाषा और लहजा

- **Source language = Hinglish** (Devanagari Hindi + आम English शब्द)। Translation इसी source string को key बनाकर होता है (`packages/shared/src/i18n`), इसलिए text बदलने पर उसका translation भी दोबारा चाहिए।
- आदर वाला "आप" — कभी "तुम/तू" नहीं।
- छोटा और सीधा: एक sentence में एक बात। Technical शब्द (OTP, KYC, RERA, lead, listing) वैसे ही English में।
- Error message बताए **क्या हुआ + अब क्या करें**: "Phone number गलत है — 10 अंकों का number डालें"।
- Empty state: क्या नहीं है + अगला कदम ("अभी कोई lead नहीं — पहली lead जोड़ें")।
- कोई mock/demo text नहीं; numbers असली हों, वरना stat छिपाएँ (`showStat`, `STAT_MIN`)।

## 2. Buttons (एक ही शब्द हर जगह)

| काम | Label | ध्यान दें |
| --- | --- | --- |
| सहेजना | **Save** | "Save करें" नहीं |
| रद्द | **Cancel** | |
| बदलना | **Edit** | |
| मिटाना | **Delete** (हमेशा के लिए) / **Remove** (list से हटाना) | Delete पर confirm dialog ज़रूरी |
| भेजना (message, review, form, invoice) | **भेजें** | "Send"/"Submit" नहीं |
| दोबारा | **Retry** (छोटा button) / "दोबारा कोशिश करें" (पूरे page का error) | |
| Login | **Login** (button) / "Login करें" (sentence/CTA) | |
| बड़े CTA | क्रिया "…करें": "Property post करें", "Visit book करें" | |

Admin actions: **Block / Unblock**, **Approve / Reject**, **Hide / Publish** — हर action पर reason लें और audit log लिखें।

## 3. शब्दावली (glossary)

| शब्द | मतलब / कब इस्तेमाल करें |
| --- | --- |
| Broker | Agent/firm (dealer, agent नहीं) |
| Firm | Broker की company (Organization) |
| Lead | Broker के CRM में संभावित client |
| Enquiry | Site/app से आई पूछताछ (lead बनने से पहले) |
| Listing / Property | Broker के लिए "listing", tenant/user के लिए "property" |
| Visit | Site visit (in-person या video) |
| Deal | Close हुआ किराया/सौदा |
| Owner | मकान-मालिक (landlord) |
| Tenant | किरायेदार |
| Co-broking | दो brokers की साझा deal |
| Verified | BrokerIQ team ने जाँचा (सिर्फ़ असली verification पर) |

## 4. Status labels

Status के labels सिर्फ़ `packages/shared/src/labels.ts` से आते हैं — screens में hard-code न करें। रंग: LIVE/ACTIVE = success, PENDING = warning, REJECTED/BLOCKED = danger, DRAFT/EXPIRED = neutral।

## 5. Translation (13 भाषाएँ)

1. नया text लिखें (source Hinglish)।
2. `node scripts/i18n/extract.mjs` — catalog बनता है (web, mobile, shared labels, API exception messages)।
3. नए keys `scripts/i18n/extra-keys.json` में जोड़ें, हर भाषा का `scripts/i18n/batches/<lang>.x.txt` (`<index>\t<translation>`) लिखें।
4. `node scripts/i18n/merge.mjs scripts/i18n/batches` — warnings (`{n}` गिनती, अंक, brand नाम) शून्य हों।
- नाम, पते, user का लिखा text, phone/email: web पर `data-no-i18n`, mobile पर translate न करें।
- API के user-facing errors: `throw new XxxException('साफ़ Hinglish message')` — extractor इन्हें उठाता है; web toast DOM translator से और mobile `errorMessage()` → `tr()` से अनुवाद होता है।

## 6. Code style

- Prettier (`printWidth 160`, single quotes) + ESLint flat config — `pnpm lint`, `pnpm format`।
- Request body का type zod schema से: `@Body(new ZodPipe(X)) body: z.infer<typeof X>`।
- Credentials कभी code में नहीं — `ConfigResolver` (org → platform → env); integration न हो तो `IntegrationNotConfiguredException`।
- नया feature = `GROWTH_FEATURES` में switch (`defaultOn`) + API `@Feature(key)` + web/mobile `useFlag(key)`।
- Paid-only UI `isGateOpen(cfg, 'paid')` / `useFreeMode()` के पीछे।
- हर module के बाद: typecheck, unit + e2e tests, commit, push।
