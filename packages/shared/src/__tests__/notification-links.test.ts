import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeNativeIntent, notificationDestination, notificationPath } from '../notification-links';
import { defaultModulePolicies } from '../modules';

test('bare native launch, canonical paths and host-style intents never produce unmatched routes', () => {
  for (const value of ['brokeriq:///', 'brokeriq://', 'brokeriq:/', '/', '']) assert.equal(normalizeNativeIntent(value), '/');
  assert.equal(normalizeNativeIntent('brokeriq://lead/abc'), '/lead/abc');
  assert.equal(normalizeNativeIntent('brokeriq:///broker/leads/abc'), '/lead/abc');
  assert.equal(normalizeNativeIntent('brokeriq:///broker/leads/requirements'), '/requirements');
  assert.equal(normalizeNativeIntent('brokeriq://user/property/a-house'), '/property/a-house');
  assert.equal(normalizeNativeIntent('brokeriq://user/search?bedrooms=2'), '/(user)/search?bedrooms=2');
  assert.equal(normalizeNativeIntent('brokeriq://expo-sharing'), '/handle-share');
  assert.equal(normalizeNativeIntent('brokeriq:///notification?notification=abc'), '/notifications?notification=abc');
  assert.equal(normalizeNativeIntent('brokeriq:///made-up-path'), '/');
});

test('requirements, selected inventory and both conversation channels map before generic record routes', () => {
  const map = (url: string) => notificationDestination(url, 'BROKER_AGENT', true);
  assert.equal(map('/broker/leads/requirements'), '/requirements');
  assert.equal(map('/broker/leads/abc'), '/lead/abc');
  assert.equal(map('/broker/inventory?item=unit_2'), '/inventory/unit_2');
  assert.equal(map('/inventory/unit_2'), '/inventory/unit_2');
  assert.equal(map('/broker/inbox?c=abc'), '/wa/abc');
  assert.equal(map('/broker/inbox?channel=CHAT&c=abc'), '/chat/abc');
  assert.equal(map('/broker/inbox?channel=SMS&c=abc'), '/wa/abc');
  assert.equal(notificationDestination('/account/messages?c=abc', 'USER', true), '/chat/abc');
  assert.equal(map('/broker/kyc'), '/(broker)/kyc');
  assert.equal(map('/feedback/abc'), '/feedback?record=abc');
});

test('role boundaries and disabled modules apply to notification navigation too', () => {
  assert.equal(notificationDestination('/admin/kyc', 'BROKER_ADMIN', true), null);
  assert.equal(notificationDestination('/broker/publications', 'BROKER_AGENT', true), null);
  assert.equal(notificationDestination('/broker/team', 'BROKER_AGENT', false), null);
  assert.equal(notificationDestination('/broker/leads', 'USER', true), null);
  assert.equal(notificationDestination('/admin/kyc', 'SUPER_ADMIN', false), '/admin/kyc');
  assert.equal(notificationDestination('/admin/kyc', 'SUPER_ADMIN', true), null);
  const p = defaultModulePolicies();
  p.inbox.state = 'HIDDEN';
  assert.equal(notificationDestination('/broker/inbox?c=abc', 'BROKER_AGENT', true, p), null);
  assert.equal(notificationDestination('/made-up-page', 'BROKER_ADMIN', false), null);
});

test('unsafe links do not become app destinations; external meeting links require separate explicit UI consent', () => {
  for (const value of [
    '//evil.test/x',
    'javascript:alert(1)',
    'file:///tmp/a',
    '/\\evil.test',
    '/broker%2fleads/a',
    '/a%0ab',
    'https://evil.test/broker/leads/a',
    'https://x:pw@brokeriq.mymultimeds.com/broker',
    '/broker/leads/a b',
  ]) {
    assert.equal(notificationPath(value), null, value);
    assert.equal(notificationDestination(value, 'BROKER_ADMIN', true), null, value);
  }
  assert.equal(notificationDestination('https://brokeriq.mymultimeds.com/broker/leads/a', 'BROKER_AGENT', true), '/lead/a');
  assert.equal(notificationDestination('/inventory/a', 'BROKER_ADMIN', false), '/broker/inventory?item=a');
});
