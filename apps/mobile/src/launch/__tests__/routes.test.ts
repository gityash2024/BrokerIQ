import { defaultModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { nativeModuleKey } from '../routes';

describe('native module routes', () => {
  it.each([
    ['/dashboard', 'today'],
    ['/inventory', 'inventory'],
    ['/leads', 'leads'],
    ['/inbox', 'inbox'],
    ['/automations', 'automation'],
  ])('maps the visible broker tab %s to %s', (path, key) => {
    expect(nativeModuleKey(path)).toBe(key);
    expect(moduleAllowed(defaultModulePolicies(), nativeModuleKey(path), 'BROKER_ADMIN')).toBe(true);
  });
  it('keeps private detail routes in their parent module', () => {
    expect(nativeModuleKey('/inventory/[id]')).toBe('inventory');
    expect(nativeModuleKey('/scanner')).toBe('inventory');
    expect(nativeModuleKey('/import-review/[id]')).toBe('inbox');
    expect(nativeModuleKey('/wa/[id]')).toBe('inbox');
  });
  it('does not grant customer accounts broker Inbox access', () => {
    expect(moduleAllowed(defaultModulePolicies(), nativeModuleKey('/inbox'), 'USER')).toBe(false);
    expect(nativeModuleKey('/messages')).toBe('consumer');
  });
  it('keeps unknown and future screens unavailable', () => {
    expect(nativeModuleKey('/unknown-workflow')).toBe('legacy');
    expect(moduleAllowed(defaultModulePolicies(), nativeModuleKey('/deals'), 'BROKER_ADMIN')).toBe(false);
  });
});
