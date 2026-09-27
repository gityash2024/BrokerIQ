import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

export default function OTPScreen() {
  const router = useRouter();
  const [otp, setOtp] = useState('749201');

  const handleVerify = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Link */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: 'absolute', top: 48, left: 24, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 18, color: '#38BDF8', marginRight: 6 }}>‹</Text>
          <Text style={{ fontSize: 14, color: '#38BDF8', fontWeight: '700' }}>Back</Text>
        </TouchableOpacity>

        {/* Verification Card */}
        <View
          style={{
            backgroundColor: '#1E293B',
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 }}>
            Security Verification
          </Text>
          <Text style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24, lineHeight: 18 }}>
            Enter the 6-digit one-time code sent to registered broker mobile{' '}
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>+91 98201 84729</Text>.
          </Text>

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8 }}>
            6-Digit OTP Code
          </Text>
          <TextInput
            placeholder="000000"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            style={{
              backgroundColor: '#0F172A',
              borderRadius: 12,
              padding: 16,
              fontSize: 22,
              fontWeight: '800',
              color: '#38BDF8',
              letterSpacing: 10,
              textAlign: 'center',
              borderWidth: 1,
              borderColor: '#334155',
              marginBottom: 20,
            }}
          />

          <TouchableOpacity
            onPress={handleVerify}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#0D9488',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
              Verify & Enter Workspace
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert('OTP Resent', 'A fresh code has been sent via SMS and WhatsApp.')}
            style={{ alignItems: 'center', marginTop: 16 }}
          >
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>
              Didn't receive code? <Text style={{ color: '#0D9488', fontWeight: '700' }}>Resend in 18s</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}