# Local OTP testing

Run from the repository root with local PostgreSQL on `127.0.0.1:5432` and a local database role that can create databases.

```sh
pnpm --filter @brokeriq/shared build
pnpm --filter @brokeriq/api qa:otp
```

Each run creates a new `brokeriq_test_otp_*` database and generates local accounts for all roles. It prints the paths to two private files, `accounts.json` and `inbox.jsonl`. Keep these files on your machine. They contain test passwords and captured messages.

Start the Web app in a second terminal.

```sh
NEXT_PUBLIC_API_URL=http://127.0.0.1:3098 API_INTERNAL_URL=http://127.0.0.1:3098 pnpm --filter @brokeriq/web exec next dev --hostname 127.0.0.1 --port 3312
```

Use `http://localhost:3312` and sign in with a generated account. Use the same local API in a Mobile development build. For an Android emulator run `adb reverse tcp:3098 tcp:3098` and set `EXPO_PUBLIC_API_URL=http://127.0.0.1:3098/api` in the development bundle. An iOS simulator can use the same loopback URL.

Request a code through the existing screen. Follow the printed inbox file with `tail -f <inbox.jsonl>` and enter the code on the row for your recipient. The QA adapter accepts email addresses under `.test` and WhatsApp destinations listed in `accounts.json`. The inbox also contains agreement links sent to those recipients. BrokerIQ's current OTP flows issue codes via email or WhatsApp. Ordinary SMS messaging is separate.

The generated Owner account is already verified and follows the existing Owner sign-in rule. To exercise first-time verification, send an invitation to a new `.test` account and sign up using the captured link. Stop the local process when done. The database and private files remain available until you remove that run's fixtures.
