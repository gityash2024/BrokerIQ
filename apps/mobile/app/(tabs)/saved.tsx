import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { Header } from '../../src/components/common/Header';
import { GURGAON_PROPERTIES } from '../../src/data/gurgaonCatalog';
import { INITIAL_SAVED_PROPERTIES, SavedPropertyItem } from '../../src/data/personaData';

export default function SavedPropertiesScreen() {
  const router = useRouter();
  const { savedPropertyIds, toggleSaveProperty, recordInquiry } = useAuth();

  // Aggregate saved properties across presets and catalog
  const savedList: SavedPropertyItem[] = [];

  INITIAL_SAVED_PROPERTIES.forEach((p) => {
    if (savedPropertyIds.has(p.id)) {
      savedList.push(p);
    }
  });

  GURGAON_PROPERTIES.forEach((g) => {
    if (savedPropertyIds.has(g.id) && !savedList.some((s) => s.id === g.id)) {
      savedList.push({
        id: g.id,
        title: `${g.project} - ${g.unitNumber}`,
        project: g.project,
        sector: g.sector,
        unitNumber: g.unitNumber,
        carpetAreaSqFt: g.carpetAreaSqFt,
        priceDisplay: g.priceDisplay,
        pricePerSqFt: g.pricePerSqFt,
        rentalYieldPct: g.rentalYieldPct,
        category: g.category,
        status: g.status,
        contactName: g.contactName,
        contactPhone: g.contactPhone,
        imageUrl:
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
        savedAt: 'Recently',
      });
    }
  });

  const handleCall = (prop: SavedPropertyItem) => {
    recordInquiry({
      propertyId: prop.id,
      propertyTitle: prop.title,
      sector: prop.sector,
      unitNumber: prop.unitNumber,
      buyerName: 'Vikram Malhotra',
      buyerPhone: '+919820011223',
      buyerBudget: prop.priceDisplay,
      ownerName: prop.contactName,
      ownerPhone: prop.contactPhone,
      status: 'CONTACTED',
      message: `Direct inquiry from Saved Wishlist for ${prop.unitNumber}.`,
    });

    const phone = prop.contactPhone.replace(/\D/g, '');
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Contact', `Calling ${prop.contactName} at +91 ${phone}`);
    });
  };

  const handleWhatsApp = (prop: SavedPropertyItem) => {
    recordInquiry({
      propertyId: prop.id,
      propertyTitle: prop.title,
      sector: prop.sector,
      unitNumber: prop.unitNumber,
      buyerName: 'Vikram Malhotra',
      buyerPhone: '+919820011223',
      buyerBudget: prop.priceDisplay,
      ownerName: prop.contactName,
      ownerPhone: prop.contactPhone,
      status: 'CONTACTED',
      message: `WhatsApp message initiated from Saved Wishlist for ${prop.unitNumber}.`,
    });

    const phone = prop.contactPhone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hello ${prop.contactName}, I have saved ${prop.title} (${prop.sector}, ${prop.priceDisplay}) on BrokerIQ. Could you share the latest site photos and tenant agreement details?`
    );
    Linking.openURL(`https://wa.me/91${phone}?text=${text}`).catch(() => {
      Alert.alert('WhatsApp Inquiry', `Message sent to +91 ${phone}`);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Saved Wishlist"
        subtitle={`${savedList.length} shortlisted commercial & residential units`}
        showNotification={true}
        unreadCount={2}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {savedList.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 32,
              alignItems: 'center',
              marginTop: 40,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>❤️</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
              Your Wishlist is Empty
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Browse verified commercial units and tap the heart icon on any listing to save it here for comparison.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)')}
              style={{
                backgroundColor: '#0D9488',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                Explore Marketplace
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Comparison Metrics Banner */}
            <View
              style={{
                backgroundColor: '#0F172A',
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700' }}>TOTAL SAVED</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 2 }}>
                  {savedList.length} Units
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700' }}>AVG YIELD</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#34D399', marginTop: 2 }}>
                  8.95% ROI
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700' }}>CORRIDORS</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#38BDF8', marginTop: 4 }}>
                  Sec 86-90 & Mumbai
                </Text>
              </View>
            </View>

            {/* Saved Items Cards */}
            {savedList.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                {/* Header Row */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View
                      style={{
                        backgroundColor: '#EFF6FF',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563EB' }}>
                        {item.sector}
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
                        Unit {item.unitNumber}
                      </Text>
                    </View>
                  </View>

                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => toggleSaveProperty(item.id)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: '#FEE2E2',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 2 }}>
                  {item.title}
                </Text>

                {/* Specs */}
                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 12 }}>
                  {item.category} • {item.carpetAreaSqFt} sq.ft • {item.status}
                </Text>

                {/* Metrics Box */}
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
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>PRICE</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                      {item.priceDisplay}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                      {typeof item.pricePerSqFt === 'number'
                        ? `₹${item.pricePerSqFt.toLocaleString()}`
                        : item.pricePerSqFt.startsWith('₹')
                        ? item.pricePerSqFt
                        : `₹${item.pricePerSqFt}`}/sq.ft
                    </Text>
                  </View>

                  {item.rentalYieldPct && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <View
                        style={{
                          backgroundColor: '#DCFCE7',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803D' }}>
                          🔥 {item.rentalYieldPct}% Yield
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                        High ROI Pre-Leased
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleCall(item)}
                    style={{
                      flex: 1,
                      backgroundColor: '#F1F5F9',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                      📞 Call Owner
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleWhatsApp(item)}
                    style={{
                      flex: 1,
                      backgroundColor: '#16A34A',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                      💬 WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
