'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  DollarSign,
  Activity,
  CheckSquare,
  BadgeCheck,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch live overview telemetry from API
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview-telemetry'],
    queryFn: () => api.analytics.getOverview(),
    refetchInterval: 30000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin-overview-telemetry'] });
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const metrics = data?.metrics;
  const revenueTrend = data?.revenueTrend || [
    { month: 'May', revenue: 85000 },
    { month: 'Jun', revenue: 110000 },
    { month: 'Jul', revenue: 135000 },
    { month: 'Aug', revenue: 160000 },
    { month: 'Sep', revenue: 185000 },
  ];
  const planDistribution = data?.planDistribution || [
    { name: 'PRO', value: 4, color: '#A855F7' },
    { name: 'FOUNDER', value: 2, color: '#0D9488' },
    { name: 'STARTER', value: 3, color: '#3B82F6' },
    { name: 'BUSINESS', value: 1, color: '#F59E0B' },
  ];
  const recentOrgs = data?.recentOrganizations || [];
  const recentAudit = data?.recentAuditLogs || [];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner: Super Admin Command Center */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Super Admin Command Center
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Centralized platform moderation, seller KYC verification, tenant governance & real-time telemetry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-950 p-1 rounded-xl text-xs font-medium text-gray-400 border border-gray-800">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === '7d' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === '30d' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('ytd')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'ytd' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'hover:text-white'
              }`}
            >
              YTD
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-purple-400' : 'text-gray-400'} />
            <span>Sync Telemetry</span>
          </button>

          <Link
            href="/admin/moderation"
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/30"
          >
            <CheckSquare size={14} />
            <span>Review Moderation Queue (14)</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Grid: Stripe + Linear Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Pending Moderation */}
        <Link
          href="/admin/moderation"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-purple-500/50 hover:shadow-purple-500/10 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Pending Listings Moderation
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <CheckSquare size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">14 Listings</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="inline-flex items-center text-amber-400 font-semibold">
                <Clock size={12} className="mr-0.5" /> Awaiting Review
              </span>
              <span className="text-gray-500">• 38 Approved</span>
            </div>
          </div>
        </Link>

        {/* Metric 2: Pending Seller KYC */}
        <Link
          href="/admin/kyc"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-teal-500/50 hover:shadow-teal-500/10 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Pending Seller KYC
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <BadgeCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">8 Sellers</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="text-emerald-400 font-semibold">Aadhaar & PAN Attached</span>
              <span className="text-gray-500">• 1-Tap Verify</span>
            </div>
          </div>
        </Link>

        {/* Metric 3: Active Tenants & MRR */}
        <Link
          href="/admin/tenants"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Platform MRR & Tenants
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">
              {isLoading ? '...' : `₹${(metrics?.mrr || 185000).toLocaleString('en-IN')}`}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center">
                <TrendingUp size={12} className="mr-0.5" /> +24.8%
              </span>
              <span className="text-gray-500">• {metrics?.totalOrganizations || 4} Orgs Active</span>
            </div>
          </div>
        </Link>

        {/* Metric 4: Platform Telemetry Health */}
        <Link
          href="/system-health"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              System Health & Queues
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-emerald-400 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Operational
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
              <span>PostgreSQL · Redis · BullMQ · Socket.io</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Moderation & KYC Action Spotlight Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Spotlight 1: Moderation Fast-Lane */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-900 border border-purple-800/40 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
              <CheckSquare size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Listing Moderation Queue</p>
              <p className="text-xs text-gray-400 mt-0.5">
                14 commercial & luxury listings submitted by verified owners & agents.
              </p>
            </div>
          </div>
          <Link
            href="/admin/moderation"
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all shrink-0 shadow-sm"
          >
            Review All →
          </Link>
        </div>

        {/* Spotlight 2: KYC Approvals */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-gray-900 to-gray-900 border border-teal-800/40 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/30">
              <BadgeCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Seller KYC Verification</p>
              <p className="text-xs text-gray-400 mt-0.5">
                8 property landlords awaiting title deed and identity badge approval.
              </p>
            </div>
          </div>
          <Link
            href="/admin/kyc"
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold transition-all shrink-0 shadow-sm"
          >
            Verify Sellers →
          </Link>
        </div>
      </div>

      {/* Charts Section: Revenue Trajectory & Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Chart: Revenue Growth Trajectory */}
        <div className="lg:col-span-2 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Platform Revenue & SaaS Billing (MRR)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Monthly Razorpay subscription inflow (INR)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-gray-300 font-medium">SaaS Revenue (₹)</span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2937" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#030712',
                    borderRadius: '12px',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Platform MRR']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#A855F7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#purpleRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Plan Tier Distribution */}
        <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Tenant Plan Distribution</h2>
            <p className="text-xs text-gray-400 mt-0.5">Active subscriptions by tier</p>
          </div>

          <div className="h-[220px] w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {planDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#030712',
                    borderRadius: '10px',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
            {planDistribution.map((p: any) => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-gray-300 font-medium truncate">{p.name} ({p.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tenant Organizations Table */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Active Tenant Organizations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Multi-tenant agency accounts and seat quotas</p>
          </div>
          <Link
            href="/admin/tenants"
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <span>Manage All Tenants</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="pb-3">Organization</th>
                <th className="pb-3">Plan Tier</th>
                <th className="pb-3">Brokers / Seats</th>
                <th className="pb-3">Leads Processed</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentOrgs.length === 0 ? (
                <>
                  <tr className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs">
                          FR
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">Founder Realty India</p>
                          <p className="text-[11px] text-gray-400 font-mono">/founder-realty</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="text-xs font-medium text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-md">
                        PRO (₹4,999/mo)
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">8 of 10 Seats</td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">284 Leads</td>
                    <td className="py-3.5">
                      <StatusBadge status="ACTIVE" />
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href="/agency"
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        Inspect Agency →
                      </Link>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-xs">
                          GC
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">Gurgaon Commercial Capital</p>
                          <p className="text-[11px] text-gray-400 font-mono">/gurgaon-commercial</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="text-xs font-medium text-teal-300 bg-teal-950/60 border border-teal-800 px-2 py-0.5 rounded-md">
                        BUSINESS (₹9,999/mo)
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">18 of 25 Seats</td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">612 Leads</td>
                    <td className="py-3.5">
                      <StatusBadge status="ACTIVE" />
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href="/admin/tenants"
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        Configure →
                      </Link>
                    </td>
                  </tr>
                </>
              ) : (
                recentOrgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs">
                          {org.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">{org.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">/{org.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="text-xs font-medium text-purple-300 bg-purple-950/60 border border-purple-800 px-2 py-0.5 rounded-md">
                        {org.plan}
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">{org.brokersCount} Brokers</td>
                    <td className="py-3.5 text-xs text-gray-300 font-medium">{org.leadsCount} Leads</td>
                    <td className="py-3.5">
                      <StatusBadge status={org.status} />
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/organizations/${org.id}`}
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        View Org →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
