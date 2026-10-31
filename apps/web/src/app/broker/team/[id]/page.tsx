'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  Eye,
  MapPin,
  MoreHorizontal,
  Navigation,
  Phone,
  Mail,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserMinus,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';
import { useTeam } from '@/components/broker/bits';
import { useAuth } from '@/lib/auth';
import { patch, useApiMutation } from '@/lib/hooks';
import { useReverseGeocode } from '@/lib/reverse-geocode';
import { cn, formatDate } from '@/lib/utils';
import { timeAgo } from '@brokeriq/shared';

export default function TeamMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const teamQuery = useTeam();

  const isAdmin = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';

  const member = (teamQuery.data?.members || []).find((m: any) => m.id === resolvedParams.id);
  const loc = member?.lastLocation;

  // Reverse geocoded address
  const { location: geoLoc, loading: geoLoading } = useReverseGeocode(loc?.latitude, loc?.longitude);

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'BROKER_ADMIN' | 'BROKER_AGENT'>('BROKER_AGENT');

  // Targets State
  const [monthlyDeals, setMonthlyDeals] = useState<number>(5);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(500000);
  const [monthlyLeads, setMonthlyLeads] = useState<number>(30);
  const [commissionPct, setCommissionPct] = useState<number>(10);

  // KYC Preview / Reject State
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Sync state when member loads
  useEffect(() => {
    if (member) {
      setEditName(member.name || '');
      setEditPhone(member.phone || '');
      setEditRole(member.role === 'BROKER_ADMIN' ? 'BROKER_ADMIN' : 'BROKER_AGENT');

      const tg = member.targets;
      if (tg) {
        setMonthlyDeals(Number(tg.monthlyDeals) || 5);
        setMonthlyRevenue(Number(tg.monthlyRevenue) || 500000);
        setMonthlyLeads(Number(tg.monthlyLeads) || 30);
        setCommissionPct(Number(tg.commissionPct) || 10);
      }
    }
  }, [member?.id, member?.name, member?.phone, member?.role, member?.targets]);

  // Mutations
  const updateProfileMutation = useApiMutation(
    (body: any) => patch(`/broker/team/members/${resolvedParams.id}`, body),
    {
      success: 'एजेंट प्रोफाइल अपडेट हो गई ✅',
      invalidate: [['team']],
    },
  );

  const updateTargetsMutation = useApiMutation(
    (body: any) => patch('/broker/team/targets', body),
    {
      success: 'मासिक लक्ष्य सेव हो गए ✅',
      invalidate: [['team']],
    },
  );

  const reviewKycMutation = useApiMutation(
    (body: { status: 'VERIFIED' | 'REJECTED'; reviewNote?: string }) =>
      patch(`/broker/team/agents/${resolvedParams.id}/kyc`, body),
    {
      success: 'KYC स्टेटस अपडेट हो गया ✅',
      invalidate: [['team'], ['agent-kyc-mine']],
      onSuccess: () => {
        setRejecting(false);
      },
    },
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      name: editName.trim(),
      phone: editPhone.trim() || null,
      role: editRole,
    });
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    updateTargetsMutation.mutate({
      agentId: resolvedParams.id,
      targets: {
        monthlyDeals: Number(monthlyDeals) || 0,
        monthlyRevenue: Number(monthlyRevenue) || 0,
        monthlyLeads: Number(monthlyLeads) || 0,
        commissionPct: Number(commissionPct) || 0,
      },
    });
  };

  if (teamQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="mx-auto max-w-2xl p-12 text-center">
        <UserMinus className="mx-auto size-12 text-muted" />
        <h2 className="mt-4 text-xl font-bold">सदस्य नहीं मिले (Member Not Found)</h2>
        <p className="mt-2 text-sm text-muted">यह सदस्य उपलब्ध नहीं हैं या टीम से हटा दिए गए हैं।</p>
        <Button className="mt-6" onClick={() => router.push('/broker/team')}>
          <ArrowLeft className="size-4 mr-2" /> टीम सूची पर वापस जाएँ
        </Button>
      </div>
    );
  }

  const kycDocs = member.kycDocuments || [];
  const aadhaar = kycDocs.find((d: any) => d.docType === 'AADHAAR');
  const pan = kycDocs.find((d: any) => d.docType === 'PAN');
  const straight = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_STRAIGHT');
  const left = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_LEFT');
  const right = kycDocs.find((d: any) => d.docType === 'OTHER' && d.docNumber === 'LIVELINESS_RIGHT');
  const hasKyc = !!(aadhaar || pan || straight);

  const dealsTarget = Number(member.targets?.monthlyDeals) || 5;
  const dealsWon = member.fulfillment?.dealsWonMonth ?? member.stats?.won30d ?? 0;
  const dealsPct = member.fulfillment?.dealsPercent ?? (dealsTarget > 0 ? Math.min(100, Math.round((dealsWon / dealsTarget) * 100)) : 0);

  const leadsTarget = Number(member.targets?.monthlyLeads) || 30;
  const openLeads = member.fulfillment?.leadsOpen ?? member.stats?.openLeads ?? 0;
  const leadsPct = member.fulfillment?.leadsPercent ?? (leadsTarget > 0 ? Math.min(100, Math.round((openLeads / leadsTarget) * 100)) : 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted">
          <Link href="/broker" className="hover:text-fg transition-colors">
            ब्रोकर वर्कस्पेस
          </Link>
          <span>/</span>
          <Link href="/broker/team" className="hover:text-fg transition-colors">
            टीम व एजेंट्स
          </Link>
          <span>/</span>
          <span className="font-bold text-fg truncate max-w-[200px] sm:max-w-xs">{member.name}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push('/broker/team')}
          className="text-xs"
        >
          <ArrowLeft className="size-3.5 mr-1.5" /> टीम सूची पर लौटें
        </Button>
      </div>

      {/* Hero Member Overview Card */}
      <div className="card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <Avatar name={member.name} src={member.avatarUrl} size={64} className="ring-2 ring-line" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{member.name}</h1>
                <Badge tone={member.role === 'BROKER_ADMIN' ? 'brand' : 'neutral'} className="font-bold">
                  {member.role === 'BROKER_ADMIN' ? <><Crown className="size-3 mr-1" /> Admin</> : 'Agent'}
                </Badge>
                {member.status === 'SUSPENDED' && (
                  <Badge tone="danger" className="font-bold">सस्पेंडेड (Suspended)</Badge>
                )}
                {member.kycStatus === 'VERIFIED' ? (
                  <Badge tone="success" className="font-bold">
                    <ShieldCheck className="size-3.5 mr-1" /> KYC Verified
                  </Badge>
                ) : member.kycStatus === 'PENDING' ? (
                  <Badge tone="warning" className="font-bold animate-pulse">
                    <Clock className="size-3.5 mr-1" /> KYC Pending
                  </Badge>
                ) : (
                  <Badge tone="neutral">KYC Unverified</Badge>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {member.email}
                </span>
                {member.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {member.phone}
                  </span>
                )}
                <span>ज्वाइन किया: {formatDate(member.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Quick Role Actions */}
          {isAdmin && member.id !== user?.id && (
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateProfileMutation.mutate({
                    role: member.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN',
                  })
                }
                loading={updateProfileMutation.isPending}
              >
                <Crown className="size-3.5 mr-1 text-brand" />
                {member.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
              </Button>
              <Button
                size="sm"
                variant={member.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                onClick={() =>
                  updateProfileMutation.mutate({
                    status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                  })
                }
                loading={updateProfileMutation.isPending}
              >
                {member.status === 'ACTIVE' ? 'सस्पेंड करें' : 'सक्रिय करें'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Live Location (Full Width or 2-Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Location & Field Presence (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Live Location */}
          <div className="card p-5 space-y-4 shadow-sm border border-emerald-500/20 bg-emerald-500/[0.02]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                लाइव लोकेशन व फील्ड उपस्थिति (Live GPS Tracker)
              </h3>
              {loc && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  एक्टिव • {timeAgo(loc.capturedAt)}
                </span>
              )}
            </div>

            {loc ? (
              <div className="space-y-4">
                {/* Reverse-geocoded Street Address Banner */}
                <div className="rounded-xl border border-line bg-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-emerald-500" /> वर्तमान वास्तविक पता (Live Street Address)
                    </p>
                    <p className="text-base font-extrabold text-fg">
                      {geoLoading ? 'पता लोड हो रहा है...' : geoLoc?.shortAddress || 'Gurugram, Haryana'}
                    </p>
                    <p className="text-xs text-muted max-w-xl">
                      {geoLoading ? '...' : geoLoc?.fullAddress}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors"
                  >
                    <Navigation className="size-3.5" />
                    Google Maps पर खोलें ↗
                  </a>
                </div>

                {/* Technical Coordinates Dock */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <span className="text-muted block text-[11px]">अक्षांश (Latitude)</span>
                    <span className="font-mono font-bold">{loc.latitude.toFixed(6)}°N</span>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <span className="text-muted block text-[11px]">देशांतर (Longitude)</span>
                    <span className="font-mono font-bold">{loc.longitude.toFixed(6)}°E</span>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <span className="text-muted block text-[11px]">शुद्धता (Accuracy)</span>
                    <span className="font-bold">±{Math.round(loc.accuracy || 25)}m</span>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2.5">
                    <span className="text-muted block text-[11px]">स्रोत (Source)</span>
                    <span className="font-bold">{loc.source || 'WEB_BROWSER'}</span>
                  </div>
                </div>

                {/* Interactive Map Embed */}
                <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-line shadow-inner">
                  <iframe
                    title="Live Location Map"
                    width="100%"
                    height="100%"
                    className="border-0"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.longitude - 0.005}%2C${loc.latitude - 0.004}%2C${loc.longitude + 0.005}%2C${loc.latitude + 0.004}&layer=mapnik&marker=${loc.latitude}%2C${loc.longitude}`}
                  />
                  <div className="absolute bottom-2 right-2 rounded-lg bg-black/75 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white border border-white/10">
                    OpenStreetMap Live View
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-8 text-center bg-surface">
                <MapPin className="mx-auto size-8 text-muted opacity-40 mb-2" />
                <p className="text-sm font-semibold">लोकेशन उपलब्ध नहीं है (Location Offline)</p>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  एजेंट ने अभी तक लोकेशन अनुमति नहीं दी है या ऐप/वेब बंद है। एजेंट के लॉग इन करने पर लोकेशन यहाँ स्वतः अपडेट होगी।
                </p>
              </div>
            )}
          </div>

          {/* Card: KYC Documents & 3-Step Face Liveliness */}
          <div className="card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="size-5 text-brand" />
                KYC दस्तावेज़ व 3-स्टेप फेस लाइवलीनेस सत्यापन
              </h3>
              {member.kycStatus === 'VERIFIED' ? (
                <Badge tone="success" className="font-bold">प्रमाणित (Verified)</Badge>
              ) : member.kycStatus === 'PENDING' ? (
                <Badge tone="warning" className="font-bold animate-pulse">समीक्षा लंबित (Pending)</Badge>
              ) : (
                <Badge tone="neutral">अपलोड नहीं हुआ</Badge>
              )}
            </div>

            {hasKyc ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aadhaar Card */}
                  <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-muted mb-2">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="size-4 text-saffron-500" /> आधार कार्ड
                        </span>
                        <Badge tone={aadhaar?.status === 'VERIFIED' ? 'success' : 'neutral'}>
                          {aadhaar?.status || 'PENDING'}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm font-extrabold tracking-wider">
                        {aadhaar?.docNumber ? aadhaar.docNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : 'नंबर दर्ज नहीं'}
                      </p>
                    </div>
                    {aadhaar?.fileUrl ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewPhoto({ title: `${member.name} - आधार कार्ड`, url: aadhaar.fileUrl })}
                        className="mt-4 w-full"
                      >
                        <Eye className="size-3.5 mr-1.5" /> आधार फ़ोटो देखें
                      </Button>
                    ) : (
                      <p className="mt-4 text-xs text-muted italic">फ़ोटो अपलोड नहीं</p>
                    )}
                  </div>

                  {/* PAN Card */}
                  <div className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-muted mb-2">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="size-4 text-blue-500" /> पैन कार्ड
                        </span>
                        <Badge tone={pan?.status === 'VERIFIED' ? 'success' : 'neutral'}>
                          {pan?.status || 'PENDING'}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm font-extrabold tracking-wider">
                        {pan?.docNumber || 'नंबर दर्ज नहीं'}
                      </p>
                    </div>
                    {pan?.fileUrl ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewPhoto({ title: `${member.name} - पैन कार्ड`, url: pan.fileUrl })}
                        className="mt-4 w-full"
                      >
                        <Eye className="size-3.5 mr-1.5" /> पैन फ़ोटो देखें
                      </Button>
                    ) : (
                      <p className="mt-4 text-xs text-muted italic">फ़ोटो अपलोड नहीं</p>
                    )}
                  </div>
                </div>

                {/* 3 Face Liveliness photos */}
                <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                  <p className="text-xs font-bold text-muted">फेस लाइवलीनेस फ़ोटो (3 कोणों से सत्यापित)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Straight */}
                    <div
                      onClick={() => straight?.fileUrl && setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (सामने)`, url: straight.fileUrl })}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-line bg-surface-2 cursor-pointer"
                    >
                      {straight?.fileUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={straight.fileUrl} alt="Straight Face" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <Eye className="size-4" />
                          </div>
                          <div className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Straight
                          </div>
                        </>
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted">अनुपलब्ध</div>
                      )}
                    </div>

                    {/* Left */}
                    <div
                      onClick={() => left?.fileUrl && setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (बायाँ)`, url: left.fileUrl })}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-line bg-surface-2 cursor-pointer"
                    >
                      {left?.fileUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={left.fileUrl} alt="Left Face" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <Eye className="size-4" />
                          </div>
                          <div className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Left
                          </div>
                        </>
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted">अनुपलब्ध</div>
                      )}
                    </div>

                    {/* Right */}
                    <div
                      onClick={() => right?.fileUrl && setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (दायाँ)`, url: right.fileUrl })}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-line bg-surface-2 cursor-pointer"
                    >
                      {right?.fileUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={right.fileUrl} alt="Right Face" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <Eye className="size-4" />
                          </div>
                          <div className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Right
                          </div>
                        </>
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted">अनुपलब्ध</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Approval Actions */}
                {isAdmin && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {member.kycStatus !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        loading={reviewKycMutation.isPending}
                        onClick={() => reviewKycMutation.mutate({ status: 'VERIFIED' })}
                      >
                        <CheckCircle2 className="size-4 mr-1.5" /> Approve KYC
                      </Button>
                    )}
                    {member.kycStatus !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejecting(true);
                          setRejectNote('');
                        }}
                      >
                        <XCircle className="size-4 mr-1.5" /> Reject KYC
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted italic">इस सदस्य ने अभी कोई KYC दस्तावेज़ जमा नहीं किया है।</p>
            )}
          </div>
        </div>

        {/* Right Column: Targets & Profile Edit Form */}
        <div className="space-y-6">
          {/* Card: Monthly Targets & Fulfillment */}
          <div className="card p-5 space-y-4 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Target className="size-5 text-brand" />
              मासिक लक्ष्य व पूर्ति (Targets & Fulfillment)
            </h3>

            {/* Performance Progress */}
            <div className="space-y-3 rounded-xl border border-line bg-surface p-4 text-xs">
              <div>
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span className="text-muted">डील्स पूर्ति (Deals Won):</span>
                  <span className="font-bold">{dealsWon} / {dealsTarget} ({dealsPct}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      dealsPct >= 100 ? 'bg-emerald-500' : dealsPct >= 50 ? 'bg-amber-500' : 'bg-brand-600',
                    )}
                    style={{ width: `${dealsPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span className="text-muted">ओपन लीड्स (Leads Handled):</span>
                  <span className="font-bold">{openLeads} / {leadsTarget} ({leadsPct}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      leadsPct >= 100 ? 'bg-emerald-500' : leadsPct >= 50 ? 'bg-amber-500' : 'bg-blue-600',
                    )}
                    style={{ width: `${leadsPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Target Edit Form */}
            <form onSubmit={handleSaveTargets} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">डील्स टारगेट (Deals)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyDeals}
                    onChange={(e) => setMonthlyDeals(Number(e.target.value))}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">लीड्स टारगेट (Leads)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyLeads}
                    onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">रेवेन्यू टारगेट (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">कमीशन (% Share)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(Number(e.target.value))}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              {isAdmin && (
                <Button
                  type="submit"
                  size="sm"
                  className="w-full mt-2 font-bold"
                  loading={updateTargetsMutation.isPending}
                >
                  <Save className="size-3.5 mr-1.5" /> लक्ष्य सेव करें (Save Targets)
                </Button>
              )}
            </form>
          </div>

          {/* Card: Agent Profile Edit */}
          {isAdmin && (
            <div className="card p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-base flex items-center gap-2">
                <User className="size-5 text-brand" />
                एजेंट प्रोफाइल जानकारी (Edit Profile)
              </h3>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">पूरा नाम (Full Name)</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">फ़ोन नंबर (Phone)</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="10 अंकों का मोबाइल नंबर"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">भूमिका (Role)</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  >
                    <option value="BROKER_AGENT">Agent (ब्रोकर एजेंट)</option>
                    <option value="BROKER_ADMIN">Admin (ब्रोकर एडमिन)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full mt-2 font-bold"
                  loading={updateProfileMutation.isPending}
                >
                  <Save className="size-3.5 mr-1.5" /> प्रोफाइल अपडेट करें
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={(v) => !v && setPreviewPhoto(null)} title={previewPhoto?.title || 'दस्तावेज़'}>
        {previewPhoto && (
          <div className="overflow-hidden rounded-xl bg-black flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewPhoto.url} alt={previewPhoto.title} className="max-h-[70vh] w-auto rounded object-contain" />
          </div>
        )}
      </Dialog>

      {/* Reject KYC Dialog */}
      <Dialog open={rejecting} onOpenChange={setRejecting} title={`KYC अस्वीकृत करें: ${member.name}`}>
        <div className="space-y-4">
          <p className="text-xs text-muted">
            कृपया अस्वीकृति का कारण लिखें। यह कारण एजेंट को उनकी स्क्रीन पर दिखाई देगा ताकि वे सुधार कर सकें।
          </p>
          <textarea
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="उदा. आधार कार्ड की फ़ोटो स्पष्ट नहीं है, कृपया साफ़ फ़ोटो अपलोड करें..."
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              रद्द करें
            </Button>
            <Button
              variant="danger"
              loading={reviewKycMutation.isPending}
              onClick={() => reviewKycMutation.mutate({ status: 'REJECTED', reviewNote: rejectNote.trim() })}
            >
              <XCircle className="size-4 mr-1.5" /> रिजेक्ट कन्फर्म करें
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
