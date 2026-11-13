# Gmail production review - current evidence

13 November 2026, Google Cloud project `brokeriq-crm`.

- Branding: Google Verification Center visibly reports verified.
- Data access: still visibly unverified.
- Existing scopes remain `gmail.readonly` and `gmail.send`; no broader scope was added.
- Saved sensitive-scope justification: reviewed CRM messages/replies from the connected mailbox, provider thread identifiers, firm/lead authorization and encrypted OAuth tokens.
- Saved restricted-scope justification: bounded selected-contact sync, full message text needed for Inbox, rejection of unrelated recipients/CC/BCC and security-code messages, no advertising/model training.
- Saved use categories: Email client and Email productivity.
- Save result observed: `Data access changes saved!`.

## Required recording and submission

Google's Data Access page requires a YouTube demo showing all assigned OAuth clients and their scope use. A still image, narrated slide deck or a fabricated consent page is not a replacement for the actual flow.

Use only the authorized test mailbox and QA contacts. Record in English:

1. Open BrokerIQ staging as the actual Broker Admin. Open Connectors -> Gmail and show the connected mailbox/disconnect controls without showing tokens or client secrets.
2. Start the genuine Connect Gmail flow. Show the consent application's name and the exact read/send permissions requested. If the unverified warning appears, include it. Do not publish passwords, OTPs, other private mailbox content or credentials.
3. Return to the connected CRM. Open only the QA client's email conversation. Show Sync importing the QA reply and the lead timeline linkage.
4. Compose and manually send a reviewed QA reply, showing provider message/thread status. Do not send to customer contacts.
5. Show disconnect/revocation controls and the public privacy policy's Gmail Limited Use statement.
6. Upload the real recording as an accessible unlisted YouTube video. Put that actual URL in Google Auth Platform -> Data Access -> Demo video, save and inspect Prepare for verification for remaining requirements.

Read and obtain the account owner's acceptance for any new legal/security-assessment commitments before submission. Submission, review, restricted-scope security assessment (if requested) and final approval are distinct states. Do not mark approval as completed until Google's Verification Center confirms it.

The computer-use tool could read and save the justifications, but later returned stale/empty page contents and timed out when opening the live broker demo. No demo URL or final review approval has been fabricated.
