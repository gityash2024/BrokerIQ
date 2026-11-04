# Provider and route checkpoint, 4 November 2026

## Staging provider evidence

Build 52 (`49c158f42c767cedb429545e86e8e510f4a24681`) served these checks. Olive Estate Broker Admin completed password and real email OTP in Chrome. The platform's transactional delivery uses Zoho. CRM Gmail has a separate OAuth client and organization grant.

Google project `brokeriq-crm` has Gmail API enabled and a dedicated web OAuth client with the BrokerIQ API callback. The app remains External / Testing with one authorized test mailbox. The two declared scopes are `gmail.readonly` and `gmail.send`. The platform secret and firm refresh token are encrypted. Current Broker Admin session consent returned successfully to the firm integration screen. A refreshed access token returned the expected profile. A single self-addressed diagnostic email reached both Sent and Inbox, verified by reading that provider message ID. The test created no lead or conversation in live business data. Client-specific production email reply/sync and provider revocation acceptance are open. Production Gmail verification remains open.

Textbee accepted one authorized diagnostic SMS using SIM subscription 3 and the sender ending 0802, to the user's number ending 6926. Textbee recorded sent at **02:28:11 IST** and delivered at **02:28:12 IST**. The signed sent and delivered callbacks reached the staging API and their records are retained. The separate diagnostic has no CRM message association. Live CRM trail and inbound reply acceptance are open. BrokerIQ inbound SMS is off. The provider reports its Android receive setting enabled, so review the device-side receive filters before enabling a BrokerIQ inbound subscription.

## Role and account checks

Commit `e5ba668` adds the explicit User/Broker Admin role declaration on the existing broker onboarding endpoint. The legacy KYC export URL deliberately accepts Broker Admin for its own firm. A real PostgreSQL case supplies a foreign firm ID and foreign selected document ID and verifies neither exposes the foreign record. The platform KYC list and review endpoints reject that Broker Admin.

The registered route audit discovers 537 HTTP route declarations and probes the 360 non-public routes with explicit role restrictions. It recorded 1,391 forbidden requests in full-platform mode and 726 in broker-first mode. Both runs pass the independent Admin/Broker namespace checks. The suite exercises real HTTP, JWT, device sessions, guards and PostgreSQL. Allowed actions, record scoping, browser screens and Android remain distinct coverage dimensions.

The full isolated API regression passes 442 cases with 30 conditional skips. One earlier run hit a share-kit image generation timeout during a host interruption. The targeted rerun passed without increasing the timeout. A later run exposed a reused stub Google subject in the persistent test database. The fixture now assigns a unique subject to each isolated account. Actual account binding remains enforced. This code is newer than the pinned Build 53 candidate.

The local 20-session workload recorded 257 rounds over 8,093 elapsed seconds, with 10,280 list reads, 5,140 details, 980 mutations and 200 refreshes. The corresponding p95 latencies were 74, 50, 48 and 101 ms. The harness passed. The observed round count is below the expected uninterrupted ten-second cadence, so continuous soak and staging performance acceptance remain open.
