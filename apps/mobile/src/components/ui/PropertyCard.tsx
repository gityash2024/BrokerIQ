import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface PropertyCardProps {
  id?: string;
  title: string;
  builder?: string;
  price: string;
  pricePerSqFt?: string;
  bhk: string;
  area?: string | number;
  location?: string;
  imageUrl?: string;
  possession?: string;
  matchingLeadsCount?: number;
  reraId?: string;
  onPress?: () => void;
  onSharePress?: () => void;
  onMatchesPress?: () => void;
}

export const PropertyCard = ({
  title,
  builder,
  price,
  pricePerSqFt,
  bhk,
  area,
  location,
  imageUrl,
  possession = 'Ready to Move',
  matchingLeadsCount,
  reraId,
  onPress,
  onSharePress,
  onMatchesPress,
}: PropertyCardProps) => {
  const handleShare = () => {
    if (onSharePress) {
      onSharePress();
    } else {
      const shareText = encodeURIComponent(
        `*${title}* by ${builder || 'Top Developer'}\n📍 ${location || 'Mumbai'}\n💰 Price: ₹ ${price} (${pricePerSqFt || ''})\n🛏️ Config: ${bhk} • ${area ? (typeof area === 'number' ? `${area} sq.ft` : area) : ''}\n🔑 Status: ${possession}\n\nContact Rajesh Sharma (AcreRise Realty) for private viewing: +91 98201 84729`
      );
      Linking.openURL(`https://wa.me/?text=${shareText}`).catch(() => {
        Alert.alert('Brochure', `Sharing details for ${title}`);
      });
    }
  };

  const defaultImg =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {/* Property Hero Image with Overlays */}
      <View style={{ height: 160, backgroundColor: '#CBD5E1', position: 'relative' }}>
        <Image
          source={{ uri: imageUrl || defaultImg }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Top Badges */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#38BDF8' }}>
              RERA APPROVED
            </Text>
          </View>

          <View
            style={{
              backgroundColor: possession.includes('Ready')
                ? 'rgba(22, 163, 74, 0.9)'
                : 'rgba(217, 119, 6, 0.9)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
              {possession}
            </Text>
          </View>
        </View>

        {/* Price Tag Overlay at Bottom Left */}
        <View
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'baseline',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
            ₹ {price}
          </Text>
          {pricePerSqFt && (
            <Text style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>
              {pricePerSqFt}
            </Text>
          )}
        </View>
      </View>

      {/* Property Details Section */}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '800',
                color: '#0F172A',
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {builder && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#0D9488',
                  marginTop: 2,
                }}
              >
                by {builder}
              </Text>
            )}
          </View>

          <View
            style={{
              backgroundColor: '#F0FDFA',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#CCFBF1',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F766E' }}>
              {bhk}
            </Text>
          </View>
        </View>

        {/* Location Row */}
        {location && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                stroke="#64748B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              style={{
                fontSize: 12,
                color: '#64748B',
                marginLeft: 4,
                fontWeight: '500',
              }}
              numberOfLines={1}
            >
              {location}
            </Text>
          </View>
        )}

        {/* Area & Matching Leads Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
          }}
        >
          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>
            {area ? (typeof area === 'number' ? `${area} sq.ft` : area) : 'Spacious Layout'}
          </Text>

          {matchingLeadsCount !== undefined && matchingLeadsCount > 0 ? (
            <TouchableOpacity
              onPress={onMatchesPress}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>
                🔥 {matchingLeadsCount} Matching Leads
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Action Button */}
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: '#0D9488',
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#FFFFFF',
                marginLeft: 6,
              }}
            >
              Share Brochure (PDF)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};