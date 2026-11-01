const { test } = require('node:test');
const assert = require('node:assert/strict');
const { protectMainActivity } = require('./with-screen-protection');

test('a clean Kotlin prebuild installs release protection before Activity creation', () => {
  const source = 'class MainActivity {\n  override fun onCreate(state: Bundle?) {\n    super.onCreate(null)\n  }\n}';
  const patched = protectMainActivity(source, 'kt');
  assert.match(patched, /if \(!BuildConfig.DEBUG\)/);
  assert.match(patched, /window.addFlags\(android.view.WindowManager.LayoutParams.FLAG_SECURE\)/);
  assert.ok(patched.indexOf('FLAG_SECURE') < patched.indexOf('super.onCreate'));
  assert.equal(protectMainActivity(patched, 'kt'), patched);
});

test('Java MainActivity is protected without changing its onCreate argument', () => {
  const patched = protectMainActivity('  public void onCreate(Bundle state) {\n    super.onCreate(state);\n  }', 'java');
  assert.match(patched, /getWindow\(\).addFlags/);
  assert.match(patched, /super.onCreate\(state\);/);
});

test('an incompatible generated Activity fails instead of silently shipping without protection', () => {
  assert.throws(() => protectMainActivity('class MainActivity {}', 'kt'), /refusing an unprotected build/);
});
