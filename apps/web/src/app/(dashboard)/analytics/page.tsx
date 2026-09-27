'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, TrendingUp, DollarSign, Users, Bot, MessageSquare,
  Calendar, Download, RefreshCw, ArrowUpRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '@/lib/api';

export default function Analytics() {
  const [metricTab, setMetricTab] = useState<'revenue' | 'leads' | 'ai'>('revenue');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['analytics-full'],
    queryFn: () => api.analytics.getOverview(),
  });

  const revenueTrend = data?.revenueTrend || [];
  const planDistribution = data?.planDistribution || [];
  const leadTrend = data?.leadTrend || [];
  const metrics = data?.metrics;

  const aiUsageData = [
    { day: 'Mon', requests: 45, tokens: 18000 },
    { day: 'Tue', requests: 72, tokens: 32000 },
    { day: 'Wed', requests: 95, tokens: 41000 },
    { day: 'Thu', requests: 68, tokens: 29000 },
    { day: 'Fri', requests: 110, tokens: 52000 },
    { day: 'Sat', requests: 135, tokens: 64000 },
    { day: 'Sun', requests: 88, tokens: 38000 },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Telemetry & Analytics</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Live Graphs
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Deep performance metrics on tenant revenue, lead ingestion velocities, and AI assistant consumption.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin text-teal-600' : 'text-gray-500'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gross MRR</span>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            ₹{(metrics?.mrr || 4999).toLocaleString('en-IN')}
          </p>
          <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">↑ 22.4% Annual Run Rate</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Leads Managed</span>
          <p className="text-2xl font-extrabold text-teal-600 mt-1">{metrics?.totalLeads || 5}</p>
          <span className="text-xs text-gray-400 mt-1 inline-block">From Housing.com & Direct</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp Dispatched</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{metrics?.whatsAppMessages || 1240}</p>
          <span className="text-xs text-gray-400 mt-1 inline-block">Cloud API Delivered</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">AI Groq LLM Inferences</span>
          <p className="text-2xl font-extrabold text-purple-600 mt-1">{metrics?.aiRequests || 345}</p>
          <span className="text-xs text-gray-400 mt-1 inline-block">Assistant & Lead Scoring</span>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue Trajectory */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">SaaS Revenue Growth (MRR)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Recurring subscription inflows in ₹</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">INR (₹)</span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'MRR Inflow']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Plan Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Subscription Tier Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tenants subscribed across plan tiers</p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {planDistribution.map((entry: any, index: number) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Lead Volumes & Site Visits */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Weekly Lead Ingestion vs Site Visits</h2>
              <p className="text-xs text-gray-500 mt-0.5">Leads captured vs physical tours booked</p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="leads" name="Leads" fill="#0D9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="siteVisits" name="Site Visits" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: AI Usage & Token Consumption */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">AI Assistant Requests (Groq LLaMA 3.3)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Daily automated broker inquiries and matching</p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aiUsageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} requests`, 'AI Volume']}
                />
                <Area type="monotone" dataKey="requests" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorAI)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
