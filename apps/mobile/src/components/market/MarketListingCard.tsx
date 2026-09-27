import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MarketProperty } from '../../data/gurgaonCatalog';

interface MarketListingCardProps {
  property: MarketProperty;
  onPress?: () => void;
}

const PhoneIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
      stroke="#0D9488"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const WhatsAppIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
      stroke="#15803D"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MarketListingCard: React.FC<MarketListingCardProps> = ({ property, onPress }) => {
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
  };

  const handleCall = () => {
    const cleanNumber = property.cleanPhone || property.contactPhone.replace(/\D/g, '');
    const url = `tel:${cleanNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Calling Unavailable', `Cannot place a call to ${property.contactName} (${property.contactPhone}).`);
        } else {
          return Linking.openURL(url);
        }
      })
      .catch((err) => {
        Alert.alert('Error', 'Unable to initiate call.');
      });
  };

  const handleWhatsApp = () => {
    const cleanNumber = property.cleanPhone || property.contactPhone.replace(/\D/g, '');
    const message = `Hi ${property.contactName}, I have an interested buyer for your unit ${property.unitNumber} at ${property.project} (${property.sector}). Please share current availability and final terms.`;
    const url = `https://wa.me/91${cleanNumber}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Unavailable', 'Could not launch WhatsApp.');
    });
  };

  const isPreLeased = property.category === 'Pre-Leased Rented (ROI)' || property.status.includes('Rented');

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.cardContainer}
    >
      {/* Top Header Row: Project Name & Unit Badge */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.titleRow}>
            <Text style={styles.projectName} numberOfLines={1}>
              {property.project}
            </Text>
            <View style={styles.sectorTag}>
              <Text style={styles.sectorTagText}>{property.sector}</Text>
            </View>
          </View>
          <Text style={styles.categoryText}>{property.category}</Text>
        </View>

        <View style={styles.unitBadge}>
          <Text style={styles.unitBadgeText}>{property.unitNumber}</Text>
        </View>
      </View>

      {/* Attributes & Floor Row */}
      <View style={styles.tagsRow}>
        <View style={styles.floorTag}>
          <Text style={styles.floorTagText}>{property.floor}</Text>
        </View>
        {property.attributes.map((attr, idx) => (
          <View key={`attr-${idx}`} style={styles.attrTag}>
            <Text style={styles.attrTagText}>{attr}</Text>
          </View>
        ))}
        {property.rentalYieldPct && (
          <View style={styles.roiTag}>
            <Text style={styles.roiTagText}>{property.rentalYieldPct}% ROI</Text>
          </View>
        )}
      </View>

      {/* Tenancy & Specifications Box */}
      <View style={[styles.tenancyBox, isPreLeased && styles.tenancyBoxPreLeased]}>
        <View style={styles.tenancyDot} />
        <Text style={styles.tenancyText} numberOfLines={2}>
          {property.tenancy}
        </Text>
      </View>

      {/* Financials & Area Grid */}
      <View style={styles.financialRow}>
        <View>
          <Text style={styles.financialLabel}>ASKING PRICE</Text>
          <Text style={styles.priceText}>{property.priceDisplay}</Text>
        </View>

        <View style={styles.statSeparator} />

        <View>
          <Text style={styles.financialLabel}>CARPET AREA</Text>
          <Text style={styles.areaText}>{property.carpetAreaSqFt} <Text style={styles.unitText}>sq.ft</Text></Text>
        </View>

        <View style={styles.statSeparator} />

        <View>
          <Text style={styles.financialLabel}>RATE / SQ.FT</Text>
          <Text style={styles.rateText}>{property.pricePerSqFt}</Text>
        </View>
      </View>

      {/* Owner / Broker Contact Bar & 1-Tap Action Buttons */}
      <View style={styles.actionFooter}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactLabel}>OWNER / BROKER</Text>
          <Text style={styles.contactName} numberOfLines={1}>
            {property.contactName}
          </Text>
          <Text style={styles.contactPhone}>
            {formatPhoneNumber(property.contactPhone)}
          </Text>
        </View>

        <View style={styles.buttonsRow}>
          {/* 1-Tap Direct Phone Call */}
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            activeOpacity={0.7}
          >
            <PhoneIcon />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>

          {/* 1-Tap WhatsApp Inquiry */}
          <TouchableOpacity
            style={styles.whatsAppButton}
            onPress={handleWhatsApp}
            activeOpacity={0.7}
          >
            <WhatsAppIcon />
            <Text style={styles.whatsAppButtonText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  projectName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectorTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectorTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  unitBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  floorTag: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  floorTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  attrTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  attrTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  roiTag: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roiTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  tenancyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  tenancyBoxPreLeased: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#10B981',
  },
  tenancyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
    marginRight: 8,
  },
  tenancyText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 16,
  },
  financialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  statSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  financialLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D9488',
  },
  areaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  unitText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  rateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  contactInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  contactName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  contactPhone: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  whatsAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  whatsAppButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
});
