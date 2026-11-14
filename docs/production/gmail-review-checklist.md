# Gmail production review - current evidence

13 November 2026, Google Cloud project `brokeriq-crm`.

- Branding: Google Verification Center visibly reports verified.
- Data access: still visibly unverified.
- Existing scopes remain `gmail.readonly` and `gmail.send`; no broader scope was added.
- Saved sensitive-scope justification: reviewed CRM messages/replies from the connected mailbox, provider thread identifiers, firm/lead authorization and encrypted OAuth tokens.
- Saved restricted-scope justification: bounded selected-contact sync, full message text needed for Inbox, rejection of unrelated recipients/CC/BCC and security-code messages, no advertising/model training.
- Saved use categories: Email client and Email productivity.
- Save result observed: `Data access changes saved!`.

## Recording and submission evidence

Google's Data Access page requires a YouTube demo showing all assigned OAuth clients and their scope use. A still image, narrated slide deck or a fabricated consent page is not a replacement for the actual flow.

Use only the authorized test mailbox and QA contacts. Record in English:

1. Open BrokerIQ staging as the actual Broker Admin. Open Connectors -> Gmail and show the connected mailbox/disconnect controls without showing tokens or client secrets.
2. Start the genuine Connect Gmail flow. Show the consent application's name and the exact read/send permissions requested. If the unverified warning appears, include it. Do not publish passwords, OTPs, other private mailbox content or credentials.
3. Return to the connected CRM. Open only the QA client's email conversation. Show Sync importing the QA reply and the lead timeline linkage.
4. Compose and manually send a reviewed QA reply, showing provider message/thread status. Do not send to customer contacts.
5. Show disconnect/revocation controls and the public privacy policy's Gmail Limited Use statement.
6. Upload the real recording as an accessible unlisted YouTube video. Put that actual URL in Google Auth Platform -> Data Access -> Demo video, save and inspect Prepare for verification for remaining requirements.

Read and obtain the account owner's acceptance for any new legal/security-assessment commitments before submission. Submission, review, restricted-scope security assessment (if requested) and final approval are distinct states. Do not mark approval as completed until Google's Verification Center confirms it.

The actual QA recording was completed on 13 November 2026. It shows the genuine unverified warning and exact Gmail read/send consent, return to Olive Estate, QA Inbox read/sync, a manually reviewed reply to the authorized test recipient, and the public Limited Use policy. Password, OTP and CAPTCHA steps were excluded. The 3m33s edited recording preserves the real sequence, removes idle time and adds English step captions. The owner confirmed the YouTube Terms acknowledgement and Unlisted publication at action time. YouTube visibly confirmed **Video published** with no copyright issues.

- Video: https://youtu.be/tUPaKR6GR2I
- Channel: the owner's existing DevToDrama channel.
- Title: BrokerIQ CRM - Gmail OAuth verification demo - 13 Nov 2026.
- Recorded portal: live Build 60; it is not represented as a Build 61 recording.
- Data Access form: the exact URL is saved; Save and Discard are disabled after saving.
- Final submission completed after the owner confirmed the formal verification and CASA/annual-recertification acknowledgements. Google Verification Center visibly reports **Your app's data access is under review.**
- Google approval and any required CASA assessment remain external gates. No assessment or payment was purchased.

On 14 November, Verification Center initially offered preparation again. The saved scope justifications and demo were present. The owner had approved the two acknowledgements for this submission. After submission, Verification Center visibly reported **Your app’s data access is under review** and offered **View verification progress**. See the [current observation](../evidence/staging-build62-20261114/gmail-review.json). Approval remains pending.
