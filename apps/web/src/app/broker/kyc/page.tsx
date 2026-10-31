'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Lock,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { PageHeader } from '@/components/panel/shell';
import { useTeam } from '@/components/broker/bits';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { AgentKycPipeline } from '@/components/broker/agent-kyc-pipeline';
import { cn, formatDate } from '@/lib/utils';

export default function BrokerKycPage() {
  const { user } = useAuth();
  const isAdminOrSuper = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';

  if (isAdminOrSuper) {
    return <AdminKycManagementView user={user} />;
  }

  return <AgentKycSubmissionView />;
}

/* ========================================================================= */
/* 1. BROKER ADMIN & SUPERADMIN: TEAM KYC REVIEW & OWN KYC                   */
/* ========================================================================= */

function AdminKycManagementView({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'team' | 'firm'>('team');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);
  const [rejectingMember, setRejectingMember] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const teamQuery = useTeam();

  const reviewMutation = useApiMutation(
    ({ agentId, ...body }: { agentId: string; status: 'VERIFIED' | 'REJECTED'; reviewNote?: string }) =>
      patch(`/broker/team/agents/${agentId}/kyc`, body),
    {
      invalidate: [['team']],
      onSuccess: (_, vars) => {
        toast.success(vars.status === 'VERIFIED' ? '✅ KYC Approved सफलतापूर्वक!' : '❌ KYC Reject कर दिया गया');
        setRejectingMember(null);
        setRejectNote('');
      },
    },
  );

  const firmKycQuery = useQuery({
    queryKey: ['broker-firm-kyc-mine'],
    queryFn: () => api<any[]>('/kyc/mine'),
  });

  const members = teamQuery.data?.members ?? [];
  const filteredMembers = members.filter((m: any) => {
    if (filter === 'ALL') return true;
    return m.kycStatus === filter;
  });

  const pendingCount = members.filter((m: any) => m.kycStatus === 'PENDING').length;
  const verifiedCount = members.filter((m: any) => m.kycStatus === 'VERIFIED').length;

  return (
    <>
      <PageHeader
        title="KYC Management"
        subtitle="अपनी टीम के एजेंट्स का KYC सत्यापन करें एवं अपनी फर्म का KYC स्टेटस देखें"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === 'team' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('team')}
            >
              <Users className="size-4" /> Team KYC Review ({pendingCount} लंबित)
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'firm' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('firm')}
            >
              <Building2 className="size-4" /> Firm KYC
            </Button>
          </div>
        }
      />

      {activeTab === 'team' ? (
        <div className="space-y-6">
          {/* Status KPI summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              onClick={() => setFilter('ALL')}
              className={cn(
                'card cursor-pointer p-4 transition-all',
                filter === 'ALL' ? 'border-brand ring-2 ring-brand/20' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-muted">कुल टीम मेंबर्स</p>
              <p className="mt-1 text-2xl font-black">{members.length}</p>
            </div>
            <div
              onClick={() => setFilter('PENDING')}
              className={cn(
                'card cursor-pointer p-4 transition-all',
                filter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'hover:bg-surface-2/40',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">समीक्षा लंबित (Pending)</p>
                {pendingCount > 0 && <span className="size-2 rounded-full bg-amber-500 animate-ping" />}
              </div>
              <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
            </div>
            <div
              onClick={() => setFilter('VERIFIED')}
              className={cn(
                'card cursor-pointer p-4 transition-all',
                filter === 'VERIFIED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">प्रमाणित (Verified)</p>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{verifiedCount}</p>
            </div>
            <div
              onClick={() => setFilter('REJECTED')}
              className={cn(
                'card cursor-pointer p-4 transition-all',
                filter === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">अस्वीकृत (Rejected)</p>
              <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                {members.filter((m: any) => m.kycStatus === 'REJECTED').length}
              </p>
            </div>
          </div>

          {teamQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <Empty
              icon={<Shield className="size-8" />}
              title="कोई KYC रिकॉर्ड नहीं मिला"
              text={filter === 'PENDING' ? 'कोई भी लंबित समीक्षा नहीं है।' : 'इस फ़िल्टर में कोई सदस्य नहीं हैं।'}
            />
          ) : (
            <div className="space-y-4">
              {filteredMembers.map((member: any) => {
                const kycDocs = member.kycDocuments || [];
                const aadhaar = kycDocs.find((d: any) => d.docType === 'AADHAAR');
                const pan = kycDocs.find((d: any) => d.docType === 'PAN');
                const straight = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_STRAIGHT');
                const left = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_LEFT');
                const right = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_RIGHT');
                const hasSubmission = !!(aadhaar || pan || straight);

                return (
                  <div
                    key={member.id}
                    className={cn(
                      'card p-5 transition-all',
                      member.kycStatus === 'PENDING' && 'border-amber-300 dark:border-amber-500/40 bg-amber-500/5',
                      member.kycStatus === 'VERIFIED' && 'border-emerald-200 dark:border-emerald-500/20',
                    )}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      {/* Member Info */}
                      <div className="flex items-start gap-3">
                        <Avatar name={member.name} src={member.avatarUrl} size={48} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-base">{member.name}</p>
                            <Badge tone={member.role === 'BROKER_ADMIN' ? 'brand' : 'neutral'}>
                              {member.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted">{member.email} {member.phone ? `· ${member.phone}` : ''}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {member.kycStatus === 'VERIFIED' ? (
                              <Badge tone="success" className="font-bold">
                                <ShieldCheck className="size-3.5 mr-1" /> Verified • प्रमाणित
                              </Badge>
                            ) : member.kycStatus === 'PENDING' ? (
                              <Badge tone="warning" className="font-bold animate-pulse">
                                <Clock className="size-3.5 mr-1" /> Pending Review • समीक्षा लंबित
                              </Badge>
                            ) : member.kycStatus === 'REJECTED' ? (
                              <Badge tone="danger" className="font-bold">
                                <ShieldAlert className="size-3.5 mr-1" /> Rejected • अस्वीकृत
                              </Badge>
                            ) : (
                              <Badge tone="neutral">Not Submitted • जमा नहीं</Badge>
                            )}
                            {aadhaar?.reviewedAt && (
                              <span className="text-[11px] text-muted">
                                {formatDate(aadhaar.reviewedAt, { day: 'numeric', month: 'short' })} को समीक्षित
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Review Action Buttons */}
                      <div className="flex items-center gap-2 self-end md:self-start">
                        {member.kycStatus !== 'VERIFIED' && hasSubmission && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            loading={reviewMutation.isPending && reviewMutation.variables?.agentId === member.id && reviewMutation.variables?.status === 'VERIFIED'}
                            onClick={() => reviewMutation.mutate({ agentId: member.id, status: 'VERIFIED' })}
                          >
                            <CheckCircle2 className="size-4" /> Approve KYC
                          </Button>
                        )}
                        {member.kycStatus !== 'REJECTED' && hasSubmission && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setRejectingMember(member);
                              setRejectNote('');
                            }}
                          >
                            <XCircle className="size-4" /> Reject KYC
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* KYC Documents & Live photos grid */}
                    {hasSubmission ? (
                      <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Aadhaar */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-muted mb-1">
                              <span className="flex items-center gap-1">
                                <CreditCard className="size-3.5 text-saffron-500" /> आधार कार्ड
                              </span>
                              <Badge tone={aadhaar?.status === 'VERIFIED' ? 'success' : 'neutral'}>
                                {aadhaar?.status || 'PENDING'}
                              </Badge>
                            </div>
                            <p className="font-mono text-xs font-extrabold tracking-wider">
                              {aadhaar?.docNumber ? aadhaar.docNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : 'नंबर दर्ज नहीं'}
                            </p>
                          </div>
                          {aadhaar?.fileUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ title: `${member.name} - आधार कार्ड`, url: aadhaar.fileUrl })}
                              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1.5 text-xs font-semibold hover:border-brand transition-colors"
                            >
                              <Eye className="size-3.5" /> फ़ोटो देखें
                            </button>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted italic">फ़ोटो अपलोड नहीं</p>
                          )}
                        </div>

                        {/* PAN */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-muted mb-1">
                              <span className="flex items-center gap-1">
                                <CreditCard className="size-3.5 text-blue-500" /> पैन कार्ड
                              </span>
                              <Badge tone={pan?.status === 'VERIFIED' ? 'success' : 'neutral'}>
                                {pan?.status || 'PENDING'}
                              </Badge>
                            </div>
                            <p className="font-mono text-xs font-extrabold tracking-wider">
                              {pan?.docNumber || 'नंबर दर्ज नहीं'}
                            </p>
                          </div>
                          {pan?.fileUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ title: `${member.name} - पैन कार्ड`, url: pan.fileUrl })}
                              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1.5 text-xs font-semibold hover:border-brand transition-colors"
                            >
                              <Eye className="size-3.5" /> फ़ोटो देखें
                            </button>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted italic">फ़ोटो अपलोड नहीं</p>
                          )}
                        </div>

                        {/* Face 1: Straight */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <p className="text-xs font-bold text-muted mb-1">फेस: सीधा (Straight)</p>
                          {straight?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (सामने)`, url: straight.fileUrl })}
                              className="relative cursor-pointer group rounded-lg overflow-hidden border border-line h-20 bg-surface-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={straight.fileUrl} alt="Straight Face" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4" />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted italic">उपलब्ध नहीं</p>
                          )}
                        </div>

                        {/* Face 2: Left */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <p className="text-xs font-bold text-muted mb-1">फेस: बायाँ (Look Left)</p>
                          {left?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (बायाँ)`, url: left.fileUrl })}
                              className="relative cursor-pointer group rounded-lg overflow-hidden border border-line h-20 bg-surface-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={left.fileUrl} alt="Left Face" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4" />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted italic">उपलब्ध नहीं</p>
                          )}
                        </div>

                        {/* Face 3: Right */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <p className="text-xs font-bold text-muted mb-1">फेस: दायाँ (Look Right)</p>
                          {right?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (दायाँ)`, url: right.fileUrl })}
                              className="relative cursor-pointer group rounded-lg overflow-hidden border border-line h-20 bg-surface-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={right.fileUrl} alt="Right Face" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4" />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted italic">उपलब्ध नहीं</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-surface-2/60 p-3 text-xs text-muted">
                        इस एजेंट ने अभी तक कोई KYC दस्तावेज़ या लाइवलीनेस सबमिट नहीं किया है।
                      </div>
                    )}

                    {member.kycStatus === 'REJECTED' && aadhaar?.reviewNote && (
                      <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-300">
                        <span className="font-bold">अस्वीकृति का कारण: </span> {aadhaar.reviewNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Firm KYC Tab */
        <div className="card max-w-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Building2 className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ब्रोकर फर्म KYC सत्यापन</h3>
              <p className="text-xs text-muted">यह KYC SuperAdmin द्वारा जाँचा और प्रमाणित किया जाता है</p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface-2/40 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted">फर्म का नाम:</span>
              <span className="font-bold text-sm">{user?.organization?.name || 'BrokerIQ Firm'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted">RERA नंबर:</span>
              <span className="font-mono text-sm font-bold">{user?.organization?.reraNumber || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted">सत्यापन स्थिति:</span>
              <Badge tone={user?.organization?.verification === 'VERIFIED' ? 'success' : 'warning'}>
                {user?.organization?.verification === 'VERIFIED' ? 'Verified by SuperAdmin' : 'Under SuperAdmin Review'}
              </Badge>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            यदि आपको फर्म के RERA लाइसेंस या व्यापार दस्तावेज़ों में बदलाव करना है, तो कृपया SuperAdmin सपोर्ट से संपर्क करें।
          </p>
        </div>
      )}

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={(v) => !v && setPreviewPhoto(null)} title={previewPhoto?.title || 'दस्तावेज़'}>
        {previewPhoto && (
          <div className="overflow-hidden rounded-xl bg-black flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewPhoto.url} alt={previewPhoto.title} className="max-h-[70vh] w-auto rounded object-contain" />
          </div>
        )}
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog
        open={!!rejectingMember}
        onOpenChange={(v) => !v && setRejectingMember(null)}
        title={`KYC अस्वीकृत करें: ${rejectingMember?.name}`}
        description="एजेंट को यह कारण दिखेगा ताकि वे सही दस्तावेज़ दोबारा सबमिट कर सकें।"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectingMember(null)}>
              रद्द करें
            </Button>
            <Button
              variant="danger"
              loading={reviewMutation.isPending}
              disabled={!rejectNote.trim()}
              onClick={() =>
                reviewMutation.mutate({
                  agentId: rejectingMember.id,
                  status: 'REJECTED',
                  reviewNote: rejectNote.trim(),
                })
              }
            >
              Reject KYC
            </Button>
          </div>
        }
      >
        <Field label="अस्वीकृति का कारण (Reason for Rejection)" required>
          <Input
            placeholder="उदा. आधार कार्ड की फ़ोटो धुंधली है या नंबर मेल नहीं खाता"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}

/* ========================================================================= */
/* 2. BROKER AGENT: OWN KYC SUBMISSION (LOCKED ON VERIFIED)                  */
/* ========================================================================= */

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

function AgentKycSubmissionView() {
  const kycQuery = useQuery({
    queryKey: ['agent-kyc-mine'],
    queryFn: () => api<MyKycResponse>('/broker/team/agent-kyc/mine'),
  });

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarPhotoUrl, setAadhaarPhotoUrl] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState('');
  const [panPhotoUrl, setPanPhotoUrl] = useState<string | null>(null);
  const aadhaarInputRef = useRef<HTMLInputElement | null>(null);
  const panInputRef = useRef<HTMLInputElement | null>(null);

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

  const kyc = kycQuery.data;
  const isVerified = kyc?.status === 'VERIFIED';
  const isPending = kyc?.status === 'PENDING';
  const isRejected = kyc?.status === 'REJECTED';

  useEffect(() => {
    if (kyc) {
      if (kyc.aadhaarNumber && !aadhaarNumber) setAadhaarNumber(kyc.aadhaarNumber);
      if (kyc.aadhaarPhotoUrl && aadhaarPhotoUrl === null) setAadhaarPhotoUrl(kyc.aadhaarPhotoUrl);
      if (kyc.panNumber && !panNumber) setPanNumber(kyc.panNumber);
      if (kyc.panPhotoUrl && panPhotoUrl === null) setPanPhotoUrl(kyc.panPhotoUrl);
      if (kyc.livelinessStraightUrl) {
        setLiveliness((prev) => ({
          straightUrl: prev.straightUrl || kyc.livelinessStraightUrl,
          leftUrl: prev.leftUrl || kyc.livelinessLeftUrl,
          rightUrl: prev.rightUrl || kyc.livelinessRightUrl,
        }));
      }
    }
  }, [kyc]);

  const submitMutation = useApiMutation(
    (body: any) => post('/broker/team/agent-kyc', body),
    {
      success: 'Agent KYC सफलतापूर्वक सबमिट हो गया है! Admin review करेंगे।',
      invalidate: [['agent-kyc-mine'], ['agent-kyc-mine-status']],
    },
  );

  const handleAadhaarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isVerified) return;
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
    if (isVerified) return;
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
    if (isVerified) return;

    const cleanAadhaar = (aadhaarNumber || kyc?.aadhaarNumber || '').replace(/\D/g, '');
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      toast.error('Aadhaar number invalid है — कृपया ठीक 12 अंकों का आधार नंबर दर्ज करें');
      return;
    }
    const finalAadhaarDoc = aadhaarPhotoUrl !== null ? aadhaarPhotoUrl : (kyc?.aadhaarPhotoUrl || '');
    if (!finalAadhaarDoc) {
      toast.error('Aadhaar card की फ़ोटो/डॉक्यूमेंट अपलोड करना ज़रूरी है');
      return;
    }

    const cleanPan = (panNumber || kyc?.panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      toast.error('PAN card number invalid है — 10 अक्षरों का फॉर्मेट होना चाहिए (उदा: ABCDE1234F)');
      return;
    }
    const finalPanDoc = panPhotoUrl !== null ? panPhotoUrl : (kyc?.panPhotoUrl || '');
    if (!finalPanDoc) {
      toast.error('PAN card की फ़ोटो/डॉक्यूमेंट अपलोड करना ज़रूरी है');
      return;
    }

    const finalStraight = liveliness.straightUrl || kyc?.livelinessStraightUrl;
    const finalLeft = liveliness.leftUrl || kyc?.livelinessLeftUrl;
    const finalRight = liveliness.rightUrl || kyc?.livelinessRightUrl;

    if (!finalStraight || !finalLeft || !finalRight) {
      toast.error('कृपया 3-स्टेप फेस लाइवलीनेस (सामने, बायाँ, दायाँ) पूरा करें');
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

  const currentAadhaar = aadhaarNumber || kyc?.aadhaarNumber || '';
  const currentAadhaarPhoto = aadhaarPhotoUrl !== null ? aadhaarPhotoUrl : (kyc?.aadhaarPhotoUrl || '');
  const currentPan = panNumber || kyc?.panNumber || '';
  const currentPanPhoto = panPhotoUrl !== null ? panPhotoUrl : (kyc?.panPhotoUrl || '');

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Agent KYC"
        subtitle="सुरक्षित ब्रोकर नेटवर्क के लिए आपकी पहचान एवं फेस लाइवलीनेस सत्यापन"
      />

      {/* KYC Status banner */}
      {isVerified ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 text-emerald-800 dark:text-emerald-300">
          <BadgeCheck className="size-8 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-extrabold text-base">KYC Verified & Locked • पहचान प्रमाणित व सुरक्षित</p>
              <Badge tone="success">Verified</Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              आपका KYC एडमिन द्वारा प्रमाणित हो चुका है। सुरक्षा मानकों के कारण अब यह जानकारी बदली नहीं जा सकती।
            </p>
          </div>
          <Lock className="size-5 text-emerald-600 shrink-0" />
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 text-amber-800 dark:text-amber-300">
          <Clock className="size-8 text-amber-600 shrink-0 animate-pulse" />
          <div>
            <p className="font-extrabold text-base">KYC समीक्षाधीन है (Under Review)</p>
            <p className="text-xs text-muted mt-0.5">
              आपके दस्तावेज़ और फेस लाइवलीनेस सबमिट हो चुके हैं। ब्रोकर एडमिन द्वारा जल्द ही इसे जाँचा जाएगा।
            </p>
          </div>
        </div>
      ) : isRejected ? (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-5 text-rose-800 dark:text-rose-300">
          <ShieldAlert className="size-8 text-rose-600 shrink-0" />
          <div className="flex-1">
            <p className="font-extrabold text-base">KYC Rejected • अस्वीकृत</p>
            <p className="text-xs mt-1 font-semibold">
              कारण: {kyc?.reviewNote || 'दस्तावेज़ साफ़ नहीं थे या जानकारी मेल नहीं खाती।'}
            </p>
            <p className="text-xs text-muted mt-0.5">
              कृपया नीचे सही आधार व पैन नंबर दर्ज करें और नए सिरे से सबमिट करें।
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-5 border border-line">
          <Shield className="size-8 text-brand shrink-0" />
          <div>
            <p className="font-bold text-sm">पहचान सत्यापन आवश्यक</p>
            <p className="text-xs text-muted mt-0.5">
              लीड्स और इन्वेंटरी एक्सेस के लिए कृपया नीचे आधार, पैन व कैमरा पाइपलाइन पूरी करें।
            </p>
          </div>
        </div>
      )}

      {/* KYC Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Aadhaar Card */}
        <div className={cn('card p-6 space-y-4', isVerified && 'opacity-90 bg-surface-2/30')}>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-saffron-500" />
              <h3 className="font-bold text-base">1. Aadhaar Card • आधार कार्ड</h3>
            </div>
            {isVerified && <Badge tone="success"><Lock className="size-3 mr-1" /> Locked</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="आधार नंबर (12 Digits)" required hint="केवल 12 अंकों का नंबर">
              <Input
                placeholder="1234 5678 9012"
                value={currentAadhaar}
                disabled={isVerified}
                maxLength={14}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setAadhaarNumber(raw);
                }}
              />
            </Field>

            <Field label="आधार कार्ड फ़ोटो / डॉक्यूमेंट" required hint="JPG, PNG या PDF">
              {currentAadhaarPhoto ? (
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-emerald-600 shrink-0" />
                    <span className="truncate text-xs font-semibold">Aadhaar_Document.jpg</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={currentAadhaarPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> देखें
                    </a>
                    {!isVerified && (
                      <>
                        <button
                          type="button"
                          onClick={() => aadhaarInputRef.current?.click()}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Upload className="size-3" /> फ़ोटो बदलें
                        </button>
                        <button
                          type="button"
                          onClick={() => setAadhaarPhotoUrl('')}
                          className="text-muted hover:text-rose-600"
                          title="हटाएँ"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <label className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-3 text-xs font-semibold transition-colors',
                  isVerified ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-brand-500 hover:bg-surface-2',
                )}>
                  <Upload className="size-4 text-muted" />
                  <span>{uploadingAadhaar ? 'अपलोड हो रहा है...' : 'Aadhaar फ़ोटो चुनें'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={isVerified || uploadingAadhaar}
                    onChange={handleAadhaarUpload}
                  />
                </label>
              )}
              {/* Hidden file input for Replace action */}
              <input
                ref={aadhaarInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={isVerified || uploadingAadhaar}
                onChange={handleAadhaarUpload}
              />
            </Field>
          </div>
        </div>

        {/* Section 2: PAN Card */}
        <div className={cn('card p-6 space-y-4', isVerified && 'opacity-90 bg-surface-2/30')}>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-500" />
              <h3 className="font-bold text-base">2. PAN Card • पैन कार्ड</h3>
            </div>
            {isVerified && <Badge tone="success"><Lock className="size-3 mr-1" /> Locked</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="पैन नंबर (10 Characters)" required hint="फॉर्मेट: ABCDE1234F">
              <Input
                placeholder="ABCDE1234F"
                value={currentPan}
                disabled={isVerified}
                maxLength={10}
                className="uppercase font-mono"
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              />
            </Field>

            <Field label="पैन कार्ड फ़ोटो / डॉक्यूमेंट" required hint="JPG, PNG या PDF">
              {currentPanPhoto ? (
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-emerald-600 shrink-0" />
                    <span className="truncate text-xs font-semibold">PAN_Document.jpg</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={currentPanPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> देखें
                    </a>
                    {!isVerified && (
                      <>
                        <button
                          type="button"
                          onClick={() => panInputRef.current?.click()}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Upload className="size-3" /> फ़ोटो बदलें
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanPhotoUrl('')}
                          className="text-muted hover:text-rose-600"
                          title="हटाएँ"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <label className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-3 text-xs font-semibold transition-colors',
                  isVerified ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-brand-500 hover:bg-surface-2',
                )}>
                  <Upload className="size-4 text-muted" />
                  <span>{uploadingPan ? 'अपलोड हो रहा है...' : 'PAN फ़ोटो चुनें'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={isVerified || uploadingPan}
                    onChange={handlePanUpload}
                  />
                </label>
              )}
              {/* Hidden file input for Replace action */}
              <input
                ref={panInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={isVerified || uploadingPan}
                onChange={handlePanUpload}
              />
            </Field>
          </div>
        </div>

        {/* Section 3: Face Liveliness Camera Pipeline */}
        <div className={cn('card p-6 space-y-4', isVerified && 'opacity-90 bg-surface-2/30')}>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-bold text-base">3. Face Liveliness • 3-स्टेप चेहरा सत्यापन</h3>
              <p className="text-xs text-muted">कैमरे के सामने चेहरा सीधा, बायाँ और दायाँ घुमाकर 3 फ़ोटो लें</p>
            </div>
            {isVerified && <Badge tone="success"><Lock className="size-3 mr-1" /> Locked</Badge>}
          </div>

          <AgentKycPipeline
            initialValues={{
              straightUrl: liveliness.straightUrl || kyc?.livelinessStraightUrl || null,
              leftUrl: liveliness.leftUrl || kyc?.livelinessLeftUrl || null,
              rightUrl: liveliness.rightUrl || kyc?.livelinessRightUrl || null,
            }}
            disabled={isVerified}
            onChange={(val) => setLiveliness(val)}
          />
        </div>

        {/* Submit or Locked state button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isVerified ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-5" /> KYC Verified & Read-Only • बदलाव की अनुमति नहीं है
            </div>
          ) : (
            <Button
              type="submit"
              size="lg"
              loading={submitMutation.isPending}
              className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold px-8 shadow-md shadow-brand-600/25 transition-all"
            >
              <ShieldCheck className="size-5" />
              {isRejected ? 'KYC पुनः सबमिट करें (Resubmit)' : 'KYC सत्यापन के लिए सबमिट करें'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
