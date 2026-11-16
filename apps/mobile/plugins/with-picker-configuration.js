const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withPickerConfiguration(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const flags = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    // Keep registered Expo activity result contracts alive on device display-size and language changes.
    for (const flag of ['density', 'locale', 'layoutDirection', 'fontScale']) flags.add(flag);
    activity.$['android:configChanges'] = [...flags].join('|');
    return cfg;
  });
};
