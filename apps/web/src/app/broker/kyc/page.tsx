'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Lock,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { post, useApiMutation } from '@/lib/hooks';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';
import { AgentKycPipeline } from '@/components/broker/agent-kyc-pipeline';
import { cn, formatDate } from '@/lib/utils';

interface MyKycResponse {
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

export default function AgentKycPage() {
  const { user } = useAuth();
  const kycQuery = useQuery({
    queryKey: ['agent-kyc-mine'],
    queryFn: () => api<MyKycResponse>('/broker/team/agent-kyc/mine'),
  });

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarPhotoUrl, setAadhaarPhotoUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panPhotoUrl, setPanPhotoUrl] = useState('');
  const [liveliness, setLiveliness] = useState<{
    straightUrl: string | null;
    leftUrl: string | null;
    rightUrl: string | null;
  }>({
    straightUrl: null,
    leftUrl: null,
    rightUrl: null,
  });

  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);

  // Sync state when data loads
  const kyc = kycQuery.data;
  const isVerified = kyc?.status === 'VERIFIED';
  const isPending = kyc?.status === 'PENDING';
  const isRejected = kyc?.status === 'REJECTED';

  // Initialize values when query returns
  useState(() => {
    if (kyc) {
      if (kyc.aadhaarNumber) setAadhaarNumber(kyc.aadhaarNumber);
      if (kyc.aadhaarPhotoUrl) setAadhaarPhotoUrl(kyc.aadhaarPhotoUrl);
      if (kyc.panNumber) setPanNumber(kyc.panNumber);
      if (kyc.panPhotoUrl) setPanPhotoUrl(kyc.panPhotoUrl);
      setLiveliness({
        straightUrl: kyc.livelinessStraightUrl,
        leftUrl: kyc.livelinessLeftUrl,
        rightUrl: kyc.livelinessRightUrl,
      });
    }
  });

  const submitMutation = useApiMutation(
    (body: any) => post('/broker/team/agent-kyc', body),
    {
      success: 'Agent KYC सफलतापूर्वक सबमिट हो गया है! Admin review करेंगे।',
      invalidate: [['agent-kyc-mine'], ['team']],
    },
  );

  const handleAadhaarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAadhaar(true);
      const { url } = await uploadFile(file, 'kyc');
      setAadhaarPhotoUrl(url);
      toast.success('Aadhaar Document अपलोड हुआ ✅');
    } catch (err: any) {
      toast.error('Aadhaar upload failed: ' + (err?.message || 'Error'));
    } finally {
      setUploadingAadhaar(false);
    }
  };

  const handlePanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPan(true);
      const { url } = await uploadFile(file, 'kyc');
      setPanPhotoUrl(url);
      toast.success('PAN Document अपलोड हुआ ✅');
    } catch (err: any) {
      toast.error('PAN upload failed: ' + (err?.message || 'Error'));
    } finally {
      setUploadingPan(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Aadhaar
    const cleanAadhaar = (aadhaarNumber || kyc?.aadhaarNumber || '').replace(/\D/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      toast.error('Aadhaar number invalid है — कृपया ठीक 12 अंकों का आधार नंबर दर्ज करें');
      return;
    }
    const finalAadhaarDoc = aadhaarPhotoUrl || kyc?.aadhaarPhotoUrl;
    if (!finalAadhaarDoc) {
      toast.error('Aadhaar card की फ़ोटो/डॉक्यूमेंट अपलोड करना ज़रूरी है');
      return;
    }

    // 2. Validate PAN
    const cleanPan = (panNumber || kyc?.panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      toast.error('PAN card number invalid है — 10 अक्षरों का फॉर्मेट होना चाहिए (उदा: ABCDE1234F)');
      return;
    }
    const finalPanDoc = panPhotoUrl || kyc?.panPhotoUrl;
    if (!finalPanDoc) {
      toast.error('PAN card की फ़ोटो/डॉक्यूमेंट अपलोड करना ज़रूरी है');
      return;
    }

    // 3. Validate Face Liveliness
    const finalStraight = liveliness.straightUrl || kyc?.livelinessStraightUrl;
    const finalLeft = liveliness.leftUrl || kyc?.livelinessLeftUrl;
    const finalRight = liveliness.rightUrl || kyc?.livelinessRightUrl;

    if (!finalStraight || !finalLeft || !finalRight) {
      toast.error('Face Liveliness Check के तीनों कोणों (Straight, Left, Right) की फ़ोटो ज़रूरी हैं');
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

  if (kycQuery.isError) {
    return <ApiErrorState error={kycQuery.error} onRetry={() => kycQuery.refetch()} />;
  }

  if (kycQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const currentAadhaarNum = aadhaarNumber || kyc?.aadhaarNumber || '';
  const currentAadhaarPhoto = aadhaarPhotoUrl || kyc?.aadhaarPhotoUrl || '';
  const currentPanNum = panNumber || kyc?.panNumber || '';
  const currentPanPhoto = panPhotoUrl || kyc?.panPhotoUrl || '';

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <PageHeader
        title="Agent KYC Verification • एजेंट सत्यापन"
        subtitle="सुरक्षित ब्रोकरेज व डील प्रमाणीकरण हेतु आधार, पैन और 3-स्टेप चेहरा सत्यापन पूरा करें"
      />

      {/* Status Hero Card */}
      {isVerified ? (
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-950 dark:text-emerald-100">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <BadgeCheck className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-lg">Verified Agent • आपका KYC सत्यापित है</h3>
              <Badge tone="success" className="font-bold">
                VERIFIED
              </Badge>
            </div>
            <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/90">
              आपके सभी पहचान दस्तावेज़ व फ़ेस लाइवलीनेस स्वीकृत हो चुके हैं। विवरण सुरक्षित व लॉक हैं।
            </p>
            {kyc?.reviewedAt && (
              <p className="mt-2 text-xs text-muted">
                सत्यापित तिथि: {formatDate(kyc.reviewedAt)}
              </p>
            )}
          </div>
        </div>
      ) : isPending ? (
        <div className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-950 dark:text-amber-100">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Clock className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-lg">KYC Under Review • सत्यापन समीक्षा में है</h3>
              <Badge tone="warning" className="font-bold">
                PENDING REVIEW
              </Badge>
            </div>
            <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
              आपके आधार, पैन व फ़ेस लाइवलीनेस का दस्तावेज़ ब्रोकर एडमिन के पास समीक्षा हेतु जमा है। अप्रूवल के बाद स्थिति अपडेट हो जाएगी।
            </p>
          </div>
        </div>
      ) : isRejected ? (
        <div className="flex items-start gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-950 dark:text-rose-100">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
            <ShieldAlert className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-lg">KYC Rejected • सत्यापन अस्वीकृत हुआ</h3>
              <Badge tone="danger" className="font-bold">
                REJECTED
              </Badge>
            </div>
            <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-200/90">
              कारण: {kyc?.reviewNote || 'दस्तावेज़ साफ़ नहीं थे या जानकारी मेल नहीं खाती।'}
            </p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              कृपया नीचे विवरण सुधारें और नए दस्तावेज़/फ़ोटो के साथ पुनः सबमिट करें।
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
            <Shield className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base">KYC शुरू करें • Complete Your Agent KYC</h3>
              <Badge tone="neutral">NOT SUBMITTED</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              पहचान सत्यापन पूरा करने के बाद आप प्रॉपर्टी इन्वेंटरी जोड़ सकते हैं व ब्रोकर टीम का वेरिफाइड बैच पा सकते हैं।
            </p>
          </div>
        </div>
      )}

      {/* Main KYC Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Aadhaar Details */}
        <div className="card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <CreditCard className="size-5 text-saffron-500" />
            <div>
              <h3 className="font-bold text-base">1. Aadhaar Card Details • आधार कार्ड विवरण</h3>
              <p className="text-xs text-muted">12 अंकों का आधार नंबर व फ़ोटो अपलोड करें</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="आधार नंबर (12 Digits)">
              <div className="relative">
                <Input
                  value={currentAadhaarNum}
                  disabled={isVerified}
                  maxLength={14}
                  placeholder="XXXX XXXX XXXX"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                    // format with spaces
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                    setAadhaarNumber(formatted);
                  }}
                  className={cn(
                    'font-mono text-base tracking-wider',
                    currentAadhaarNum.replace(/\D/g, '').length === 12 && 'border-emerald-500 ring-1 ring-emerald-500',
                  )}
                />
                {currentAadhaarNum.replace(/\D/g, '').length === 12 && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                )}
              </div>
            </Field>

            <Field label="आधार कार्ड फ़ोटो / डॉक्यूमेंट">
              <div className="flex items-center gap-3">
                {currentAadhaarPhoto ? (
                  <div className="relative flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2 pr-4">
                    <a
                      href={currentAadhaarPhoto}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block size-12 overflow-hidden rounded-lg bg-surface border"
                    >
                      <img src={currentAadhaarPhoto} alt="Aadhaar" className="h-full w-full object-cover" />
                    </a>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">दस्तावेज़ संलग्न ✅</p>
                      <a href={currentAadhaarPhoto} target="_blank" rel="noreferrer" className="text-muted hover:underline">
                        देखें (View)
                      </a>
                    </div>
                    {!isVerified && (
                      <label className="cursor-pointer text-xs font-semibold text-saffron-600 hover:underline">
                        बदलें
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleAadhaarUpload} />
                      </label>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/60 p-3 text-xs font-semibold hover:bg-surface-2">
                    <Upload className="size-4 text-muted" />
                    <span>{uploadingAadhaar ? 'अपलोड हो रहा है...' : 'आधार फ़ाइल अपलोड करें'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isVerified || uploadingAadhaar}
                      className="hidden"
                      onChange={handleAadhaarUpload}
                    />
                  </label>
                )}
              </div>
            </Field>
          </div>
        </div>

        {/* Section 2: PAN Details */}
        <div className="card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <FileText className="size-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-base">2. PAN Card Details • पैन कार्ड विवरण</h3>
              <p className="text-xs text-muted">10 अक्षरों का आयकर पैन नंबर व फ़ोटो अपलोड करें</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="पैन नंबर (Format: ABCDE1234F)">
              <div className="relative">
                <Input
                  value={currentPanNum}
                  disabled={isVerified}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className={cn(
                    'font-mono text-base uppercase tracking-wider',
                    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(currentPanNum) && 'border-emerald-500 ring-1 ring-emerald-500',
                  )}
                />
                {/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(currentPanNum) && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                )}
              </div>
            </Field>

            <Field label="पैन कार्ड फ़ोटो / डॉक्यूमेंट">
              <div className="flex items-center gap-3">
                {currentPanPhoto ? (
                  <div className="relative flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2 pr-4">
                    <a
                      href={currentPanPhoto}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block size-12 overflow-hidden rounded-lg bg-surface border"
                    >
                      <img src={currentPanPhoto} alt="PAN" className="h-full w-full object-cover" />
                    </a>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">दस्तावेज़ संलग्न ✅</p>
                      <a href={currentPanPhoto} target="_blank" rel="noreferrer" className="text-muted hover:underline">
                        देखें (View)
                      </a>
                    </div>
                    {!isVerified && (
                      <label className="cursor-pointer text-xs font-semibold text-saffron-600 hover:underline">
                        बदलें
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePanUpload} />
                      </label>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/60 p-3 text-xs font-semibold hover:bg-surface-2">
                    <Upload className="size-4 text-muted" />
                    <span>{uploadingPan ? 'अपलोड हो रहा है...' : 'पैन फ़ाइल अपलोड करें'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isVerified || uploadingPan}
                      className="hidden"
                      onChange={handlePanUpload}
                    />
                  </label>
                )}
              </div>
            </Field>
          </div>
        </div>

        {/* Section 3: 3-step Face Liveliness Camera Pipeline */}
        <AgentKycPipeline
          disabled={isVerified}
          initialValues={{
            straightUrl: liveliness.straightUrl || kyc?.livelinessStraightUrl || null,
            leftUrl: liveliness.leftUrl || kyc?.livelinessLeftUrl || null,
            rightUrl: liveliness.rightUrl || kyc?.livelinessRightUrl || null,
          }}
          onChange={(val) => setLiveliness(val)}
        />

        {/* Action button */}
        {!isVerified && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 h-12 text-base shadow-xl shadow-emerald-950/20"
            >
              <ShieldCheck className="size-5 mr-2" />
              {submitMutation.isPending ? 'सत्यापन भेजा जा रहा है...' : isRejected ? 'सुधार कर पुनः सबमिट करें' : 'KYC सबमिट करें (Submit KYC)'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
