import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { MOCK_BROKER, MOCK_METRICS } from '../../src/data/mockData';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export default function MoreScreen() {
  const router = useRouter();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of BrokerIQ Enterprise?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => router.replace('/(auth)/login'),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Broker Hub & Profile"
        subtitle="Rajesh Sharma • AcreRise Realty & Advisory"
        showNotification={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Broker Profile Hero Card */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={{ uri: MOCK_BROKER.avatar }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 2,
                borderColor: '#0D9488',
              }}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>
                  {MOCK_BROKER.name}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: '#38BDF8', fontWeight: '600', marginTop: 2 }}>
                {MOCK_BROKER.role}
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                {MOCK_BROKER.agency}
              </Text>
            </View>
          </View>

          {/* RERA Registration & Tier Row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: '#1E293B',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#10B981',
                  marginRight: 6,
                }}
              />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>
                MahaRERA: {MOCK_BROKER.reraNumber}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(13, 148, 136, 0.25)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#0D9488',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#5EEAD4' }}>
                ENTERPRISE PLATINUM
              </Text>
            </View>
          </View>

          {/* Contact Details */}
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 16 }}>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>📞 {MOCK_BROKER.phone}</Text>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>📍 {MOCK_BROKER.city}</Text>
          </View>
        </View>

        {/* Section 1: AI & Growth Tools */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10, marginLeft: 4 }}>
          CRM INTELLIGENCE & AUTOMATION
        </Text>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          {/* AI Deal Forecaster */}
          <TouchableOpacity
            onPress={() => setIsAiModalOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                  AI Deal Pipeline Forecaster
                </Text>
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 6,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#B45309' }}>PRO</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Pipeline health: ₹ 48.5 Cr • 87% predicted closing rate
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          {/* WhatsApp Broadcast Automation */}
          <TouchableOpacity
            onPress={() => setIsTemplatesModalOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#DCFCE7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                  stroke="#16A34A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                WhatsApp Automation & Templates
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                MahaRERA compliant bulk broadcast templates
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          {/* Commission & Brokerage Tracker */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#F0FDFA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>💰</Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                Brokerage Payouts (This Month)
              </Text>
              <Text style={{ fontSize: 12, color: '#0D9488', fontWeight: '700', marginTop: 2 }}>
                {MOCK_METRICS.commissionEarnedLakh} earned • 3 deals closed
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#DCFCE7',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803D' }}>PAID</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Account & Brokerage Management */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10, marginLeft: 4 }}>
          BROKERAGE & TEAM MANAGEMENT
        </Text>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          {/* Subscription & Quota Screen Navigation */}
          <TouchableOpacity
            onPress={() => router.push('/subscription')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#FDF4FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke="#A855F7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                Subscription & Usage Limits
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Enterprise Platinum • 184 / 1,000 Active Leads
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          {/* Brokerage Agents Team */}
          <TouchableOpacity
            onPress={() => setIsTeamModalOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#FEF2F2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                  stroke="#E11D48"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <Circle cx="9" cy="7" r="4" stroke="#E11D48" strokeWidth="2" />
                <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#E11D48" strokeWidth="2" />
              </Svg>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                Agency Team Management
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                6 Brokers & Associates active in AcreRise
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          {/* Developer VIP Desks */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>🏢</Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                Direct Developer VIP Desks
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Lodha, Oberoi, Godrej, Piramal, Hiranandani
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#EFF6FF',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>CONNECTED</Text>
            </View>
          </View>
        </View>

        {/* Section 3: Legal & Sign Out */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'MahaRERA Legal Vault',
                'Your digital repository includes standard Builder-Buyer Agreements, Customer KYC, and RERA registration documents for AcreRise Realty (A51900028491).'
              );
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 14 }}>📜</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                MahaRERA Compliance Vault
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Agreements, LOI templates, KYC repository
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 14 }}>🚪</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#DC2626' }}>
                Sign Out
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                Log out of Rajesh Sharma's broker account
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#DC2626', fontWeight: '700' }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Version Footer */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
            BrokerIQ Enterprise CRM • Build 36
          </Text>
          <Text style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>
            Empowering Top Real Estate Advisory Firms across India
          </Text>
        </View>
      </ScrollView>

      {/* AI Pipeline Modal */}
      <Modal
        visible={isAiModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAiModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                🤖 AI Pipeline Intelligence
              </Text>
              <TouchableOpacity onPress={() => setIsAiModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View
                style={{
                  backgroundColor: '#0F172A',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#38BDF8' }}>
                  ACTIVE PIPELINE HEALTH
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 4 }}>
                  ₹ 48.5 Cr
                </Text>
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                  Weighted Expected Close: ₹ 36.2 Cr across 8 high-intent leads.
                </Text>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                Highest Probability Closings This Week
              </Text>

              {[
                { name: 'Kunal Shah & Partners', prop: 'One BKC Commercial Suite', amount: '₹ 14.5 Cr', prob: '94%', action: 'LOI Signing Scheduled' },
                { name: 'Vikramaditya Singhania', prop: 'Lodha World One Unit 4802', amount: '₹ 8.75 Cr', prob: '89%', action: 'Site Visit Scheduled 3:30 PM' },
                { name: 'Dr. Neha Agarwal', prop: 'Oberoi Sky City 3BHK', amount: '₹ 3.40 Cr', prob: '82%', action: 'Price Negotiation 5:00 PM' },
              ].map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{item.name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0D9488' }}>{item.amount}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.prop}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>⚡ Win Probability: {item.prob}</Text>
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>{item.action}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setIsAiModalOpen(false)}
                style={{
                  backgroundColor: '#0D9488',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Back to Hub</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Templates Modal */}
      <Modal
        visible={isTemplatesModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTemplatesModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                💬 MahaRERA Broadcast Templates
              </Text>
              <TouchableOpacity onPress={() => setIsTemplatesModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  title: '✨ Exclusive Pre-Launch Access',
                  desc: 'Luxury Sea-facing 4BHK towers in Worli with direct developer pricing and zero floor-rise charges.',
                },
                {
                  title: '🏢 Commercial Grade-A BKC Opportunity',
                  desc: 'Bare-shell corporate suites with 8.5% projected rental yield and Fortune 500 pre-leasing demand.',
                },
                {
                  title: '🔑 Private VIP Walkthrough Invitation',
                  desc: 'Personalized private high-tea viewing of sample penthouse suites with architectural consultants.',
                },
                {
                  title: '⚡ Festival Price Lock Guarantee',
                  desc: 'Limited-period token discount of ₹ 15 Lakhs and complimentary bespoke Italian modular kitchen.',
                },
              ].map((tpl, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{tpl.title}</Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 18 }}>{tpl.desc}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const shareText = encodeURIComponent(`${tpl.title}\n\n${tpl.desc}\n\nContact Rajesh Sharma (AcreRise Realty): +91 98201 84729`);
                      Linking.openURL(`https://wa.me/?text=${shareText}`);
                    }}
                    style={{
                      backgroundColor: '#DCFCE7',
                      alignSelf: 'flex-start',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>Broadcast to Hot Leads ›</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setIsTemplatesModalOpen(false)}
                style={{
                  backgroundColor: '#0D9488',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Team Modal */}
      <Modal
        visible={isTeamModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTeamModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                👥 AcreRise Advisory Team
              </Text>
              <TouchableOpacity onPress={() => setIsTeamModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { name: 'Rajesh Sharma', role: 'Managing Principal Broker', leads: 48, closed: '₹ 7.2 Cr' },
                { name: 'Vikram Joshi', role: 'Senior Luxury Associate', leads: 34, closed: '₹ 4.8 Cr' },
                { name: 'Nidhi Saxena', role: 'Suburban Residential Lead', leads: 29, closed: '₹ 3.4 Cr' },
                { name: 'Farhan Contractor', role: 'Commercial Leasing Specialist', leads: 18, closed: '₹ 14.5 Cr' },
                { name: 'Priya Nair', role: 'Township & Resale Specialist', leads: 26, closed: '₹ 2.1 Cr' },
                { name: 'Aditya Mehta', role: 'Developer Liaison Officer', leads: 29, closed: '₹ 5.1 Cr' },
              ].map((agent, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{agent.name}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{agent.role}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0D9488' }}>{agent.closed}</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{agent.leads} Active Leads</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setIsTeamModalOpen(false)}
                style={{
                  backgroundColor: '#0D9488',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}