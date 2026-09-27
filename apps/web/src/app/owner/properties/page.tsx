'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building,
  PlusCircle,
  MapPin,
  ShieldCheck,
  Zap,
  Edit,
  Eye,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface OwnerProperty {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  category: string;
  tenancy: string;
  status: 'ACTIVE' | 'RENTED' | 'UNDER_CONTRACT';
  views: number;
  boosted: boolean;
}

const OWNER_PROPERTIES: OwnerProperty[] = [
  {
    id: 'own-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    category: 'Commercial Retail Shop',
    tenancy: 'Ready Shop · High Footfall Commercial Corridor',
    status: 'ACTIVE',
    views: 680,
    boosted: true,
  },
  {
    id: 'own-2',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    category: 'Pre-Leased Commercial',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart (9-yr lease)',
    status: 'RENTED',
    views: 520,
    boosted: false,
  },
  {
    id: 'own-3',
    project: 'AIPL Joy District',
    unit: 'Food Court K-12',
    sector: 'Sector-88A',
    areaSqFt: 310,
    floor: '3rd Floor Food Court',
    price: '₹42,00,000',
    category: 'Food Court Unit',
    tenancy: 'Pre-leased @ ₹140/sq.ft · 9.1% Yield',
    status: 'ACTIVE',
    views: 220,
    boosted: true,
  },
];

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>(OWNER_PROPERTIES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleBoostListing = (id: string, projectName: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, boosted: true, views: p.views + 80 } : p))
    );
    showToast(`⚡ 50 Credits deducted: "${projectName}" boosted to #1 on search results!`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-sky-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
            <Building size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">My Listed Properties</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage your commercial units, occupancy status, tenant lease details, and search promotion.
            </p>
          </div>
        </div>

        <Link
          href="/owner/post-property"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-sky-900/30"
        >
          <PlusCircle size={14} />
          <span>Post New Property</span>
        </Link>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {properties.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl hover:border-sky-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{p.project}</h3>
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-sky-300 font-mono text-xs font-bold">
                      {p.unit}
                    </span>
                  </div>
                  <p className="text-xs text-sky-400 font-medium flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {p.sector} · {p.floor}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    p.status === 'ACTIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-blue-950 text-blue-400 border border-blue-800'
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-gray-950/80 border border-gray-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Carpet Area:</span>
                  <span className="font-bold text-white">{p.areaSqFt} sq.ft</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <span className="text-gray-400 font-medium">Asking Price / Rent:</span>
                  <span className="font-extrabold text-white text-sm">{p.price}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <span className="text-gray-400 font-medium">Buyer Views:</span>
                  <span className="font-bold text-teal-400 flex items-center gap-1">
                    <Eye size={12} /> {p.views} views
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-300 mt-3 line-clamp-2">{p.tenancy}</p>

              {p.boosted && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-950/40 p-2 rounded-lg border border-amber-800/60">
                  <Zap size={12} className="fill-current" />
                  <span>Boost Active · Featured on Seeker Discovery Home</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck size={13} /> Verified
              </span>

              <div className="flex items-center gap-2">
                {!p.boosted && (
                  <button
                    type="button"
                    onClick={() => handleBoostListing(p.id, p.project)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Zap size={12} />
                    <span>Boost (50 cr)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => showToast(`Edit form loaded for ${p.project} ${p.unit}`)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
