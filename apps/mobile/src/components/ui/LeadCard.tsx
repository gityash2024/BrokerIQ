import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { StatusBadge } from './StatusBadge';
import Svg, { Path, Circle } from 'react-native-svg';

export interface LeadCardProps {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  requirement?: string;
  property?: string;
  budgetMin?: string;
  budgetMax?: string;
  stage: string;
  source?: string;
  priority?: string;
  followUpDate?: string;
  followUpTime?: string;
  aiScore?: number;
  onPress?: () => void;
  onCallPress?: () => void;
  onWhatsAppPress?: () => void;
}

export const LeadCard = ({
  name,
  phone,
  requirement,
  property,
  budgetMin,
  budgetMax,
  stage,
  source,
  priority = 'WARM',
  followUpDate,
  followUpTime,
  aiScore,
  onPress,
  onCallPress,
  onWhatsAppPress,
}: LeadCardProps) => {
  const initials = (name || 'Lead')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleCall = () => {
    if (onCallPress) {
      onCallPress();
    } else {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
        Alert.alert('Call', `Calling ${phone}`);
      });
    }
  };

  const handleWhatsApp = () => {
    if (onWhatsAppPress) {
      onWhatsAppPress();
    } else {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const text = encodeURIComponent(
        `Hello ${name}, this is Rajesh Sharma from AcreRise Realty regarding your real estate inquiry.`
      );
      Linking.openURL(`https://wa.me/${cleanPhone}?text=${text}`).catch(() => {
        Alert.alert('WhatsApp', `Opening WhatsApp for ${phone}`);
      });
    }
  };

  const isHot = priority === 'HOT';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isHot ? '#FECACA' : '#E2E8F0',
        shadowColor: isHot ? '#EF4444' : '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isHot ? 0.08 : 0.03,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Top Header Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: isHot ? '#FEE2E2' : '#F0FDFA',
              borderWidth: 1.5,
              borderColor: isHot ? '#FCA5A5' : '#CCFBF1',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              position: 'relative',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isHot ? '#B91C1C' : '#0F766E',
              }}
            >
              {initials}
            </Text>
            {isHot && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#EF4444',
                  borderWidth: 1.5,
                  borderColor: '#FFFFFF',
                }}
              />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#0F172A',
                  marginRight: 6,
                }}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>
                {phone}
              </Text>
              {source && (
                <View
                  style={{
                    backgroundColor: '#F1F5F9',
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 4,
                    marginLeft: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>
                    {source}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <StatusBadge status={stage} />
      </View>

      {/* Requirement / Property snippet */}
      {(requirement || property) && (
        <View
          style={{
            backgroundColor: '#F8FAFC',
            padding: 10,
            borderRadius: 10,
            marginBottom: 10,
            borderLeftWidth: 3,
            borderLeftColor: '#0D9488',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#1E293B',
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {requirement || property}
          </Text>
          {(budgetMin || budgetMax) && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#0D9488',
                marginTop: 4,
              }}
            >
              Budget: {budgetMin} {budgetMax ? `– ${budgetMax}` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Footer Info & 1-Tap Action Row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          paddingTop: 10,
          marginTop: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {followUpTime && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke="#EA580C" strokeWidth="2" />
                <Path d="M12 7v5l3 2" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: '#EA580C',
                  marginLeft: 4,
                }}
              >
                {followUpDate ? `${followUpDate} ` : ''}
                {followUpTime}
              </Text>
            </View>
          )}
          {aiScore && (
            <View
              style={{
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginLeft: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>
                ⚡ {aiScore}% Match
              </Text>
            </View>
          )}
        </View>

        {/* Quick Action Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={handleCall}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F0FDFA',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#99F6E4',
            }}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                stroke="#0F766E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#0F766E',
                marginLeft: 4,
              }}
            >
              Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#DCFCE7',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#86EFAC',
            }}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                stroke="#15803D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#15803D',
                marginLeft: 4,
              }}
            >
              WhatsApp
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};