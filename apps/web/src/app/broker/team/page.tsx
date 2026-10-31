'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  MoreHorizontal,
  Navigation,
  Percent,
  Phone,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate, safeTimeAgo } from '@/lib/utils';
import { useReverseGeocode } from '@/lib/reverse-geocode';
import { PageHeader } from '@/components/panel/shell';
import { useTeam } from '@/components/broker/bits';
import { CopyField } from '@/components/panel/integration-card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { SortableTh, useSortableTable } from '@/components/ui/sortable-header';
import { TeamLeaderboardView } from '@/components/broker/team/team-leaderboard';
import { DateRangeFilter, type DateRangeValue, isDateInRange } from '@/components/broker/date-range-filter';
import { ExportToolbar } from '@/components/broker/export-toolbar';

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
  ...rest
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  [key: string]: any;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      className={cn(
        'size-4 rounded border-line bg-surface text-brand focus:ring-2 focus:ring-brand-500/20 cursor-pointer accent-brand-600',
        className,
      )}
      {...rest}
    />
  );
}

export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';
  const q = useTeam();
  const [invite, setInvite] = useState(false);
  const inv = [['team']];
  const update = useApiMutation(({ id, ...b }: any) => patch(`/broker/team/${id}`, b), {
    success: 'अपडेट हो गया ✅',
    invalidate: inv,
  });
  const remove = useApiMutation((id: string) => del(`/broker/team/${id}`), {
    success: 'सदस्य को टीम से हटा दिया गया',
    invalidate: inv,
  });
  const cancel = useApiMutation((id: string) => del(`/broker/team/invites/${id}`), {
    success: 'Invite रद्द कर दिया गया',
    invalidate: inv,
  });

  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  // Teams & Agents Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BROKER_ADMIN' | 'BROKER_AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'LIVE' | 'OFFLINE'>('ALL');
  const [kycFilter, setKycFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REQUIRED'>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: 'ALL' });
  const [sortBy, setSortBy] = useState<'PERFORMANCE' | 'LEADS' | 'NAME'>('PERFORMANCE');

  // Table Row Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Enterprise Table Header Sorting State (3-State Sort)
  const { sortColumn, sortDirection, handleSort } = useSortableTable<'name' | 'role' | 'location' | 'target' | 'kyc' | 'leads' | 'won'>();

  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const members = q.data?.members ?? [];
  const ranked = [...members]
    .filter((m) => m.status === 'ACTIVE')
    .sort((a, b) => b.stats.won30d - a.stats.won30d || b.stats.activities30d - a.stats.activities30d);

  // Filter & Sort members
  const filteredMembers = members
    .filter((m: any) => {
      // 1. Role filter
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;

      // 2. Account Status filter (ACTIVE, SUSPENDED)
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      // 3. Live location filter (active within 30 min)
      const loc = m.lastLocation;
      const isLive = loc && (Date.now() - new Date(loc.updatedAt || loc.capturedAt).getTime() <= 30 * 60 * 1000);
      if (locationFilter === 'LIVE' && !isLive) return false;
      if (locationFilter === 'OFFLINE' && isLive) return false;

      // 4. KYC Status filter
      const kyc = m.kycStatus || 'UNVERIFIED';
      if (kycFilter === 'VERIFIED' && kyc !== 'VERIFIED') return false;
      if (kycFilter === 'PENDING' && kyc !== 'PENDING') return false;
      if (kycFilter === 'REQUIRED' && (kyc === 'VERIFIED' || kyc === 'PENDING')) return false;

      // 5. Individual Agent selector filter
      if (agentFilter !== 'ALL' && m.id !== agentFilter) return false;

      // 6. Date Range filter (Today, Yesterday, Last 7 Days, This Month, Custom)
      if (!isDateInRange(m.createdAt, dateRange)) return false;

      // 7. Search (name, email, phone)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = m.name?.toLowerCase().includes(query);
        const emailMatch = m.email?.toLowerCase().includes(query);
        const phoneMatch = m.phone?.includes(query);
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }

      return true;
    })
    .sort((a: any, b: any) => {
      // Enterprise 3-state sort takes precedence if a column header was clicked
      if (sortColumn && sortDirection) {
        let diff = 0;
        if (sortColumn === 'name') diff = (a.name || '').localeCompare(b.name || '');
        else if (sortColumn === 'role') diff = (a.role || '').localeCompare(b.role || '');
        else if (sortColumn === 'location') {
          const aLive = a.lastLocation && (Date.now() - new Date(a.lastLocation.updatedAt || a.lastLocation.capturedAt).getTime() <= 30 * 60 * 1000) ? 1 : 0;
          const bLive = b.lastLocation && (Date.now() - new Date(b.lastLocation.updatedAt || b.lastLocation.capturedAt).getTime() <= 30 * 60 * 1000) ? 1 : 0;
          diff = aLive - bLive;
        } else if (sortColumn === 'target') {
          const aTarget = Number(a.targets?.monthlyDeals) || 5;
          const bTarget = Number(b.targets?.monthlyDeals) || 5;
          const aPct = aTarget > 0 ? ((a.fulfillment?.dealsWonMonth ?? a.stats?.won30d ?? 0) / aTarget) : 0;
          const bPct = bTarget > 0 ? ((b.fulfillment?.dealsWonMonth ?? b.stats?.won30d ?? 0) / bTarget) : 0;
          diff = aPct - bPct;
        } else if (sortColumn === 'kyc') {
          diff = (a.kycStatus || 'UNVERIFIED').localeCompare(b.kycStatus || 'UNVERIFIED');
        } else if (sortColumn === 'leads') {
          diff = (a.stats?.openLeads ?? a.stats?.leadsHandled ?? 0) - (b.stats?.openLeads ?? b.stats?.leadsHandled ?? 0);
        } else if (sortColumn === 'won') {
          diff = (a.fulfillment?.dealsWonMonth ?? a.stats?.won30d ?? 0) - (b.fulfillment?.dealsWonMonth ?? b.stats?.won30d ?? 0);
        }
        return sortDirection === 'asc' ? diff : -diff;
      }

      // Default dropdown sort
      if (sortBy === 'PERFORMANCE') {
        const aWon = a.fulfillment?.dealsWonMonth ?? a.stats?.won30d ?? 0;
        const bWon = b.fulfillment?.dealsWonMonth ?? b.stats?.won30d ?? 0;
        if (bWon !== aWon) return bWon - aWon;
        return (b.stats?.activities30d ?? 0) - (a.stats?.activities30d ?? 0);
      }
      if (sortBy === 'LEADS') {
        return (b.stats?.openLeads ?? 0) - (a.stats?.openLeads ?? 0);
      }
      if (sortBy === 'NAME') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  // Selection helpers
  const isAllFilteredSelected =
    filteredMembers.length > 0 && filteredMembers.every((m: any) => selectedIds.has(m.id));
  const isSomeFilteredSelected =
    filteredMembers.some((m: any) => selectedIds.has(m.id)) && !isAllFilteredSelected;

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const next = new Set(selectedIds);
      filteredMembers.forEach((m: any) => next.delete(m.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredMembers.forEach((m: any) => next.add(m.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setLocationFilter('ALL');
    setKycFilter('ALL');
    setAgentFilter('ALL');
    setDateRange({ preset: 'ALL' });
    setSortBy('PERFORMANCE');
    setSelectedIds(new Set());
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    roleFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    locationFilter !== 'ALL' ||
    kycFilter !== 'ALL' ||
    agentFilter !== 'ALL' ||
    dateRange.preset !== 'ALL' ||
    sortBy !== 'PERFORMANCE' ||
    sortColumn !== null ||
    selectedIds.size > 0;

  // Dedicated View for Agents: show ONLY Team Leaderboard (no admin controls, no tracking links)
  if (!admin) {
    return (
      <>
        <PageHeader
          title="Team Leaderboard"
          subtitle="अपनी टीम की रैंकिंग, क्लोज़ हुई डील्स व प्रदर्शन बोर्ड"
        />
        <div className="mt-4">
          <TeamLeaderboardView members={members} currentUserId={user?.id} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Team & Agents"
        subtitle="एजेंट्स को इनवाइट करें, रोल्स दें, टारगेट्स सेट करें व लाइव लोकेशन ट्रैक करें"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push('/broker/team/leaderboard')}
              className="border-amber-300/40 hover:border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold"
            >
              <Trophy className="size-4 mr-1.5 text-amber-500" /> Leaderboard
            </Button>
            <Button size="sm" onClick={() => setInvite(true)}>
              <UserPlus className="size-4 mr-1.5" /> Member invite करें
            </Button>
          </div>
        }
      />

      {ranked.length > 1 && (
        <div className="mb-4 grid gap-2.5 md:grid-cols-3">
          {ranked.slice(0, 3).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn('card relative overflow-hidden p-4', i === 0 && 'border-saffron-300 dark:border-saffron-500/40')}
            >
              {i === 0 && <div className="absolute -top-12 -right-12 size-40 rounded-full bg-saffron-400/20 blur-2xl" />}
              <div className="relative flex items-center gap-3">
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl} size={42} />
                  <span
                    className={cn(
                      'absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-[10px] font-extrabold text-white ring-2 ring-surface',
                      ['bg-saffron-500', 'bg-slate-400', 'bg-amber-700'][i],
                    )}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-sm">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.stats.won30d} won · {m.stats.activities30d} activities (30 दिन)
                  </p>
                </div>
                {i === 0 && <Trophy className="size-5 text-saffron-500" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filter Toolbar for Teams & Agents */}
      <div className="card mb-3.5 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Instant Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="मेंबर खोजें — नाम, ईमेल, फ़ोन..."
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

            {/* Role Filter */}
            <div className="w-32">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="ALL">सभी रोल्स (Role)</option>
                <option value="BROKER_ADMIN">Admin</option>
                <option value="BROKER_AGENT">Agent</option>
              </Select>
            </div>

            {/* Account Status Filter */}
            <div className="w-32">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="ALL">सभी स्थिति (Status)</option>
                <option value="ACTIVE">सक्रिय (Active)</option>
                <option value="SUSPENDED">निलंबित (Suspended)</option>
              </Select>
            </div>

            {/* Live Location Filter */}
            <div className="w-36">
              <Select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="ALL">सभी लोकेशन (Location)</option>
                <option value="LIVE">🟢 लाइव (Active Now)</option>
                <option value="OFFLINE">ऑफलाइन (Offline)</option>
              </Select>
            </div>

            {/* KYC Status Filter */}
            <div className="w-36">
              <Select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="ALL">सभी KYC स्थिति</option>
                <option value="VERIFIED">✅ प्रमाणित (Verified)</option>
                <option value="PENDING">⏳ समीक्षाधीन (Pending)</option>
                <option value="REQUIRED">⚠️ अप्रमाणित (Required)</option>
              </Select>
            </div>

            {/* Agent Selector Dropdown */}
            <div className="w-40">
              <Select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="ALL">सभी सदस्य (All Agents)</option>
                {members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})
                  </option>
                ))}
              </Select>
            </div>

            {/* Date Range Preset Filter */}
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              size="xs"
              className="min-w-[190px]"
            />

            {/* Sort By */}
            <div className="w-36">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 text-xs"
              >
                <option value="PERFORMANCE">डील्स परफ़ॉर्मेंस</option>
                <option value="LEADS">ओपन लीड्स</option>
                <option value="NAME">नाम (A से Z)</option>
              </Select>
            </div>

            {/* Clear Filter button */}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                className="h-9 text-xs text-muted hover:text-fg"
              >
                <RotateCcw className="size-3.5 mr-1" /> रीसेट
              </Button>
            )}
          </div>

          {/* Right Action: Export Toolbar & Roster Count */}
          <div className="flex items-center gap-2 shrink-0">
            <ExportToolbar
              endpoint="/broker/team/export"
              selectedIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
              filters={{
                role: roleFilter !== 'ALL' ? roleFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: searchQuery.trim() || undefined,
                agentId: agentFilter !== 'ALL' ? agentFilter : undefined,
                datePreset: dateRange.preset !== 'ALL' ? dateRange.preset : undefined,
                from: dateRange.preset === 'CUSTOM' ? dateRange.from : undefined,
                to: dateRange.preset === 'CUSTOM' ? dateRange.to : undefined,
              }}
              filenamePrefix="team-roster"
              totalCount={members.length}
              filteredCount={filteredMembers.length}
            />

            <div className="text-xs font-semibold text-muted">
              दिखे <span className="font-bold text-fg">{filteredMembers.length}</span> / {members.length} सदस्य
            </div>
          </div>
        </div>

        {/* Selected Rows Banner (when selection active) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-brand/10 border border-brand/20 px-3 py-2 text-xs text-brand font-semibold animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-2 rounded-full bg-brand animate-pulse" />
              <span>{selectedIds.size} सदस्य चयनित (Selected for Export)</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-bold text-brand hover:underline"
            >
              चयन हटाएं (Clear Selection)
            </button>
          </div>
        )}
      </div>

      {!q.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : filteredMembers.length === 0 ? (
        <Empty
          icon={<Users className="size-8" />}
          title="कोई सदस्य नहीं मिला"
          text={
            hasActiveFilters
              ? 'चुने गए फ़िल्टर के अनुसार कोई टीम सदस्य नहीं मिला। कृपया फ़िल्टर रीसेट करें।'
              : 'अभी तक कोई सदस्य टीम में नहीं जुड़ा है।'
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold tracking-wide text-subtle uppercase">
              <tr>
                {/* Header Checkbox (Select All / Indeterminate) */}
                <th className="w-10 px-3 py-3 text-center">
                  <IndeterminateCheckbox
                    checked={isAllFilteredSelected}
                    indeterminate={isSomeFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="सभी सदस्य चुनें (Select all)"
                  />
                </th>
                <SortableTh column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Member</SortableTh>
                <SortableTh column="role" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Role</SortableTh>
                <SortableTh column="location" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Live Location</SortableTh>
                <SortableTh column="target" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Target & Fulfillment</SortableTh>
                <SortableTh column="kyc" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>KYC Status</SortableTh>
                <SortableTh column="leads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="center">Open leads</SortableTh>
                <SortableTh column="won" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="center">Won (30d)</SortableTh>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m: any) => {
                const kycStatus = m.kycStatus || 'UNVERIFIED';
                const loc = m.lastLocation;
                const dealsTarget = m.targets?.monthlyDeals || 5;
                const dealsWon = m.fulfillment?.dealsWonMonth ?? m.stats?.won30d ?? 0;
                const dealsPct = m.fulfillment?.dealsPercent ?? (dealsTarget > 0 ? Math.min(100, Math.round((dealsWon / dealsTarget) * 100)) : 0);
                const isSelected = selectedIds.has(m.id);

                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/broker/team/${m.id}`)}
                    className={cn(
                      'border-b border-line last:border-0 cursor-pointer hover:bg-surface-2/50 transition-colors',
                      isSelected && 'bg-brand/5 dark:bg-brand/10',
                      m.status !== 'ACTIVE' && 'opacity-60',
                    )}
                  >
                    {/* Row Selection Checkbox */}
                    <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectRow(m.id, e as any)}
                        aria-label={`Select ${m.name}`}
                        className="size-4 rounded border-line bg-surface text-brand focus:ring-2 focus:ring-brand-500/20 cursor-pointer accent-brand-600"
                      />
                    </td>

                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} src={m.avatarUrl} size={38} />
                        <div className="min-w-0">
                          <p className="font-semibold flex items-center gap-1.5">
                            {m.name} {m.id === user?.id && <span className="text-xs font-normal text-muted">(आप)</span>}
                          </p>
                          <p className="truncate text-xs text-muted">{m.email ?? m.phone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {m.role === 'BROKER_ADMIN' ? (
                        <Badge tone="brand">
                          <Crown className="size-3 mr-1" /> Admin
                        </Badge>
                      ) : (
                        <Badge>Agent</Badge>
                      )}
                      {m.status === 'SUSPENDED' && (
                        <Badge tone="danger" className="ml-1">
                          Suspended
                        </Badge>
                      )}
                    </td>

                    {/* Live Location */}
                    <td className="px-4 py-3" onClick={(e) => loc && e.stopPropagation()}>
                      <TeamLiveLocationCell loc={loc} />
                    </td>

                    {/* Target & Fulfillment */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-muted">डील्स:</span>
                          <span>{dealsWon} / {dealsTarget} ({dealsPct}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              dealsPct >= 100 ? 'bg-emerald-500' : dealsPct >= 50 ? 'bg-amber-500' : 'bg-brand',
                            )}
                            style={{ width: `${dealsPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* KYC Status */}
                    <td className="px-4 py-3">
                      {kycStatus === 'VERIFIED' ? (
                        <Badge tone="success" className="font-bold">
                          <ShieldCheck className="size-3 mr-1" /> Verified
                        </Badge>
                      ) : kycStatus === 'PENDING' ? (
                        <Badge tone="warning" className="font-bold animate-pulse">
                          Pending
                        </Badge>
                      ) : kycStatus === 'REJECTED' ? (
                        <Badge tone="danger">Rejected</Badge>
                      ) : (
                        <Badge tone="neutral">Required</Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-semibold">{m.stats?.openLeads ?? m.fulfillment?.leadsOpen ?? 0}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-600">{m.stats?.won30d ?? m.fulfillment?.dealsWonMonth ?? 0}</td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="xs" variant="ghost" onClick={() => router.push(`/broker/team/${m.id}`)}>
                          Details & Target
                        </Button>
                        {admin && m.id !== user?.id && (
                          <DM.Root>
                            <DM.Trigger className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </DM.Trigger>
                            <DM.Portal>
                              <DM.Content align="end" className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-xl">
                                <DM.Item
                                  onSelect={() =>
                                    update.mutate({
                                      id: m.id,
                                      role: m.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN',
                                    })
                                  }
                                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2"
                                >
                                  <Crown className="size-4 text-brand" /> {m.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
                                </DM.Item>
                                <DM.Item
                                  onSelect={() => update.mutate({ id: m.id, status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2"
                                >
                                  <X className="size-4 text-amber-500" /> {m.status === 'ACTIVE' ? 'Suspend करें' : 'Reactivate करें'}
                                </DM.Item>
                                <DM.Item
                                  onSelect={() => confirm(`${m.name} को टीम से हटाएँ? उनकी सभी leads unassigned हो जाएँगी।`) && remove.mutate(m.id)}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 outline-none hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                >
                                  <UserMinus className="size-4" /> Team से हटाएँ
                                </DM.Item>
                              </DM.Content>
                            </DM.Portal>
                          </DM.Root>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {admin && (q.data?.invites ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">लंबित इनवाइट्स (Pending invites)</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(q.data?.invites ?? []).map((i: any) => (
              <div key={i.id} className="card flex min-w-0 items-center gap-3 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
                  <Mail className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.name}</p>
                  <p className="truncate text-xs text-muted">
                    {i.email} · {i.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'} · expires {formatDate(i.expiresAt, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Button size="xs" variant="ghost" className="shrink-0" onClick={() => cancel.mutate(i.id)}>
                  रद्द करें
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteDialog open={invite} onOpenChange={setInvite} />
      <AgentDetailsAndTargetModal
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(v) => !v && setSelectedAgent(null)}
      />
    </>
  );
}

/* ========================================================================= */
/* AGENT DETAILS, EDITABLE PROFILE, TARGETS & LIVE LOCATION MODAL            */
/* ========================================================================= */

function AgentDetailsAndTargetModal({
  agent,
  open,
  onOpenChange,
}: {
  agent: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'BROKER_ADMIN' | 'BROKER_AGENT'>('BROKER_AGENT');
  const [dealsTarget, setDealsTarget] = useState<number>(5);
  const [revenueTarget, setRevenueTarget] = useState<number>(500000);
  const [leadsTarget, setLeadsTarget] = useState<number>(30);
  const [commissionPct, setCommissionPct] = useState<number>(10);

  // Sync state when agent selected
  useEffect(() => {
    if (agent) {
      setEditName(agent.name || '');
      setEditPhone(agent.phone || '');
      setEditRole(agent.role || 'BROKER_AGENT');
      setDealsTarget(agent.targets?.monthlyDeals ?? 5);
      setRevenueTarget(agent.targets?.monthlyRevenue ?? 500000);
      setLeadsTarget(agent.targets?.monthlyLeads ?? 30);
      setCommissionPct(agent.targets?.commissionPct ?? 10);
    }
  }, [agent]);

  const saveMutation = useApiMutation(
    (body: any) => patch(`/broker/team/${agent?.id}`, body),
    {
      success: 'Agent प्रोफाइल और टारगेट्स अपडेट हो गए ✅',
      invalidate: [['team']],
      onSuccess: () => {
        onOpenChange(false);
      },
    },
  );

  if (!agent) return null;

  const loc = agent.lastLocation;
  const wonThisMonth = agent.fulfillment?.dealsWonMonth ?? agent.stats?.won30d ?? 0;
  const dealsPct = dealsTarget > 0 ? Math.min(100, Math.round((wonThisMonth / dealsTarget) * 100)) : 0;
  const openLeads = agent.stats?.openLeads ?? 0;
  const leadsPct = leadsTarget > 0 ? Math.min(100, Math.round((openLeads / leadsTarget) * 100)) : 0;

  const handleSave = () => {
    saveMutation.mutate({
      name: editName.trim(),
      phone: editPhone.trim() || null,
      role: editRole,
      targets: {
        monthlyDeals: Number(dealsTarget) || 0,
        monthlyRevenue: Number(revenueTarget) || 0,
        monthlyLeads: Number(leadsTarget) || 0,
        commissionPct: Number(commissionPct) || 0,
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${agent.name} • एजेंट विवरण व लक्ष्य`}
      description="प्रोफाइल, रोल्स, मासिक टारगेट्स एवं एजेंट की लाइव लोकेशन प्रबंधित करें"
      footer={
        <div className="flex items-center justify-between w-full">
          <Link
            href="/broker/kyc"
            className="text-xs text-brand font-semibold hover:underline flex items-center gap-1"
          >
            <ShieldCheck className="size-4" /> KYC मॉड्यूल में देखें
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              बंद करें
            </Button>
            {isAdmin && (
              <Button loading={saveMutation.isPending} onClick={handleSave} className="bg-brand text-white font-bold">
                <Save className="size-4" /> बदलाव सेव करें
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Profile Card */}
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4 border border-line">
          <div className="flex items-center gap-3">
            <Avatar name={agent.name} src={agent.avatarUrl} size={48} />
            <div>
              <p className="font-bold text-base">{agent.name}</p>
              <p className="text-xs text-muted">{agent.email} {agent.phone ? `· ${agent.phone}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={agent.role === 'BROKER_ADMIN' ? 'brand' : 'neutral'}>
              {agent.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
            </Badge>
            <Badge tone={agent.kycStatus === 'VERIFIED' ? 'success' : agent.kycStatus === 'PENDING' ? 'warning' : 'neutral'}>
              {agent.kycStatus || 'UNVERIFIED'}
            </Badge>
          </div>
        </div>

        {/* 1. Live Location Tracker Section */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Compass className="size-4 text-emerald-500 animate-spin" />
              <span>लाइव लोकेशन ट्रैकर (Live Location)</span>
            </div>
            {loc ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                एक्टिव ({safeTimeAgo(loc.capturedAt)})
              </span>
            ) : (
              <span className="text-xs text-muted">लोकेशन उपलब्ध नहीं</span>
            )}
          </div>

          {loc ? (
            <div className="rounded-xl bg-surface-2/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-mono font-bold text-fg">
                  Lat: {loc.latitude.toFixed(6)}, Lng: {loc.longitude.toFixed(6)}
                </p>
                <p className="text-muted mt-0.5">
                  Accuracy: {loc.accuracy ? `±${Math.round(loc.accuracy)}m` : 'GPS'} · स्रोत: {loc.source || 'App'}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 font-bold shrink-0 transition-colors"
              >
                <Navigation className="size-3.5" /> Google Maps पर देखें
              </a>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-2/30 p-3 text-xs text-muted">
              एजेंट ने अभी तक मोबाइल ऐप या वेब पोर्टल से लोकेशन शेयर नहीं की है। जब एजेंट ऐप खोलेगा, लोकेशन अपने-आप यहाँ अपडेट हो जाएगी।
            </div>
          )}
        </div>

        {/* 2. Agent Targets & Fulfillment */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Target className="size-4 text-saffron-500" />
              <span>मासिक लक्ष्य व पूर्ति (Targets & Fulfillment)</span>
            </div>
            <span className="text-xs text-muted">इस माह की प्रगति</span>
          </div>

          {/* Fulfillment Progress bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Deals Won: {wonThisMonth} / {dealsTarget}</span>
                <span className={dealsPct >= 100 ? 'text-emerald-600' : 'text-fg'}>{dealsPct}% पूर्ण</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    dealsPct >= 100 ? 'bg-emerald-500' : 'bg-saffron-500',
                  )}
                  style={{ width: `${dealsPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Leads Handled: {openLeads} / {leadsTarget}</span>
                <span>{leadsPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${leadsPct}%` }} />
              </div>
            </div>
          </div>

          {/* Target inputs */}
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Field label="Monthly Deals Target">
                <Input
                  type="number"
                  min="0"
                  value={dealsTarget}
                  onChange={(e) => setDealsTarget(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
              <Field label="Monthly Leads Target">
                <Input
                  type="number"
                  min="0"
                  value={leadsTarget}
                  onChange={(e) => setLeadsTarget(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
              <Field label="Revenue Target (₹)">
                <Input
                  type="number"
                  min="0"
                  step="10000"
                  value={revenueTarget}
                  onChange={(e) => setRevenueTarget(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </Field>
              <Field label="Commission %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </Field>
            </div>
          )}
        </div>

        {/* 3. Editable Profile Fields */}
        {isAdmin && (
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <h4 className="font-bold text-sm text-fg">एजेंट प्रोफाइल विवरण (Edit Profile)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="नाम">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Field>
              <Field label="फ़ोन नंबर">
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="10 अंक" />
              </Field>
            </div>
            {agent.id !== user?.id && (
              <Field label="रोल (Role)">
                <Select value={editRole} onChange={(e) => setEditRole(e.target.value as any)}>
                  <option value="BROKER_AGENT">Agent</option>
                  <option value="BROKER_ADMIN">Admin</option>
                </Select>
              </Field>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const send = useApiMutation(() => post<{ link: string; emailed: boolean }>('/broker/team/invite', f), {
    invalidate: [['team']],
    onSuccess: (r) => {
      setResult(r);
      toast.success(r.emailed ? 'Invite email भेज दी गई' : 'Invite बन गया — link share करें');
    },
  });
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setResult(null);
      setF({ name: '', email: '', role: 'BROKER_AGENT' });
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Team member invite करें"
      description="Invite link 7 दिन valid रहता है"
      footer={
        !result && (
          <Button loading={send.isPending} disabled={!f.name || !f.email} onClick={() => send.mutate(undefined)}>
            <Send className="size-4" /> Invite भेजें
          </Button>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Link2 className="size-5" />
            <p className="text-sm font-semibold">
              {result.emailed
                ? `${f.email} पर email चला गया। चाहें तो link WhatsApp पर भी भेजें:`
                : 'Email (SMTP) configure नहीं है — ये link खुद WhatsApp पर भेजें:'}
            </p>
          </div>
          <CopyField label="Invite link" value={result.link} />
          <Button variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(`${f.name}, हमारी team join करें: ${result.link}`)}`}>
            WhatsApp पर भेजें
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="नाम" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Role" hint="Admin: billing, connectors, automations, पूरी team की leads। Agent: सिर्फ़ अपनी assigned leads।">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="BROKER_AGENT">Agent</option>
              <option value="BROKER_ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}

function TeamLiveLocationCell({ loc }: { loc: any }) {
  const { location: geoLoc, loading } = useReverseGeocode(loc?.latitude, loc?.longitude);

  if (!loc || loc.latitude == null || loc.longitude == null) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span>Offline</span>
      </div>
    );
  }

  const capturedTime = loc.capturedAt || loc.recordedAt || loc.createdAt;
  const isRecent = capturedTime && Date.now() - new Date(capturedTime).getTime() < 15 * 60 * 1000;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          {isRecent ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
          )}
        </span>
        <span className={cn('font-semibold', isRecent ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}>
          {safeTimeAgo(capturedTime)}
        </span>
        <a
          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-brand transition-colors p-0.5"
          title="Google Maps पर देखें"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3" />
        </a>
      </div>
      <div
        className="text-[11px] text-muted flex items-center gap-1 truncate max-w-[200px]"
        title={geoLoc?.fullAddress || `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`}
      >
        <MapPin className="size-3 text-muted shrink-0" />
        <span className="truncate">
          {loading
            ? 'पता लोड हो रहा है...'
            : geoLoc?.locality
              ? `${geoLoc.locality}${geoLoc.city ? `, ${geoLoc.city}` : ''}`
              : `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`}
        </span>
      </div>
    </div>
  );
}
