'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Trash2,
  Phone,
  MessageSquare,
  Building,
  MapPin,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface SavedItem {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  ratePerSqFt: string;
  price: string;
  floor: string;
  yieldRoi: string;
  tenancy: string;
  sellerName: string;
  sellerPhone: string;
}

const INITIAL_SAVED: SavedItem[] = [
  {
    id: 'save-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    ratePerSqFt: '₹16,700/sq.ft',
    price: '₹75,00,000',
    floor: 'Ground Floor (GF)',
    yieldRoi: '8.4%',
    tenancy: 'Ready Shop · High Footfall Corridor',
    sellerName: 'Deepak Singhania',
    sellerPhone: '+91 98992 48292',
  },
  {
    id: 'save-2',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    ratePerSqFt: '₹17,050/sq.ft',
    price: '₹1,45,00,000',
    floor: 'Ground + 1st Floor (Corner)',
    yieldRoi: '9.2%',
    tenancy: 'Ready for Fitouts · Approved for F&B',
    sellerName: 'Ashwani Goyal',
    sellerPhone: '+91 62602 45484',
  },
];

export default function SeekerSavedPage() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(INITIAL_SAVED);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRemove = (id: string, projectName: string) => {
    setSavedItems((prev) => prev.filter((i) => i.id !== id));
    showToast(`Removed "${projectName}" from saved list.`);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-rose-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold">
            <Bookmark size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Saved Properties & Wishlist</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Side-by-side comparison of shortlisted commercial units, rates per sq.ft, and rental returns.
            </p>
          </div>
        </div>
      </div>

      {savedItems.length === 0 ? (
        <div className="p-12 rounded-2xl bg-gray-900 border border-gray-800 text-center space-y-3">
          <Bookmark size={32} className="text-gray-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Your wishlist is empty</h3>
          <p className="text-xs text-gray-400">Bookmark properties while browsing search results to compare them here.</p>
          <Link
            href="/portal/search"
            className="inline-block mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
          >
            Browse Properties
          </Link>
        </div>
      ) : (
        <>
          {/* Side-by-side comparison matrix */}
          <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Side-by-Side Comparison Matrix</h3>
              <span className="text-xs text-gray-400">{savedItems.length} Shortlisted Units</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
                    <th className="py-3 px-4">Feature / Metric</th>
                    {savedItems.map((item) => (
                      <th key={item.id} className="py-3 px-4 font-bold text-white">
                        {item.project} ({item.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Micro-Market Sector</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 font-medium text-white">
                        {item.sector}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Carpet Area</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 font-bold text-gray-200">
                        {item.areaSqFt} sq.ft
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Total Asking Price</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 font-extrabold text-white text-sm">
                        {item.price}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Effective Rate / sq.ft</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 font-mono text-gray-300">
                        {item.ratePerSqFt}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Rental Yield (ROI)</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 font-bold text-emerald-400 text-sm">
                        {item.yieldRoi} Yield
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Floor Specification</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4 text-gray-300">
                        {item.floor}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 text-gray-400 font-semibold">Direct Outreach</td>
                    {savedItems.map((item) => (
                      <td key={item.id} className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${item.sellerPhone}`}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <Phone size={12} />
                            <span>Call</span>
                          </a>
                          <a
                            href={`https://wa.me/${item.sellerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hi, I have shortlisted ${item.project} ${item.unit}.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1"
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id, item.project)}
                            className="p-1.5 text-gray-500 hover:text-red-400"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
