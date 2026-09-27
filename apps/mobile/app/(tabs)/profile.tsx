import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { Header } from '../../src/components/common/Header';
import { PersonaSwitcherModal } from '../../src/components/common/PersonaSwitcherModal';

export default function ProfileScreen() {
  const router = useRouter();
  const { activePersona, logout } = useAuth();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="My Profile"
        subtitle="Role Settings & Preferences"
        showNotification={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Persona Card */}
        <View
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            {/* Avatar Circle */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: activePersona.accentColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
                shadowColor: activePersona.accentColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF' }}>
                {activePersona.avatar}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>
                  {activePersona.name}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: `${activePersona.accentColor}30`,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: activePersona.accentColor }}>
                  {activePersona.badgeText}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                {activePersona.organizationName}
              </Text>
            </View>
          </View>

          {/* Details Grid */}
          <View
            style={{
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#1E293B',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: '#CBD5E1' }}>
              📧 {activePersona.email}
            </Text>
            <Text style={{ fontSize: 12, color: '#CBD5E1' }}>
              📱 {activePersona.phone}
            </Text>
            <Text style={{ fontSize: 12, color: '#CBD5E1' }}>
              📍 {activePersona.city}
            </Text>
            {activePersona.reraNumber && (
              <Text style={{ fontSize: 12, color: '#FBBF24', fontWeight: '700' }}>
                🛡️ RERA: {activePersona.reraNumber}
              </Text>
            )}
          </View>

          {/* 1-Tap Persona Switcher Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSwitcherVisible(true)}
            style={{
              backgroundColor: '#0D9488',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              marginTop: 16,
              shadowColor: '#0D9488',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
              ⚡ Switch Active Persona (5 Roles)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Persona Capabilities & Permissions */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
            Current Mode: {activePersona.mode}
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 12 }}>
            {activePersona.description}
          </Text>

          <View
            style={{
              backgroundColor: '#F8FAFC',
              borderRadius: 10,
              padding: 10,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}>
              Scoped Navigation Permissions:
            </Text>
            {activePersona.mode === 'SEEKER' && (
              <Text style={{ fontSize: 11, color: '#475569' }}>
                ✓ Explore Gurgaon Catalog & Mumbai Corridors{'\n'}
                ✓ Save Properties to Personal Wishlist{'\n'}
                ✓ Direct WhatsApp & Phone Outreach to Owners{'\n'}
                ✓ Track Contacted Inquiries & Status
              </Text>
            )}
            {activePersona.mode === 'OWNER' && (
              <Text style={{ fontSize: 11, color: '#475569' }}>
                ✓ 3-Step Property Creation Wizard{'\n'}
                ✓ Instant Verified Trust Badge Tracker{'\n'}
                ✓ Direct Buyer Inquiries & Negotiations{'\n'}
                ✓ 1-Tap Priority Search Boost
              </Text>
            )}
            {activePersona.mode === 'BROKER' && (
              <Text style={{ fontSize: 11, color: '#475569' }}>
                ✓ Full CRM Deal Pipeline & Analytics{'\n'}
                ✓ AI Physical Listing Book Scanner{'\n'}
                ✓ Micro-Market Directory & Floor Filters{'\n'}
                ✓ Follow-up Scheduling & Client WhatsApp
              </Text>
            )}
          </View>
        </View>

        {/* App Settings & Network */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>
            System & Offline Telemetry
          </Text>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Backend API Target</Text>
              <Text style={{ fontSize: 12, color: '#0D9488', fontWeight: '700' }}>
                http://10.0.2.2:3000/api
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Offline Cache</Text>
              <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>
                Active (54 Commercial Units)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Language</Text>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>English (India)</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Version</Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>v1.0.0 (Build 57)</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSignOut}
          style={{
            backgroundColor: '#FEE2E2',
            borderWidth: 1,
            borderColor: '#FECACA',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#DC2626' }}>
            Sign Out of BrokerIQ
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PersonaSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
    </View>
  );
}
