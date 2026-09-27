'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Building,
  Phone,
  MessageSquare,
  Bookmark,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface SearchProperty {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  priceNumeric: number;
  category: string;
  tenancy: string;
  sellerName: string;
  sellerPhone: string;
  verified: boolean;
  yieldRoi: string;
}

const SEARCH_CATALOG: SearchProperty[] = [
  {
    id: 's-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    priceNumeric: 7500000,
    category: 'Commercial Shop',
    tenancy: 'Ready Shop · High Footfall Commercial Corridor',
    sellerName: 'Deepak Singhania',
    sellerPhone: '+91 98992 48292',
    verified: true,
    yieldRoi: '8.4%',
  },
  {
    id: 's-2',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    priceNumeric: 55000,
    category: 'Pre-Leased Rented',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart (9-yr lease)',
    sellerName: 'Amit Verma',
    sellerPhone: '+91 98712 34567',
    verified: true,
    yieldRoi: '8.9%',
  },
  {
    id: 's-3',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor',
    price: '₹1,45,00,000',
    priceNumeric: 14500000,
    category: 'SCO Plot',
    tenancy: 'Commercial SCO Plot · Approved for F&B / Gym',
    sellerName: 'Ashwani Goyal',
    sellerPhone: '+91 62602 45484',
    verified: true,
    yieldRoi: '9.2%',
  },
  {
    id: 's-4',
    project: 'Orris Market 89',
    unit: 'A-515',
    sector: 'Sector-89',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    price: '₹38,00,000',
    priceNumeric: 3800000,
    category: 'Commercial Shop',
    tenancy: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    sellerName: 'Vineet Kumar',
    sellerPhone: '+91 99113 89167',
    verified: true,
    yieldRoi: '8.2%',
  },
  {
    id: 's-5',
    project: 'Sapphire Ninety',
    unit: 'SF-12',
    sector: 'Sector-90',
    areaSqFt: 620,
    floor: 'Second Floor (SF)',
    price: '₹62,000/mo',
    priceNumeric: 62000,
    category: 'Pre-Leased Rented',
    tenancy: 'Rented to Corporate Bank ATM & Branch',
    sellerName: 'Gaurav Kapoor',
    sellerPhone: '+91 98114 56789',
    verified: true,
    yieldRoi: '8.6%',
  },
  {
    id: 's-6',
    project: 'DLF Regal Garden',
    unit: 'Tower 4 - 1402',
    sector: 'Sector-90',
    areaSqFt: 1750,
    floor: '14th Floor',
    price: '₹1,85,00,000',
    priceNumeric: 18500000,
    category: 'Luxury Apartment',
    tenancy: 'Ready to Move · 3BHK + Servants Quarter',
    sellerName: 'Neha Sharma',
    sellerPhone: '+91 98666 77889',
    verified: true,
    yieldRoi: '5.2%',
  },
];

export default function SeekerSearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(['s-1']);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleSave = (id: string, name: string) => {
    if (savedIds.includes(id)) {
      setSavedIds((prev) => prev.filter((i) => i !== id));
      showToast(`Removed "${name}" from saved list.`);
    } else {
      setSavedIds((prev) => [...prev, id]);
      showToast(`⭐ "${name}" added to saved list!`);
    }
  };

  const filtered = SEARCH_CATALOG.filter((p) => {
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (selectedSector !== 'ALL' && p.sector !== selectedSector) return false;
    if (selectedFloor !== 'ALL' && !p.floor.includes(selectedFloor)) return false;
    if (verifiedOnly && !p.verified) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        p.project.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        p.sector.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-rose-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <h1 className="text-xl font-bold text-white tracking-tight">Marketplace Property Search</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Filter through commercial shops, pre-leased rented assets, and SCO plots across Gurgaon sectors.
        </p>

        {/* Filter Toolbar */}
        <div className="mt-5 space-y-4 pt-4 border-t border-gray-800 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by project, complex, unit #, or sector..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          {/* Filter Chips Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Select */}
            <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
              {['ALL', 'Commercial Shop', 'SCO Plot', 'Pre-Leased Rented', 'Luxury Apartment'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Types' : cat}
                  </button>
                )
              )}
            </div>

            {/* Sector Select */}
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-medium"
            >
              <option value="ALL">All Sectors</option>
              <option value="Sector-86">Sector-86</option>
              <option value="Sector-88A">Sector-88A</option>
              <option value="Sector-89">Sector-89</option>
              <option value="Sector-90">Sector-90</option>
            </select>

            {/* Floor Select */}
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-medium"
            >
              <option value="ALL">All Floors</option>
              <option value="Ground">Ground Floor (GF)</option>
              <option value="First">First Floor (FF)</option>
              <option value="Second">Second Floor (SF)</option>
            </select>

            {/* Verified Only Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl cursor-pointer text-gray-300">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded bg-gray-900 border-gray-800 text-rose-500 w-4 h-4"
              />
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={14} /> Verified Only
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>Showing {filtered.length} Properties Matching Filters</span>
        <span>Sorted by: Relevance & Yield</span>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => {
          const isSaved = savedIds.includes(p.id);

          return (
            <div
              key={p.id}
              className="rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-rose-500/40 shadow-xl transition-all flex flex-col justify-between overflow-hidden group"
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
                  >
                    <Bookmark size={15} className={isSaved ? 'fill-current' : ''} />
                  </button>
                </div>

                {/* Specs */}
                <div className="mt-4 p-3 rounded-xl bg-gray-950/80 border border-gray-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium">Carpet Area:</span>
                    <span className="font-bold text-white">{p.areaSqFt} sq.ft</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium">Asking Price / Rent:</span>
                    <span className="font-extrabold text-white text-sm">{p.price}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800/80">
                    <span className="text-gray-400 font-medium">Rental Yield:</span>
                    <span className="font-bold text-emerald-400">{p.yieldRoi} ROI</span>
                  </div>
                </div>

                <p className="text-xs text-gray-300 mt-3 line-clamp-2">{p.tenancy}</p>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>Seller: <strong className="text-gray-200">{p.sellerName}</strong></span>
                  {p.verified && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      <ShieldCheck size={12} /> Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-gray-950/60 border-t border-gray-800 flex items-center justify-between gap-2">
                <a
                  href={`tel:${p.sellerPhone}`}
                  className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>Call</span>
                </a>

                <a
                  href={`https://wa.me/${p.sellerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${p.sellerName}, I am interested in ${p.project} ${p.unit}.`
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
  );
}
