import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../stores/authStore';
import { Header } from '../common/Header';

export const OwnerListingsView = () => {
  const router = useRouter();
  const { ownerListings, toggleBoostListing, inquiries } = useAuth();

  const totalViews = ownerListings.reduce((sum, item) => sum + item.viewsCount, 0);
  const totalInquiries = ownerListings.reduce((sum, item) => sum + item.inquiriesCount, 0);

  const handleBoost = (id: string, isCurrentlyBoosted: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    toggleBoostListing(id);
    Alert.alert(
      isCurrentlyBoosted ? 'Boost Deactivated' : '🔥 Listing Boost Activated!',
      isCurrentlyBoosted
        ? 'Your listing has returned to standard ranking.'
        : 'Your listing will now appear at the top of Seeker search results with 4x visibility.'
    );
  };

  const handleCallBuyer = (phone: string, name: string) => {
    const clean = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Call Buyer', `Calling ${name} at +91 ${clean}`);
    });
  };

  const handleWhatsAppBuyer = (phone: string, name: string, unit: string) => {
    const clean = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hello ${name}, thank you for your inquiry on BrokerIQ regarding my commercial unit ${unit}. When would you like to schedule a visit?`
    );
    Linking.openURL(`https://wa.me/91${clean}?text=${text}`).catch(() => {
      Alert.alert('WhatsApp Reply', `Opening WhatsApp for ${name}`);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="My Listed Units"
        subtitle="SS Omnia & Commercial Portfolio"
        showNotification={true}
        unreadCount={3}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio KPI Overview Banner */}
        <View
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
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
                  backgroundColor: '#0D9488',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                  OWNER DASHBOARD
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>Verified Landlord</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/verification')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(217, 119, 6, 0.2)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(217, 119, 6, 0.4)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#FBBF24' }}>
                ⭐ 85% KYC Score
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 14 }}>
            Commercial Portfolio
          </Text>

          {/* Metric Columns */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#1E293B',
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>Active Units</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 2 }}>
                {ownerListings.length}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>Seeker Views</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#38BDF8', marginTop: 2 }}>
                {totalViews}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>Inquiries</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#34D399', marginTop: 2 }}>
                {totalInquiries}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>Occupancy</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FBBF24', marginTop: 2 }}>
                67%
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Shortcuts */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/post-property')}
            style={{
              flex: 1,
              backgroundColor: '#0D9488',
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#0D9488',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
              Post New Unit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/verification')}
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                stroke="#0284C7"
                strokeWidth="2"
              />
              <Path d="M9 12l2 2 4-4" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
            </Svg>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
              Trust Badges
            </Text>
          </TouchableOpacity>
        </View>

        {/* Listings Section Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
            Managed Properties ({ownerListings.length})
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>Tap Boost for top ranking</Text>
        </View>

        {/* Listings Cards */}
        {ownerListings.map((listing) => (
          <View
            key={listing.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: listing.isBoosted ? '#99F6E4' : '#E2E8F0',
              shadowColor: listing.isBoosted ? '#0D9488' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: listing.isBoosted ? 0.1 : 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {/* Top Row: Sector, Unit & Verified Badge */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563EB' }}>
                    {listing.sector}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#F1F5F9',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                    Unit {listing.unitNumber}
                  </Text>
                </View>
              </View>

              {listing.verified && (
                <View
                  style={{
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
                  </Svg>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#16A34A' }}>
                    Verified Unit
                  </Text>
                </View>
              )}
            </View>

            {/* Title & Floor */}
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 3 }}>
              {listing.project}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 12 }}>
              {listing.floor} • {listing.carpetAreaSqFt} sq.ft • {listing.tenancy}
            </Text>

            {/* Price & Metrics Bar */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
                padding: 12,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <View>
                <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>VALUATION / PRICE</Text>
                <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A', marginTop: 1 }}>
                  {listing.priceDisplay}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>VIEWS</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#2563EB', marginTop: 1 }}>
                  👁️ {listing.viewsCount}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>BUYER LEADS</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#16A34A', marginTop: 1 }}>
                  💬 {listing.inquiriesCount}
                </Text>
              </View>
            </View>

            {/* 1-Tap Boost Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleBoost(listing.id, listing.isBoosted)}
              style={{
                backgroundColor: listing.isBoosted ? '#0D9488' : '#FEF3C7',
                borderWidth: 1,
                borderColor: listing.isBoosted ? '#0D9488' : '#FDE68A',
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: listing.isBoosted ? '#FFFFFF' : '#B45309',
                }}
              >
                {listing.isBoosted
                  ? '🔥 BOOST ACTIVE (Priority Search Position)'
                  : '⚡ 1-Tap Boost Visibility (+4x Leads)'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Inbound Buyer Inquiries Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
            Recent Buyer Inquiries ({inquiries.length})
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/inquiries')}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0D9488' }}>
              All Inquiries →
            </Text>
          </TouchableOpacity>
        </View>

        {inquiries.slice(0, 3).map((inq) => (
          <View
            key={inq.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                {inq.buyerName}
              </Text>
              <View
                style={{
                  backgroundColor: inq.status === 'NEGOTIATION' ? '#FEF3C7' : '#EFF6FF',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: inq.status === 'NEGOTIATION' ? '#B45309' : '#2563EB',
                  }}
                >
                  {inq.status}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
              Inquired on {inq.propertyTitle} • Budget: {inq.buyerBudget}
            </Text>

            <Text style={{ fontSize: 12, color: '#334155', marginBottom: 10, fontStyle: 'italic' }}>
              "{inq.message}"
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleCallBuyer(inq.buyerPhone, inq.buyerName)}
                style={{
                  flex: 1,
                  backgroundColor: '#F1F5F9',
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>
                  📞 Call Buyer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleWhatsAppBuyer(inq.buyerPhone, inq.buyerName, inq.unitNumber)}
                style={{
                  flex: 1,
                  backgroundColor: '#16A34A',
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                  💬 WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default OwnerListingsView;
