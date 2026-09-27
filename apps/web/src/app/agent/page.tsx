'use client';

import React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Users,
  Building,
  ScanLine,
  CalendarCheck,
  Phone,
  MessageSquare,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

const TODAYS_AGENDA = [
  {
    id: 'ag-1',
    leadName: 'Rohit Agrawal',
    property: 'SS Omnia - Shop G80',
    sector: 'Sector-86',
    time: '11:00 AM',
    phone: '+91 98111 55667',
    type: 'SITE_VISIT',
    notes: 'Investor interested in high footfall commercial shop. Budget ₹75L ready.',
  },
  {
    id: 'ag-2',
    leadName: 'Sameer Bansal',
    property: 'SS Highpoint - Shop No-52',
    sector: 'Sector-86',
    time: '02:30 PM',
    phone: '+91 98222 66778',
    type: 'CALL',
    notes: 'Follow-up regarding pre-leased ROI agreement with Vishal Mega Mart.',
  },
  {
    id: 'ag-3',
    leadName: 'Kavita Chawla',
    property: 'Signature Signum-88A SCO',
    sector: 'Sector-88A',
    time: '04:00 PM',
    phone: '+91 98333 77889',
    type: 'WHATSAPP',
    notes: 'Send video walkthrough of SCO plot corner location.',
  },
];

export default function AgentDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner: Amit Verma Field CRM */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <Briefcase size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Amit Verma — Field CRM</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                Senior Negotiator · Founder Realty
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Personal deals cockpit: active buyer pipeline, AI physical listing book scanner, and daily outreach schedule.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/agent/market-scanner"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-teal-900/30 animate-pulse"
          >
            <ScanLine size={14} />
            <span>AI Book Scanner (Gurgaon Catalog)</span>
          </Link>
          <Link
            href="/agent/leads"
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition-all"
          >
            <Users size={14} />
            <span>My Leads (24)</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link
          href="/agent/leads"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-teal-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              My Active Leads
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">24 Clients</p>
            <p className="text-xs text-emerald-400 font-semibold mt-1">6 Hot / High Priority</p>
          </div>
        </Link>

        <Link
          href="/agent/follow-ups"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-amber-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Follow-ups Due Today
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-amber-400 tracking-tight">6 Outreach Items</p>
            <p className="text-xs text-gray-400 mt-1">3 Calls · 2 Site Visits · 1 WhatsApp</p>
          </div>
        </Link>

        <Link
          href="/agent/inventory"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-blue-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              My Active Inventory
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Building size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">12 Units</p>
            <p className="text-xs text-gray-400 mt-1">Sector 86, 88A, 89 Commercial</p>
          </div>
        </Link>

        <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Closed Commission MTD
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-emerald-400 tracking-tight">₹1,20,000</p>
            <p className="text-xs text-gray-400 mt-1">4 Deals closed this month</p>
          </div>
        </div>
      </div>

      {/* Today's Outreach Agenda */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Today's Client Outreach Agenda</h2>
            <p className="text-xs text-gray-400 mt-0.5">High-priority client touchpoints scheduled for today</p>
          </div>
          <Link href="/agent/follow-ups" className="text-xs font-semibold text-teal-400 hover:text-teal-300">
            Full Calendar →
          </Link>
        </div>

        <div className="space-y-3">
          {TODAYS_AGENDA.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-teal-500/40 transition-all gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{item.leadName}</span>
                    <span className="text-[10px] font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                      {item.type}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono font-semibold">@{item.time}</span>
                  </div>
                  <p className="text-xs text-gray-300 font-medium mt-0.5">
                    {item.property} · <span className="text-gray-400">{item.sector}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{item.notes}</p>
                </div>
              </div>

              {/* Direct 1-Tap Outreach Actions */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <a
                  href={`tel:${item.phone}`}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-teal-600 text-gray-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>Call Client</span>
                </a>
                <a
                  href={`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${item.leadName}, Amit Verma here from Founder Realty regarding ${item.property}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/40 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
