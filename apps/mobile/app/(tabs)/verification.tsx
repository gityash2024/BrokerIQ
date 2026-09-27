import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { Header } from '../../src/components/common/Header';
import { VerificationBadgeItem } from '../../src/data/personaData';

export default function VerificationScreen() {
  const { verificationBadges, updateVerificationBadge } = useAuth();

  const verifiedCount = verificationBadges.filter((b) => b.status === 'VERIFIED').length;
  const scorePercent = Math.round((verifiedCount / verificationBadges.length) * 100);

  const handleVerifyPending = (badge: VerificationBadgeItem) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    updateVerificationBadge(badge.id, 'VERIFIED');
    Alert.alert(
      '✅ Document Verified Successfully!',
      `${badge.title} has been authenticated with DigiLocker and Haryana State Revenue API.`
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Owner Trust Center"
        subtitle="DigiLocker, Aadhaar & Tehsil Registry"
        showNotification={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Trust Score Header Banner */}
        <View
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: '#D97706',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                  GOLD TRUST TIER
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>Top 5% Verified Landlord</Text>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: '#FBBF24' }}>
              {scorePercent}%
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 }}>
            Landlord Trust Badges
          </Text>
          <Text style={{ fontSize: 12, color: '#94A3B8', lineHeight: 18, marginBottom: 14 }}>
            Verified owner listings receive 4.2x more buyer inquiries and prime top-tier ranking in the marketplace.
          </Text>

          {/* Progress Bar */}
          <View
            style={{
              height: 6,
              backgroundColor: '#1E293B',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${scorePercent}%`,
                height: '100%',
                backgroundColor: '#10B981',
                borderRadius: 3,
              }}
            />
          </View>
        </View>

        {/* Badges List */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>
          Verification Badges ({verifiedCount}/{verificationBadges.length})
        </Text>

        {verificationBadges.map((badge) => {
          const isVerified = badge.status === 'VERIFIED';

          return (
            <View
              key={badge.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: isVerified ? '#E2E8F0' : '#FED7AA',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', flex: 1, marginRight: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: isVerified ? '#ECFDF5' : '#FFF7ED',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                        stroke={isVerified ? '#10B981' : '#F59E0B'}
                        strokeWidth="2"
                      />
                      {isVerified && (
                        <Path
                          d="M9 12l2 2 4-4"
                          stroke="#10B981"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      )}
                    </Svg>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 }}>
                      {badge.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 16 }}>
                      {badge.subtitle}
                    </Text>
                    {badge.documentNumber && (
                      <Text style={{ fontSize: 10, color: '#0284C7', fontWeight: '700', marginTop: 4 }}>
                        Ref: {badge.documentNumber} {badge.verifiedDate ? `• ${badge.verifiedDate}` : ''}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Status Tag or Action */}
                {isVerified ? (
                  <View
                    style={{
                      backgroundColor: '#DCFCE7',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#16A34A' }}>
                      VERIFIED
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleVerifyPending(badge)}
                    style={{
                      backgroundColor: '#0D9488',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                      Verify Now
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Benefits Card */}
        <View
          style={{
            backgroundColor: '#EFF6FF',
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: '#BFDBFE',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 6 }}>
            🛡️ Verified Landlord Benefits
          </Text>
          <Text style={{ fontSize: 11, color: '#1E3A8A', lineHeight: 17 }}>
            • "Direct Owner Verified" green badge on all marketplace cards{'\n'}
            • Priority placement in search results and AI property matching{'\n'}
            • High-intent buyer phone inquiries forwarded directly to your WhatsApp{'\n'}
            • Free legal deed verification assistance from BrokerIQ advisors
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
