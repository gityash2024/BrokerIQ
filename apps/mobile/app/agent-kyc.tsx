import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Shield,
  RotateCcw,
  Upload,
} from 'lucide-react-native';
import { BrokerScreen } from '@/launch/screen';
import { Txt, Button } from '@/ui';
import { useTheme } from '@/lib/theme';
import { api, post, uploadUri } from '@/lib/api';

interface KycResponse {
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  aadhaarNumber: string | null;
  aadhaarPhotoUrl: string | null;
  panNumber: string | null;
  panPhotoUrl: string | null;
  livelinessStraightUrl: string | null;
  livelinessLeftUrl: string | null;
  livelinessRightUrl: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export default function AgentKycScreen() {
  const { c, isDark } = useTheme();
  const queryClient = useQueryClient();

  const kycQuery = useQuery({
    queryKey: ['agent-kyc-mine-mobile'],
    queryFn: () => api<KycResponse>('/broker/team/agent-kyc/mine'),
  });

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarPhotoUrl, setAadhaarPhotoUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panPhotoUrl, setPanPhotoUrl] = useState('');

  const [straightUrl, setStraightUrl] = useState<string | null>(null);
  const [leftUrl, setLeftUrl] = useState<string | null>(null);
  const [rightUrl, setRightUrl] = useState<string | null>(null);

  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
  const [uploadingPose, setUploadingPose] = useState<string | null>(null);

  const kyc = kycQuery.data;
  const isVerified = kyc?.status === 'VERIFIED';
  const isPending = kyc?.status === 'PENDING';
  const isRejected = kyc?.status === 'REJECTED';

  useEffect(() => {
    if (kyc) {
      if (kyc.aadhaarNumber) setAadhaarNumber(kyc.aadhaarNumber);
      if (kyc.aadhaarPhotoUrl) setAadhaarPhotoUrl(kyc.aadhaarPhotoUrl);
      if (kyc.panNumber) setPanNumber(kyc.panNumber);
      if (kyc.panPhotoUrl) setPanPhotoUrl(kyc.panPhotoUrl);
      if (kyc.livelinessStraightUrl) setStraightUrl(kyc.livelinessStraightUrl);
      if (kyc.livelinessLeftUrl) setLeftUrl(kyc.livelinessLeftUrl);
      if (kyc.livelinessRightUrl) setRightUrl(kyc.livelinessRightUrl);
    }
  }, [kyc]);

  const submitMutation = useMutation({
    mutationFn: (body: any) => post('/broker/team/agent-kyc', body),
    onSuccess: () => {
      Alert.alert(
        'KYC सबमिट हो गया ✅',
        'आपका Agent KYC सफलतापूर्वक सबमिट हो चुका है। ब्रोकर एडमिन इसे जल्द वेरिफाई करेंगे।',
      );
      queryClient.invalidateQueries({ queryKey: ['agent-kyc-mine-mobile'] });
    },
    onError: (err: any) => {
      Alert.alert('त्रुटि', err?.message || 'KYC सबमिट नहीं हो सका');
    },
  });

  // Pick/Capture Document (Aadhaar / PAN)
  const pickDocument = async (type: 'aadhaar' | 'pan') => {
    if (isVerified) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (res.canceled || !res.assets[0]?.uri) return;

      if (type === 'aadhaar') {
        setUploadingAadhaar(true);
        const { url } = await uploadUri(res.assets[0].uri, 'kyc');
        setAadhaarPhotoUrl(url);
      } else {
        setUploadingPan(true);
        const { url } = await uploadUri(res.assets[0].uri, 'kyc');
        setPanPhotoUrl(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message || 'फ़ोटो अपलोड नहीं हो पाई');
    } finally {
      setUploadingAadhaar(false);
      setUploadingPan(false);
    }
  };

  // Capture Liveliness Selfie with front camera
  const capturePose = async (pose: 'STRAIGHT' | 'LEFT' | 'RIGHT') => {
    if (isVerified) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('कैमरा परमिशन आवश्यक', 'चेहरा सत्यापन हेतु कैमरा परमिशन दें।');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (res.canceled || !res.assets[0]?.uri) return;

      setUploadingPose(pose);
      const { url } = await uploadUri(res.assets[0].uri, 'kyc');

      if (pose === 'STRAIGHT') setStraightUrl(url);
      if (pose === 'LEFT') setLeftUrl(url);
      if (pose === 'RIGHT') setRightUrl(url);
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'फ़ोटो कैप्चर नहीं हो सकी');
    } finally {
      setUploadingPose(null);
    }
  };

  const handleSubmit = () => {
    const cleanAadhaar = (aadhaarNumber || kyc?.aadhaarNumber || '').replace(/\D/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      Alert.alert('अमान्य आधार नंबर', 'कृपया ठीक 12 अंकों का आधार कार्ड नंबर दर्ज करें।');
      return;
    }
    const finalAadhaarDoc = aadhaarPhotoUrl || kyc?.aadhaarPhotoUrl;
    if (!finalAadhaarDoc) {
      Alert.alert('दस्तावेज़ आवश्यक', 'कृपया आधार कार्ड की फ़ोटो अपलोड करें।');
      return;
    }

    const cleanPan = (panNumber || kyc?.panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      Alert.alert('अमान्य पैन नंबर', 'कृपया मान्य 10 अक्षरों का पैन कार्ड नंबर दर्ज करें (उदा: ABCDE1234F)।');
      return;
    }
    const finalPanDoc = panPhotoUrl || kyc?.panPhotoUrl;
    if (!finalPanDoc) {
      Alert.alert('दस्तावेज़ आवश्यक', 'कृपया पैन कार्ड की फ़ोटो अपलोड करें।');
      return;
    }

    const finalStraight = straightUrl || kyc?.livelinessStraightUrl;
    const finalLeft = leftUrl || kyc?.livelinessLeftUrl;
    const finalRight = rightUrl || kyc?.livelinessRightUrl;

    if (!finalStraight || !finalLeft || !finalRight) {
      Alert.alert('फ़ेस लाइवलीनेस अधूरी', 'कृपया चेहरे के तीनों कोण (सामने, बाईं ओर, दाईं ओर) कैप्चर करें।');
      return;
    }

    submitMutation.mutate({
      aadhaarNumber: cleanAadhaar,
      aadhaarPhotoUrl: finalAadhaarDoc,
      panNumber: cleanPan,
      panPhotoUrl: finalPanDoc,
      livelinessStraightUrl: finalStraight,
      livelinessLeftUrl: finalLeft,
      livelinessRightUrl: finalRight,
    });
  };

  const currentAadhaar = aadhaarNumber || kyc?.aadhaarNumber || '';
  const currentAadhaarDoc = aadhaarPhotoUrl || kyc?.aadhaarPhotoUrl || '';
  const currentPan = panNumber || kyc?.panNumber || '';
  const currentPanDoc = panPhotoUrl || kyc?.panPhotoUrl || '';

  return (
    <BrokerScreen title="Agent KYC Verification" subtitle="आधार, पैन व फ़ेस लाइवलीनेस सत्यापन" back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 50 }}>
        {/* Status Card */}
        {isVerified ? (
          <View
            style={{
              padding: 16,
              borderRadius: 20,
              backgroundColor: 'rgba(16,185,129,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(16,185,129,0.3)',
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={22} color="#10B981" />
              <Txt style={{ fontSize: 16, fontWeight: '900', color: '#10B981' }}>
                KYC Verified • सत्यापित
              </Txt>
            </View>
            <Txt v="small" style={{ color: isDark ? '#A7F3D0' : '#065F46' }}>
              आपके सभी पहचान दस्तावेज़ स्वीकृत हैं। आप वेरिफाइड एजेंट के रूप में प्रमाणित हैं।
            </Txt>
          </View>
        ) : isPending ? (
          <View
            style={{
              padding: 16,
              borderRadius: 20,
              backgroundColor: 'rgba(245,158,11,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.3)',
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={22} color="#F59E0B" />
              <Txt style={{ fontSize: 16, fontWeight: '900', color: '#F59E0B' }}>
                Under Review • समीक्षा जारी है
              </Txt>
            </View>
            <Txt v="small" style={{ color: isDark ? '#FDE68A' : '#92400E' }}>
              दस्तावेज़ जमा हो चुके हैं। ब्रोकर एडमिन की समीक्षा के बाद स्थिति अपडेट होगी।
            </Txt>
          </View>
        ) : isRejected ? (
          <View
            style={{
              padding: 16,
              borderRadius: 20,
              backgroundColor: 'rgba(239,68,68,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.3)',
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={22} color="#EF4444" />
              <Txt style={{ fontSize: 16, fontWeight: '900', color: '#EF4444' }}>
                KYC Rejected • अस्वीकृत
              </Txt>
            </View>
            <Txt v="small" style={{ color: isDark ? '#FECACA' : '#991B1B' }}>
              कारण: {kyc?.reviewNote || 'दस्तावेज़ साफ़ नहीं थे या जानकारी मेल नहीं खाती।'}
            </Txt>
            <Txt v="caption" style={{ color: isDark ? '#FCA5A5' : '#B91C1C' }}>
              कृपया सही जानकारी व नई फ़ोटो के साथ पुनः सबमिट करें।
            </Txt>
          </View>
        ) : (
          <View
            style={{
              padding: 16,
              borderRadius: 20,
              backgroundColor: isDark ? '#13172C' : '#FFFFFF',
              borderWidth: 1,
              borderColor: c.line,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Shield size={20} color={c.muted} />
              <Txt style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>
                पहचान सत्यापन आवश्यक
              </Txt>
            </View>
            <Txt v="small" color="muted">
              कृपया नीचे आधार नंबर, पैन नंबर व 3-स्टेप चेहरा सत्यापन पूरा करें।
            </Txt>
          </View>
        )}

        {/* Section 1: Aadhaar Card */}
        <View
          style={{
            borderRadius: 22,
            padding: 16,
            backgroundColor: isDark ? '#121524' : '#FFFFFF',
            borderWidth: 1,
            borderColor: c.line,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} color="#F97316" />
            <Txt style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>
              1. Aadhaar Card • आधार कार्ड
            </Txt>
          </View>

          <View style={{ gap: 4 }}>
            <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
              आधार नंबर (12 Digits)
            </Txt>
            <TextInput
              value={currentAadhaar}
              editable={!isVerified}
              keyboardType="numeric"
              maxLength={14}
              placeholder="XXXX XXXX XXXX"
              placeholderTextColor={c.muted}
              onChangeText={(t) => {
                const raw = t.replace(/\D/g, '').slice(0, 12);
                const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                setAadhaarNumber(formatted);
              }}
              style={{
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: currentAadhaar.replace(/\D/g, '').length === 12 ? '#10B981' : c.line,
                backgroundColor: isDark ? '#0A0D1A' : '#F9FAFB',
                paddingHorizontal: 14,
                fontSize: 15,
                fontWeight: '700',
                color: c.fg,
                fontFamily: 'monospace',
                letterSpacing: 1,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
              आधार कार्ड फ़ोटो / डॉक्यूमेंट
            </Txt>
            {currentAadhaarDoc ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 8 }}>
                <Image source={{ uri: currentAadhaarDoc }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>दस्तावेज़ संलग्न ✅</Txt>
                  <Txt v="caption" color="muted" numberOfLines={1}>{currentAadhaarDoc}</Txt>
                </View>
                {!isVerified && (
                  <TouchableOpacity onPress={() => pickDocument('aadhaar')} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Txt style={{ color: c.brand, fontSize: 12, fontWeight: '700' }}>बदलें</Txt>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                disabled={isVerified || uploadingAadhaar}
                onPress={() => pickDocument('aadhaar')}
                style={{
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: c.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Upload size={16} color={c.muted} />
                <Txt v="small" style={{ fontWeight: '700', color: c.fg }}>
                  {uploadingAadhaar ? 'अपलोड हो रहा है...' : 'आधार फ़ोटो चुनें (Upload)'}
                </Txt>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section 2: PAN Card */}
        <View
          style={{
            borderRadius: 22,
            padding: 16,
            backgroundColor: isDark ? '#121524' : '#FFFFFF',
            borderWidth: 1,
            borderColor: c.line,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#6366F1" />
            <Txt style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>
              2. PAN Card • पैन कार्ड
            </Txt>
          </View>

          <View style={{ gap: 4 }}>
            <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
              पैन नंबर (Format: ABCDE1234F)
            </Txt>
            <TextInput
              value={currentPan}
              editable={!isVerified}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="ABCDE1234F"
              placeholderTextColor={c.muted}
              onChangeText={(t) => setPanNumber(t.toUpperCase())}
              style={{
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(currentPan) ? '#10B981' : c.line,
                backgroundColor: isDark ? '#0A0D1A' : '#F9FAFB',
                paddingHorizontal: 14,
                fontSize: 15,
                fontWeight: '700',
                color: c.fg,
                fontFamily: 'monospace',
                letterSpacing: 1,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Txt v="caption" color="muted" style={{ fontWeight: '700' }}>
              पैन कार्ड फ़ोटो / डॉक्यूमेंट
            </Txt>
            {currentPanDoc ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 8 }}>
                <Image source={{ uri: currentPanDoc }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>दस्तावेज़ संलग्न ✅</Txt>
                  <Txt v="caption" color="muted" numberOfLines={1}>{currentPanDoc}</Txt>
                </View>
                {!isVerified && (
                  <TouchableOpacity onPress={() => pickDocument('pan')} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Txt style={{ color: c.brand, fontSize: 12, fontWeight: '700' }}>बदलें</Txt>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                disabled={isVerified || uploadingPan}
                onPress={() => pickDocument('pan')}
                style={{
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: c.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Upload size={16} color={c.muted} />
                <Txt v="small" style={{ fontWeight: '700', color: c.fg }}>
                  {uploadingPan ? 'अपलोड हो रहा है...' : 'पैन फ़ोटो चुनें (Upload)'}
                </Txt>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section 3: Face Liveliness Check (3 Poses) */}
        <View
          style={{
            borderRadius: 22,
            padding: 16,
            backgroundColor: isDark ? '#121524' : '#FFFFFF',
            borderWidth: 1,
            borderColor: c.line,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Camera size={18} color="#10B981" />
              <Txt style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>
                3. Face Liveliness (3 Poses)
              </Txt>
            </View>
            {straightUrl && leftUrl && rightUrl && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={14} color="#10B981" />
                <Txt style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>3/3 Complete</Txt>
              </View>
            )}
          </View>

          <Txt v="caption" color="muted">
            सत्यापन हेतु सेल्फी कैमरे से 3 अलग कोणों में अपना चेहरा कैप्चर करें
          </Txt>

          {/* 3 Pose Cards */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { key: 'STRAIGHT' as const, label: 'Straight', hint: 'सामने देखें', url: straightUrl },
              { key: 'LEFT' as const, label: 'Turn Left', hint: 'बाईं तरफ', url: leftUrl },
              { key: 'RIGHT' as const, label: 'Turn Right', hint: 'दाईं तरफ', url: rightUrl },
            ].map((pose) => (
              <View
                key={pose.key}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: pose.url ? '#10B981' : c.line,
                  backgroundColor: isDark ? '#0A0D1A' : '#F9FAFB',
                  padding: 8,
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: 10,
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#171B30' : '#E5E7EB',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pose.url ? (
                    <Image source={{ uri: pose.url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Camera size={24} color={c.muted} />
                  )}
                  {pose.url && (
                    <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#10B981', borderRadius: 99, padding: 2 }}>
                      <CheckCircle2 size={12} color="#fff" />
                    </View>
                  )}
                </View>

                <Txt style={{ fontSize: 11, fontWeight: '800', color: c.fg }}>{pose.label}</Txt>
                <Txt style={{ fontSize: 10, color: c.muted }}>{pose.hint}</Txt>

                {!isVerified && (
                  <TouchableOpacity
                    disabled={uploadingPose === pose.key}
                    onPress={() => capturePose(pose.key)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: pose.url ? 'transparent' : c.brand,
                    }}
                  >
                    <Txt style={{ fontSize: 11, fontWeight: '700', color: pose.url ? c.brand : '#fff' }}>
                      {uploadingPose === pose.key ? 'Saving...' : pose.url ? 'दोबारा लें' : 'कैप्चर करें'}
                    </Txt>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        {!isVerified && (
          <Button
            size="lg"
            variant="primary"
            title={isRejected ? 'सुधार कर पुनः सबमिट करें' : 'KYC सबमिट करें (Submit KYC)'}
            loading={submitMutation.isPending}
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </BrokerScreen>
  );
}
