import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateMediaPath } from '../private-media';

test('binary credentials stay on the configured API origin and known media paths', () => {
  const base = 'https://api.brokeriq.test/api';
  assert.equal(privateMediaPath('https://api.brokeriq.test/api/media/kyc/doc1', base), '/media/kyc/doc1');
  assert.equal(privateMediaPath('/media/f/scan/owner/202611/id?w=1200', base), '/media/f/scan/owner/202611/id?w=1200');
  for (const value of [
    'https://other.test/api/media/kyc/1',
    '//other.test/api/media/kyc/1',
    'https://user@api.brokeriq.test/api/media/kyc/1',
    'file:///api/media/kyc/1',
    'data:image/png;base64,aaa',
    '/media/../auth/me',
    '/media/%2e%2e/auth',
    '/media/kyc/%2fid',
    '/media\\kyc\\1',
    '/media/kyc/1#x',
    '/auth/me',
  ]) {
    assert.equal(privateMediaPath(value, base), null, value);
  }
});
