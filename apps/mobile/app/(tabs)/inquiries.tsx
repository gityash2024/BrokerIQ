import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../src/stores/authStore';
import { Header } from '../../src/components/common/Header';
import { InquiryItem } from '../../src/data/personaData';

const FILTER_TABS = ['All', 'Negotiation', 'Scheduled', 'New'];

export default function InquiriesScreen() {
  const { inquiries, activePersona } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');

  const isOwner = activePersona.mode === 'OWNER';

  const filteredInquiries = inquiries.filter((inq) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Negotiation') return inq.status === 'NEGOTIATION';
    if (activeFilter === 'Scheduled') return inq.status === 'SCHEDULED';
    if (activeFilter === 'New') return inq.status === 'NEW';
    return true;
  });

  const handleCall = (inq: InquiryItem) => {
    const targetPhone = isOwner ? inq.buyerPhone : inq.ownerPhone;
    const targetName = isOwner ? inq.buyerName : inq.ownerName;
    const clean = targetPhone.replace(/\D/g, '');

    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Call', `Calling ${targetName} at +91 ${clean}`);
    });
  };

  const handleWhatsApp = (inq: InquiryItem) => {
    const targetPhone = isOwner ? inq.buyerPhone : inq.ownerPhone;
    const targetName = isOwner ? inq.buyerName : inq.ownerName;
    const clean = targetPhone.replace(/\D/g, '');

    const text = isOwner
      ? encodeURIComponent(
          `Hello ${inq.buyerName}, following up on your inquiry for ${inq.propertyTitle} (${inq.sector}). Please let me know a suitable time for a call or site inspection.`
        )
      : encodeURIComponent(
          `Hello ${inq.ownerName}, I sent an inquiry on BrokerIQ regarding ${inq.propertyTitle}. Could you share the latest floor plan and lease agreement?`
        );

    Linking.openURL(`https://wa.me/91${clean}?text=${text}`).catch(() => {
      Alert.alert('WhatsApp', `Opening WhatsApp for ${targetName}`);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEGOTIATION':
        return { bg: '#FEF3C7', text: '#B45309', label: 'In Negotiation' };
      case 'SCHEDULED':
        return { bg: '#EFF6FF', text: '#2563EB', label: 'Visit Scheduled' };
      case 'NEW':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'Action Required' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: 'Contacted' };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title={isOwner ? 'Inbound Buyer Leads' : 'My Contacted Properties'}
        subtitle={
          isOwner
            ? `${inquiries.length} prospective buyers inquired on your units`
            : `${inquiries.length} active outreach conversations`
        }
        showNotification={true}
        unreadCount={inquiries.length}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilter(tab)}
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
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredInquiries.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 28,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
              No Inquiries Found
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B' }}>
              No inquiries match the "{activeFilter}" filter.
            </Text>
          </View>
        ) : (
          filteredInquiries.map((inq) => {
            const badge = getStatusColor(inq.status);

            return (
              <View
                key={inq.id}
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
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View
                      style={{
                        backgroundColor: '#F1F5F9',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                        {inq.sector}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{inq.createdAt}</Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: badge.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: badge.text }}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Property Title */}
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 }}>
                  {inq.propertyTitle}
                </Text>

                {/* Counterparty Information */}
                <Text style={{ fontSize: 12, color: '#0D9488', fontWeight: '700', marginBottom: 8 }}>
                  {isOwner
                    ? `Buyer: ${inq.buyerName} • Budget: ${inq.buyerBudget}`
                    : `Owner / Developer: ${inq.ownerName}`}
                </Text>

                {/* Message */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', lineHeight: 17 }}>
                    "{inq.message}"
                  </Text>
                  {inq.lastInteraction && (
                    <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '600' }}>
                      ⚡ Status: {inq.lastInteraction}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleCall(inq)}
                    style={{
                      flex: 1,
                      backgroundColor: '#F1F5F9',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                      📞 {isOwner ? 'Call Buyer' : 'Call Owner'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleWhatsApp(inq)}
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
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
