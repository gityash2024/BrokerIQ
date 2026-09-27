import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { PropertyCard } from '../../src/components/ui/PropertyCard';
import { MOCK_PROPERTIES, MOCK_LEADS, Property, Lead } from '../../src/data/mockData';
import Svg, { Path, Circle } from 'react-native-svg';

import { useCRMProperties } from '../../src/stores/propertyStore';

export default function PropertiesScreen() {
  const { properties, addProperty } = useCRMProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'READY' | 'UNDER_CONST' | 'COMMERCIAL' | 'LUXURY'>('ALL');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Property Form State
  const [newTitle, setNewTitle] = useState('');
  const [newBuilder, setNewBuilder] = useState('');
  const [newLocation, setNewLocation] = useState('Lower Parel, South Mumbai');
  const [newPrice, setNewPrice] = useState('4.80 Cr');
  const [newBhk, setNewBhk] = useState('3 BHK Luxe');
  const [newArea, setNewArea] = useState('1650');
  const [newPossession, setNewPossession] = useState('Ready to Move');
  const [newRera, setNewRera] = useState('P51900049210');
  const [newType, setNewType] = useState<'Apartment' | 'Commercial Office' | 'Penthouse'>('Apartment');

  const filteredProperties = properties.filter((prop) => {
    // Filter chip logic
    let matchesFilter = true;
    if (activeFilter === 'READY') {
      matchesFilter = prop.possession.toLowerCase().includes('ready');
    } else if (activeFilter === 'UNDER_CONST') {
      matchesFilter = prop.possession.toLowerCase().includes('under construction');
    } else if (activeFilter === 'COMMERCIAL') {
      matchesFilter = prop.type === 'Commercial Office' || prop.bhk.toLowerCase().includes('commercial');
    } else if (activeFilter === 'LUXURY') {
      const numPrice = parseFloat(prop.price);
      matchesFilter = !isNaN(numPrice) && numPrice >= 5.0;
    }

    // Search query logic
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      prop.title.toLowerCase().includes(q) ||
      prop.builder.toLowerCase().includes(q) ||
      prop.location.toLowerCase().includes(q) ||
      prop.subLocation.toLowerCase().includes(q) ||
      prop.reraId.toLowerCase().includes(q) ||
      prop.bhk.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const handleCreateProperty = () => {
    if (!newTitle.trim() || !newBuilder.trim()) {
      Alert.alert('Required Fields', 'Please enter property title and builder name.');
      return;
    }

    const createdProp: Property = {
      id: `prop-${Date.now()}`,
      title: newTitle.trim(),
      builder: newBuilder.trim(),
      location: newLocation,
      subLocation: 'Prime Micro-Market',
      price: newPrice.trim(),
      pricePerSqFt: '₹ 28,500 / sq.ft',
      bhk: newBhk,
      areaSqFt: parseInt(newArea, 10) || 1500,
      possession: newPossession,
      reraId: newRera.trim(),
      furnishing: 'Semi-Furnished',
      type: newType,
      purpose: 'Sale',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
      matchingLeadsCount: 4,
      amenities: ['Clubhouse', 'Swimming Pool', '24x7 Security', 'Covered Parking', 'Power Backup'],
      description: `Premium newly listed ${newBhk} inventory in ${newLocation}. Verified title deeds and ready for immediate client inspections.`,
      contactPerson: 'Rajesh Sharma (Managing Broker) - +91 98201 84729',
    };

    addProperty(createdProp);
    setNewTitle('');
    setNewBuilder('');
    setIsAddModalOpen(false);
    Alert.alert('Inventory Added', `Successfully added ${createdProp.title} to your portfolio!`);
  };

  const handleShareBrochure = (prop: Property) => {
    const text = encodeURIComponent(
      `*${prop.title}* by ${prop.builder}\n` +
      `📍 *Location:* ${prop.location} (${prop.subLocation})\n` +
      `💰 *Price:* ₹ ${prop.price} (${prop.pricePerSqFt})\n` +
      `🛏️ *Configuration:* ${prop.bhk} • ${prop.areaSqFt} sq.ft\n` +
      `🔑 *Possession:* ${prop.possession}\n` +
      `📜 *MahaRERA ID:* ${prop.reraId}\n` +
      `✨ *Amenities:* ${prop.amenities.slice(0, 4).join(', ')}\n\n` +
      `Contact Rajesh Sharma (AcreRise Realty & Advisory) for exclusive VIP viewing:\n📞 +91 98201 84729`
    );
    Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {
      Alert.alert('Brochure Sent', `Luxury brochure for ${prop.title} generated.`);
    });
  };

  // Get matching leads for a selected property
  const getMatchingLeads = (prop: Property): Lead[] => {
    return MOCK_LEADS.filter(
      (l) =>
        l.matchingPropertyId === prop.id ||
        l.bhk.includes(prop.bhk.substring(0, 2)) ||
        prop.location.toLowerCase().includes(l.location.toLowerCase().split('/')[0].trim())
    ).slice(0, 3);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Inventory & Projects"
        subtitle={`${filteredProperties.length} Prime Units • ₹ 48.5 Cr Total Value`}
        showNotification={false}
      />

      {/* Search Input Bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx="11" cy="11" r="7" stroke="#64748B" strokeWidth="2" />
            <Path d="M20 20l-4.35-4.35" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
          </Svg>
          <TextInput
            placeholder="Search projects, builders, locations, RERA..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 14,
              color: '#0F172A',
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={{ paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {[
            { key: 'ALL', label: `All (${properties.length})` },
            {
              key: 'READY',
              label: `Ready to Move (${properties.filter((p) => p.possession.includes('Ready')).length})`,
            },
            {
              key: 'UNDER_CONST',
              label: `Under Const. (${properties.filter((p) => p.possession.includes('Under Construction')).length})`,
            },
            {
              key: 'COMMERCIAL',
              label: `Commercial (${properties.filter((p) => p.type === 'Commercial Office' || p.bhk.includes('Commercial')).length})`,
            },
            {
              key: 'LUXURY',
              label: `Luxury > ₹5 Cr (${properties.filter((p) => parseFloat(p.price) >= 5.0).length})`,
            },
          ].map((tab) => {
            const isSelected = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key as any)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isSelected ? '#0D9488' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isSelected ? '#0D9488' : '#E2E8F0',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '600',
                    color: isSelected ? '#FFFFFF' : '#475569',
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Property Cards List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredProperties.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 32,
              alignItems: 'center',
              marginTop: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
              No properties matched
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              Try searching by builder or location, or add a new listing.
            </Text>
          </View>
        ) : (
          filteredProperties.map((prop) => (
            <PropertyCard
              key={prop.id}
              id={prop.id}
              title={prop.title}
              builder={prop.builder}
              price={prop.price}
              pricePerSqFt={prop.pricePerSqFt}
              bhk={prop.bhk}
              area={prop.areaSqFt}
              location={`${prop.location} • ${prop.subLocation}`}
              imageUrl={prop.imageUrl}
              possession={prop.possession}
              matchingLeadsCount={prop.matchingLeadsCount}
              reraId={prop.reraId}
              onPress={() => setSelectedProperty(prop)}
              onSharePress={() => handleShareBrochure(prop)}
              onMatchesPress={() => setSelectedProperty(prop)}
            />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button: Add Listing */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsAddModalOpen(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          backgroundColor: '#0D9488',
          borderRadius: 28,
          paddingHorizontal: 20,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#0D9488',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginLeft: 8 }}>
          Add Listing
        </Text>
      </TouchableOpacity>

      {/* Property Details Modal */}
      <Modal
        visible={!!selectedProperty}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProperty(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
              overflow: 'hidden',
            }}
          >
            {selectedProperty && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Header Image */}
                <View style={{ height: 210, position: 'relative', backgroundColor: '#0F172A' }}>
                  <Image
                    source={{ uri: selectedProperty.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setSelectedProperty(null)}
                    activeOpacity={0.8}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 16, color: '#FFFFFF', fontWeight: '800' }}>✕</Text>
                  </TouchableOpacity>

                  <View
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: 16,
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#38BDF8' }}>
                      MahaRERA: {selectedProperty.reraId}
                    </Text>
                  </View>
                </View>

                {/* Content Body */}
                <View style={{ padding: 20 }}>
                  {/* Title & Price Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
                        {selectedProperty.title}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0D9488', marginTop: 2 }}>
                        by {selectedProperty.builder}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                        📍 {selectedProperty.location} ({selectedProperty.subLocation})
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A' }}>
                        ₹ {selectedProperty.price}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {selectedProperty.pricePerSqFt}
                      </Text>
                    </View>
                  </View>

                  {/* Specs Grid */}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      backgroundColor: '#F8FAFC',
                      borderRadius: 14,
                      padding: 14,
                      marginTop: 18,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      gap: 12,
                    }}
                  >
                    <View style={{ width: '46%' }}>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>CONFIGURATION</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 }}>
                        {selectedProperty.bhk}
                      </Text>
                    </View>
                    <View style={{ width: '46%' }}>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>CARPET AREA</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 }}>
                        {selectedProperty.areaSqFt} sq.ft
                      </Text>
                    </View>
                    <View style={{ width: '46%' }}>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>POSSESSION</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#16A34A', marginTop: 2 }}>
                        {selectedProperty.possession}
                      </Text>
                    </View>
                    <View style={{ width: '46%' }}>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>FURNISHING</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 }}>
                        {selectedProperty.furnishing}
                      </Text>
                    </View>
                  </View>

                  {/* Amenities */}
                  <View style={{ marginTop: 18 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>
                      Verified Project Amenities
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {selectedProperty.amenities.map((amenity, i) => (
                        <View
                          key={i}
                          style={{
                            backgroundColor: '#F0FDFA',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#CCFBF1',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F766E' }}>
                            ✓ {amenity}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Description */}
                  <View style={{ marginTop: 18 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>
                      Overview & Architecture
                    </Text>
                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                      {selectedProperty.description}
                    </Text>
                  </View>

                  {/* Developer Direct Sales Desk */}
                  <View
                    style={{
                      backgroundColor: '#F1F5F9',
                      borderRadius: 14,
                      padding: 14,
                      marginTop: 18,
                      borderLeftWidth: 4,
                      borderLeftColor: '#0D9488',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F766E' }}>
                      DEVELOPER VIP SALES DESK
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 4 }}>
                      {selectedProperty.contactPerson}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Direct inventory lock & commission confirmation desk.
                    </Text>
                  </View>

                  {/* Matching High-Net-Worth Buyers */}
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                        🔥 Matching VIP Buyers ({getMatchingLeads(selectedProperty).length})
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0D9488', fontWeight: '700' }}>
                        AI Auto-Scored
                      </Text>
                    </View>

                    {getMatchingLeads(selectedProperty).map((lead) => (
                      <View
                        key={lead.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                            {lead.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            Budget: {lead.budgetMin} – {lead.budgetMax} • Match: {lead.aiScore}%
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${lead.phone.replace(/\s+/g, '')}`)}
                            style={{
                              backgroundColor: '#F0FDFA',
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#CCFBF1',
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0D9488' }}>Call</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              const clean = lead.phone.replace(/[^0-9]/g, '');
                              Linking.openURL(
                                `https://wa.me/${clean}?text=${encodeURIComponent(
                                  `Hello ${lead.name}, regarding your ${lead.bhk} requirement, here are the verified details for ${selectedProperty.title}: ₹ ${selectedProperty.price}. Let me know if you would like a private walkthrough.`
                                )}`
                              );
                            }}
                            style={{
                              backgroundColor: '#DCFCE7',
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#BBF7D0',
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Share Luxury PDF Action */}
                  <TouchableOpacity
                    onPress={() => handleShareBrochure(selectedProperty)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: '#0D9488',
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                      marginTop: 20,
                      marginBottom: 10,
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginLeft: 8 }}>
                      Share Luxury PDF Brochure
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Property Listing Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '90%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                Add Exclusive Listing
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Project / Property Title *
              </Text>
              <TextInput
                placeholder="e.g. Rustomjee Crown Tower A"
                placeholderTextColor="#94A3B8"
                value={newTitle}
                onChangeText={setNewTitle}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 14,
                }}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Developer / Builder Name *
              </Text>
              <TextInput
                placeholder="e.g. Rustomjee Developers"
                placeholderTextColor="#94A3B8"
                value={newBuilder}
                onChangeText={setNewBuilder}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 14,
                }}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Location / Micro-Market
              </Text>
              <TextInput
                placeholder="e.g. Prabhadevi, South Mumbai"
                placeholderTextColor="#94A3B8"
                value={newLocation}
                onChangeText={setNewLocation}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 14,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                    Asking Price (Cr)
                  </Text>
                  <TextInput
                    placeholder="e.g. 5.50 Cr"
                    placeholderTextColor="#94A3B8"
                    value={newPrice}
                    onChangeText={setNewPrice}
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 14,
                      color: '#0F172A',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      marginBottom: 14,
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                    Carpet Area (sq.ft)
                  </Text>
                  <TextInput
                    placeholder="e.g. 1850"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newArea}
                    onChangeText={setNewArea}
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 14,
                      color: '#0F172A',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      marginBottom: 14,
                    }}
                  />
                </View>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Configuration
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['2 BHK', '3 BHK Luxe', '4 BHK', 'Commercial'].map((bhk) => (
                  <TouchableOpacity
                    key={bhk}
                    onPress={() => setNewBhk(bhk)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: newBhk === bhk ? '#0D9488' : '#F1F5F9',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: newBhk === bhk ? '#FFFFFF' : '#475569',
                      }}
                    >
                      {bhk}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                MahaRERA Registration Number
              </Text>
              <TextInput
                placeholder="e.g. P51900012345"
                placeholderTextColor="#94A3B8"
                value={newRera}
                onChangeText={setNewRera}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 20,
                }}
              />

              <TouchableOpacity
                onPress={handleCreateProperty}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#0D9488',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                  Save & Publish to Portfolio
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}