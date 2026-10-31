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
  FileCheck,
  FileText,
  Filter,
  Lock,
  MapPin,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
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
import { Field, Input, Select } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { AgentKycPipeline } from '@/components/broker/agent-kyc-pipeline';
import { DateRangeFilter, type DateRangeValue, isDateInRange } from '@/components/broker/date-range-filter';
import { ExportToolbar } from '@/components/broker/export-toolbar';
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
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_SUBMITTED'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BROKER_AGENT' | 'BROKER_ADMIN'>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: 'ALL' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'PENDING_FIRST' | 'RECENT' | 'NAME_ASC'>('PENDING_FIRST');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    queryKey: ['broker-firm-kyc'],
    queryFn: () => api<any>('/broker/firm-kyc'),
  });

  const members = teamQuery.data?.members ?? [];

  // Filter & Sort members
  const filteredMembers = members
    .filter((m: any) => {
      const hasSubmission = (m.kycDocuments || []).length > 0;
      // Status filter
      if (filter === 'PENDING' && m.kycStatus !== 'PENDING') return false;
      if (filter === 'VERIFIED' && m.kycStatus !== 'VERIFIED') return false;
      if (filter === 'REJECTED' && m.kycStatus !== 'REJECTED') return false;
      if (filter === 'NOT_SUBMITTED' && (m.kycStatus === 'VERIFIED' || m.kycStatus === 'PENDING' || hasSubmission)) return false;

      // Role filter
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;

      // Agent dropdown filter
      if (agentFilter !== 'ALL' && m.id !== agentFilter) return false;

      // Search query (name, email, phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = m.name?.toLowerCase().includes(q);
        const emailMatch = m.email?.toLowerCase().includes(q);
        const phoneMatch = m.phone?.includes(q);
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }

      // Date Range filter (evaluating KYC document or member creation date in IST)
      if (dateRange.preset !== 'ALL') {
        const kycDate = m.kycDocuments?.[0]?.createdAt || m.createdAt;
        if (!isDateInRange(kycDate, dateRange)) return false;
      }

      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'PENDING_FIRST') {
        if (a.kycStatus === 'PENDING' && b.kycStatus !== 'PENDING') return -1;
        if (b.kycStatus === 'PENDING' && a.kycStatus !== 'PENDING') return 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'RECENT') {
        const aDate = a.kycDocuments?.[0]?.createdAt ? new Date(a.kycDocuments[0].createdAt).getTime() : 0;
        const bDate = b.kycDocuments?.[0]?.createdAt ? new Date(b.kycDocuments[0].createdAt).getTime() : 0;
        return bDate - aDate;
      }
      return 0;
    });

  // Row selection helpers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredMembers.length > 0 && selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m: any) => m.id)));
    }
  };

  // Map selected team member IDs to their submitted KYC document IDs for /admin/kyc/export
  const selectedDocIds = members
    .filter((m: any) => selectedIds.has(m.id))
    .flatMap((m: any) => (m.kycDocuments || []).map((d: any) => d.id))
    .filter(Boolean);

  const pendingCount = members.filter((m: any) => m.kycStatus === 'PENDING').length;
  const verifiedCount = members.filter((m: any) => m.kycStatus === 'VERIFIED').length;
  const rejectedCount = members.filter((m: any) => m.kycStatus === 'REJECTED').length;
  const notSubmittedCount = members.filter((m: any) => m.kycStatus !== 'VERIFIED' && m.kycStatus !== 'PENDING' && (m.kycDocuments || []).length === 0).length;

  const firmVerification = firmKycQuery.data?.organization?.verification || user?.organization?.verification;
  const isFirmVerified = firmVerification === 'VERIFIED';
  const hasActiveFilters =
    filter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    agentFilter !== 'ALL' ||
    searchQuery.trim().length > 0 ||
    dateRange.preset !== 'ALL' ||
    sortBy !== 'PENDING_FIRST' ||
    selectedIds.size > 0;

  const handleResetFilters = () => {
    setFilter('ALL');
    setRoleFilter('ALL');
    setAgentFilter('ALL');
    setSearchQuery('');
    setDateRange({ preset: 'ALL' });
    setSortBy('PENDING_FIRST');
    setSelectedIds(new Set());
  };

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
              <Building2 className="size-4" /> Firm KYC {isFirmVerified ? '✅' : '(सत्यापन)'}
            </Button>
          </div>
        }
      />

      {activeTab === 'team' ? (
        <div className="space-y-4">
          {/* Status KPI summary */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div
              onClick={() => setFilter('ALL')}
              className={cn(
                'card cursor-pointer p-3.5 transition-all',
                filter === 'ALL' ? 'border-brand ring-2 ring-brand/20 bg-brand/5' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-muted">कुल टीम मेंबर्स</p>
              <p className="mt-0.5 text-xl font-black">{members.length}</p>
            </div>
            <div
              onClick={() => setFilter('PENDING')}
              className={cn(
                'card cursor-pointer p-3.5 transition-all',
                filter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10' : 'hover:bg-surface-2/40',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">लंबित (Pending)</p>
                {pendingCount > 0 && <span className="size-2 rounded-full bg-amber-500 animate-ping" />}
              </div>
              <p className="mt-0.5 text-xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
            </div>
            <div
              onClick={() => setFilter('VERIFIED')}
              className={cn(
                'card cursor-pointer p-3.5 transition-all',
                filter === 'VERIFIED' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">प्रमाणित (Verified)</p>
              <p className="mt-0.5 text-xl font-black text-emerald-600 dark:text-emerald-400">{verifiedCount}</p>
            </div>
            <div
              onClick={() => setFilter('REJECTED')}
              className={cn(
                'card cursor-pointer p-3.5 transition-all',
                filter === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">अस्वीकृत (Rejected)</p>
              <p className="mt-0.5 text-xl font-black text-rose-600 dark:text-rose-400">{rejectedCount}</p>
            </div>
            <div
              onClick={() => setFilter('NOT_SUBMITTED')}
              className={cn(
                'card cursor-pointer p-3.5 transition-all',
                filter === 'NOT_SUBMITTED' ? 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-500/10' : 'hover:bg-surface-2/40',
              )}
            >
              <p className="text-xs font-semibold text-muted">जमा नहीं (Not Submitted)</p>
              <p className="mt-0.5 text-xl font-black text-subtle">{notSubmittedCount}</p>
            </div>
          </div>

          {/* KYC Smart Filters Toolbar */}
          <div className="card p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                {/* Search bar */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="खोजें — नाम, फ़ोन या ईमेल..."
                    className="pl-9 pr-7 h-9 text-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Status filter dropdown */}
                <div className="w-36">
                  <Select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="ALL">सभी स्टेटस (All)</option>
                    <option value="PENDING">लंबित (Pending)</option>
                    <option value="VERIFIED">प्रमाणित (Verified)</option>
                    <option value="REJECTED">अस्वीकृत (Rejected)</option>
                    <option value="NOT_SUBMITTED">जमा नहीं (Not Submitted)</option>
                  </Select>
                </div>

                {/* Role filter */}
                <div className="w-36">
                  <Select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="ALL">सभी रोल्स (All Roles)</option>
                    <option value="BROKER_AGENT">केवल एजेंट्स (Agents)</option>
                    <option value="BROKER_ADMIN">केवल एडमिन्स (Admins)</option>
                  </Select>
                </div>

                {/* Agent dropdown filter */}
                <div className="w-44">
                  <Select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="ALL">सभी एजेंट्स (All Agents)</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Date Range filter */}
                <DateRangeFilter value={dateRange} onChange={setDateRange} size="sm" />

                {/* Sort by */}
                <div className="w-36">
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-9 text-xs"
                  >
                    <option value="PENDING_FIRST">समीक्षा लंबित पहले</option>
                    <option value="RECENT">हालिया सबमिशन पहले</option>
                    <option value="NAME_ASC">नाम (A से Z)</option>
                  </Select>
                </div>

                {/* Reset filter */}
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="h-9 text-xs text-muted hover:text-fg"
                  >
                    <RotateCcw className="size-3.5 mr-1" /> रीसेट (Clear)
                  </Button>
                )}
              </div>
            </div>

            {/* Selection and Export Sub-Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-fg">
                  <input
                    type="checkbox"
                    checked={filteredMembers.length > 0 && selectedIds.size === filteredMembers.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredMembers.length;
                    }}
                    onChange={handleSelectAll}
                    className="size-4 rounded border-line accent-brand-600 cursor-pointer"
                  />
                  <span>सब चुनें (Select All)</span>
                </label>

                {selectedIds.size > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                    <span>{selectedIds.size} चयनित (Selected)</span>
                    {selectedDocIds.length === 0 ? (
                      <span className="font-normal text-amber-600 dark:text-amber-400 text-[11px] ml-1">
                        (0 दस्तावेज़ / No Docs)
                      </span>
                    ) : selectedDocIds.length !== selectedIds.size ? (
                      <span className="font-normal text-muted text-[11px] ml-1">
                        ({selectedDocIds.length} दस्तावेज़)
                      </span>
                    ) : null}
                  </span>
                )}

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-muted hover:text-fg underline"
                  >
                    चयन हटाएं
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-muted">
                  दिखे <span className="font-bold text-fg">{filteredMembers.length}</span> / {members.length} मेंबर्स
                </span>

                <ExportToolbar
                  endpoint="/admin/kyc/export"
                  baseFilename="kyc-verification-report"
                  selectedIds={selectedIds.size > 0 ? (selectedDocIds.length > 0 ? selectedDocIds : ['__NONE__']) : undefined}
                  disabled={selectedIds.size > 0 && selectedDocIds.length === 0}
                  totalCount={members.length}
                  filteredCount={filteredMembers.length}
                  filters={{
                    status: filter !== 'ALL' ? filter : undefined,
                    role: roleFilter !== 'ALL' ? roleFilter : undefined,
                    agentId: agentFilter !== 'ALL' ? agentFilter : undefined,
                    search: searchQuery.trim() || undefined,
                    datePreset: dateRange.preset !== 'ALL' ? dateRange.preset.toLowerCase() : undefined,
                    from: dateRange.preset === 'CUSTOM' ? dateRange.from : undefined,
                    to: dateRange.preset === 'CUSTOM' ? dateRange.to : undefined,
                  }}
                />
              </div>
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
                      selectedIds.has(member.id) && 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-500/5',
                      member.kycStatus === 'PENDING' && !selectedIds.has(member.id) && 'border-amber-300 dark:border-amber-500/40 bg-amber-500/5',
                      member.kycStatus === 'VERIFIED' && !selectedIds.has(member.id) && 'border-emerald-200 dark:border-emerald-500/20',
                    )}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      {/* Member Info */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={() => handleToggleSelect(member.id)}
                          className="mt-1 size-4 rounded border-line accent-brand-600 cursor-pointer shrink-0"
                          aria-label={`Select ${member.name}`}
                        />
                        <Avatar name={member.name} src={member.avatarUrl} size={48} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-base">{member.name}</p>
                            <Badge tone={member.role === 'BROKER_ADMIN' ? 'brand' : 'neutral'}>
                              {member.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
                            </Badge>
                            {member.lastLocation && (
                              <a
                                href={`https://www.google.com/maps?q=${member.lastLocation.latitude},${member.lastLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full hover:underline"
                                title={`${member.lastLocation.latitude.toFixed(4)}, ${member.lastLocation.longitude.toFixed(4)}`}
                              >
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <MapPin className="size-3" />
                                लाइव लोकेशन
                              </a>
                            )}
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

                          {/* Embedded Photo Thumbnail */}
                          {aadhaar?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - आधार कार्ड`, url: aadhaar.fileUrl })}
                              className="my-2 relative aspect-[4/3] rounded-lg overflow-hidden border border-line bg-slate-950 flex items-center justify-center cursor-pointer group hover:border-brand transition-all"
                            >
                              <img
                                src={aadhaar.fileUrl}
                                alt="Aadhaar Document"
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-bold gap-1">
                                <Eye className="size-3" /> फ़ोटो देखें
                              </div>
                            </div>
                          ) : (
                            <div className="my-2 aspect-[4/3] rounded-lg border border-dashed border-line bg-surface-2/40 flex flex-col items-center justify-center p-2 text-center text-muted">
                              <FileText className="size-5 opacity-40 mb-1" />
                              <span className="text-[10px]">दस्तावेज़ फ़ोटो नहीं</span>
                            </div>
                          )}

                          {aadhaar?.fileUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ title: `${member.name} - आधार कार्ड`, url: aadhaar.fileUrl })}
                              className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1.5 text-xs font-semibold hover:border-brand transition-colors"
                            >
                              <Eye className="size-3.5" /> फ़ोटो देखें
                            </button>
                          ) : (
                            <p className="mt-1 text-[11px] text-muted italic text-center">फ़ोटो अपलोड नहीं</p>
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

                          {/* Embedded Photo Thumbnail */}
                          {pan?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - पैन कार्ड`, url: pan.fileUrl })}
                              className="my-2 relative aspect-[4/3] rounded-lg overflow-hidden border border-line bg-slate-950 flex items-center justify-center cursor-pointer group hover:border-brand transition-all"
                            >
                              <img
                                src={pan.fileUrl}
                                alt="PAN Document"
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-bold gap-1">
                                <Eye className="size-3" /> फ़ोटो देखें
                              </div>
                            </div>
                          ) : (
                            <div className="my-2 aspect-[4/3] rounded-lg border border-dashed border-line bg-surface-2/40 flex flex-col items-center justify-center p-2 text-center text-muted">
                              <FileText className="size-5 opacity-40 mb-1" />
                              <span className="text-[10px]">दस्तावेज़ फ़ोटो नहीं</span>
                            </div>
                          )}

                          {pan?.fileUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({ title: `${member.name} - पैन कार्ड`, url: pan.fileUrl })}
                              className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1.5 text-xs font-semibold hover:border-brand transition-colors"
                            >
                              <Eye className="size-3.5" /> फ़ोटो देखें
                            </button>
                          ) : (
                            <p className="mt-1 text-[11px] text-muted italic text-center">फ़ोटो अपलोड नहीं</p>
                          )}
                        </div>

                        {/* Face 1: Straight */}
                        <div className="rounded-xl border border-line bg-surface p-3 flex flex-col justify-between">
                          <p className="text-xs font-bold text-muted mb-1">फेस: सीधा (Straight)</p>
                          {straight?.fileUrl ? (
                            <div
                              onClick={() => setPreviewPhoto({ title: `${member.name} - फेस लाइवलीनेस (सामने)`, url: straight.fileUrl })}
                              className="relative cursor-pointer group rounded-xl overflow-hidden border border-line aspect-[4/5] bg-slate-950 flex items-center justify-center"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={straight.fileUrl} alt="Straight Face" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4 mr-1" /> बड़ा देखें
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
                              className="relative cursor-pointer group rounded-xl overflow-hidden border border-line aspect-[4/5] bg-slate-950 flex items-center justify-center"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={left.fileUrl} alt="Left Face" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4 mr-1" /> बड़ा देखें
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
                              className="relative cursor-pointer group rounded-xl overflow-hidden border border-line aspect-[4/5] bg-slate-950 flex items-center justify-center"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={right.fileUrl} alt="Right Face" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="size-4 mr-1" /> बड़ा देखें
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
        <FirmKycManagementView user={user} canEdit={true} />
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
/* 2. BROKER FIRM KYC MANAGEMENT (SUPERADMIN REVIEW & AGENT VERIFICATION)  */
/* ========================================================================= */

function FirmKycManagementView({ user, canEdit = true }: { user: any; canEdit?: boolean }) {
  const firmKycQuery = useQuery({
    queryKey: ['broker-firm-kyc'],
    queryFn: () => api<any>('/broker/firm-kyc'),
  });

  const [reraNumber, setReraNumber] = useState('');
  const [reraDocUrl, setReraDocUrl] = useState<string | null>(null);
  const [gstNumber, setGstNumber] = useState('');
  const [gstDocUrl, setGstDocUrl] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState('');
  const [panDocUrl, setPanDocUrl] = useState<string | null>(null);

  const [uploadingRera, setUploadingRera] = useState(false);
  const [uploadingGst, setUploadingGst] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  const reraInputRef = useRef<HTMLInputElement | null>(null);
  const gstInputRef = useRef<HTMLInputElement | null>(null);
  const panInputRef = useRef<HTMLInputElement | null>(null);

  const firmData = firmKycQuery.data;
  const org = firmData?.organization;
  const isVerified = org?.verification === 'VERIFIED';
  const isPending = org?.verification === 'PENDING';
  const isRejected = org?.verification === 'REJECTED';

  useEffect(() => {
    if (firmData) {
      if (firmData.organization?.reraNumber && !reraNumber) setReraNumber(firmData.organization.reraNumber);
      if (firmData.organization?.gstNumber && !gstNumber) setGstNumber(firmData.organization.gstNumber);
      if (firmData.reraDocument?.fileUrl && reraDocUrl === null) setReraDocUrl(firmData.reraDocument.fileUrl);
      if (firmData.gstDocument?.fileUrl && gstDocUrl === null) setGstDocUrl(firmData.gstDocument.fileUrl);
      if (firmData.panDocument?.docNumber && !panNumber) setPanNumber(firmData.panDocument.docNumber);
      if (firmData.panDocument?.fileUrl && panDocUrl === null) setPanDocUrl(firmData.panDocument.fileUrl);
    }
  }, [firmData]);

  const submitMutation = useApiMutation(
    (body: any) => post('/broker/firm-kyc', body),
    {
      success: 'फर्म KYC दस्तावेज़ सफलतापूर्वक सबमिट हो गए! सुपरएडमिन जल्द इसे सत्यापित करेगा।',
      invalidate: [['broker-firm-kyc']],
    },
  );

  const handleUpload = async (file: File, type: 'RERA' | 'GST' | 'PAN') => {
    try {
      if (type === 'RERA') setUploadingRera(true);
      if (type === 'GST') setUploadingGst(true);
      if (type === 'PAN') setUploadingPan(true);

      const res = await uploadFile(file, 'kyc');
      if (type === 'RERA') setReraDocUrl(res.url);
      if (type === 'GST') setGstDocUrl(res.url);
      if (type === 'PAN') setPanDocUrl(res.url);
      toast.success(`${type} दस्तावेज़ सफलतापूर्वक अपलोड हुआ ✅`);
    } catch (err: any) {
      toast.error(err?.message || 'दस्तावेज़ अपलोड करने में त्रुटि हुई');
    } finally {
      if (type === 'RERA') setUploadingRera(false);
      if (type === 'GST') setUploadingGst(false);
      if (type === 'PAN') setUploadingPan(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isVerified) return;

    if (!reraNumber.trim() && !reraDocUrl && !gstNumber.trim() && !gstDocUrl && !panNumber.trim() && !panDocUrl) {
      toast.error('कृपया कम से कम RERA, GST या PAN दस्तावेज़ विवरण भरें');
      return;
    }

    submitMutation.mutate({
      reraNumber: reraNumber.trim() || null,
      reraCertificateUrl: reraDocUrl,
      gstNumber: gstNumber.trim() || null,
      gstCertificateUrl: gstDocUrl,
      panNumber: panNumber.trim().toUpperCase() || null,
      panPhotoUrl: panDocUrl,
    });
  };

  const editable = canEdit && !isVerified;

  if (firmKycQuery.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Firm Header Card */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">{org?.name || user?.organization?.name || 'BrokerIQ Firm'}</h3>
                {isVerified ? (
                  <Badge tone="success">
                    <ShieldCheck className="size-3 mr-1 text-emerald-500" />
                    Verified by SuperAdmin
                  </Badge>
                ) : isPending ? (
                  <Badge tone="warning">
                    <Clock className="size-3 mr-1" />
                    Under SuperAdmin Review
                  </Badge>
                ) : isRejected ? (
                  <Badge tone="danger">
                    <ShieldAlert className="size-3 mr-1" />
                    Rejected by SuperAdmin
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    <Shield className="size-3 mr-1" />
                    KYC Required
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {canEdit
                  ? 'अपनी ब्रोकर फर्म के आधिकारिक रजिस्ट्रेशन, RERA और GST दस्तावेज़ सबमिट करें।'
                  : 'आपकी फर्म के सुपरएडमिन द्वारा सत्यापित आधिकारिक RERA और GST क्रेडेंशियल्स।'}
              </p>
            </div>
          </div>

          {isVerified && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <Lock className="size-3.5" /> सत्यापित फर्म (Locked)
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {isVerified && (
          <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-bold">ब्रोकर फर्म पूरी तरह सत्यापित है</p>
              <p className="mt-0.5 text-muted">आपकी फर्म के सभी व्यावसायिक दस्तावेज व RERA लाइसेंस सुपरएडमिन द्वारा जांचे और प्रमाणित किए जा चुके हैं।</p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2.5">
            <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold">सुपरएडमिन समीक्षा लंबित है (Review in Progress)</p>
              <p className="mt-0.5">आपके द्वारा सबमिट किए गए फर्म दस्तावेज़ सुपरएडमिन की वेरिफिकेशन कतार में हैं।</p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 dark:text-rose-200">
              <p className="font-bold">सुपरएडमिन द्वारा अस्वीकृत (Action Required)</p>
              <p className="mt-0.5">
                {firmData?.reraDocument?.reviewNote || firmData?.gstDocument?.reviewNote || 'दस्तावेज़ स्पष्ट नहीं हैं या RERA नंबर मेल नहीं खाता। कृपया सही दस्तावेज़ दोबारा अपलोड करें।'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form or Display View */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* 1. RERA License Card */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <FileCheck className="size-4 text-brand-600" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted">1. RERA रजिस्ट्रेशन व सर्टिफिकेट</h4>
            </div>
            {firmData?.reraDocument?.status === 'VERIFIED' && (
              <Badge tone="success">Verified RERA</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="RERA रजिस्ट्रेशन नंबर (RERA Number)">
              <Input
                value={reraNumber}
                onChange={(e) => setReraNumber(e.target.value)}
                placeholder="उदा: HRERA-GGM-2024-XXXX"
                disabled={!editable}
                className="font-mono text-xs h-9"
              />
            </Field>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                RERA सर्टिफिकेट दस्तावेज़ (PDF / Image)
              </label>
              <input
                type="file"
                ref={reraInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'RERA');
                }}
              />

              {reraDocUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-line bg-surface-2/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-brand shrink-0" />
                    <span className="truncate font-medium">RERA_Certificate_Doc</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewDoc({ title: 'RERA Certificate', url: reraDocUrl })}
                      className="h-7 text-xs px-2"
                    >
                      <Eye className="size-3.5 mr-1" /> देखें
                    </Button>
                    {editable && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setReraDocUrl(null)}
                        className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploadingRera}
                    onClick={() => reraInputRef.current?.click()}
                    className="w-full text-xs h-9 justify-center"
                  >
                    <Upload className="size-3.5 mr-1.5" /> RERA सर्टिफिकेट अपलोड करें
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* 2. GST & Trade License Card */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-blue-500" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted">2. GSTIN / ट्रेड लाइसेंस</h4>
            </div>
            {firmData?.gstDocument?.status === 'VERIFIED' && (
              <Badge tone="success">Verified GST</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="GSTIN / ट्रेड लाइसेंस नंबर">
              <Input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="उदा: 07AAAAA0000A1Z5"
                disabled={!editable}
                className="font-mono uppercase text-xs h-9"
              />
            </Field>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                GST / ट्रेड सर्टिफिकेट (PDF / Image)
              </label>
              <input
                type="file"
                ref={gstInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'GST');
                }}
              />

              {gstDocUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-line bg-surface-2/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-blue-500 shrink-0" />
                    <span className="truncate font-medium">GST_Certificate_Doc</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewDoc({ title: 'GST Certificate', url: gstDocUrl })}
                      className="h-7 text-xs px-2"
                    >
                      <Eye className="size-3.5 mr-1" /> देखें
                    </Button>
                    {editable && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setGstDocUrl(null)}
                        className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploadingGst}
                    onClick={() => gstInputRef.current?.click()}
                    className="w-full text-xs h-9 justify-center"
                  >
                    <Upload className="size-3.5 mr-1.5" /> GST सर्टिफिकेट अपलोड करें
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* 3. Company PAN Card */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-amber-500" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted">3. फर्म पैन कार्ड (Company PAN)</h4>
            </div>
            {firmData?.panDocument?.status === 'VERIFIED' && (
              <Badge tone="success">Verified PAN</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="कंपनी पैन नंबर (PAN Number)">
              <Input
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="उदा: ABCDE1234F"
                disabled={!editable}
                className="font-mono uppercase text-xs h-9"
              />
            </Field>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                कंपनी पैन कार्ड फ़ोटो (PDF / Image)
              </label>
              <input
                type="file"
                ref={panInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'PAN');
                }}
              />

              {panDocUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-line bg-surface-2/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-amber-500 shrink-0" />
                    <span className="truncate font-medium">Company_PAN_Doc</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewDoc({ title: 'Company PAN', url: panDocUrl })}
                      className="h-7 text-xs px-2"
                    >
                      <Eye className="size-3.5 mr-1" /> देखें
                    </Button>
                    {editable && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPanDocUrl(null)}
                        className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploadingPan}
                    onClick={() => panInputRef.current?.click()}
                    className="w-full text-xs h-9 justify-center"
                  >
                    <Upload className="size-3.5 mr-1.5" /> पैन कार्ड अपलोड करें
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Submit Action for Admin */}
        {editable && (
          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              loading={submitMutation.isPending}
              className="px-5 h-9 text-xs"
            >
              <ShieldCheck className="size-4 mr-1.5" /> फर्म KYC सबमिट करें (Submit to SuperAdmin)
            </Button>
          </div>
        )}
      </form>

      {/* Document Preview Dialog */}
      <Dialog
        open={!!previewDoc}
        onOpenChange={(v) => !v && setPreviewDoc(null)}
        title={previewDoc?.title || 'दस्तावेज़'}
      >
        {previewDoc && (
          <div className="overflow-hidden rounded-xl bg-black flex items-center justify-center p-2">
            {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
              <iframe src={previewDoc.url} className="w-full h-[70vh] rounded" title={previewDoc.title} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewDoc.url} alt={previewDoc.title} className="max-h-[70vh] w-auto rounded object-contain" />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ========================================================================= */
/* 3. BROKER AGENT: OWN KYC SUBMISSION & FIRM KYC VIEW                       */
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
  const { user } = useAuth();
  const [agentTab, setAgentTab] = useState<'my' | 'firm'>('my');

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
    <div className="space-y-4 max-w-4xl">
      <PageHeader
        title={agentTab === 'my' ? "Agent KYC" : "ब्रोकर फर्म KYC"}
        subtitle={
          agentTab === 'my'
            ? "सुरक्षित ब्रोकर नेटवर्क के लिए आपकी पहचान एवं फेस लाइवलीनेस सत्यापन"
            : "आपकी ब्रोकर फर्म के आधिकारिक रजिस्ट्रेशन व RERA सत्यापन विवरण"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={agentTab === 'my' ? 'primary' : 'secondary'}
              onClick={() => setAgentTab('my')}
            >
              <UserCheck className="size-4" /> मेरा KYC (My KYC)
            </Button>
            <Button
              size="sm"
              variant={agentTab === 'firm' ? 'primary' : 'secondary'}
              onClick={() => setAgentTab('firm')}
            >
              <Building2 className="size-4" /> फर्म KYC (Firm Status)
            </Button>
          </div>
        }
      />

      {agentTab === 'firm' ? (
        <FirmKycManagementView user={user} canEdit={false} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
