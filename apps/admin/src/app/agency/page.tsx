'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  GitBranch,
  Kanban,
  Award,
  ChevronRight,
  ArrowUpRight,
  UserPlus,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const AGENT_LEADERBOARD = [
  { id: '1', name: 'Amit Verma', dealsClosed: 4, revenue: '₹14,50,000', leads: 24, conversion: '16.7%', avatar: 'AV' },
  { id: '2', name: 'Priya Nair', dealsClosed: 3, revenue: '₹11,20,000', leads: 19, conversion: '15.8%', avatar: 'PN' },
  { id: '3', name: 'Rohan Deshmukh', dealsClosed: 3, revenue: '₹9,80,000', leads: 21, conversion: '14.2%', avatar: 'RD' },
  { id: '4', name: 'Saurabh Mehta', dealsClosed: 2, revenue: '₹7,30,000', leads: 15, conversion: '13.3%', avatar: 'SM' },
];

const PIPELINE_DISTRIBUTION = [
  { stage: 'New', count: 18, color: '#3B82F6' },
  { stage: 'Contacted', count: 28, color: '#F59E0B' },
  { stage: 'Site Visit', count: 14, color: '#8B5CF6' },
  { stage: 'Negotiation', count: 8, color: '#0D9488' },
  { stage: 'Won', count: 12, color: '#10B981' },
];

export default function AgencyDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner: Founder Realty Executive Console */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Founder Realty India</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Agency Manager Portal
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Principal broker management console: agent quotas, lead routing rules, and unified team pipeline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/agency/team"
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/30"
          >
            <UserPlus size={14} />
            <span>Manage Broker Seats (8/10)</span>
          </Link>
          <Link
            href="/agency/allocation"
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition-all"
          >
            <GitBranch size={14} />
            <span>Allocation Rules</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 */}
        <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Agency Sales Volume
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">₹42,80,000</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-400 font-semibold">
              <TrendingUp size={12} />
              <span>+31.2% this quarter</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Team Seats */}
        <Link
          href="/agency/team"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-amber-500/50 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Broker Seats Utilization
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">8 of 10 Seats</p>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '80%' }} />
            </div>
          </div>
        </Link>

        {/* KPI 3: Unallocated Leads */}
        <Link
          href="/agency/allocation"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-teal-500/50 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Unallocated Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <GitBranch size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-teal-400 tracking-tight">5 Inbound Leads</p>
            <p className="text-xs text-gray-400 mt-1.5">Housing.com & WhatsApp triggers</p>
          </div>
        </Link>

        {/* KPI 4: Unified Pipeline */}
        <Link
          href="/agency/pipeline"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-blue-500/50 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Total Agency Pipeline
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Kanban size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">₹14.2 Crores</p>
            <p className="text-xs text-gray-400 mt-1.5">80 Active opportunities</p>
          </div>
        </Link>
      </div>

      {/* Grid: Pipeline Chart & Broker Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pipeline Funnel Chart */}
        <div className="lg:col-span-2 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Agency Leads Pipeline Distribution</h2>
              <p className="text-xs text-gray-400 mt-0.5">Active leads across stage progression</p>
            </div>
            <Link href="/agency/pipeline" className="text-xs font-semibold text-amber-400 hover:text-amber-300">
              Open Board →
            </Link>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PIPELINE_DISTRIBUTION} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2937" />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#030712',
                    borderRadius: '10px',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [val, 'Active Leads']}
                />
                <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Agent Performance Leaderboard */}
        <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Agent Leaderboard</h2>
              <p className="text-xs text-gray-400 mt-0.5">Top closers this month</p>
            </div>
            <Award size={18} className="text-amber-400" />
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {AGENT_LEADERBOARD.map((agent, index) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {agent.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-white text-xs">{agent.name}</p>
                    <p className="text-[10px] text-gray-400">{agent.dealsClosed} Deals · {agent.conversion} Conv.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-400">{agent.revenue}</p>
                  <p className="text-[10px] text-gray-500">{agent.leads} leads</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-800 mt-4">
            <Link
              href="/agency/team"
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1"
            >
              <span>View All 8 Agents</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
