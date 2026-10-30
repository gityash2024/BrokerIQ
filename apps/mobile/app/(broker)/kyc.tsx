import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react-native';
import { BrokerScreen } from '@/launch/screen';
import { Txt, Button, Card, Badge, Avatar, Row } from '@/ui';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api, patch } from '@/lib/api';
import AgentKycScreen from '../agent-kyc';

export default function BrokerKycTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'BROKER_ADMIN';

  if (!isAdmin) {
    return <AgentKycScreen />;
  }

  return <BrokerAdminKycManagement />;
}

function BrokerAdminKycManagement() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'team' | 'firm'>('team');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);

  const teamQuery = useQuery({
    queryKey: ['team-mobile-kyc'],
    queryFn: () => api<any>('/broker/team'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ agentId, status, reviewNote }: { agentId: string; status: 'VERIFIED' | 'REJECTED'; reviewNote?: string }) =>
      patch(`/broker/team/agents/${agentId}/kyc`, { status, reviewNote }),
    onSuccess: (_, vars) => {
      Alert.alert(
        vars.status === 'VERIFIED' ? 'KYC स्वीकृत ✅' : 'KYC अस्वीकृत',
        vars.status === 'VERIFIED' ? 'एजेंट का KYC सफलतापूर्वक वेरीफाई हो गया।' : 'एजेंट का KYC रिजेक्ट कर दिया गया है।',
      );
      queryClient.invalidateQueries({ queryKey: ['team-mobile-kyc'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'KYC स्टेटस अपडेट नहीं हो सका');
    },
  });

  const handleApprove = (member: any) => {
    Alert.alert(
      'KYC Approve करें?',
      `क्या आप ${member.name} का Agent KYC वेरीफाई करना चाहते हैं?`,
      [
        { text: 'रद्द करें', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => reviewMutation.mutate({ agentId: member.id, status: 'VERIFIED' }),
        },
      ],
    );
  };

  const handleReject = (member: any) => {
    Alert.prompt
      ? Alert.prompt(
          'KYC Reject करें',
          'अस्वीकृति का कारण दर्ज करें (उदा. आधार साफ़ नहीं है):',
          [
            { text: 'रद्द करें', style: 'cancel' },
            {
              text: 'Reject',
              style: 'destructive',
              onPress: (note?: string) =>
                reviewMutation.mutate({
                  agentId: member.id,
                  status: 'REJECTED',
                  reviewNote: note?.trim() || 'दस्तावेज़ स्पष्ट नहीं हैं',
                }),
            },
          ],
        )
      : Alert.alert(
          'KYC Reject करें',
          `क्या आप ${member.name} का KYC अस्वीकार करना चाहते हैं?`,
          [
            { text: 'रद्द करें', style: 'cancel' },
            {
              text: 'Reject',
              style: 'destructive',
              onPress: () =>
                reviewMutation.mutate({
                  agentId: member.id,
                  status: 'REJECTED',
                  reviewNote: 'दस्तावेज़ स्पष्ट नहीं हैं या जानकारी मेल नहीं खाती',
                }),
            },
          ],
        );
  };

  const members = teamQuery.data?.members ?? [];
  const filtered = members.filter((m: any) => {
    if (filter === 'ALL') return true;
    return m.kycStatus === filter;
  });

  const pendingCount = members.filter((m: any) => m.kycStatus === 'PENDING').length;
  const verifiedCount = members.filter((m: any) => m.kycStatus === 'VERIFIED').length;

  return (
    <BrokerScreen title="KYC" subtitle="टीम का सत्यापन व फर्म स्टेटस">
      {/* Header with Tab switcher */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>

        {/* Tab switch pills */}
        <Row gap={8}>
          <TouchableOpacity
            onPress={() => setActiveTab('team')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: activeTab === 'team' ? c.brand : isDark ? '#1C2138' : '#F1F5F9',
            }}
          >
            <Users size={16} color={activeTab === 'team' ? '#fff' : c.muted} />
            <Txt v="small" style={{ fontWeight: '800', color: activeTab === 'team' ? '#fff' : c.fg }}>
              Team KYC ({pendingCount})
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('firm')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: activeTab === 'firm' ? c.brand : isDark ? '#1C2138' : '#F1F5F9',
            }}
          >
            <Building2 size={16} color={activeTab === 'firm' ? '#fff' : c.muted} />
            <Txt v="small" style={{ fontWeight: '800', color: activeTab === 'firm' ? '#fff' : c.fg }}>
              Firm KYC
            </Txt>
          </TouchableOpacity>
        </Row>

        {/* Filter Pills (when Team KYC is active) */}
        {activeTab === 'team' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {[
              { id: 'ALL', label: `सभी (${members.length})` },
              { id: 'PENDING', label: `लंबित (${pendingCount})` },
              { id: 'VERIFIED', label: `वेरिफाइड (${verifiedCount})` },
              { id: 'REJECTED', label: 'अस्वीकृत' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilter(tab.id as any)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: filter === tab.id ? (isDark ? '#312E81' : '#EEF2FF') : 'transparent',
                  borderWidth: 1,
                  borderColor: filter === tab.id ? c.brand : c.line,
                }}
              >
                <Txt
                  v="caption"
                  style={{
                    fontWeight: '700',
                    color: filter === tab.id ? c.brand : c.muted,
                  }}
                >
                  {tab.label}
                </Txt>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Main Content */}
      {activeTab === 'team' ? (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
          ListEmptyComponent={
            <Card style={{ padding: 24, alignItems: 'center', gap: 6 }}>
              <Shield size={36} color={c.muted} />
              <Txt v="bodyStrong">कोई KYC रिकॉर्ड नहीं मिला</Txt>
              <Txt v="caption" color="muted">इस फ़िल्टर में कोई सदस्य उपलब्ध नहीं हैं</Txt>
            </Card>
          }
          renderItem={({ item: m }) => {
            const docs = m.kycDocuments || [];
            const aadhaar = docs.find((d: any) => d.docType === 'AADHAAR');
            const pan = docs.find((d: any) => d.docType === 'PAN');
            const straight = docs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_STRAIGHT');
            const left = docs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_LEFT');
            const right = docs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_RIGHT');
            const hasSubmission = !!(aadhaar || pan || straight);

            return (
              <Card
                style={{
                  padding: 14,
                  gap: 12,
                  borderColor: m.kycStatus === 'PENDING' ? '#F59E0B' : m.kycStatus === 'VERIFIED' ? '#10B981' : c.line,
                  borderWidth: m.kycStatus === 'PENDING' ? 1.5 : 1,
                }}
              >
                {/* Member header */}
                <Row justify="space-between" align="center">
                  <Row gap={10} align="center">
                    <Avatar name={m.name} uri={m.avatarUrl} size={42} />
                    <View>
                      <Txt v="bodyStrong">{m.name}</Txt>
                      <Txt v="caption" color="muted">{m.email || m.phone}</Txt>
                    </View>
                  </Row>

                  <Badge
                    label={m.kycStatus === 'VERIFIED' ? 'Verified' : m.kycStatus === 'PENDING' ? 'Pending' : m.kycStatus === 'REJECTED' ? 'Rejected' : 'Not Submitted'}
                    color={m.kycStatus === 'VERIFIED' ? '#10B981' : m.kycStatus === 'PENDING' ? '#F59E0B' : m.kycStatus === 'REJECTED' ? '#EF4444' : c.muted}
                  />
                </Row>

                {/* Document details */}
                {hasSubmission ? (
                  <View style={{ gap: 8, backgroundColor: isDark ? '#111422' : '#F8FAFC', padding: 10, borderRadius: 12 }}>
                    <Row justify="space-between" align="center">
                      <Row gap={6} align="center">
                        <CreditCard size={14} color="#F97316" />
                        <Txt v="caption" style={{ fontWeight: '700' }}>
                          Aadhaar: {aadhaar?.docNumber || 'दर्ज नहीं'}
                        </Txt>
                      </Row>
                      {aadhaar?.fileUrl && (
                        <TouchableOpacity
                          onPress={() => setPreviewPhoto({ title: `${m.name} - आधार`, url: aadhaar.fileUrl })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} color={c.brand} />
                          <Txt v="caption" color="brand" style={{ fontWeight: '800' }}>फ़ोटो</Txt>
                        </TouchableOpacity>
                      )}
                    </Row>

                    <Row justify="space-between" align="center">
                      <Row gap={6} align="center">
                        <CreditCard size={14} color="#3B82F6" />
                        <Txt v="caption" style={{ fontWeight: '700' }}>
                          PAN: {pan?.docNumber || 'दर्ज नहीं'}
                        </Txt>
                      </Row>
                      {pan?.fileUrl && (
                        <TouchableOpacity
                          onPress={() => setPreviewPhoto({ title: `${m.name} - पैन`, url: pan.fileUrl })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} color={c.brand} />
                          <Txt v="caption" color="brand" style={{ fontWeight: '800' }}>फ़ोटो</Txt>
                        </TouchableOpacity>
                      )}
                    </Row>

                    {/* Liveliness captures thumbnails */}
                    <View style={{ gap: 4, marginTop: 4 }}>
                      <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
                        Face Liveliness Captures (चेहरा सत्यापन):
                      </Txt>
                      <Row gap={8}>
                        {[
                          { label: 'सीधा', url: straight?.fileUrl },
                          { label: 'बायाँ', url: left?.fileUrl },
                          { label: 'दायाँ', url: right?.fileUrl },
                        ].map((pose, idx) => (
                          <TouchableOpacity
                            key={idx}
                            disabled={!pose.url}
                            onPress={() => pose.url && setPreviewPhoto({ title: `${m.name} - ${pose.label}`, url: pose.url })}
                            style={{
                              flex: 1,
                              height: 52,
                              borderRadius: 8,
                              backgroundColor: isDark ? '#1E2337' : '#E2E8F0',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                          >
                            {pose.url ? (
                              <Image source={{ uri: pose.url }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Txt v="caption" color="subtle">{pose.label}</Txt>
                            )}
                          </TouchableOpacity>
                        ))}
                      </Row>
                    </View>
                  </View>
                ) : (
                  <View style={{ padding: 8, borderRadius: 10, backgroundColor: isDark ? '#141829' : '#F1F5F9' }}>
                    <Txt v="caption" color="muted">एजेंट ने अभी तक कोई KYC दस्तावेज़ सबमिट नहीं किए हैं।</Txt>
                  </View>
                )}

                {/* Action Buttons */}
                {hasSubmission && (
                  <Row gap={8} style={{ marginTop: 2 }}>
                    {m.kycStatus !== 'VERIFIED' && (
                      <TouchableOpacity
                        onPress={() => handleApprove(m)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#10B981',
                          paddingVertical: 9,
                          borderRadius: 12,
                        }}
                      >
                        <CheckCircle2 size={16} color="#fff" />
                        <Txt v="small" style={{ color: '#fff', fontWeight: '800' }}>Approve KYC</Txt>
                      </TouchableOpacity>
                    )}

                    {m.kycStatus !== 'REJECTED' && (
                      <TouchableOpacity
                        onPress={() => handleReject(m)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: isDark ? '#3D1C24' : '#FEE2E2',
                          paddingVertical: 9,
                          borderRadius: 12,
                        }}
                      >
                        <XCircle size={16} color="#EF4444" />
                        <Txt v="small" style={{ color: '#EF4444', fontWeight: '800' }}>Reject KYC</Txt>
                      </TouchableOpacity>
                    )}
                  </Row>
                )}
              </Card>
            );
          }}
        />
      ) : (
        /* Firm KYC view */
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Card style={{ padding: 18, gap: 12 }}>
            <Row gap={12} align="center">
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={24} color={c.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" style={{ fontSize: 16 }}>फर्म सत्यापन (Firm KYC)</Txt>
                <Txt v="caption" color="muted">SuperAdmin द्वारा जाँचा जाता है</Txt>
              </View>
            </Row>

            <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: isDark ? '#13172C' : '#F8FAFC' }}>
              <Row justify="space-between">
                <Txt v="caption" color="muted">फर्म का नाम:</Txt>
                <Txt v="small" style={{ fontWeight: '700' }}>{user?.organization?.name || 'BrokerIQ Firm'}</Txt>
              </Row>
              <Row justify="space-between">
                <Txt v="caption" color="muted">RERA नंबर:</Txt>
                <Txt v="small" style={{ fontWeight: '700' }}>{(user?.organization as any)?.reraNumber || 'उपलब्ध नहीं'}</Txt>
              </Row>
              <Row justify="space-between">
                <Txt v="caption" color="muted">सत्यापन स्थिति:</Txt>
                <Badge
                  label={(user?.organization as any)?.verification === 'VERIFIED' ? 'Verified by SuperAdmin' : 'Under Review'}
                  color={(user?.organization as any)?.verification === 'VERIFIED' ? '#10B981' : '#F59E0B'}
                />
              </Row>
            </View>
          </Card>
        </ScrollView>
      )}

      {/* Photo Preview Modal */}
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <TouchableOpacity
            onPress={() => setPreviewPhoto(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {previewPhoto && (
            <View style={{ width: '100%', alignItems: 'center', gap: 12 }}>
              <Txt style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{previewPhoto.title}</Txt>
              <Image source={{ uri: previewPhoto.url }} style={{ width: '100%', height: 380, borderRadius: 14 }} resizeMode="contain" />
            </View>
          )}
        </View>
      </Modal>
    </BrokerScreen>
  );
}
