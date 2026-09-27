import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../stores/authStore';
import { GURGAON_PROPERTIES, MarketProperty } from '../../data/gurgaonCatalog';
import { Header } from '../common/Header';

const SECTORS = ['All Sectors', 'Sector-86', 'Sector-88A', 'Sector-89', 'Sector-90', 'Sector-92'];
const CATEGORIES = ['All Types', 'Retail Shop', 'Pre-Leased Rented', 'SCO Commercial Plot', 'Food Court'];

export const SeekerExploreView = () => {
  const router = useRouter();
  const { isPropertySaved, toggleSaveProperty, recordInquiry } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [selectedCategory, setSelectedCategory] = useState('All Types');
  const [investmentBudget, setInvestmentBudget] = useState(12500000); // 1.25 Cr

  // Filter listings
  const filteredListings = useMemo(() => {
    return GURGAON_PROPERTIES.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.unitNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSector =
        selectedSector === 'All Sectors' || item.sector === selectedSector;

      const matchesCategory =
        selectedCategory === 'All Types' ||
        item.category.toLowerCase().includes(selectedCategory.toLowerCase());

      return matchesSearch && matchesSector && matchesCategory;
    });
  }, [searchQuery, selectedSector, selectedCategory]);

  const handleCall = (prop: MarketProperty) => {
    recordInquiry({
      propertyId: prop.id,
      propertyTitle: `${prop.project} - ${prop.unitNumber}`,
      sector: prop.sector,
      unitNumber: prop.unitNumber,
      buyerName: 'Vikram Malhotra',
      buyerPhone: '+919820011223',
      buyerBudget: prop.priceDisplay,
      ownerName: prop.contactName,
      ownerPhone: prop.contactPhone,
      status: 'CONTACTED',
      message: `Direct phone inquiry initiated for Unit ${prop.unitNumber} at ${prop.project}.`,
    });

    const phone = prop.cleanPhone || prop.contactPhone.replace(/\D/g, '');
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Owner', `Calling ${prop.contactName} at +91 ${phone}`);
    });
  };

  const handleWhatsApp = (prop: MarketProperty) => {
    recordInquiry({
      propertyId: prop.id,
      propertyTitle: `${prop.project} - ${prop.unitNumber}`,
      sector: prop.sector,
      unitNumber: prop.unitNumber,
      buyerName: 'Vikram Malhotra',
      buyerPhone: '+919820011223',
      buyerBudget: prop.priceDisplay,
      ownerName: prop.contactName,
      ownerPhone: prop.contactPhone,
      status: 'CONTACTED',
      message: `WhatsApp brochure & ROI request sent for Unit ${prop.unitNumber}.`,
    });

    const phone = prop.cleanPhone || prop.contactPhone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hi ${prop.contactName}, I found your listing for ${prop.project} Unit ${prop.unitNumber} (${prop.sector}, ${prop.priceDisplay}) on BrokerIQ. I would like to review the lease deed and discuss terms.`
    );
    Linking.openURL(`https://wa.me/91${phone}?text=${text}`).catch(() => {
      Alert.alert('WhatsApp Inquiry', `Sent inquiry to +91 ${phone}`);
    });
  };

  // Calculation for ROI Widget
  const estimatedAnnualYield = (investmentBudget * 0.088); // 8.8%
  const monthlyRentalReturn = Math.round(estimatedAnnualYield / 12);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Explore Properties"
        subtitle="Dwarka Expressway & Luxury Corridors"
        showNotification={true}
        unreadCount={2}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Housing.com Style Search Hero */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
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
                DIRECT OWNER & BUILDER
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>Zero Brokerage Options</Text>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: '#FFFFFF',
              letterSpacing: -0.3,
              marginBottom: 14,
              lineHeight: 24,
            }}
          >
            Find Commercial Retail, SCOs & Luxury Homes in New Gurgaon
          </Text>

          {/* Search Input Box */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1E293B',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#334155',
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx="11" cy="11" r="7" stroke="#94A3B8" strokeWidth="2" />
              <Path d="M21 21l-4.35-4.35" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
            </Svg>

            <TextInput
              placeholder="Search by project, sector (e.g. SS Omnia, 86, SCO)..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                marginLeft: 10,
                color: '#FFFFFF',
                fontSize: 13,
                paddingVertical: 4,
              }}
            />

            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sector Filter Chips */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8, letterSpacing: 0.2 }}>
          MICRO-MARKET SECTOR CORRIDORS
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
        >
          {SECTORS.map((sector) => {
            const isSelected = selectedSector === sector;
            return (
              <TouchableOpacity
                key={sector}
                activeOpacity={0.8}
                onPress={() => setSelectedSector(sector)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: isSelected ? '#0D9488' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isSelected ? '#0D9488' : '#E2E8F0',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '800' : '600',
                    color: isSelected ? '#FFFFFF' : '#475569',
                  }}
                >
                  {sector}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 18 }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: isSelected ? '#0F172A' : '#F1F5F9',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? '#FFFFFF' : '#64748B',
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Investment ROI & Rental Yield Calculator Widget */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#ECFDF5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 13 }}>📈</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                Commercial Rental Yield Calculator
              </Text>
            </View>
            <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#16A34A' }}>8.8% Avg ROI</Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Simulate monthly income from pre-leased retail shops & SCO commercial plots.
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Target Investment:</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[7500000, 12500000, 25000000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setInvestmentBudget(amount)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: investmentBudget === amount ? '#0D9488' : '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: investmentBudget === amount ? '#FFFFFF' : '#475569',
                    }}
                  >
                    ₹{(amount / 10000000).toFixed(2)} Cr
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC',
              padding: 12,
              borderRadius: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: '#64748B' }}>Est. Monthly Rent</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0D9488', marginTop: 2 }}>
                ₹{monthlyRentalReturn.toLocaleString('en-IN')} / mo
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#64748B' }}>Annual Pre-Tax Return</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 }}>
                ₹{(estimatedAnnualYield / 100000).toFixed(2)} Lakh
              </Text>
            </View>
          </View>
        </View>

        {/* Listings Section Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
            Featured Units ({filteredListings.length})
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/market-hub')}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0D9488' }}>
              View Directory Map →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Listings Cards */}
        {filteredListings.map((listing) => {
          const isSaved = isPropertySaved(listing.id);

          return (
            <View
              key={listing.id}
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
              {/* Top Tag Row */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
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

                {/* Wishlist Heart Button */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleSaveProperty(listing.id)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isSaved ? '#FEE2E2' : '#F8FAFC',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: isSaved ? '#FECACA' : '#E2E8F0',
                  }}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill={isSaved ? '#EF4444' : 'none'}>
                    <Path
                      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                      stroke={isSaved ? '#EF4444' : '#64748B'}
                      strokeWidth="2"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>

              {/* Title & Complex */}
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                {listing.project}
              </Text>

              {/* Tenancy & Category */}
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 10 }}>
                {listing.category} • {listing.floor} • {listing.carpetAreaSqFt} sq.ft
              </Text>

              {/* Price & ROI Callout */}
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
                  <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>ASKING PRICE</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                    {listing.priceDisplay}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                    {listing.pricePerSqFt.startsWith('₹') ? listing.pricePerSqFt : `₹${listing.pricePerSqFt}`}/sq.ft
                  </Text>
                </View>

                {listing.rentalYieldPct ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <View
                      style={{
                        backgroundColor: '#DCFCE7',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        marginBottom: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803D' }}>
                        🔥 {listing.rentalYieldPct}% Yield
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#64748B' }}>
                      {listing.status}
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0D9488' }}>
                      {listing.status}
                    </Text>
                  </View>
                )}
              </View>

              {/* Contact Actions Row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleCall(listing)}
                  style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                  </Svg>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                    Call Owner
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleWhatsApp(listing)}
                  style={{
                    flex: 1,
                    backgroundColor: '#16A34A',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                    shadowColor: '#16A34A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </Svg>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                    WhatsApp Inquiry
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default SeekerExploreView;
