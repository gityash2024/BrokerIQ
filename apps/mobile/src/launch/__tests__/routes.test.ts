import { defaultModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { nativeHomeForRole, nativeModuleKey, nativePlatformMonitorAllowed } from '../routes';

describe('native module routes', () => {
  it('gives Super Admin an explicit location monitor without granting other native admin routes', () => {
    expect(nativeHomeForRole('SUPER_ADMIN')).toBe('/time-logging');
    expect(nativePlatformMonitorAllowed('/time-logging', 'SUPER_ADMIN')).toBe(true);
    for (const role of ['USER', 'BROKER_AGENT', 'SUPPORT', 'MODERATOR', 'PUBLIC']) expect(nativePlatformMonitorAllowed('/time-logging', role)).toBe(false);
    for (const path of ['/team', '/inventory', '/time-logging/unknown', '/connectors']) expect(nativePlatformMonitorAllowed(path, 'SUPER_ADMIN')).toBe(false);
    expect(moduleAllowed(defaultModulePolicies(), 'time_logging', 'SUPER_ADMIN')).toBe(true);
    expect(moduleAllowed({ time_logging: { state: 'HIDDEN', roles: ['SUPER_ADMIN'] } }, 'time_logging', 'SUPER_ADMIN')).toBe(false);
    expect(nativeHomeForRole('BROKER_ADMIN')).toBe('/(broker)/dashboard');
    expect(nativeHomeForRole('BROKER_AGENT')).toBe('/(broker)/dashboard');
    expect(nativeHomeForRole('USER')).toBe('/(user)/home');
    expect(nativeHomeForRole('SUPPORT')).toBe('/login');
  });
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
    expect(nativeModuleKey('/publication-reviews')).toBe('inventory');
    expect(nativeModuleKey('/time-logging')).toBe('time_logging');
    expect(nativeModuleKey('/import-review/[id]')).toBe('inbox');
    expect(nativeModuleKey('/wa/[id]')).toBe('inbox');
    expect(nativeModuleKey('/team-member/[id]')).toBe('team');
    expect(moduleAllowed(defaultModulePolicies(), nativeModuleKey('/team-member/[id]'), 'BROKER_AGENT')).toBe(false);
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
