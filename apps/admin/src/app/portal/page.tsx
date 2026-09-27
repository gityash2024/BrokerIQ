'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Search,
  MapPin,
  Building,
  Phone,
  MessageSquare,
  Bookmark,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Calculator,
} from 'lucide-react';

interface FeaturedListing {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  category: string;
  tenancy: string;
  sellerName: string;
  sellerRole: string;
  sellerPhone: string;
  verified: boolean;
  yieldRoi: string;
}

const FEATURED_UNITS: FeaturedListing[] = [
  {
    id: 'feat-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    category: 'Commercial Retail Shop',
    tenancy: 'Ready Shop · High Footfall Commercial Corridor',
    sellerName: 'Deepak Singhania',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 98992 48292',
    verified: true,
    yieldRoi: '8.4%',
  },
  {
    id: 'feat-2',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    category: 'Pre-Leased Commercial',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart (9-yr lease)',
    sellerName: 'Amit Verma',
    sellerRole: 'Senior Broker',
    sellerPhone: '+91 98712 34567',
    verified: true,
    yieldRoi: '8.9%',
  },
  {
    id: 'feat-3',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor',
    price: '₹1,45,00,000',
    category: 'Commercial SCO Plot',
    tenancy: 'Commercial SCO Plot · Approved for F&B / Gym',
    sellerName: 'Ashwani Goyal',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 62602 45484',
    verified: true,
    yieldRoi: '9.2%',
  },
  {
    id: 'feat-4',
    project: 'Orris Market 89',
    unit: 'A-515',
    sector: 'Sector-89',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    price: '₹38,00,000',
    category: 'Commercial Retail Shop',
    tenancy: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    sellerName: 'Vineet Kumar',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 99113 89167',
    verified: true,
    yieldRoi: '8.2%',
  },
  {
    id: 'feat-5',
    project: 'Sapphire Ninety',
    unit: 'SF-12',
    sector: 'Sector-90',
    areaSqFt: 620,
    floor: 'Second Floor (SF)',
    price: '₹62,000/mo',
    category: 'Pre-Leased Commercial',
    tenancy: 'Rented to Corporate Bank ATM & Branch',
    sellerName: 'Gaurav Kapoor',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 98114 56789',
    verified: true,
    yieldRoi: '8.6%',
  },
  {
    id: 'feat-6',
    project: 'DLF Regal Garden',
    unit: 'Tower 4 - 1402',
    sector: 'Sector-90',
    areaSqFt: 1750,
    floor: '14th Floor',
    price: '₹1,85,00,000',
    category: 'Luxury Residential',
    tenancy: 'Ready to Move · 3BHK + Servants Quarter',
    sellerName: 'Neha Sharma',
    sellerRole: 'Senior Broker',
    sellerPhone: '+91 98666 77889',
    verified: true,
    yieldRoi: '5.2%',
  },
];

const SECTOR_INTELLIGENCE = [
  { sector: 'Sector-86', avgRate: '₹12,500/sq.ft', yield: '8.5% Yield', units: '42 Units', anchor: 'SS Omnia & Highpoint' },
  { sector: 'Sector-88A', avgRate: '₹14,000/sq.ft', yield: '9.2% Yield', units: '28 Units', anchor: 'Signature Signum' },
  { sector: 'Sector-89', avgRate: '₹11,000/sq.ft', yield: '7.8% Yield', units: '35 Units', anchor: 'Orris Market 89' },
  { sector: 'Sector-90', avgRate: '₹13,200/sq.ft', yield: '8.1% Yield', units: '50 Units', anchor: 'Sapphire Ninety & DLF' },
];

export default function SeekerPortalPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [savedList, setSavedList] = useState<string[]>(['feat-1', 'feat-3']);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleSave = (id: string, projectName: string) => {
    if (savedList.includes(id)) {
      setSavedList((prev) => prev.filter((item) => item !== id));
      showToast(`Removed "${projectName}" from your saved wishlist.`);
    } else {
      setSavedList((prev) => [...prev, id]);
      showToast(`⭐ "${projectName}" saved to your wishlist!`);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-rose-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Search Experience: Housing.com Inspired */}
      <div className="relative rounded-3xl bg-gradient-to-br from-rose-950/50 via-gray-900 to-gray-950 border border-gray-800 p-8 sm:p-12 overflow-hidden shadow-2xl text-center">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-medium">
            <Sparkles size={14} className="text-rose-400" />
            <span>Gurgaon Commercial & Luxury Corridor Hub</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Discover Verified Commercial & <br />
            <span className="bg-gradient-to-r from-rose-400 via-pink-300 to-rose-200 bg-clip-text text-transparent">
              High-Yield Pre-Leased Properties
            </span>
          </h1>

          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Browse 50+ commercial shops, SCO plots, and luxury apartments directly from verified owners & top brokers in Sectors 86–90.
          </p>

          {/* Search Box */}
          <div className="pt-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 bg-gray-950/90 border border-gray-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl">
              <Search className="text-gray-500 ml-3 shrink-0" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by project (SS Omnia, Signum), sector, or unit type..."
                className="w-full bg-transparent px-2 py-2 text-white placeholder:text-gray-500 text-sm focus:outline-none"
              />
              <Link
                href="/portal/search"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-900/40 shrink-0"
              >
                Search Units
              </Link>
            </div>
          </div>

          {/* Sector Shortcut Pills */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">Trending Micro-Markets:</span>
            {['Sector-86', 'Sector-88A', 'Sector-89', 'Sector-90', 'Dwarka Expressway'].map((sec) => (
              <Link
                key={sec}
                href={`/portal/search?sector=${sec}`}
                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-rose-500/50 transition-all font-medium"
              >
                {sec}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sector Financial Intelligence Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Micro-Market Financial Intelligence</h2>
            <p className="text-xs text-gray-400 mt-0.5">Prevailing capital rates and commercial rental yields</p>
          </div>
          <Link href="/portal/calculator" className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1">
            <Calculator size={13} />
            <span>ROI Calculator</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECTOR_INTELLIGENCE.map((sec) => (
            <div
              key={sec.sector}
              className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-rose-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{sec.sector}</span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  {sec.yield}
                </span>
              </div>
              <p className="text-lg font-extrabold text-gray-100 mt-2">{sec.avgRate}</p>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-800">
                <span>{sec.anchor}</span>
                <span className="font-medium text-rose-400">{sec.units}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Properties Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Featured Verified Properties</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top-rated commercial and residential units available right now</p>
          </div>
          <Link href="/portal/search" className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1">
            <span>Explore All 54 Listings</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED_UNITS.map((p) => {
            const isSaved = savedList.includes(p.id);

            return (
              <div
                key={p.id}
                className="rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-rose-500/50 shadow-xl transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base group-hover:text-rose-300 transition-colors">
                          {p.project}
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-rose-300 font-mono text-xs font-bold">
                          {p.unit}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin size={12} className="text-rose-400" /> {p.sector} · {p.floor}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSave(p.id, p.project)}
                      className={`p-2 rounded-xl border transition-all ${
                        isSaved
                          ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                          : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-white'
                      }`}
                      title={isSaved ? 'Saved in Wishlist' : 'Save to Wishlist'}
                    >
                      <Bookmark size={15} className={isSaved ? 'fill-current' : ''} />
                    </button>
                  </div>

                  {/* Specs & Pricing Banner */}
                  <div className="mt-4 p-3 rounded-xl bg-gray-950/80 border border-gray-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Carpet Area:</span>
                      <span className="font-bold text-white">{p.areaSqFt} sq.ft</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Asking:</span>
                      <span className="font-extrabold text-white text-sm">{p.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800/80">
                      <span className="text-gray-400 font-medium">Rental Yield ROI:</span>
                      <span className="font-bold text-emerald-400">{p.yieldRoi} Prevailing</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 mt-3 line-clamp-2">{p.tenancy}</p>

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      {p.sellerName} · <strong className="text-gray-200">{p.sellerRole}</strong>
                    </span>
                    {p.verified && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                        <ShieldCheck size={12} /> Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct 1-Tap Outreach Footer */}
                <div className="p-4 bg-gray-950/60 border-t border-gray-800 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${p.sellerPhone}`}
                    className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Phone size={13} />
                    <span>Call Seller</span>
                  </a>

                  <a
                    href={`https://wa.me/${p.sellerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hello, I am interested in ${p.project} ${p.unit} in ${p.sector} listed on BrokerIQ.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
