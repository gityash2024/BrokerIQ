const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.serializer.getPolyfills = () => {
  const rnPath = require.resolve("react-native/package.json");
  const jsPolyfills = require(require.resolve("@react-native/js-polyfills", { paths: [rnPath] }))();
  return jsPolyfills;
};

module.exports = withNativeWind(config, { input: "./global.css" });