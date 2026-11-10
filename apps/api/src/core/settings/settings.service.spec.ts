import { SettingsService } from './settings.service';

describe('OpenRouter connection test credentials', () => {
  it('loads a saved disabled key for diagnostics while keeping normal AI resolution disabled', async () => {
    const findUnique = jest.fn().mockResolvedValue({ value: { enabled: false, fields: { apiKey: { enc: 'encrypted' } } } });
    const decrypt = jest.fn().mockReturnValue('isolated-test-key');
    const settings = new SettingsService({ systemSetting: { findUnique } } as any, { decrypt } as any);

    await expect(settings.resolve('openrouter')).resolves.toBeNull();
    expect(decrypt).not.toHaveBeenCalled();
    await expect(settings.openRouterTestCredentials()).resolves.toMatchObject({ apiKey: 'isolated-test-key', textModel: 'openrouter/free' });
    await expect(settings.resolve('openrouter')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { key: 'integration.openrouter' } });
  });
});
