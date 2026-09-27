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
import { MOCK_FOLLOW_UPS, FollowUpTask } from '../../src/data/mockData';
import Svg, { Path, Circle } from 'react-native-svg';

export default function FollowUpsScreen() {
  const [tasks, setTasks] = useState<FollowUpTask[]>(MOCK_FOLLOW_UPS);
  const [activeTab, setActiveTab] = useState<'TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED'>('TODAY');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [newLeadName, setNewLeadName] = useState('');
  const [newPhone, setNewPhone] = useState('+91 98200 ');
  const [newProperty, setNewProperty] = useState('Lodha World One');
  const [newType, setNewType] = useState<FollowUpTask['type']>('Site Visit');
  const [newDate, setNewDate] = useState('Today');
  const [newTime, setNewTime] = useState('04:30 PM');
  const [newPriority, setNewPriority] = useState<FollowUpTask['priority']>('HIGH');
  const [newNotes, setNewNotes] = useState('');

  const todayCount = tasks.filter((t) => t.status === 'TODAY').length;
  const overdueCount = tasks.filter((t) => t.status === 'OVERDUE').length;
  const upcomingCount = tasks.filter((t) => t.status === 'UPCOMING').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const currentTasks = tasks.filter((t) => t.status === activeTab);

  const handleToggleComplete = (task: FollowUpTask) => {
    const isCompleted = task.status === 'COMPLETED';
    const newStatus: FollowUpTask['status'] = isCompleted ? 'TODAY' : 'COMPLETED';

    const updated = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
    setTasks(updated);

    Alert.alert(
      isCompleted ? 'Task Reopened' : 'Task Completed',
      isCompleted
        ? `Task for ${task.leadName} moved back to Today.`
        : `Great job! Task for ${task.leadName} marked as completed.`
    );
  };

  const handleCreateTask = () => {
    if (!newLeadName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter client name and phone number.');
      return;
    }

    const createdTask: FollowUpTask = {
      id: `task-${Date.now()}`,
      leadId: `lead-${Date.now()}`,
      leadName: newLeadName.trim(),
      phone: newPhone.trim(),
      propertyTitle: newProperty.trim(),
      type: newType,
      date: newDate,
      time: newTime,
      status: newDate.toLowerCase().includes('today') ? 'TODAY' : 'UPCOMING',
      priority: newPriority,
      notes: newNotes.trim() || `${newType} appointment scheduled with client.`,
    };

    setTasks([createdTask, ...tasks]);
    setNewLeadName('');
    setNewNotes('');
    setIsAddModalOpen(false);
    Alert.alert('Scheduled', `Follow-up task for ${createdTask.leadName} successfully created!`);
  };

  const getTypeColor = (type: FollowUpTask['type']) => {
    switch (type) {
      case 'Site Visit':
        return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
      case 'Price Negotiation':
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
      case 'Call':
        return { bg: '#F0FDFA', text: '#0F766E', border: '#CCFBF1' };
      case 'WhatsApp Brochure':
        return { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' };
      case 'Token Collection':
        return { bg: '#FFE4E6', text: '#BE123C', border: '#FECDD3' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title="Broker Tasks & Visits"
        subtitle={`${todayCount + overdueCount} Actions Due • 4 Site Visits Today`}
        showNotification={false}
      />

      {/* Segmented Status Tabs */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F1F5F9',
            borderRadius: 12,
            padding: 4,
          }}
        >
          {[
            { key: 'TODAY', label: `Today (${todayCount})` },
            { key: 'OVERDUE', label: `Overdue (${overdueCount})` },
            { key: 'UPCOMING', label: `Upcoming (${upcomingCount})` },
            { key: 'COMPLETED', label: `Done (${completedCount})` },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            const isOverdue = tab.key === 'OVERDUE' && overdueCount > 0;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 9,
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  shadowColor: isSelected ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isSelected ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: isSelected ? 2 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: isSelected ? '800' : '600',
                    color: isSelected
                      ? isOverdue
                        ? '#DC2626'
                        : '#0D9488'
                      : isOverdue
                      ? '#EF4444'
                      : '#64748B',
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Task Cards List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {currentTasks.length === 0 ? (
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
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="9" stroke="#94A3B8" strokeWidth="2" />
              <Path d="M9 12l2 2 4-4" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" />
            </Svg>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 12, marginBottom: 4 }}>
              No tasks in this view
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              All caught up! Tap 'Schedule Task' below to create a new appointment or follow-up.
            </Text>
          </View>
        ) : (
          currentTasks.map((task) => {
            const badgeStyle = getTypeColor(task.type);
            const isCompleted = task.status === 'COMPLETED';

            return (
              <View
                key={task.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: task.status === 'OVERDUE' ? '#FECDD3' : '#E2E8F0',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                  opacity: isCompleted ? 0.75 : 1,
                }}
              >
                {/* Card Top: Type & Priority */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View
                    style={{
                      backgroundColor: badgeStyle.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: badgeStyle.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: badgeStyle.text }}>
                      {task.type.toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {task.priority === 'HIGH' && (
                      <View
                        style={{
                          backgroundColor: '#FEF2F2',
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#FEE2E2',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC2626' }}>
                          ⚡ HIGH PRIORITY
                        </Text>
                      </View>
                    )}

                    <View
                      style={{
                        backgroundColor: '#F8FAFC',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>
                        ⏰ {task.time}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Client Name & Property Title */}
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: isCompleted ? '#64748B' : '#0F172A',
                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                  }}
                >
                  {task.leadName}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0D9488', marginTop: 2 }}>
                  🏢 {task.propertyTitle}
                </Text>

                {/* Notes */}
                {task.notes ? (
                  <View
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: 10,
                      borderRadius: 10,
                      marginTop: 10,
                      borderLeftWidth: 3,
                      borderLeftColor: task.status === 'OVERDUE' ? '#EF4444' : '#0D9488',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17 }}>
                      {task.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Bottom Actions Row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#F1F5F9',
                    gap: 8,
                  }}
                >
                  {/* Complete Checkbox Button */}
                  <TouchableOpacity
                    onPress={() => handleToggleComplete(task)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isCompleted ? '#F1F5F9' : '#F0FDFA',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isCompleted ? '#E2E8F0' : '#CCFBF1',
                    }}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 13l4 4L19 7"
                        stroke={isCompleted ? '#64748B' : '#0D9488'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isCompleted ? '#64748B' : '#0F766E',
                        marginLeft: 6,
                      }}
                    >
                      {isCompleted ? 'Mark Pending' : 'Mark Done'}
                    </Text>
                  </TouchableOpacity>

                  {/* Call & WhatsApp Buttons */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${task.phone.replace(/\s+/g, '')}`)}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: '#0F766E',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      </Svg>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginLeft: 4 }}>
                        Call
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const clean = task.phone.replace(/[^0-9]/g, '');
                        const msg = encodeURIComponent(
                          `Hello ${task.leadName}, Rajesh Sharma here from AcreRise Realty. Following up on your scheduled ${task.type} regarding ${task.propertyTitle}. Please let me know if this timing works well for you.`
                        );
                        Linking.openURL(`https://wa.me/${clean}?text=${msg}`);
                      }}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: '#16A34A',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                        💬 WhatsApp
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button: Schedule Task */}
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
          Schedule Task
        </Text>
      </TouchableOpacity>

      {/* Schedule Task Modal */}
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
                Schedule Follow-up / Visit
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
                value={newLeadName}
                onChangeText={setNewLeadName}
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
                Property Associated
              </Text>
              <TextInput
                placeholder="e.g. Lodha World One (Unit 4802)"
                placeholderTextColor="#94A3B8"
                value={newProperty}
                onChangeText={setNewProperty}
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
                Task Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {(['Site Visit', 'Call', 'Price Negotiation', 'Token Collection', 'WhatsApp Brochure'] as const).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewType(type)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: newType === type ? '#0D9488' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: newType === type ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                    Scheduled Date
                  </Text>
                  <TextInput
                    placeholder="e.g. Today or Tomorrow"
                    placeholderTextColor="#94A3B8"
                    value={newDate}
                    onChangeText={setNewDate}
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
                    Time
                  </Text>
                  <TextInput
                    placeholder="e.g. 05:00 PM"
                    placeholderTextColor="#94A3B8"
                    value={newTime}
                    onChangeText={setNewTime}
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
                Meeting Notes & Instructions
              </Text>
              <TextInput
                placeholder="e.g. Escort client from lobby, bring printed floor plans & cost sheet"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={newNotes}
                onChangeText={setNewNotes}
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 20,
                  height: 70,
                  textAlignVertical: 'top',
                }}
              />

              <TouchableOpacity
                onPress={handleCreateTask}
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
                  Confirm & Schedule Task
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}