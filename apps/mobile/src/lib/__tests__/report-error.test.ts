import { reportAppError } from '../report-error';

describe('app error reporting', () => {
  const fetchMock = jest.fn(async () => ({ ok: true }));
  beforeAll(() => {
    (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
  });

  it('sends a crash once per session and never throws', () => {
    reportAppError(new Error('boom in property screen'), '/property');
    reportAppError(new Error('boom in property screen'), '/property');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toMatchObject({ source: 'MOBILE', message: 'boom in property screen', route: '/property' });
  });

  it('accepts non-Error values', () => {
    expect(() => reportAppError('plain string failure')).not.toThrow();
  });
});
