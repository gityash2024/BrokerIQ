import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { Header } from '../../src/components/common/Header';

const SECTORS = ['Sector-86', 'Sector-88A', 'Sector-89', 'Sector-90', 'Sector-92', 'Dwarka Expressway'];
const PROPERTY_TYPES = ['Retail Shop', 'SCO Commercial Plot', 'Food Court Unit', 'Corporate Office', 'Luxury Apartment'];
const FLOORS = ['Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)', 'Lower Ground (LGF)'];
const TENANCY_OPTIONS = ['Pre-Leased Rented', 'Ready Vacant', 'Under Construction'];

export default function PostPropertyScreen() {
  const router = useRouter();
  const { addOwnerListing } = useAuth();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Basics
  const [project, setProject] = useState('SS Highpoint');
  const [sector, setSector] = useState('Sector-86');
  const [unitNumber, setUnitNumber] = useState('Shop G-24');
  const [propertyType, setPropertyType] = useState('Retail Shop');

  // Step 2: Specs
  const [carpetArea, setCarpetArea] = useState('520');
  const [floor, setFloor] = useState('Ground Floor (GF)');
  const [tenancy, setTenancy] = useState('Pre-Leased Rented');

  // Step 3: Pricing & Docs
  const [priceDisplay, setPriceDisplay] = useState('₹1.35 Cr');
  const [monthlyRent, setMonthlyRent] = useState('₹95,000 / month');
  const [enableVerifiedBadge, setEnableVerifiedBadge] = useState(true);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!project.trim() || !unitNumber.trim()) {
        Alert.alert('Required Fields', 'Please enter project name and unit number.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!carpetArea.trim()) {
        Alert.alert('Required Fields', 'Please enter carpet area in sq.ft.');
        return;
      }
      setCurrentStep(3);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const areaNum = parseInt(carpetArea) || 500;
    const priceNum = 13500000;
    const perSqFt = Math.round(priceNum / areaNum);

    addOwnerListing({
      project,
      sector,
      unitNumber,
      floor,
      carpetAreaSqFt: areaNum,
      priceDisplay,
      pricePerSqFt: perSqFt,
      status: tenancy === 'Pre-Leased Rented' ? `Rented @ ${monthlyRent}` : 'Ready Shop',
      tenancy,
    });

    Alert.alert(
      '🎉 Listing Published Successfully!',
      `${project} ${unitNumber} is now live with Instant Verified Badge on BrokerIQ. Inbound buyer inquiries will appear in your Leads tab.`,
      [
        {
          text: 'View My Listings',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Post New Listing"
        subtitle="3-Step Verified Owner Listing Wizard"
        showNotification={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step Progression Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingHorizontal: 8,
          }}
        >
          {[1, 2, 3].map((step) => {
            const isDone = currentStep > step;
            const isCurrent = currentStep === step;

            return (
              <React.Fragment key={step}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isCurrent ? '#0D9488' : isDone ? '#047857' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: isCurrent || isDone ? '#FFFFFF' : '#64748B' }}>
                      {isDone ? '✓' : step}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: isCurrent ? '800' : '600',
                      color: isCurrent ? '#0D9488' : '#64748B',
                      marginTop: 4,
                    }}
                  >
                    {step === 1 ? 'Basics' : step === 2 ? 'Specs' : 'Pricing & Docs'}
                  </Text>
                </View>

                {step < 3 && (
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: currentStep > step ? '#0D9488' : '#E2E8F0',
                      marginHorizontal: 8,
                      marginBottom: 14,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Step 1: Basics */}
        {currentStep === 1 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
              Step 1: Property Location & Project
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
              Enter the complex name and unit location.
            </Text>

            {/* Project Name */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Project / Complex Name *
            </Text>
            <TextInput
              placeholder="e.g. SS Omnia, SS Highpoint, Signature Signum"
              placeholderTextColor="#94A3B8"
              value={project}
              onChangeText={setProject}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#0F172A',
                marginBottom: 16,
              }}
            />

            {/* Sector Picker */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Sector *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SECTORS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSector(s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: sector === s ? '#0D9488' : '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: sector === s ? '800' : '600',
                      color: sector === s ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit Number */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Unit / Shop Number *
            </Text>
            <TextInput
              placeholder="e.g. Shop G-80, SCO-309"
              placeholderTextColor="#94A3B8"
              value={unitNumber}
              onChangeText={setUnitNumber}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#0F172A',
                marginBottom: 16,
              }}
            />

            {/* Property Type */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Property Category *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROPERTY_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt}
                  onPress={() => setPropertyType(pt)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: propertyType === pt ? '#0F172A' : '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: propertyType === pt ? '800' : '600',
                      color: propertyType === pt ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {pt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Specs */}
        {currentStep === 2 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
              Step 2: Area & Specifications
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
              Define carpet area, floor level, and current tenancy status.
            </Text>

            {/* Carpet Area */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Carpet Area (sq.ft) *
            </Text>
            <TextInput
              placeholder="e.g. 520"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={carpetArea}
              onChangeText={setCarpetArea}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#0F172A',
                marginBottom: 16,
              }}
            />

            {/* Floor Selection */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Floor Level *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {FLOORS.map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFloor(f)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: floor === f ? '#0D9488' : '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: floor === f ? '800' : '600',
                      color: floor === f ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tenancy Selection */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Current Tenancy / Occupancy Status *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TENANCY_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTenancy(t)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: tenancy === t ? '#0F172A' : '#F1F5F9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: tenancy === t ? '800' : '600',
                      color: tenancy === t ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Pricing & Docs */}
        {currentStep === 3 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
              Step 3: Pricing & Instant Trust Badge
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
              Set your target asking price and enable verified owner badge.
            </Text>

            {/* Asking Price */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Expected Asking Price *
            </Text>
            <TextInput
              placeholder="e.g. ₹1.35 Cr"
              placeholderTextColor="#94A3B8"
              value={priceDisplay}
              onChangeText={setPriceDisplay}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#0F172A',
                marginBottom: 16,
              }}
            />

            {/* Monthly Rent if Rented */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Monthly Rental Income (if Pre-Leased)
            </Text>
            <TextInput
              placeholder="e.g. ₹95,000 / month"
              placeholderTextColor="#94A3B8"
              value={monthlyRent}
              onChangeText={setMonthlyRent}
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#0F172A',
                marginBottom: 18,
              }}
            />

            {/* Instant Verified Badge Switch */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setEnableVerifiedBadge(!enableVerifiedBadge)}
              style={{
                backgroundColor: enableVerifiedBadge ? '#ECFDF5' : '#F8FAFC',
                borderWidth: 1.5,
                borderColor: enableVerifiedBadge ? '#10B981' : '#E2E8F0',
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                    Instant Owner Verified Badge
                  </Text>
                  <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#16A34A' }}>+4x LEADS</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  Auto-link to your Aadhaar & Registry KYC for top buyer trust.
                </Text>
              </View>

              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: enableVerifiedBadge ? '#10B981' : '#CBD5E1',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {enableVerifiedBadge && (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                  </Svg>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Wizard Controls */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          {currentStep > 1 && (
            <TouchableOpacity
              onPress={() => setCurrentStep((currentStep - 1) as any)}
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#CBD5E1',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>
                ← Previous
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={{
              flex: 2,
              backgroundColor: '#0D9488',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#0D9488',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
              {currentStep === 3 ? '🚀 Publish Verified Listing' : 'Next Step →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
