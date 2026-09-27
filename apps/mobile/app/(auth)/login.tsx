import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { DEMO_PERSONAS, PersonaConfig } from '../../src/data/personaData';

export default function LoginScreen() {
  const router = useRouter();
  const { loginAsPersona } = useAuth();
  const [identifier, setIdentifier] = useState('amit.verma@founder-realty.in');
  const [password, setPassword] = useState('••••••••••••');

  const handleQuickLogin = async (persona: PersonaConfig) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // safe fallback
    }
    await loginAsPersona(persona.id);
    router.replace('/(tabs)');
  };

  const handleManualLogin = async () => {
    // Smart match based on typed email or fallback to agent
    const matched = Object.values(DEMO_PERSONAS).find(
      (p) =>
        p.email.toLowerCase() === identifier.trim().toLowerCase() ||
        p.phone.includes(identifier.trim())
    );

    if (matched) {
      await loginAsPersona(matched.id);
    } else {
      await loginAsPersona(DEMO_PERSONAS.BROKER_AGENT.id);
    }

    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 20,
          paddingTop: 50,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: '#0D9488',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#0D9488',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
              marginBottom: 12,
            }}
          >
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <Path
                d="M9 21V12h6v9"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: '#FFFFFF',
              letterSpacing: -0.5,
            }}
          >
            BrokerIQ <Text style={{ color: '#0D9488' }}>Multi-Persona</Text>
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#94A3B8',
              marginTop: 4,
              fontWeight: '500',
              textAlign: 'center',
            }}
          >
            Real Estate Marketplace & CRM • 5 First-Class Personas
          </Text>
        </View>

        {/* 1-Tap Demo Quick-Login Section */}
        <View
          style={{
            backgroundColor: '#1E293B',
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#F8FAFC' }}>
                ⚡ 1-Tap Demo Quick-Login
              </Text>
              <View
                style={{
                  backgroundColor: '#0D9488',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  marginLeft: 8,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>
                  5 ROLES
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>Select to test</Text>
          </View>

          {Object.values(DEMO_PERSONAS).map((persona) => (
            <TouchableOpacity
              key={persona.id}
              activeOpacity={0.8}
              onPress={() => handleQuickLogin(persona)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0F172A',
                borderWidth: 1,
                borderColor: '#334155',
                borderRadius: 14,
                padding: 10,
                marginBottom: 8,
              }}
            >
              {/* Avatar Chip */}
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: persona.accentColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                  {persona.avatar}
                </Text>
              </View>

              {/* Name & Title */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                    {persona.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: `${persona.accentColor}25`,
                      paddingHorizontal: 5,
                      paddingVertical: 1.5,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '800',
                        color: persona.accentColor,
                      }}
                    >
                      {persona.badgeText}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#94A3B8',
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {persona.description}
                </Text>
              </View>

              {/* Arrow */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#1E293B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke="#94A3B8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Standard Credentials Sign In */}
        <View
          style={{
            backgroundColor: '#1E293B',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: 14,
            }}
          >
            Or Sign In with Credentials
          </Text>

          {/* Identifier Input */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#94A3B8',
              marginBottom: 6,
            }}
          >
            Email or Registered Mobile
          </Text>
          <TextInput
            placeholder="e.g. amit.verma@founder-realty.in"
            placeholderTextColor="#64748B"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            style={{
              backgroundColor: '#0F172A',
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#334155',
              marginBottom: 12,
            }}
          />

          {/* Password Input */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#94A3B8',
              marginBottom: 6,
            }}
          >
            Password
          </Text>
          <TextInput
            placeholder="Enter password"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{
              backgroundColor: '#0F172A',
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#334155',
              marginBottom: 16,
            }}
          />

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleManualLogin}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#0D9488',
              paddingVertical: 13,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#0D9488',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
              Sign In to BrokerIQ
            </Text>
          </TouchableOpacity>

          {/* OTP Link */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/otp')}
            style={{ alignItems: 'center', marginTop: 14 }}
          >
            <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
              Sign in with <Text style={{ color: '#0D9488', fontWeight: '700' }}>SMS / WhatsApp OTP</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 11, color: '#64748B' }}>
            BrokerIQ Multi-Role Platform • Compliant with RERA Standards
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}