# Email integration evidence — 1 November 2026

- Requested sender: gityash216@gmail.com. User enabled Google 2-Step Verification and created the app credential.
- Saved through the deployed SettingsService/CryptoService into SystemSetting integration.smtp, AES-256-GCM encrypted pass field. No prior SMTP database row existed. No credential is in this report or repository.
- Production Gmail SMTP connection timed out after a bounded 45-second test. Separate TCP checks on 465 and 587 also timed out before authentication.
- Local computer connected to both ports. Gmail SMTP authentication and a self-addressed diagnostic email succeeded. The exact diagnostic subject was `BrokerIQ Gmail authentication check — local only`; Gmail inbox visibly received it at 13:30 IST. This is credential/mailbox evidence, not production delivery.
- Production SMTP is disabled with its encrypted configuration retained and failure recorded, preventing broken email paths from waiting on blocked SMTP connections.
- User choice pending: Gmail HTTPS API retaining the requested sender, or a verified company-domain sending provider. Production recovery/invitation/email acceptance remains OPEN.

DigitalOcean documents default Droplet restrictions on SMTP ports 25, 465 and 587: https://docs.digitalocean.com/support/why-is-smtp-blocked/ . Google app-password authentication works independently of this hosting restriction.

Local private evidence screenshot: output/playwright/smtp-local-authentication-delivery.png (not a public landing/manual image).
