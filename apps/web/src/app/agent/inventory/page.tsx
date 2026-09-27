'use client';

import React, { useState } from 'react';
import {
  Building,
  Search,
  MapPin,
  Share2,
  Phone,
  MessageSquare,
  CheckCircle2,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';

interface PersonalProperty {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  category: string;
  tenancy: string;
  ownerName: string;
  ownerPhone: string;
  status: 'ACTIVE' | 'PENDING_OFFER' | 'DEAL_CLOSED';
}

const MY_INVENTORY: PersonalProperty[] = [
  {
    id: 'prop-101',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    category: 'Commercial Shop',
    tenancy: 'Ready Shop · High Footfall Commercial Corridor',
    ownerName: 'Deepak Singhania',
    ownerPhone: '+91 98992 48292',
    status: 'ACTIVE',
  },
  {
    id: 'prop-102',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    category: 'Pre-Leased Rented',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart',
    ownerName: 'Deepak Singhania',
    ownerPhone: '+91 98992 48292',
    status: 'ACTIVE',
  },
  {
    id: 'prop-103',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor',
    price: '₹1,45,00,000',
    category: 'SCO Commercial Plot',
    tenancy: 'Ready for Fitouts · Corner Facing',
    ownerName: 'Ashwani Goyal',
    ownerPhone: '+91 62602 45484',
    status: 'ACTIVE',
  },
  {
    id: 'prop-104',
    project: 'Orris Market 89',
    unit: 'A-515',
    sector: 'Sector-89',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    price: '₹38,00,000',
    category: 'Commercial Shop',
    tenancy: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    ownerName: 'Vineet Kumar',
    ownerPhone: '+91 99113 89167',
    status: 'PENDING_OFFER',
  },
];

export default function AgentInventoryPage() {
  const [items, setItems] = useState<PersonalProperty[]>(MY_INVENTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredItems = items.filter(
    (p) =>
      p.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-teal-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <Building size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">My Active Inventory & Mandates</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Personal active listings ready for client pitching, WhatsApp sharing, and site visit scheduling.
            </p>
          </div>
        </div>

        <a
          href="/agent/market-scanner"
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-teal-900/30"
        >
          <PlusCircle size={14} />
          <span>Scan & Import More Units</span>
        </a>
      </div>

      {/* Search */}
      <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search property or sector..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
        <span className="text-xs text-gray-400 font-medium">Showing {filteredItems.length} Units</span>
      </div>

      {/* Grid of Inventory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {filteredItems.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl hover:border-teal-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{p.project}</h3>
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-teal-300 font-mono text-xs font-bold">
                      {p.unit}
                    </span>
                  </div>
                  <p className="text-xs text-teal-400 font-medium flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {p.sector} · {p.areaSqFt} sq.ft · {p.floor}
                  </p>
                </div>
                <span className="text-base font-extrabold text-white">{p.price}</span>
              </div>

              <p className="text-xs text-gray-300 mt-3 p-3 rounded-xl bg-gray-950/70 border border-gray-800">
                {p.tenancy}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Owner: <strong className="text-gray-200">{p.ownerName}</strong></span>
                <span className="font-mono">{p.ownerPhone}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between">
              <a
                href={`tel:${p.ownerPhone}`}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Phone size={13} />
                <span>Call Owner</span>
              </a>

              <button
                type="button"
                onClick={() =>
                  showToast(
                    `Brochure pitch for ${p.project} ${p.unit} copied! Ready to paste into client WhatsApp.`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Share2 size={13} />
                <span>Share Client Pitch</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
