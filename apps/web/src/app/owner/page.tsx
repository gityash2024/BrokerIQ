'use client';

import React from 'react';
import Link from 'next/link';
import {
  Home,
  Building,
  PlusCircle,
  MessageSquare,
  ShieldCheck,
  Zap,
  Eye,
  TrendingUp,
  ArrowRight,
  Phone,
  Sparkles,
} from 'lucide-react';

const RECENT_ENQUIRIES = [
  {
    id: 'enq-1',
    buyerName: 'Vikram Malhotra',
    property: 'SS Omnia - Shop G80 (Sector-86)',
    phone: '+91 98109 87654',
    message: 'Interested in purchasing for ready electronics franchise. When can we meet for site visit?',
    time: '25 mins ago',
  },
  {
    id: 'enq-2',
    buyerName: 'Dr. Arvinder Sethi',
    property: 'SS Highpoint - Shop No-52',
    phone: '+91 98222 11990',
    message: 'Looking for pre-leased commercial property with steady rental ROI. Please share lease deed copy.',
    time: '2 hours ago',
  },
];

export default function OwnerDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner: Deepak Singhania Property Owner Cockpit */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
            <Home size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Deepak Singhania — Owner Portal</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                Verified Landlord ✅
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Direct landlord cockpit: manage listed commercial shops, track inbound buyer calls, and boost visibility.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/owner/post-property"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-sky-900/30"
          >
            <PlusCircle size={14} />
            <span>List Property (3-Step Wizard)</span>
          </Link>
          <Link
            href="/owner/credits"
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs font-semibold rounded-xl border border-sky-500/30 transition-all"
          >
            <Zap size={14} />
            <span>Boost Credits (250)</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link
          href="/owner/properties"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-sky-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              My Listed Properties
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Building size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">3 Commercial Units</p>
            <p className="text-xs text-emerald-400 font-semibold mt-1">2 Available · 1 Rented</p>
          </div>
        </Link>

        <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-teal-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Buyer & Tenant Views
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <Eye size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-white tracking-tight">1,420 Views</p>
            <p className="text-xs text-teal-400 font-semibold mt-1">+18.5% traffic boost</p>
          </div>
        </div>

        <Link
          href="/owner/enquiries"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-amber-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Direct Buyer Inquiries
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-amber-400 tracking-tight">28 Inbound Leads</p>
            <p className="text-xs text-gray-400 mt-1">Direct Call & WhatsApp</p>
          </div>
        </Link>

        <Link
          href="/owner/verification"
          className="bg-gray-900/90 p-5 rounded-2xl border border-gray-800 shadow-lg hover:border-emerald-500/50 transition-all block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Verification Trust Score
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-emerald-400 tracking-tight">100% Verified</p>
            <p className="text-xs text-gray-400 mt-1">Aadhaar · PAN · Registry Approved</p>
          </div>
        </Link>
      </div>

      {/* Inbound Buyer Enquiries Section */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Recent Direct Buyer Inquiries</h2>
            <p className="text-xs text-gray-400 mt-0.5">Prospective buyers seeking property visits or lease agreements</p>
          </div>
          <Link href="/owner/enquiries" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
            View All 28 Leads →
          </Link>
        </div>

        <div className="space-y-3">
          {RECENT_ENQUIRIES.map((enq) => (
            <div
              key={enq.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-gray-950/70 border border-gray-800/80 hover:border-sky-500/40 transition-all gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{enq.buyerName}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({enq.time})</span>
                </div>
                <p className="text-xs text-sky-400 font-medium mt-0.5">{enq.property}</p>
                <p className="text-xs text-gray-300 mt-1 max-w-xl">{enq.message}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${enq.phone}`}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-sky-600 text-gray-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>Call Buyer</span>
                </a>
                <a
                  href={`https://wa.me/${enq.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${enq.buyerName}, Deepak Singhania here regarding ${enq.property}.`
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
