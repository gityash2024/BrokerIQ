import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../common/Header';
import { MetricCard } from '../ui/MetricCard';
import { LeadCard } from '../ui/LeadCard';
import {
  MOCK_BROKER,
  MOCK_METRICS,
  MOCK_LEADS,
  MOCK_FOLLOW_UPS,
  MOCK_ACTIVITY_LOGS,
} from '../../data/mockData';
import { useAuth } from '../../stores/authStore';
import Svg, { Path, Circle } from 'react-native-svg';

export const BrokerDashboardView = () => {
  const router = useRouter();
  const { activePersona } = useAuth();
  const [filterPeriod, setFilterPeriod] = useState<'Today' | 'This Month'>('This Month');

  const hotLeads = MOCK_LEADS.filter((l) => l.priority === 'HOT').slice(0, 3);
  const todayTasks = MOCK_FOLLOW_UPS.filter((t) => t.status === 'TODAY' || t.status === 'OVERDUE');

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <Header
        title={`Hi, ${activePersona.name.split(' ')[0]}`}
        subtitle={`${activePersona.organizationName} • ${activePersona.city}`}
        showNotification={true}
        unreadCount={4}
        onNotificationPress={() => {
          Alert.alert(
            'Notifications',
            '• 3 New inquiries from Housing.com\n• Vikramaditya Singhania confirmed 3:30 PM site visit\n• Token payment of ₹25L scheduled tomorrow'
          );
        }}
        avatarText={activePersona.avatar}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Insight Intelligence Banner */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            Alert.alert(
              'AI Property Match Recommendation',
              'Vikramaditya Singhania is 96% matched to Lodha World One 4BHK.\n\nAI Suggested Next Action:\nSend cost-sheet and schedule high-tea with developer sales lead Aditya Mehta.'
            );
          }}
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
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
                AI PIPELINE PULSE
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>Just now</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF', lineHeight: 20 }}>
            3 High-intent buyers viewed Lodha World One brochure. Tap to review matches & send VIP invites.
          </Text>
        </TouchableOpacity>

        {/* Pipeline Value Summary Banner */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>
              ACTIVE DEAL PIPELINE
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2 }}>
              <TouchableOpacity
                onPress={() => setFilterPeriod('Today')}
                style={{
                  backgroundColor: filterPeriod === 'Today' ? '#FFFFFF' : 'transparent',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: filterPeriod === 'Today' ? '#0F172A' : '#64748B' }}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterPeriod('This Month')}
                style={{
                  backgroundColor: filterPeriod === 'This Month' ? '#FFFFFF' : 'transparent',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: filterPeriod === 'This Month' ? '#0F172A' : '#64748B' }}>
                  This Month
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#0F172A', letterSpacing: -1 }}>
              {MOCK_METRICS.monthlyPipelineCr}
            </Text>
            <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803D' }}>
                +18.4% MoM
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Closed Revenue</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F766E', marginTop: 2 }}>
                {MOCK_METRICS.closedThisMonthCr}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Brokerage Earned</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#B45309', marginTop: 2 }}>
                {MOCK_METRICS.commissionEarnedLakh}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Team Win Rate</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B', marginTop: 2 }}>
                24.8%
              </Text>
            </View>
          </View>
        </View>

        {/* 2x2 Metric Cards Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="New Leads Today"
              value={MOCK_METRICS.newLeadsToday}
              trend={MOCK_METRICS.newLeadsTrend}
              accentColor="#0D9488"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Active Pipeline"
              value={MOCK_METRICS.activeLeads}
              trend={MOCK_METRICS.activeLeadsTrend}
              accentColor="#2563EB"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Follow-ups Due"
              value={MOCK_METRICS.followUpsDue}
              subtitle="2 Overdue"
              accentColor="#EA580C"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Site Visits"
              value={MOCK_METRICS.siteVisitsScheduled}
              subtitle="4 Scheduled"
              accentColor="#7C3AED"
            />
          </View>
        </View>

        {/* Quick Action Shortcuts */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 8, marginBottom: 12 }}>
          Quick Actions
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          {[
            {
              title: 'Add Lead',
              iconColor: '#0D9488',
              bgColor: '#F0FDFA',
              onPress: () => router.push('/(tabs)/leads'),
            },
            {
              title: 'Properties',
              iconColor: '#2563EB',
              bgColor: '#EFF6FF',
              onPress: () => router.push('/(tabs)/properties'),
            },
            {
              title: 'Schedule Visit',
              iconColor: '#7C3AED',
              bgColor: '#F5F3FF',
              onPress: () => router.push('/(tabs)/follow-ups'),
            },
            {
              title: 'Market Hub',
              iconColor: '#16A34A',
              bgColor: '#F0FDF4',
              onPress: () => router.push('/(tabs)/market-hub'),
            },
          ].map((action, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.8}
              onPress={action.onPress}
              style={{
                width: '23%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: action.bgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  {i === 0 && (
                    <Path d="M12 5v14M5 12h14" stroke={action.iconColor} strokeWidth="2.5" strokeLinecap="round" />
                  )}
                  {i === 1 && (
                    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={action.iconColor} strokeWidth="2" />
                  )}
                  {i === 2 && (
                    <>
                      <Circle cx="12" cy="12" r="9" stroke={action.iconColor} strokeWidth="2" />
                      <Path d="M12 7v5l3 2" stroke={action.iconColor} strokeWidth="2" strokeLinecap="round" />
                    </>
                  )}
                  {i === 3 && (
                    <Path
                      d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
                      stroke={action.iconColor}
                      strokeWidth="2"
                    />
                  )}
                </Svg>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#334155', textAlign: 'center' }}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's Follow-ups Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
              Today's Schedule
            </Text>
            <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>
                {todayTasks.length} Due
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/(tabs)/follow-ups')}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0D9488' }}>
              View All →
            </Text>
          </TouchableOpacity>
        </View>

        {todayTasks.slice(0, 3).map((task) => (
          <View
            key={task.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: task.status === 'OVERDUE' ? '#FECACA' : '#E2E8F0',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View
                  style={{
                    backgroundColor: task.status === 'OVERDUE' ? '#FEE2E2' : '#EFF6FF',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginRight: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: task.status === 'OVERDUE' ? '#DC2626' : '#2563EB',
                    }}
                  >
                    {task.time}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                  {task.type}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                {task.leadName}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                📍 {task.propertyTitle}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/follow-ups')}
              style={{
                backgroundColor: '#F0FDFA',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#99F6E4',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F766E' }}>
                Details
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Hot Leads Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
            Hot High-Intent Inquiries
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/leads')}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0D9488' }}>
              All Leads →
            </Text>
          </TouchableOpacity>
        </View>

        {hotLeads.map((lead) => (
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
            onPress={() => router.push('/(tabs)/leads')}
          />
        ))}

        {/* Recent Activity Timeline */}
        <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 16, marginBottom: 12 }}>
          Live CRM Feed
        </Text>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          {MOCK_ACTIVITY_LOGS.map((log, i) => (
            <View
              key={log.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingBottom: i === MOCK_ACTIVITY_LOGS.length - 1 ? 0 : 12,
                marginBottom: i === MOCK_ACTIVITY_LOGS.length - 1 ? 0 : 12,
                borderBottomWidth: i === MOCK_ACTIVITY_LOGS.length - 1 ? 0 : 1,
                borderBottomColor: '#F1F5F9',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: log.type === 'LEAD' ? '#3B82F6' : log.type === 'DEAL' ? '#16A34A' : '#0D9488',
                  marginTop: 6,
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    {log.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>{log.time}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {log.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default BrokerDashboardView;
