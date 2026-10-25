# ADR: Yarvix-owned WhatsApp onboarding for BrokerIQ

**Status:** Yarvix business verification approved; BrokerIQ WhatsApp advanced-permission App Review in progress; Rahul client connection not yet started
**Date:** 2026-10-24 (Asia/Kolkata)
**Decider:** Product owner, in this chat

## Current execution scope (owner update, 2026-10-24)

The owner has limited the immediate goal to one connection: Rahul's existing WhatsApp Business app to Rahul's own BrokerIQ organization, using Meta's supported coexistence route. Future multi-broker automation remains deferred. Do not turn the customer's app or Meta assets into BrokerIQ's shared provider account.

This narrows the implementation order; it does not waive the existing-app preservation or free-only constraints below. Ordinary number registration previously returned error 2655122 and is not a safe substitute for coexistence. A provider/eligibility prerequisite that remains required by Meta must be reported rather than bypassed. Rahul has logged back into his existing Meta account.

After reviewing the exact Meta dialog, the owner explicitly approved accepting Tech Provider Terms and starting independent Tech Provider onboarding on the existing Olive Estate app, solely to pursue Rahul's connection. This is an exception to the earlier deferred-provider execution order, not authorization to make this app BrokerIQ's shared multi-broker provider. No new personal account or Yarvix portfolio was created. Meta now exposes Embedded Signup Builder and reports **0 of 2 steps complete**: Business Verification and App Review remain required. The verification form currently requires the real legal business type; the owner has been asked for Rahul's legal name, address, email and website rather than guessing or substituting Yarvix details. No verification application or App Review submission has been completed.

Live inspection also distinguishes two states: Rahul's real number is listed as Connected in the existing business-app messaging account, while the developer app's separate API setup entry is Unverified and has webhooks disabled. These are different assets; neither the business-app Connected badge nor the Meta test number proves BrokerIQ Cloud API access. No number verification OTP, migration, disconnection or registration was performed during this inspection.

The owner subsequently confirmed Rahul does not have the requested legal business documentation; Yarvix has the developer-company documentation. The unsubmitted Olive Estate verification form was closed without selecting a legal business type or submitting business details. Do not use Yarvix documents to verify Olive Estate, and do not treat a broker customer as the software provider merely to bypass provider verification.

On 2026-10-25, the owner created the BrokerIQ Meta app in the **Yarvix Technologies Private Limited** portfolio and explicitly approved the WhatsApp Platform and Independent Tech Provider terms. Yarvix business verification is now shown as **Approved** in Meta Business Suite. Meta Developer currently shows the separate App Review for advanced `whatsapp_business_messaging` and `whatsapp_business_management` permissions as **In review**. Until that review completes, do not start Rahul's embedded-signup/coexistence flow, create a permanent token, subscribe a webhook, or verify Rahul's number. No Rahul number, WABA, access token, group, chat, message history, business profile, payment method, or billing setting has been altered.

The safe architecture remains a verified software provider (Yarvix) onboarding Rahul as a client. Client eligibility and any Meta-requested business checks must still be respected; no promise of document-free approval is made.

Bulk export and edit-form fixes follow the WhatsApp connection work. No successful connection or end-to-end WhatsApp verification has been recorded yet.

## Context

BrokerIQ is a product of Yarvix Technologies Private Limited. The currently inspected Meta app, Olive Estate, belongs to a broker customer and must not become BrokerIQ's shared platform-provider app. Its registered API test number does not establish access to the customer's Business app number; see the live asset distinction above.

The ordinary Add phone number flow rejected the customer's existing Business app number with Meta error 2655122. No migration, disconnection, account deletion, or successful number registration was performed. The customer's existing groups, chats, data and business account must remain intact.

The owner has approved coexistence's documented feature limitations while requiring groups and ordinary chats to remain safe. The owner has explicitly forbidden payment methods, paid providers and chargeable messaging activation during this setup.

## Decision

- Keep Yarvix's Meta business portfolio and BrokerIQ provider app separate from each broker's portfolio and WhatsApp assets.
- Use an existing Facebook account controlled by the product owner for Yarvix administration. Do not create a fictitious personal identity or make the broker's login the provider owner.
- Reuse a Yarvix business portfolio if it exists; otherwise create it using owner-confirmed business details, contact email and the required Meta consent.
- Use Meta's supported Embedded Signup coexistence flow. Never ask an existing Business app user to disconnect/delete the app account to pass normal Cloud API registration.
- Keep manual credentials as an advanced, backward-compatible path for already-provisioned API accounts. Ordinary brokers should use a guided Connect WhatsApp journey.
- Persist app secrets and broker tokens only through encrypted platform SystemSetting / organization OrgSetting. Never return an access token or app secret to browser/native clients.
- Bind onboarding sessions to an authenticated BROKER_ADMIN and firm; validate provider-returned assets server-side before saving, and reject replayed or expired completion attempts.
- Do not automatically import old messaging history. If offered by Meta, the broker chooses whether to share it. Group history is not synchronized through coexistence and remains in the Business app.
- Do not call number migration/disconnection or paid template sends during onboarding. Native entry should open a first-party web onboarding surface rather than embedding Meta login in an insecure WebView.

## Options considered

| Option | Cost and ownership | Existing app | Decision |
| --- | --- | --- | --- |
| Customer app as provider | Incorrect customer/platform boundary | Risk of setup confusion | Rejected |
| Normal Cloud API registration | Direct API, separate lifecycle | Requires migration/disconnection for this number | Rejected |
| Yarvix provider app + coexistence | No paid intermediary selected; Meta messaging prices still apply | Supported continuation of Business app | Selected |
| Third-party paid Solution Partner | Additional vendor/billing commitment | May offer coexistence | Outside current authorization |
| Unofficial QR/WhatsApp Web automation | Unsupported account/session handling | Unreliable business continuity | Rejected |

## Free-only boundary

Meta's pricing page states service replies within a customer-initiated 24-hour service window are free. Template messages outside applicable free conditions may be charged. A Housing lead arriving via CRM is not itself a WhatsApp inbound message and does not open that window.

Therefore this setup must not promise free proactive Housing-to-WhatsApp messaging. Keep chargeable sends/campaigns disabled and do not add a card, credit line, subscription, paid BSP or payment channel. If Meta makes a billing commitment mandatory for a later step, stop that step and report the limitation.

## Consequences

One-time provider setup and applicable Meta verification/review are platform responsibilities. Broker onboarding should then expose clear steps, cancellation, reconnect and connection errors rather than developer credential instructions. Meta eligibility/review is an external dependency, not an application test result.

Coexistence preserves ordinary app usage and groups but changes certain app features. The inspected official documentation lists broadcast-list restrictions, changes to disappearing/view-once/live-location messaging and companion-device relinking. These limitations must be shown before connection; never promise identical behavior for every Business app feature.

## Action items

The Yarvix/platform items below are deferred. Current next steps are Rahul's existing login, supported coexistence eligibility/configuration, organization-scoped credentials/webhooks, and a customer-initiated test conversation with the authorized test recipient.

- [x] Owner's Facebook login and confirmed app contact email.
- [x] Yarvix portfolio identity/ownership verified; business details supplied where required.
- [x] BrokerIQ app created under that portfolio with owner-approved Meta terms.
- [ ] Meta App Review for `whatsapp_business_messaging` and `whatsapp_business_management` approved.
- [ ] Current supported Embedded Signup configuration, allowed domains and callbacks configured.
- [ ] Guided broker onboarding, server-side asset validation, encrypted credential persistence and webhook routing implemented/tested.
- [ ] Customer reconnects using the existing Business app coexistence choice and confirms on their phone.
- [ ] Test one customer-initiated conversation with the expressly authorized test recipient; inspect delivery and inbound webhook evidence. Do not test-send to real Housing leads.

## Evidence and sources

Inspected live Meta developer UI and official documentation on 2026-10-24 and 2026-10-25. BrokerIQ is now a Yarvix-owned Meta app; no payment method was added at this checkpoint.

- [Meta coexistence requirements and feature comparison](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [WhatsApp Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)

The deferred 300 MB import changes are retained separately in a local Git stash named `codex: deferred 300MB import work; WhatsApp priority 20261024`; they are unshipped. The reported nullable-field edit-form defect remains queued after WhatsApp setup.
