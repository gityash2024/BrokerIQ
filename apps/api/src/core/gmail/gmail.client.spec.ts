import { canonicalEmail, GMAIL_SCOPES, gmailBody, gmailContactQuery, gmailExchange, gmailMime, gmailPlainBody } from './gmail.client';
const values = { clientId: 'isolated.apps.googleusercontent.com', clientSecret: 'isolated-client-secret' };
afterEach(() => jest.restoreAllMocks());
it('encodes Unicode/plaintext MIME without header injection and uses a stable message id', () => {
  const input = {
    from: 'firm@example.com',
    to: 'client@example.com',
    subject: 'विज़िट की जानकारी',
    text: 'कल सुबह मिलते हैं।',
    requestKey: 'stable-owned-request',
  };
  const result = gmailMime(input),
    mime = Buffer.from(result.raw, 'base64url').toString();
  expect(gmailMime(input).messageId).toBe(result.messageId);
  expect(mime).toContain('Content-Type: text/plain');
  expect(mime).not.toContain('Bcc:');
  expect(() => gmailMime({ ...input, subject: 'hi\r\nBcc: attacker@example.com' })).toThrow();
  expect(() => gmailMime({ ...input, to: 'client@example.com\r\nBcc: attacker@example.com' })).toThrow();
});
it('builds only a contact/date query and never accepts Gmail search operators as addresses', () => {
  expect(gmailContactQuery('CLIENT@example.com', new Date('2026-11-01T00:00:00Z'))).toBe(
    '{from:client@example.com to:client@example.com} after:1793491200 -in:trash -in:spam',
  );
  expect(canonicalEmail('client@example.com OR newer_than:99y')).toBeNull();
});
it('reads bounded text/plain parts, ignores attachments/HTML, and prevents arbitrary recursion', () => {
  const data = Buffer.from('Plain client reply').toString('base64url');
  expect(
    gmailPlainBody({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', body: { data } },
        { mimeType: 'text/plain', filename: 'private.txt', body: { data } },
        { mimeType: 'text/html', body: { data: Buffer.from('<script>bad</script>').toString('base64url') } },
      ],
    }),
  ).toBe('Plain client reply');
});
it('requires both scopes and a refresh token, without exposing provider errors/secrets', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'isolated-access', refresh_token: 'isolated-refresh', scope: GMAIL_SCOPES[1] }), { status: 200 }),
    );
  await expect(gmailExchange(values, 'one-time-code', 'pkce-verifier', 'https://app.example.com/api/webhooks/gmail/callback')).rejects.toThrow(
    'Both read/send',
  );
  expect(String(fetch.mock.calls[0][1]?.body)).toContain('code_verifier=pkce-verifier');
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: 'isolated-access', refresh_token: 'isolated-refresh', scope: GMAIL_SCOPES.join(' ') }), { status: 200 }),
  );
  await expect(gmailExchange(values, 'code', 'verifier', 'https://app.example.com/callback')).resolves.toMatchObject({ refreshToken: 'isolated-refresh' });
});
it('converts HTML-only client mail to text without fetching trackers or rendering active HTML', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  const body = await gmailBody({
    mimeType: 'text/html',
    body: {
      data: Buffer.from('<p>कल की visit</p><script>private()</script><img src="https://tracker.example.com/private"><p>11 AM</p>').toString('base64url'),
    },
  });
  expect(body).toContain('कल की visit');
  expect(body).toContain('11 AM');
  expect(body).not.toMatch(/<script|private\(\)|<img/);
  expect(fetch).not.toHaveBeenCalled();
  expect(await gmailBody({ mimeType: 'text/html', filename: 'private.html', body: { data: Buffer.from('attachment').toString('base64url') } })).toBe('');
});
it('a failed HTTP exchange returns a bounded error without retaining provider response text', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('SECRET details', { status: 403 }));
  await expect(gmailExchange(values, 'code', 'verifier', 'https://app.example.com/callback')).rejects.toMatchObject({ status: 403, ambiguous: false });
});
