const fs = require('fs');
const path = require('path');

const dirs = [
  'src/theme',
  'src/components/ui',
  'app/(auth)',
  'app/(tabs)',
  'src/i18n',
  'src/api',
  'src/stores',
  'src/hooks',
  'src/mocks'
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

const files = {
  'app.json': `{
  "expo": {
    "name": "BrokerIQ",
    "slug": "brokeriq",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "scheme": "brokeriq"
  }
}`,
  'babel.config.js': `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};`,
  'metro.config.js': `const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });`,
  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D9488', // teal-600
          dark: '#0F766E', // teal-700
        },
        surface: '#FFFFFF',
        background: '#F9FAFB',
        text: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
        },
        border: '#E5E7EB',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      }
    },
  },
  plugins: [],
};`,
  'global.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
  'src/theme/colors.ts': `export const colors = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  surface: '#FFFFFF',
  background: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};`,
  'src/theme/typography.ts': `export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const },
  pageTitle: { fontSize: 26, fontWeight: '700' as const },
  section: { fontSize: 20, fontWeight: '600' as const },
  card: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  secondary: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};`,
  'src/theme/spacing.ts': `export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};`,
  'src/components/ui/Button.tsx': `import React from 'react';
import { Text, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', isLoading }: ButtonProps) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  let bgClass = 'bg-primary';
  let textClass = 'text-white';
  if (variant === 'secondary') { bgClass = 'bg-gray-200'; textClass = 'text-gray-900'; }
  else if (variant === 'outline') { bgClass = 'bg-transparent border border-primary'; textClass = 'text-primary'; }
  else if (variant === 'ghost') { bgClass = 'bg-transparent'; textClass = 'text-primary'; }
  else if (variant === 'danger') { bgClass = 'bg-error'; textClass = 'text-white'; }

  return (
    <Animated.View style={animatedStyle} className="my-2">
      <Animated.Text onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} className={\`px-4 py-3 rounded-lg text-center font-semibold \${bgClass} \${textClass}\`}>
        {isLoading ? <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#0D9488' : '#FFF'} /> : title}
      </Animated.Text>
    </Animated.View>
  );
};`,
  'src/components/ui/Card.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export const Card = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style} className="bg-surface rounded-xl shadow-sm p-4 border border-border my-2" onTouchStart={() => onPress && (scale.value = withSpring(0.98))} onTouchEnd={() => onPress && (scale.value = withSpring(1))}>
      {children}
    </Animated.View>
  );
};`,
  'src/components/ui/Input.tsx': `import React from 'react';
import { TextInput, View, Text } from 'react-native';

export const Input = ({ label, error, ...props }: any) => (
  <View className="mb-4">
    {label && <Text className="text-sm text-text font-medium mb-1">{label}</Text>}
    <TextInput className={\`border rounded-lg p-3 text-text bg-surface \${error ? 'border-error' : 'border-border'}\`} placeholderTextColor="#9CA3AF" {...props} />
    {error && <Text className="text-xs text-error mt-1">{error}</Text>}
  </View>
);`,
  'src/components/ui/Select.tsx': `import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export const Select = ({ label, value, onPress }: any) => (
  <View className="mb-4">
    {label && <Text className="text-sm text-text font-medium mb-1">{label}</Text>}
    <TouchableOpacity onPress={onPress} className="border border-border rounded-lg p-3 bg-surface">
      <Text className={value ? "text-text" : "text-gray-400"}>{value || 'Select...'}</Text>
    </TouchableOpacity>
  </View>
);`,
  'src/components/ui/IconButton.tsx': `import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export const IconButton = ({ icon, onPress }: any) => (
  <TouchableOpacity onPress={onPress} className="p-2 rounded-full bg-gray-100 items-center justify-center">
    <Text>{icon}</Text>
  </TouchableOpacity>
);`,
  'src/components/ui/StatusBadge.tsx': `import React from 'react';
import { View, Text } from 'react-native';

export const StatusBadge = ({ status }: { status: string }) => {
  let color = 'bg-gray-100 text-gray-800';
  if (status === 'NEW') color = 'bg-blue-100 text-blue-800';
  if (status === 'WON') color = 'bg-green-100 text-green-800';
  if (status === 'LOST') color = 'bg-red-100 text-red-800';

  return (
    <View className={\`px-2 py-1 rounded-full \${color.split(' ')[0]}\`}>
      <Text className={\`text-xs font-medium \${color.split(' ')[1]}\`}>{status}</Text>
    </View>
  );
};`,
  'src/components/ui/MetricCard.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';

export const MetricCard = ({ label, value, trend }: any) => (
  <Card>
    <Text className="text-sm text-text-secondary">{label}</Text>
    <Text className="text-2xl font-bold text-text mt-1">{value}</Text>
    {trend && <Text className="text-xs text-success mt-1">{trend}</Text>}
  </Card>
);`,
  'src/components/ui/LeadCard.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

export const LeadCard = ({ name, phone, property, stage }: any) => (
  <Card>
    <View className="flex-row justify-between items-start mb-2">
      <View>
        <Text className="text-lg font-semibold text-text">{name}</Text>
        <Text className="text-sm text-text-secondary">{phone}</Text>
      </View>
      <StatusBadge status={stage} />
    </View>
    <Text className="text-sm text-text mt-1">{property}</Text>
  </Card>
);`,
  'src/components/ui/PropertyCard.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';

export const PropertyCard = ({ title, price, bhk, area }: any) => (
  <Card>
    <View className="h-32 bg-gray-200 rounded-lg mb-3" />
    <Text className="text-lg font-semibold text-text">{title}</Text>
    <Text className="text-primary font-bold mt-1">₹ {price}</Text>
    <Text className="text-sm text-text-secondary mt-1">{bhk} • {area}</Text>
  </Card>
);`,
  'src/components/ui/SubscriptionCard.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';

export const SubscriptionCard = ({ plan, status, renewal }: any) => (
  <Card>
    <Text className="text-lg font-bold text-text">{plan} Plan</Text>
    <Text className="text-sm text-text-secondary mt-1">Status: {status}</Text>
    <Text className="text-sm text-text-secondary">Renews: {renewal}</Text>
  </Card>
);`,
  'src/components/ui/UsageProgress.tsx': `import React from 'react';
import { View, Text } from 'react-native';

export const UsageProgress = ({ label, used, max }: any) => {
  const percentage = Math.min((used / max) * 100, 100);
  return (
    <View className="mb-4">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm font-medium text-text">{label}</Text>
        <Text className="text-sm text-text-secondary">{used} / {max}</Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full w-full overflow-hidden">
        <View className="h-full bg-primary" style={{ width: \`\${percentage}%\` }} />
      </View>
    </View>
  );
};`,
  'src/components/ui/EmptyState.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Button } from './Button';

export const EmptyState = ({ title, description, action }: any) => (
  <View className="flex-1 items-center justify-center p-6">
    <Text className="text-xl font-bold text-text mb-2 text-center">{title}</Text>
    <Text className="text-sm text-text-secondary text-center mb-6">{description}</Text>
    {action && <Button title={action.label} onPress={action.onPress} />}
  </View>
);`,
  'src/components/ui/Skeleton.tsx': `import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming, useSharedValue, useEffect } from 'react-native-reanimated';

export const Skeleton = ({ className }: { className?: string }) => {
  const opacity = useSharedValue(0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style} className={\`bg-gray-200 rounded-md \${className}\`} />;
};`,
  'src/components/ui/Search.tsx': `import React from 'react';
import { TextInput, View } from 'react-native';

export const Search = ({ placeholder, onChangeText }: any) => (
  <View className="px-4 py-2">
    <TextInput className="bg-gray-100 rounded-lg p-3 text-text" placeholder={placeholder || "Search..."} onChangeText={onChangeText} />
  </View>
);`,
  'src/components/ui/BottomSheet.tsx': `import React from 'react';
import { View, Text, Modal } from 'react-native';

export const BottomSheet = ({ visible, onClose, children }: any) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 justify-end bg-black/50">
      <View className="bg-surface rounded-t-2xl p-4 min-h-[50%]">
        <Text onPress={onClose} className="self-end text-primary mb-2">Close</Text>
        {children}
      </View>
    </View>
  </Modal>
);`,
  'src/components/ui/FilterSheet.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { BottomSheet } from './BottomSheet';

export const FilterSheet = (props: any) => (
  <BottomSheet {...props}>
    <Text className="text-xl font-bold mb-4">Filters</Text>
  </BottomSheet>
);`,
  'src/components/ui/Header.tsx': `import React from 'react';
import { View, Text } from 'react-native';

export const Header = ({ title }: { title: string }) => (
  <View className="flex-row items-center p-4 bg-surface border-b border-border">
    <Text className="text-lg font-bold text-text">{title}</Text>
  </View>
);`,
  'src/components/ui/Screen.tsx': `import React from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';

export const Screen = ({ children, scroll = false }: any) => {
  const Content = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Content className="flex-1 p-4">{children}</Content>
    </SafeAreaView>
  );
};`,
  'src/components/ui/Timeline.tsx': `import React from 'react';
import { View, Text } from 'react-native';

export const Timeline = ({ items }: any) => (
  <View className="pl-4">
    {items.map((item: any, i: number) => (
      <View key={i} className="flex-row mb-4">
        <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-3" />
        <View>
          <Text className="text-sm font-medium text-text">{item.title}</Text>
          <Text className="text-xs text-text-secondary">{item.date}</Text>
        </View>
      </View>
    ))}
  </View>
);`,
  'src/components/ui/WhatsAppComposer.tsx': `import React from 'react';
import { View, TextInput, Text } from 'react-native';

export const WhatsAppComposer = () => (
  <View className="flex-row items-center p-3 border-t border-border bg-surface">
    <TextInput className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2" placeholder="Message..." />
    <Text className="text-primary font-bold">Send</Text>
  </View>
);`,
  'src/components/ui/AIInsight.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';

export const AIInsight = ({ suggestion }: any) => (
  <Card>
    <Text className="text-sm font-bold text-primary mb-2">✨ AI Suggestion</Text>
    <Text className="text-sm text-text mb-4">{suggestion}</Text>
    <View className="flex-row justify-end space-x-2">
      <Button variant="outline" title="Reject" />
      <Button title="Accept" />
    </View>
  </Card>
);`,
  'src/components/ui/index.ts': `export * from './Button';
export * from './Card';
export * from './Input';
export * from './Select';
export * from './IconButton';
export * from './StatusBadge';
export * from './MetricCard';
export * from './LeadCard';
export * from './PropertyCard';
export * from './SubscriptionCard';
export * from './UsageProgress';
export * from './EmptyState';
export * from './Skeleton';
export * from './Search';
export * from './BottomSheet';
export * from './FilterSheet';
export * from './Header';
export * from './Screen';
export * from './Timeline';
export * from './WhatsAppComposer';
export * from './AIInsight';`,
  'app/_layout.tsx': `import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="subscription" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}`,
  'app/(auth)/_layout.tsx': `import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}`,
  'app/(auth)/login.tsx': `import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Input, Button } from '../../src/components/ui';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text className="text-4xl font-bold text-primary mb-8 text-center">BrokerIQ</Text>
        <Input label="Email or Phone" placeholder="Enter your email or phone number" />
        <Input label="Password" placeholder="Enter your password" secureTextEntry />
        <Button title="Login" onPress={() => router.replace('/(tabs)')} />
        <Button variant="ghost" title="Use OTP instead" onPress={() => router.push('/otp')} />
      </View>
    </Screen>
  );
}`,
  'app/(auth)/otp.tsx': `import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Input, Button } from '../../src/components/ui';
import { useRouter } from 'expo-router';

export default function OTPScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-bold text-text mb-4 text-center">Verify OTP</Text>
        <Input placeholder="Enter 6-digit OTP" keyboardType="numeric" />
        <Button title="Verify" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}`,
  'app/(tabs)/_layout.tsx': `import { Tabs } from 'expo-router';
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0D9488', headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads' }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties' }} />
      <Tabs.Screen name="follow-ups" options={{ title: 'Follow-ups' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}`,
  'app/(tabs)/index.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Header, MetricCard } from '../../src/components/ui';

export default function DashboardScreen() {
  return (
    <>
      <Header title="Dashboard" />
      <Screen scroll>
        <View className="flex-row flex-wrap justify-between">
          <View className="w-[48%]"><MetricCard label="New Leads Today" value="12" /></View>
          <View className="w-[48%]"><MetricCard label="Active Leads" value="145" /></View>
          <View className="w-[48%]"><MetricCard label="Follow-ups Due" value="8" /></View>
          <View className="w-[48%]"><MetricCard label="Site Visits" value="3" /></View>
        </View>
        <Text className="text-lg font-bold mt-6 mb-4">Today's Follow-ups</Text>
        {/* Placeholder for list */}
      </Screen>
    </>
  );
}`,
  'app/(tabs)/leads.tsx': `import React from 'react';
import { View } from 'react-native';
import { Screen, Header, Search, LeadCard } from '../../src/components/ui';

export default function LeadsScreen() {
  return (
    <>
      <Header title="Leads" />
      <Search placeholder="Search leads..." />
      <Screen scroll>
        <LeadCard name="John Doe" phone="+91 9876543210" property="3BHK in Andheri" stage="NEW" />
        <LeadCard name="Jane Smith" phone="+91 9123456780" property="2BHK in Bandra" stage="CONTACTED" />
      </Screen>
    </>
  );
}`,
  'app/(tabs)/properties.tsx': `import React from 'react';
import { View } from 'react-native';
import { Screen, Header, Search, PropertyCard } from '../../src/components/ui';

export default function PropertiesScreen() {
  return (
    <>
      <Header title="Properties" />
      <Search placeholder="Search properties..." />
      <Screen scroll>
        <PropertyCard title="Luxury 3BHK Apartment" price="2.5 Cr" bhk="3 BHK" area="1500 sqft" />
      </Screen>
    </>
  );
}`,
  'app/(tabs)/follow-ups.tsx': `import React from 'react';
import { Text } from 'react-native';
import { Screen, Header, EmptyState } from '../../src/components/ui';

export default function FollowUpsScreen() {
  return (
    <>
      <Header title="Follow-ups" />
      <Screen>
        <EmptyState title="No follow-ups due" description="You have completed all your tasks for today." />
      </Screen>
    </>
  );
}`,
  'app/(tabs)/more.tsx': `import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Header, Button } from '../../src/components/ui';
import { useRouter } from 'expo-router';

export default function MoreScreen() {
  const router = useRouter();
  return (
    <>
      <Header title="More" />
      <Screen scroll>
        <Button variant="outline" title="Subscription" onPress={() => router.push('/subscription')} />
        <Button variant="danger" title="Logout" onPress={() => router.replace('/(auth)/login')} />
      </Screen>
    </>
  );
}`,
  'app/subscription.tsx': `import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Header, SubscriptionCard, UsageProgress, Button } from '../src/components/ui';

export default function SubscriptionScreen() {
  return (
    <>
      <Header title="Subscription" />
      <Screen scroll>
        <SubscriptionCard plan="Pro" status="Active" renewal="12 Dec 2026" />
        <View className="mt-6">
          <Text className="text-lg font-bold mb-4">Usage Limits</Text>
          <UsageProgress label="Leads" used={450} max={500} />
          <UsageProgress label="AI Requests" used={120} max={1000} />
          <UsageProgress label="Properties" used={15} max={50} />
          <UsageProgress label="Team Members" used={3} max={5} />
        </View>
        <View className="mt-6">
          <Button title="Upgrade Plan" />
        </View>
      </Screen>
    </>
  );
}`,
  'src/i18n/index.ts': `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});
export default i18n;`,
  'src/i18n/en.json': `{"login": "Login"}`,
  'src/i18n/hi.json': `{"login": "लॉग इन करें"}`,
  'src/api/client.ts': `import axios from 'axios';
export const apiClient = axios.create({ baseURL: 'https://api.brokeriq.com/v1' });`,
  'src/api/auth.ts': `import { apiClient } from './client';
export const login = (data: any) => apiClient.post('/auth/login', data);`,
  'src/stores/auth.ts': `export const useAuthStore = () => ({ user: null, setToken: () => {} });`,
  'src/hooks/useAuth.ts': `export const useAuth = () => ({ user: null, login: () => {} });`,
  'src/hooks/useLeads.ts': `import { useQuery } from '@tanstack/react-query';
export const useLeads = () => useQuery({ queryKey: ['leads'], queryFn: () => Promise.resolve([]) });`,
  'src/hooks/useProperties.ts': `import { useQuery } from '@tanstack/react-query';
export const useProperties = () => useQuery({ queryKey: ['properties'], queryFn: () => Promise.resolve([]) });`,
  'src/mocks/index.ts': `export const mockLeads = [];`
};

for (const [filepath, content] of Object.entries(files)) {
  fs.writeFileSync(filepath, content);
}

console.log('App shell generated successfully');
