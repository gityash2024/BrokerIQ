# Email integration evidence — 1 November 2026

- Initial sender: gityash216@gmail.com. User enabled Google 2-Step Verification and created the app credential. This initial choice has now been superseded by the user's Zoho/company-sender instruction.
- Saved through the deployed SettingsService/CryptoService into SystemSetting integration.smtp, AES-256-GCM encrypted pass field. No prior SMTP database row existed. No credential is in this report or repository.
- Production Gmail SMTP connection timed out after a bounded 45-second test. Separate TCP checks on 465 and 587 also timed out before authentication.
- Local computer connected to both ports. Gmail SMTP authentication and a self-addressed diagnostic email succeeded. The exact diagnostic subject was `BrokerIQ Gmail authentication check — local only`; Gmail inbox visibly received it at 13:30 IST. This is credential/mailbox evidence, not production delivery.
- Production SMTP is disabled with its encrypted configuration retained and failure recorded, preventing broken email paths from waiting on blocked SMTP connections.
- User selected the existing YARVIX Zoho login and its `hello@yarvixhq.com` sender. The alias was visibly present in the authenticated Zoho Mail From selector (India data center). This is sender-availability evidence, not API authorization or delivery evidence.
- User completed Zoho identity re-verification, created the Self Client and generated its ten-minute authorization code with the two documented scopes. Browser was reconnected as the Yash Chrome profile after an intermediate disabled-access block.
- Grant and existing client credentials were read from visible Console fields and streamed through a private mode-0600 FIFO into SSH stdin. No plaintext credential file, shell argument, environment-secret addition or repository secret was created. FIFO was removed immediately. Production CryptoService encrypted Client Secret and refresh token in SystemSetting `integration.zoho_mail`.
- An isolated operational adapter under `/opt/brokeriq/ops/zoho-20261101` sent one HTTPS diagnostic from the production server using sender `hello@yarvixhq.com` to the user-authorized Gmail recipient. Zoho accepted it with message ID `1793524429583108000`. This did not modify/reload the live application checkout or apply any migration.
- Gmail inbox visibly received and opened the exact diagnostic at **1 November 2026, 14:43 IST**, sender `hello@yarvixhq.com`, recipient `gityash216@gmail.com`. Screenshot: `output/playwright/zoho-production-server-delivery.png`. This is actual server-to-provider-to-inbox evidence, not a local-computer SMTP result.
- Setup intentionally remains disabled until the application release supports this provider and application-level acceptance completes. No provider selection changed. OTP, recovery and invitation journeys remain separate release gates.

## Zoho HTTPS implementation checkpoint (not deployed)

- Fixed data-center allowlist, POST-body OAuth secrets, encrypted refresh token storage through SettingsService, masked admin responses, bounded requests, shared short-lived access-token refresh and explicit provider selection. No paid or automatic provider fallback.
- Minimum requested scopes: `ZohoMail.messages.CREATE,ZohoMail.accounts.READ`. No message-content read/delete or organization-administration access. Account metadata is read only to identify the authorized, enabled sender account and its confirmed alias.
- Credentials saved without a refresh token remain incomplete. Successful provider testing is required before provider selection. Any credential edit invalidates previous test results. The UI distinguishes disabled, unconfigured, untested, failed and tested states.
- Send timeout or server error is not automatically retried because Zoho may already have accepted the message. Only an explicit authentication rejection allows one refresh/retry. BCC recipients remain separate from public recipients/content.
- Zoho's documented send request has no per-message Reply-To parameter. Replies go to the selected mailbox; a different firm reply destination is included as an explicit mailto link. We do not modify account-wide reply settings or request UPDATE scope. From-name configuration is not a per-message API override.
- Tests use isolated local PostgreSQL and stubbed Zoho responses; none proves an authorized live Zoho connection. Production recovery, invitation and inbox delivery remain OPEN until actual provider and application-release checks pass.

Official API contracts: [Self Client flow](https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html), [account discovery](https://www.zoho.com/mail/help/api/get-all-users-accounts.html), [send email](https://www.zoho.com/mail/help/api/post-send-an-email.html).

DigitalOcean documents default Droplet restrictions on SMTP ports 25, 465 and 587: https://docs.digitalocean.com/support/why-is-smtp-blocked/ . Google app-password authentication works independently of this hosting restriction.

Local private evidence screenshot: output/playwright/smtp-local-authentication-delivery.png (not a public landing/manual image).
