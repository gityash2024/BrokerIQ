/** Keep Android release capture protection reproducible across clean Expo prebuilds. */
const { withMainActivity } = require('expo/config-plugins');

const MARK = '// brokeriq-release-screen-protection';

function protectMainActivity(contents, language) {
  if (contents.includes(MARK)) return contents;
  const kotlin = language === 'kt';
  const call = kotlin
    ? '    if (!BuildConfig.DEBUG) {\n      window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)\n    }\n'
    : '    if (!BuildConfig.DEBUG) {\n      getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);\n    }\n';
  const superCall = /^(\s*)super\.onCreate\([^\n]*\);?\s*$/m;
  if (!superCall.test(contents)) {
    throw new Error('BrokerIQ screen protection: MainActivity.onCreate was not found; refusing an unprotected build');
  }
  return contents.replace(superCall, function (match) {
    return '    ' + MARK + '\n' + call + match;
  });
}

module.exports = function withScreenProtection(config) {
  return withMainActivity(config, (cfg) => {
    cfg.modResults.contents = protectMainActivity(cfg.modResults.contents, cfg.modResults.language);
    return cfg;
  });
};
module.exports.protectMainActivity = protectMainActivity;
