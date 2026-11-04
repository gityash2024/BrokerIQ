import { BROKERIQ_COMPANY } from '@brokeriq/shared';

export const DRAFT_MARKER = 'Draft — publish करने से पहले';

const COMPANY_HTML = `
<p>BrokerIQ is operated by <strong>${BROKERIQ_COMPANY.name}</strong> (CIN ${BROKERIQ_COMPANY.cin}). Registered office: ${BROKERIQ_COMPANY.registeredOffice}.</p>
<p>For support, privacy requests or complaints, email <a href="mailto:${BROKERIQ_COMPANY.supportEmail}">${BROKERIQ_COMPANY.supportEmail}</a> or use the <a href="/contact">BrokerIQ contact form</a>.</p>
`.trim();

export const PRIVACY_HTML = `
<p><em>Policy version 4 November 2026</em></p>
${COMPANY_HTML}

<h2>1. Account, marketplace and CRM</h2>
<p>We use your name, email, optional phone number, profile and sign-in information to manage accounts, verify sign-in, protect sessions and provide support. BrokerIQ processes listings and media, enquiries, client contact details, communications, requirements, visits, invoices and team records to run the marketplace and the broker workspace. Public listing fields and photos appear after publication. Private firm and client records are available according to role, firm and record access.</p>

<h2>2. Verification and device permissions</h2>
<p>KYC submissions can include Aadhaar, PAN, firm documents and three face photos. Pose checks assist capture. Authorized reviewers use the submitted documents and photos to make verification decisions. Camera and media permissions support capture and uploads. Push tokens and technical diagnostics help deliver notifications and troubleshoot the service.</p>
<p>Optional location sharing in the customer account and shift tracking in the broker workspace serve different purposes. With permission, mobile shift tracking collects coordinates, capture time and accuracy during an active shift, including in the background. Authorized managers can view shift history. Pause or end your shift to stop active tracking. You can change device permissions in Android settings. Previously recorded shift history may remain available to the firm.</p>

<h2>3. Connected communications</h2>
<p>Configured services can include Housing, WhatsApp, SMS, email and push. BrokerIQ processes client conversations, message status and related lead activity for the firm. Messaging providers receive the information needed to deliver messages and callbacks. Transactional emails such as sign-in codes and invitations are separate from the firm’s Gmail connector.</p>
<p>When a Broker Admin authorizes Gmail, BrokerIQ uses Gmail read access to find messages for linked client email addresses and Gmail send access to send replies from the connected mailbox. The connector stores supported message text, subjects, participants, timestamps and provider identifiers in the firm’s Inbox and lead timeline. A Broker Admin can disconnect Gmail under Integrations. Disconnecting stops future sync and sending through that connection. Previously imported CRM records can remain.</p>
<p>BrokerIQ uses Google Workspace data to provide the visible Gmail Inbox and client messaging features. It applies Google’s Limited Use requirements and does not use this data for advertising or model training. Read the <a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy">Google Workspace user data policy</a>.</p>

<h2>4. Imports and AI</h2>
<p>When you submit chat exports, scans, photos or voice notes, BrokerIQ may process the content and its source details to prepare CRM records for review. Enabled AI features can process the selected content locally or through the configured provider. Imported chats are not used to train a model automatically. Review extracted fields and suggested actions before relying on them.</p>

<h2>5. Retention, security and your choices</h2>
<p>We retain account and business records to operate the service, preserve authorized firm history, address security incidents and meet applicable obligations. Integration credentials are encrypted and KYC previews require authorized access. Access to records, including review and integration actions, is controlled and may be audited.</p>
<p>You can ask to access, correct or delete personal information, or withdraw optional permissions. The <a href="/account-deletion">account deletion page</a> explains what self-service deletion covers. Firm records, communications, invoices, audit history and backup copies may remain where needed for business continuity, security or applicable obligations. Contact us about a specific retained record or privacy concern.</p>

<h2>हिंदी में सार</h2>
<p>BrokerIQ account, property listings, enquiries और firm CRM चलाने के लिए ज़रूरी जानकारी इस्तेमाल करता है। KYC documents और face photos अधिकृत reviewers देखते हैं। आपकी अनुमति से active shift के दौरान Android background में location दर्ज कर सकता है। Gmail जोड़ने पर linked clients के emails Inbox में आते हैं और उसी mailbox से जवाब जा सकता है। Integrations से Gmail disconnect करें। Imports और AI के सुझाव जाँचकर इस्तेमाल करें। Account deletion और privacy requests के लिए ऊपर दिए संपर्क का इस्तेमाल करें।</p>
`.trim();

export const TERMS_HTML = `
<p><em>Policy version 4 November 2026</em></p>
${COMPANY_HTML}

<h2>1. Using BrokerIQ</h2>
<p>BrokerIQ offers a property marketplace and broker tools for managing inventory, requirements, leads, conversations, follow-ups and site visits. Features depend on account role, firm settings, and available integrations. You must be 18 or older, supply accurate information and keep your password and verification codes private.</p>

<h2>2. Listings, firm access and moderation</h2>
<p>Only publish property details and photos you have the right to share. Keep price, availability, charges and property information current. Brokers are responsible for any registrations and disclosures applicable to their work. BrokerIQ may restrict accounts or remove listings for inaccurate information, abuse, spam or unlawful use. A verification badge reflects an account or firm review and does not guarantee a property or transaction.</p>

<h2>3. Client data and connected services</h2>
<p>Import and use client details, chat exports, documents and media only where you are authorized to do so. Use firm accounts and connected messaging services for legitimate client communication. Respect recipients’ choices, applicable law, and provider terms and charges. Use the team’s permission controls to keep private data within the intended workspace.</p>

<h2>4. Transactions and automated assistance</h2>
<p>Owners, customers and brokers arrange transactions directly. BrokerIQ provides tools to record or coordinate work. Check property particulars, charges and agreement terms before paying or signing. Review AI output and imported records before relying on them. Applicable statutory and consumer rights continue to apply.</p>

<h2>5. Account, privacy and complaints</h2>
<p>Use the <a href="/account-deletion">account deletion page</a> for deletion instructions. See the <a href="/p/privacy">Privacy Policy</a> for data handling and your choices. Contact the operator listed above for support or complaints. These terms are governed by the laws of India, subject to applicable mandatory protections.</p>

<h2>हिंदी में सार</h2>
<p>सही account और property जानकारी दें। OTP गोपनीय रखें और केवल वह data या photos share करें जिनके इस्तेमाल की अनुमति आपके पास है। Listing publish करने से पहले कीमत, availability और charges जाँचें। Payment या agreement से पहले property और शर्तों की पुष्टि करें। AI के सुझाव और imported records review करें।</p>
`.trim();
