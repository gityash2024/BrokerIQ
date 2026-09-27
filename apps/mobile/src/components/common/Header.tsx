import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../stores/authStore';
import { PersonaSwitcherModal } from './PersonaSwitcherModal';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showNotification?: boolean;
  unreadCount?: number;
  onNotificationPress?: () => void;
  avatarText?: string;
  showPersonaPill?: boolean;
}

export const Header = ({
  title,
  subtitle,
  showNotification = true,
  unreadCount = 3,
  onNotificationPress,
  avatarText,
  showPersonaPill = true,
}: HeaderProps) => {
  const insets = useSafeAreaInsets();
  const { activePersona } = useAuth();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const displayAvatar = avatarText || activePersona.avatar || 'BI';

  return (
    <>
      <View
        style={{
          paddingTop: Math.max(insets.top + 8, 20),
          paddingBottom: 14,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Title and Persona Role Pill */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '800',
                color: '#0F172A',
                letterSpacing: -0.4,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>

            {showPersonaPill && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSwitcherVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${activePersona.accentColor}15`,
                  borderWidth: 1,
                  borderColor: `${activePersona.accentColor}40`,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                  gap: 4,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: activePersona.accentColor,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: activePersona.accentColor,
                    letterSpacing: 0.2,
                  }}
                >
                  {activePersona.badgeText}
                </Text>
                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 9l6 6 6-6"
                    stroke={activePersona.accentColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            )}
          </View>

          {subtitle && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#64748B',
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Action Icons: Notification Bell & Persona Avatar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {showNotification && (
            <TouchableOpacity
              onPress={onNotificationPress}
              activeOpacity={0.7}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M13.73 21a2 2 0 01-3.46 0"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 7,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: '#EF4444',
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                  }}
                />
              )}
            </TouchableOpacity>
          )}

          {/* Interactive Persona Avatar Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSwitcherVisible(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: activePersona.accentColor,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: activePersona.accentColor,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
              {displayAvatar}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <PersonaSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
    </>
  );
};

export default Header;
