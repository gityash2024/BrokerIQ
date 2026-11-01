import { ZohoMailService } from './zoho-mail.service';
const values = {
  region: 'IN',
  clientId: 'isolated-client',
  clientSecret: 'isolated-secret',
  refreshToken: 'isolated-refresh',
  fromEmail: 'hello@company.test',
};
const input = { to: 'recipient@e2e.test', subject: 'Isolated contract fixture', html: '<p>Example</p>' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const account = { accountId: '12345', enabled: true, emailAddress: [{ mailId: values.fromEmail, isConfirmed: true }] };
describe('Zoho HTTPS adapter contracts (stubbed provider, not live acceptance)', () => {
  let service: ZohoMailService, fetcher: jest.SpyInstance;
  beforeEach(() => {
    service = new ZohoMailService();
    fetcher = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url) =>
        String(url).endsWith('/token')
          ? json({ access_token: 'isolated-access', expires_in: 3600 })
          : String(url).endsWith('/api/accounts')
            ? json({ status: { code: 200 }, data: [account] })
            : json({ status: { code: 200 }, data: { messageId: 'test-message' } }),
      );
  });
  afterEach(() => fetcher.mockRestore());
  it('sends only through the selected data center and preserves BCC privacy', async () => {
    await expect(service.send(values, { ...input, bcc: ['hidden@e2e.test'] })).resolves.toEqual({ accepted: true, messageId: 'test-message' });
    const calls = fetcher.mock.calls;
    expect(calls.map((call) => call[0])).toEqual([
      'https://accounts.zoho.in/oauth/v2/token',
      'https://mail.zoho.in/api/accounts',
      'https://mail.zoho.in/api/accounts/12345/messages',
    ]);
    expect(String(calls[0][0])).not.toContain(values.clientSecret);
    const body = JSON.parse(calls[2][1].body);
    expect(body.toAddress).toBe(input.to);
    expect(body.bccAddress).toBe('hidden@e2e.test');
    expect(body.content).not.toContain('hidden@e2e.test');
  });
  it('shares one refresh across twenty concurrent requests and refreshes after credential rotation', async () => {
    await Promise.all(Array.from({ length: 20 }, () => service.send(values, input)));
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/token'))).toHaveLength(1);
    await service.send({ ...values, refreshToken: 'rotated-isolated-refresh' }, input);
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/token'))).toHaveLength(2);
  });
  it('never sends for an unauthorized alias or an arbitrary provider URL', async () => {
    await expect(service.send({ ...values, fromEmail: 'other@company.test' }, input)).rejects.toThrow('confirmed alias');
    expect(fetcher.mock.calls.some((call) => String(call[0]).endsWith('/messages'))).toBe(false);
    await expect(service.send({ ...values, region: 'https://attacker.test' }, input)).rejects.toThrow('configured');
  });
  it('fails closed for disabled accounts and aliases without positive confirmation', async () => {
    for (const row of [
      { ...account, enabled: false },
      { ...account, outgoingBlocked: true },
      { ...account, emailAddress: [{ mailId: values.fromEmail }] },
    ]) {
      fetcher.mockImplementation(async (url) =>
        String(url).endsWith('/token') ? json({ access_token: 'isolated-access' }) : json({ status: { code: 200 }, data: [row] }),
      );
      await expect(service.send(values, input)).rejects.toThrow('confirmed alias');
    }
    expect(fetcher.mock.calls.some((call) => String(call[0]).endsWith('/messages'))).toBe(false);
  });
  it('rejects OAuth HTTP-200 errors without exposing secret provider response content', async () => {
    fetcher.mockResolvedValue(json({ error: 'invalid_grant', error_description: 'sensitive provider text' }));
    await expect(service.send(values, input)).rejects.toThrow('invalid_grant');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not retry a possibly accepted send after a timeout', async () => {
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith('/token')
        ? json({ access_token: 'isolated-access' })
        : String(url).endsWith('/api/accounts')
          ? json({ status: { code: 200 }, data: [account] })
          : Promise.reject(new Error('timeout')),
    );
    await expect(service.send(values, input)).rejects.toThrow('no automatic resend');
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/messages'))).toHaveLength(1);
  });
  it('refreshes and retries only an explicit authentication rejection', async () => {
    let sends = 0;
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith('/token')
        ? json({ access_token: 'isolated-access-' + sends })
        : String(url).endsWith('/api/accounts')
          ? json({ status: { code: 200 }, data: [account] })
          : ++sends === 1
            ? json({ status: { code: 401 } }, 401)
            : json({ status: { code: 200 }, data: { messageId: 'after-refresh' } }),
    );
    await expect(service.send(values, input)).resolves.toMatchObject({ accepted: true, messageId: 'after-refresh' });
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/token'))).toHaveLength(2);
  });
  it('rejects provider-level failure even when HTTP status is successful', async () => {
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith('/token')
        ? json({ access_token: 'isolated-access' })
        : String(url).endsWith('/api/accounts')
          ? json({ status: { code: 200 }, data: [account] })
          : json({ status: { code: 400 } }),
    );
    await expect(service.send(values, input)).rejects.toThrow('Mail API rejected');
  });
  it('exchanges a short-lived grant in the POST body and requires a refresh token', async () => {
    fetcher.mockResolvedValue(json({ refresh_token: 'generated-isolated-refresh' }));
    await expect(service.authorize(values, 'short-lived-code')).resolves.toBe('generated-isolated-refresh');
    expect(String(fetcher.mock.calls[0][0])).not.toContain('short-lived-code');
    expect(fetcher.mock.calls[0][1].body.get('code')).toBe('short-lived-code');
  });
});
