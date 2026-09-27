import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { LeadCard } from '../../src/components/ui/LeadCard';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { MOCK_LEADS, Lead } from '../../src/data/mockData';
import Svg, { Path, Circle } from 'react-native-svg';

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HOT' | 'SITE_VISIT' | 'NEGOTIATION' | 'WON'>('ALL');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Lead Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRequirement, setNewRequirement] = useState('');
  const [newBudget, setNewBudget] = useState('₹ 2.5 Cr');
  const [newBhk, setNewBhk] = useState('3 BHK');

  const filteredLeads = leads.filter((lead) => {
    const matchesFilter =
      activeFilter === 'ALL' ||
      (activeFilter === 'HOT' && lead.priority === 'HOT') ||
      (activeFilter === 'SITE_VISIT' && lead.stage === 'SITE_VISIT') ||
      (activeFilter === 'NEGOTIATION' && lead.stage === 'NEGOTIATION') ||
      (activeFilter === 'WON' && lead.stage === 'WON');

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.phone.includes(q) ||
      lead.requirement.toLowerCase().includes(q) ||
      lead.location.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const handleCreateLead = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter at least lead name and phone number.');
      return;
    }

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim(),
      email: `${newName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      budgetMin: newBudget,
      budgetMax: newBudget,
      requirement: newRequirement || `${newBhk} requirement in prime location`,
      location: 'Mumbai Suburban',
      bhk: newBhk,
      stage: 'NEW',
      source: 'Referral',
      priority: 'HOT',
      followUpDate: 'Today',
      followUpTime: '06:00 PM',
      notes: 'Direct inquiry added via mobile CRM. Awaiting initial requirements discussion.',
      lastContacted: 'Just now',
      aiScore: 90,
      aiInsight: 'Newly added high-priority buyer lead.',
    };

    setLeads([newLead, ...leads]);
    setNewName('');
    setNewPhone('');
    setNewRequirement('');
    setIsAddModalOpen(false);
    Alert.alert('Success', `Lead for ${newLead.name} created successfully!`);
  };

  const handleUpdateStage = (newStage: Lead['stage']) => {
    if (!selectedLead) return;
    const updated = leads.map((l) => (l.id === selectedLead.id ? { ...l, stage: newStage } : l));
    setLeads(updated);
    setSelectedLead({ ...selectedLead, stage: newStage });
    Alert.alert('Stage Updated', `${selectedLead.name} moved to ${newStage}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Leads Pipeline"
        subtitle={`${filteredLeads.length} active inquiries • ${leads.filter((l) => l.priority === 'HOT').length} Hot`}
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
            placeholder="Search leads by name, phone, location..."
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

      {/* Filter Tabs / Chips */}
      <View style={{ paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {[
            { key: 'ALL', label: `All (${leads.length})` },
            { key: 'HOT', label: `🔥 Hot (${leads.filter((l) => l.priority === 'HOT').length})` },
            { key: 'SITE_VISIT', label: `Site Visit (${leads.filter((l) => l.stage === 'SITE_VISIT').length})` },
            { key: 'NEGOTIATION', label: `Negotiation (${leads.filter((l) => l.stage === 'NEGOTIATION').length})` },
            { key: 'WON', label: `Won (${leads.filter((l) => l.stage === 'WON').length})` },
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

      {/* Leads List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredLeads.length === 0 ? (
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
              No leads found
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              Try adjusting your search or filters, or add a new lead below.
            </Text>
          </View>
        ) : (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              name={lead.name}
              phone={lead.phone}
              requirement={lead.requirement}
              budgetMin={lead.budgetMin}
              budgetMax={lead.budgetMax}
              stage={lead.stage}
              source={lead.source}
              priority={lead.priority}
              followUpDate={lead.followUpDate}
              followUpTime={lead.followUpTime}
              aiScore={lead.aiScore}
              onPress={() => setSelectedLead(lead)}
            />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button (FAB): Add Lead */}
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
          Add Lead
        </Text>
      </TouchableOpacity>

      {/* Lead Details Modal */}
      <Modal
        visible={!!selectedLead}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedLead(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '85%',
            }}
          >
            {selectedLead && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
                      {selectedLead.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      {selectedLead.phone} • {selectedLead.source}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedLead(null)}>
                    <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Stage Indicator & Badges */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <StatusBadge status={selectedLead.stage} size="md" />
                  <StatusBadge status={selectedLead.priority} size="md" />
                  <View
                    style={{
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 9999,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>
                      ⚡ AI Score: {selectedLead.aiScore}%
                    </Text>
                  </View>
                </View>

                {/* Budget & Location Box */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
                    BUDGET & LOCATION
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0D9488', marginTop: 4 }}>
                    {selectedLead.budgetMin} {selectedLead.budgetMax ? `– ${selectedLead.budgetMax}` : ''}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600', marginTop: 2 }}>
                    📍 {selectedLead.location} ({selectedLead.bhk})
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 18 }}>
                    {selectedLead.requirement}
                  </Text>
                </View>

                {/* AI Copilot Insights */}
                <View
                  style={{
                    backgroundColor: '#0F172A',
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#38BDF8', marginBottom: 4 }}>
                    🤖 AI BROKER COPILOT INSIGHT
                  </Text>
                  <Text style={{ fontSize: 13, color: '#F8FAFC', lineHeight: 18 }}>
                    {selectedLead.aiInsight}
                  </Text>
                </View>

                {/* Stage Progression Buttons */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>
                  Update Deal Stage
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {(['NEW', 'CONTACTED', 'SITE_VISIT', 'NEGOTIATION', 'WON'] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => handleUpdateStage(st)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: selectedLead.stage === st ? '#0D9488' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: selectedLead.stage === st ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {st.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Primary Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(`tel:${selectedLead.phone.replace(/\s+/g, '')}`);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#0F766E',
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                      📞 Call Client
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const cleanPhone = selectedLead.phone.replace(/[^0-9]/g, '');
                      Linking.openURL(`https://wa.me/${cleanPhone}`);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#16A34A',
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                      💬 WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Lead Modal Form */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}>
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
                Add High-Value Lead
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                Client Name *
              </Text>
              <TextInput
                placeholder="e.g. Vikramaditya Singhania"
                placeholderTextColor="#94A3B8"
                value={newName}
                onChangeText={setNewName}
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
                Phone Number (WhatsApp) *
              </Text>
              <TextInput
                placeholder="+91 98200 XXXXX"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
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
                Budget
              </Text>
              <TextInput
                placeholder="e.g. ₹ 3.5 Cr"
                placeholderTextColor="#94A3B8"
                value={newBudget}
                onChangeText={setNewBudget}
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
                Configuration
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['2 BHK', '3 BHK', '4 BHK', 'Commercial'].map((bhk) => (
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
                        fontSize: 12,
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
                Specific Requirement / Notes
              </Text>
              <TextInput
                placeholder="e.g. Sea facing, ready to move, 2 car parking spaces"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={newRequirement}
                onChangeText={setNewRequirement}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 20,
                  height: 80,
                  textAlignVertical: 'top',
                }}
              />

              <TouchableOpacity
                onPress={handleCreateLead}
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
                  Create & Save Lead
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}