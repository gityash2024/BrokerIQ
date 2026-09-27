// Expo auto-configures monorepo (pnpm workspace) resolution.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
