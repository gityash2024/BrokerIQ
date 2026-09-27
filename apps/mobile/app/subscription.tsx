import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Header } from '../src/components/ui/Header';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export default function SubscriptionScreen() {
  const router = useRouter();

  const handleDownloadInvoice = () => {
    Alert.alert(
      'Tax Invoices (GST)',
      'Your latest GST tax invoice for AcreRise Realty & Advisory (Invoice #INV-2026-0928) has been queued for download and emailed to rajesh@acrerise.in.'
    );
  };

  const handleContactManager = () => {
    Alert.alert(
      'Enterprise Support Desk',
      'Your dedicated Enterprise Account Director is Priya Varma (+91 98200 11223). We are available 24/7 for custom API integrations and quota adjustments.',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Call Director',
          onPress: () => Linking.openURL('tel:+919820011223'),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Subscription & Quotas"
        subtitle="Enterprise Platinum • Active Tier"
        showNotification={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Plan Hero Card */}
        <View
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <View
                style={{
                  backgroundColor: 'rgba(13, 148, 136, 0.25)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  borderWidth: 1,
                  borderColor: '#0D9488',
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#5EEAD4' }}>
                  ACTIVE TIER
                </Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF' }}>
                Enterprise Platinum
              </Text>
              <Text style={{ fontSize: 13, color: '#38BDF8', marginTop: 2, fontWeight: '600' }}>
                ₹ 19,999 / month • Billed Annually
              </Text>
            </View>

            <View
              style={{
                backgroundColor: '#16A34A',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                ✓ VERIFIED
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: '#1E293B',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>
              Renewal Date: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>31 Dec 2026</Text>
            </Text>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>
              Seats: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>6 / 10 Active</Text>
            </Text>
          </View>
        </View>

        {/* Section: Resource Quota & Usage */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginLeft: 4 }}>
          REAL-TIME USAGE & LIMITS
        </Text>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            marginBottom: 20,
          }}
        >
          {/* Active Leads Meter */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Active Leads Database</Text>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>184 / 1,000 (18%)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: '18%', height: '100%', backgroundColor: '#0D9488', borderRadius: 4 }} />
            </View>
          </View>

          {/* AI Copilot & Matching Queries */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>AI Broker Copilot Queries</Text>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>420 / 2,500 (17%)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: '17%', height: '100%', backgroundColor: '#2563EB', borderRadius: 4 }} />
            </View>
          </View>

          {/* WhatsApp Broadcast Credits */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>WhatsApp Broadcast Credits</Text>
              <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>8,450 / 10,000 Available</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: '84%', height: '100%', backgroundColor: '#16A34A', borderRadius: 4 }} />
            </View>
          </View>

          {/* Cloud Property Vault Storage */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Cloud Brochure Storage</Text>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>3.2 GB / 50 GB</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: '6%', height: '100%', backgroundColor: '#A855F7', borderRadius: 4 }} />
            </View>
          </View>

          {/* Agency Team Seats */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Licensed Agent Seats</Text>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>6 / 10 Seats Used</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: '60%', height: '100%', backgroundColor: '#E11D48', borderRadius: 4 }} />
            </View>
          </View>
        </View>

        {/* Section: Add-on Booster Packs */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginLeft: 4 }}>
          ADD-ON BOOSTER PACKS
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>+5,000 WhatsApp</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Direct Verified SMS/WA</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0D9488', marginTop: 8 }}>₹ 1,499</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Add-on Added', '5,000 WhatsApp credits added to your account.')}
              style={{
                backgroundColor: '#F0FDFA',
                paddingVertical: 6,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#CCFBF1',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0D9488' }}>Purchase Pack</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>+1,000 AI Queries</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>High-Speed Deal Matcher</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#2563EB', marginTop: 8 }}>₹ 999</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Add-on Added', '1,000 AI copilot queries added to your account.')}
              style={{
                backgroundColor: '#EFF6FF',
                paddingVertical: 6,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>Purchase Pack</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Enterprise Management Actions */}
        <TouchableOpacity
          onPress={handleDownloadInvoice}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FFFFFF',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
            📥 Download GST Tax Invoices
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContactManager}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#0D9488',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
            📞 Contact Enterprise Support Desk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>
            ‹ Back to Previous Screen
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}