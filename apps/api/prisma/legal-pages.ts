/**
 * Launch versions of the legal pages (served at /p/privacy and /p/terms). The seed publishes them only
 * while the stored page still has the old "Draft" placeholder — anything edited in Super Admin → CMS →
 * Pages is never overwritten. Have a legal advisor review before scaling up.
 */
export const DRAFT_MARKER = 'Draft — publish करने से पहले';

export const PRIVACY_HTML = `
<p><em>Last updated: 30 September 2026 · BrokerIQ ("हम", "we") — Gurgaon, Haryana का rental marketplace और broker CRM.</em></p>

<h2>1. हम कौन-सा data लेते हैं</h2>
<ul>
<li><b>Account:</b> नाम, email, mobile नंबर, password (hash करके), profile photo, और Google sign-in करने पर Google की basic profile.</li>
<li><b>Listings और enquiries:</b> आपकी डाली गई properties, photos/videos, enquiries, site-visit bookings, chats, reviews और requirements.</li>
<li><b>Brokers:</b> firm details, RERA नंबर, KYC documents (सिर्फ़ verification के लिए), leads, deals, invoices और team.</li>
<li><b>Tenant verification (optional):</b> office email या ID document — सिर्फ़ जब आप खुद verify करें.</li>
<li><b>Location (optional, आपकी अनुमति से):</b> approximate location, दिन में ज़्यादा से ज़्यादा एक बार; background tracking नहीं.</li>
<li><b>Phone contacts (optional, सिर्फ़ app, आपकी अनुमति से):</b> नाम, नंबर और email — सिर्फ़ BrokerIQ की internal team देख सकती है.</li>
<li><b>Technical:</b> device/browser type, app version, push-notification token, और errors (app ठीक करने के लिए).</li>
</ul>
<p>हम कोई card, UPI PIN या bank details नहीं लेते. Rent, token और brokerage का पैसा सीधे users और brokers के बीच जाता है — BrokerIQ पैसा नहीं रखता.</p>

<h2>2. क्यों लेते हैं</h2>
<ul>
<li>Properties दिखाने, enquiries brokers/owners तक पहुँचाने, visits और alerts भेजने के लिए.</li>
<li>Fraud और fake listings रोकने, safety और moderation के लिए.</li>
<li>AI features (listing description, lead summary, assistant, listing-book scan) के लिए: जिस text या photo पर आप AI चलाते हैं, वह processing के लिए हमारे AI providers (जैसे OpenRouter, Groq, Google Gemini) को भेजा जाता है. वे इसे हमारी service देने के लिए process करते हैं.</li>
<li>Service सुधारने के लिए aggregate (नाम-रहित) analytics.</li>
</ul>

<h2>3. किसके साथ share होता है</h2>
<ul>
<li><b>जिस broker/owner को आप enquiry भेजते हैं</b> या जिनका नंबर देखते हैं — उन्हें आपका नाम और नंबर मिलता है.</li>
<li><b>Move-in partners</b> (packers, broadband आदि) — सिर्फ़ जब आप callback माँगें.</li>
<li><b>Service providers</b> जो हमारे लिए काम करते हैं: email, WhatsApp/SMS, push notifications, AI processing, hosting.</li>
<li>क़ानून के अनुसार ज़रूरी होने पर सरकारी अधिकारियों के साथ.</li>
</ul>
<p>हम आपका personal data <b>बेचते नहीं</b>.</p>

<h2>4. कितने समय रखते हैं</h2>
<p>Account active रहने तक. Account delete करने पर profile, saved properties, requirements और chats हटा दिए जाते हैं; क़ानूनी/audit ज़रूरतों वाले records (जैसे invoices) सीमित समय तक रखे जा सकते हैं. Location की आख़िरी 50 entries तक रहती हैं; sharing बंद करते ही हट जाती हैं.</p>

<h2>5. सुरक्षा</h2>
<p>Data India में हमारे अपने server पर रहता है. Documents और photos encrypted रखे जाते हैं, passwords hash किए जाते हैं, और admin access का audit log रहता है.</p>

<h2>6. आपके अधिकार (DPDP Act, 2023)</h2>
<ul>
<li>अपना data देखना, सुधारना और delete करवाना.</li>
<li>Location/contacts sharing कभी भी बंद करना — Profile → Privacy & data sharing.</li>
<li><b>Account delete करना:</b> app में Profile → Edit profile → "Account delete करें", या website पर Account → Profile. पूरी जानकारी: <a href="/account-deletion">/account-deletion</a>.</li>
<li>Consent वापस लेना — इससे पहले की processing पर असर नहीं पड़ता.</li>
</ul>

<h2>7. बच्चे</h2>
<p>BrokerIQ 18 साल से ज़्यादा उम्र के लोगों के लिए है.</p>

<h2>8. Grievance officer / संपर्क</h2>
<p>Privacy से जुड़े सवाल या शिकायत के लिए <a href="/contact">Contact page</a> पर दिए email/phone पर लिखें. हम 30 दिनों में जवाब देते हैं.</p>

<h2>English summary</h2>
<p>We collect account, listing, enquiry and (optionally, with your consent) location and contacts data to run the rental marketplace and broker CRM. Text or photos you run AI features on are processed by our AI providers. We never sell personal data. Money never passes through BrokerIQ. You can view, correct or delete your data and delete your account at any time (see /account-deletion). Contact us via the Contact page.</p>
`.trim();

export const TERMS_HTML = `
<p><em>Last updated: 30 September 2026. BrokerIQ इस्तेमाल करके आप इन शर्तों से सहमत होते हैं.</em></p>

<h2>1. Service</h2>
<p>BrokerIQ Gurgaon, Haryana में rent की properties खोजने, list करने और brokers के लिए CRM tools देने वाला platform है. अभी सारी सुविधाएँ <b>free</b> हैं. आगे paid features आएँ तो पहले से बताया जाएगा और free में ली गई सुविधाएँ बिना सूचना नहीं छीनी जाएँगी.</p>

<h2>2. Account</h2>
<ul>
<li>आपकी उम्र 18+ होनी चाहिए और दी गई जानकारी सही होनी चाहिए.</li>
<li>Password और OTP गोपनीय रखें; आपके account से हुई गतिविधि की ज़िम्मेदारी आपकी है.</li>
<li>Brokers को सही firm details और (जहाँ लागू) RERA registration देना होगा.</li>
</ul>

<h2>3. Listings और content</h2>
<ul>
<li>Listing सच्ची, मौजूदा और आपके अधिकार वाली होनी चाहिए — सही rent, deposit, brokerage और photos के साथ.</li>
<li>हर listing review के बाद live होती है. BrokerIQ किसी भी listing, review या content को बिना कारण बताए छिपा, block या हटा सकता है.</li>
<li>मना है: fake/duplicate listings, भेदभाव वाली भाषा, दूसरों का data, spam, और क़ानून के ख़िलाफ़ कुछ भी.</li>
</ul>

<h2>4. पैसा और deals</h2>
<p>BrokerIQ पैसा नहीं रखता और payment gateway नहीं है. Rent, deposit, token और brokerage सीधे users, owners और brokers के बीच तय होते हैं. <b>Property देखे बिना कोई token/advance न दें.</b> "Token record", invoices और rent receipts सिर्फ़ record के लिए हैं.</p>

<h2>5. Tools की सीमाएँ</h2>
<ul>
<li>Rent agreement एक सामान्य template है, क़ानूनी सलाह नहीं; stamp duty/registration आपकी ज़िम्मेदारी है. OTP से confirm करना stamp paper या registration की जगह नहीं लेता.</li>
<li>Fair rent, commute time और AI से बने text अनुमान हैं — फ़ैसले से पहले ख़ुद जाँचें.</li>
<li>WhatsApp, calls या social posting broker के अपने accounts से होती हैं; उनके नियम और खर्च broker के.</li>
</ul>

<h2>6. Account बंद करना</h2>
<p>आप कभी भी account delete कर सकते हैं. नियम तोड़ने पर BrokerIQ किसी account, firm या listing को suspend/block कर सकता है.</p>

<h2>7. ज़िम्मेदारी</h2>
<p>BrokerIQ users, owners और brokers को जोड़ने वाला platform है; किसी property, deal या व्यक्ति की guarantee नहीं देता. क़ानून द्वारा अनुमत सीमा तक BrokerIQ किसी indirect नुकसान के लिए ज़िम्मेदार नहीं है.</p>

<h2>8. क़ानून</h2>
<p>ये शर्तें भारत के क़ानून से चलती हैं; विवाद Gurugram, Haryana की अदालतों में.</p>

<h2>9. संपर्क</h2>
<p>सवाल या शिकायत: <a href="/contact">Contact page</a>.</p>
`.trim();
