import type { ExpoConfig } from 'expo/config';

/**
 * Only build-time identifiers live here. Everything the user sees (site name,
 * colours, flags, announcement, force-update versions, map/google keys …) is
 * fetched at runtime from GET /api/public/config — managed in Super Admin.
 */
const config: ExpoConfig = {
  name: process.env.APP_NAME ?? 'BrokerIQ',
  slug: 'brokeriq',
  scheme: 'brokeriq',
  version: '1.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'com.brokeriq.app',
    infoPlist: {
      NSCameraUsageDescription: 'Property photos और listing-book scan करने के लिए camera चाहिए।',
      NSPhotoLibraryUsageDescription: 'Property photos चुनने के लिए gallery access चाहिए।',
      NSLocationWhenInUseUsageDescription: 'आस-पास की properties और site-visit check-in के लिए location चाहिए।',
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'com.brokeriq.app',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#1D2530' },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: process.env.WEB_HOST ? [{ scheme: 'https', host: process.env.WEB_HOST, pathPrefix: '/property' }] : [{ scheme: 'brokeriq' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-image-picker', { photosPermission: 'Property photos चुनने के लिए gallery access चाहिए।', cameraPermission: 'Photos और listing-book scan के लिए camera चाहिए।' }],
    ['expo-location', { locationWhenInUsePermission: 'आस-पास की properties और site-visit check-in के लिए location चाहिए।' }],
    ['expo-notifications', { color: '#4F46E5' }],
    ['expo-splash-screen', { image: './assets/splash-logo.png', imageWidth: 220, resizeMode: 'contain', backgroundColor: '#1D2530' }],
    'expo-font',
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
