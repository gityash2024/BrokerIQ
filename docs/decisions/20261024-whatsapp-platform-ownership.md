# ADR: Yarvix-owned WhatsApp onboarding for BrokerIQ

**Status:** Accepted ownership and safety constraints; Meta assets and implementation pending
**Date:** 2026-10-24 (Asia/Kolkata)
**Decider:** Product owner, in this chat

## Context

BrokerIQ is a product of Yarvix Technologies Private Limited. The currently inspected Meta app, Olive Estate, belongs to a broker customer and must not become BrokerIQ's platform-provider app. Its current registered API asset is a Meta test number, not proof that the customer's Business app number is connected.

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

- [ ] Owner's Facebook login and confirmed app contact email.
- [ ] Yarvix portfolio identity/ownership verified; business details supplied where required.
- [ ] BrokerIQ app created under that portfolio with owner-approved Meta terms.
- [ ] Tech Provider/access requirements and any business verification/App Review completed.
- [ ] Current supported Embedded Signup configuration, allowed domains and callbacks configured.
- [ ] Guided broker onboarding, server-side asset validation, encrypted credential persistence and webhook routing implemented/tested.
- [ ] Customer reconnects using the existing Business app coexistence choice and confirms on their phone.
- [ ] Test one customer-initiated conversation with the expressly authorized test recipient; inspect delivery and inbound webhook evidence. Do not test-send to real Housing leads.

## Evidence and sources

Inspected live Meta developer UI and official documentation on 2026-10-24. No provider app was created and no payment method was added at this checkpoint.

- [Meta coexistence requirements and feature comparison](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [WhatsApp Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)

The deferred 300 MB import changes are retained separately in a local Git stash named `codex: deferred 300MB import work; WhatsApp priority 20261024`; they are unshipped. The reported nullable-field edit-form defect remains queued after WhatsApp setup.
