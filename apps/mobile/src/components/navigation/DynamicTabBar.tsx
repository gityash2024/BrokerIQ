import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useAuth } from '../../stores/authStore';
import { PersonaNavigationMode } from '../../data/personaData';

// --- Tab Vector Icons ---

const DashboardIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
  </Svg>
);

const LeadsIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
    <Path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const PropertiesIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <Path d="M9 21V12h6v9" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  </Svg>
);

const MarketHubIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M8 17V10h4v7M12 17V7h4v10"
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </Svg>
);

const FollowUpsIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MoreIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="5" cy="12" r="2" fill={color} />
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Circle cx="19" cy="12" r="2" fill={color} />
  </Svg>
);

const ExploreIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const SavedIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);

const InquiriesIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);

const PostPropertyIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </Svg>
);

const VerificationIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ProfileIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" />
  </Svg>
);

const MyListingsIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M10 11h4M10 15h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

interface TabDefinition {
  name: string;
  label: string;
  Icon: React.ComponentType<{ color: string }>;
  getBadge?: (store: ReturnType<typeof useAuth>) => number | null;
}

const TAB_CONFIGS: Record<PersonaNavigationMode, TabDefinition[]> = {
  // Seeker Mode: [Explore, Saved, Inquiries, Market Hub, Profile]
  SEEKER: [
    { name: 'index', label: 'Explore', Icon: ExploreIcon },
    {
      name: 'saved',
      label: 'Saved',
      Icon: SavedIcon,
      getBadge: (store) => store.savedPropertyIds.size || null,
    },
    {
      name: 'inquiries',
      label: 'Inquiries',
      Icon: InquiriesIcon,
      getBadge: (store) => store.inquiries.length || null,
    },
    { name: 'market-hub', label: 'Market Hub', Icon: MarketHubIcon },
    { name: 'profile', label: 'Profile', Icon: ProfileIcon },
  ],

  // Owner Mode: [My Listings, Inquiries, Post Property, Verification, Profile]
  OWNER: [
    { name: 'index', label: 'My Listings', Icon: MyListingsIcon },
    {
      name: 'inquiries',
      label: 'Inquiries',
      Icon: InquiriesIcon,
      getBadge: (store) => store.inquiries.length || null,
    },
    { name: 'post-property', label: 'Post Property', Icon: PostPropertyIcon },
    { name: 'verification', label: 'Verification', Icon: VerificationIcon },
    { name: 'profile', label: 'Profile', Icon: ProfileIcon },
  ],

  // Broker Mode: [Dashboard, Leads, Market Hub, Properties, Follow-ups, More]
  BROKER: [
    { name: 'index', label: 'Dashboard', Icon: DashboardIcon },
    { name: 'leads', label: 'Leads', Icon: LeadsIcon },
    { name: 'market-hub', label: 'Market Hub', Icon: MarketHubIcon },
    { name: 'properties', label: 'Properties', Icon: PropertiesIcon },
    { name: 'follow-ups', label: 'Follow-ups', Icon: FollowUpsIcon },
    { name: 'more', label: 'More', Icon: MoreIcon },
  ],
};

export interface DynamicTabBarProps {
  state: any;
  descriptors?: any;
  navigation: any;
  insets?: any;
}

export const DynamicTabBar: React.FC<DynamicTabBarProps> = ({
  state,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const mode = auth.activePersona.mode || 'BROKER';
  const tabs = TAB_CONFIGS[mode] || TAB_CONFIGS.BROKER;

  const currentRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        height: 54 + Math.max(insets.bottom, 8),
        paddingBottom: Math.max(insets.bottom, 6),
        paddingTop: 6,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 8,
      }}
    >
      {tabs.map((tab) => {
        const isFocused = currentRouteName === tab.name;
        const activeColor = '#0D9488'; // Deep Teal
        const inactiveColor = '#94A3B8';
        const color = isFocused ? activeColor : inactiveColor;
        const badgeCount = tab.getBadge ? tab.getBadge(auth) : null;

        const isPostProperty = tab.name === 'post-property';

        const handlePress = () => {
          const route = state.routes?.find((r: { name: string; key?: string }) => r.name === tab.name);
          const event = navigation.emit({
            type: 'tabPress',
            target: route?.key || tab.name,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        if (isPostProperty) {
          // Highlighted central post property button for owners
          return (
            <TouchableOpacity
              key={tab.name}
              activeOpacity={0.8}
              onPress={handlePress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#0D9488',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -12,
                  shadowColor: '#0D9488',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 5,
                }}
              >
                <PostPropertyIcon color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: isFocused ? '#0D9488' : '#334155',
                  marginTop: 2,
                  letterSpacing: -0.2,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            activeOpacity={0.7}
            onPress={handlePress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              paddingVertical: 2,
            }}
          >
            <View style={{ position: 'relative' }}>
              <tab.Icon color={color} />
              {badgeCount !== null && badgeCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -9,
                    backgroundColor: '#EF4444',
                    borderRadius: 9,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 9,
                      fontWeight: '800',
                    }}
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={{
                fontSize: 10,
                fontWeight: isFocused ? '800' : '600',
                color,
                marginTop: 3,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default DynamicTabBar;
