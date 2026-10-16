/**
 * Signs Android release builds (APK + AAB) with the BrokerIQ upload key.
 *
 * The keystore and its passwords never live in the repo: they are read at build time from
 *   $BROKERIQ_SIGNING_PROPERTIES  or  ~/.brokeriq/android/keystore.properties
 * with keys storeFile, storePassword, keyAlias, keyPassword. Without that file the release
 * release tasks fail before building. Debug builds still work without a release key.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// brokeriq-release-signing';
const LOAD = `${MARK}
def biqSigningFile = file(System.getenv('BROKERIQ_SIGNING_PROPERTIES') ?: "\${System.getProperty('user.home')}/.brokeriq/android/keystore.properties")
def biqSigning = new Properties()
if (biqSigningFile.exists()) { biqSigningFile.withInputStream { biqSigning.load(it) } }
else if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }) {
    throw new GradleException("BrokerIQ release signing properties are required; refusing a debug-signed release")
}
`;
const CONFIG = `
        release {
            if (biqSigningFile.exists()) {
                storeFile file(biqSigning['storeFile'])
                storePassword biqSigning['storePassword']
                keyAlias biqSigning['keyAlias']
                keyPassword biqSigning['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    g = g.replace(/\nandroid \{/, `\n${LOAD}\nandroid {`);
    g = g.replace(/signingConfigs \{(\s*debug \{[\s\S]*?\n {8}\})/, (m, debug) => `signingConfigs {${debug}${CONFIG}`);
    g = g.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig biqSigningFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );
    if (!g.includes('signingConfigs.release')) throw new Error('with-release-signing: could not patch android/app/build.gradle');
    cfg.modResults.contents = g;
    return cfg;
  });
};
