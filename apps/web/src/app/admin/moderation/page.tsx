'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  MapPin,
  Eye,
  ShieldCheck,
  Clock,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

interface ModerationItem {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  category: 'Commercial Shop' | 'SCO Plot' | 'Pre-Leased Rented' | 'Luxury Apartment';
  tenancy: string;
  submitterName: string;
  submitterRole: 'Property Owner' | 'Broker Agent';
  submittedAt: string;
  verifiedOwner: boolean;
}

const INITIAL_MODERATION_ITEMS: ModerationItem[] = [
  {
    id: 'mod-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    status: 'PENDING',
    category: 'Commercial Shop',
    tenancy: 'Ready Shop · High Footfall Corridor',
    submitterName: 'Deepak Singhania',
    submitterRole: 'Property Owner',
    submittedAt: '12 mins ago',
    verifiedOwner: true,
  },
  {
    id: 'mod-2',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    status: 'PENDING',
    category: 'Pre-Leased Rented',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart',
    submitterName: 'Amit Verma',
    submitterRole: 'Broker Agent',
    submittedAt: '35 mins ago',
    verifiedOwner: true,
  },
  {
    id: 'mod-3',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor',
    price: '₹1,45,00,000',
    status: 'PENDING',
    category: 'SCO Plot',
    tenancy: 'Ready for Fitouts · Corner Facing',
    submitterName: 'Ashwani Goyal',
    submitterRole: 'Property Owner',
    submittedAt: '1 hour ago',
    verifiedOwner: true,
  },
  {
    id: 'mod-4',
    project: 'Orris Market 89',
    unit: 'A-515',
    sector: 'Sector-89',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    price: '₹38,00,000',
    status: 'PENDING',
    category: 'Commercial Shop',
    tenancy: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    submitterName: 'Vineet Kumar',
    submitterRole: 'Broker Agent',
    submittedAt: '2 hours ago',
    verifiedOwner: false,
  },
  {
    id: 'mod-5',
    project: 'Sapphire Ninety',
    unit: 'SF-12',
    sector: 'Sector-90',
    areaSqFt: 620,
    floor: 'Second Floor (SF)',
    price: '₹62,000/mo',
    status: 'PENDING',
    category: 'Pre-Leased Rented',
    tenancy: 'Rented to Corporate Bank ATM & Branch',
    submitterName: 'Gaurav Kapoor',
    submitterRole: 'Property Owner',
    submittedAt: '3 hours ago',
    verifiedOwner: true,
  },
  {
    id: 'mod-6',
    project: 'DLF Regal Garden',
    unit: 'Tower 4 - 1402',
    sector: 'Sector-90',
    areaSqFt: 1750,
    floor: '14th Floor',
    price: '₹1,85,00,000',
    status: 'APPROVED',
    category: 'Luxury Apartment',
    tenancy: 'Ready to Move · 3BHK + Servants',
    submitterName: 'Rajesh Sharma',
    submitterRole: 'Broker Agent',
    submittedAt: 'Yesterday',
    verifiedOwner: true,
  },
  {
    id: 'mod-7',
    project: 'AIPL Joy District',
    unit: 'Food Court K-12',
    sector: 'Sector-88A',
    areaSqFt: 310,
    floor: '3rd Floor Food Court',
    price: '₹42,00,000',
    status: 'APPROVED',
    category: 'Commercial Shop',
    tenancy: 'Pre-leased @ ₹140/sq.ft · 9.1% Yield',
    submitterName: 'Deepak Singhania',
    submitterRole: 'Property Owner',
    submittedAt: 'Yesterday',
    verifiedOwner: true,
  },
  {
    id: 'mod-8',
    project: 'Adani Galleria',
    unit: 'GF-18',
    sector: 'Sector-89A',
    areaSqFt: 720,
    floor: 'Ground Floor (GF)',
    price: '₹1,15,00,000',
    status: 'FLAGGED',
    category: 'Commercial Shop',
    tenancy: 'Unverified ownership deed document',
    submitterName: 'Unknown Broker',
    submitterRole: 'Broker Agent',
    submittedAt: '2 days ago',
    verifiedOwner: false,
  },
];

export default function ListingModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>(INITIAL_MODERATION_ITEMS);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'FLAGGED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApprove = (id: string, projectName: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' as const } : item))
    );
    showToast(`✅ "${projectName}" listing APPROVED and published live on Seeker Marketplace!`);
  };

  const handleReject = (id: string, projectName: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'REJECTED' as const } : item))
    );
    showToast(`❌ "${projectName}" listing REJECTED. Submitter notified.`);
  };

  const handleFlag = (id: string, projectName: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'FLAGGED' as const } : item))
    );
    showToast(`⚠️ "${projectName}" listing FLAGGED for compliance investigation.`);
  };

  const filteredItems = items.filter((item) => {
    if (activeTab !== 'ALL' && item.status !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.project.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q) ||
        item.submitterName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const approvedCount = items.filter((i) => i.status === 'APPROVED').length;
  const flaggedCount = items.filter((i) => i.status === 'FLAGGED').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-purple-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
            <CheckSquare size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Listing Moderation Queue</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {pendingCount} Pending Review
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Review, approve, or reject user-submitted commercial and residential listings before marketplace publishing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Listing queue re-synchronized with live catalog')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition-all"
          >
            <RefreshCw size={13} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-900/90 p-4 rounded-2xl border border-gray-800 shadow-lg">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'PENDING'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'APPROVED'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab('FLAGGED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'FLAGGED'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Flagged ({flaggedCount})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ALL'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({items.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project, unit, sector, submitter..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
          />
        </div>
      </div>

      {/* Moderation Items Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
                <th className="py-3.5 px-4">Property / Project</th>
                <th className="py-3.5 px-4">Sector & Specs</th>
                <th className="py-3.5 px-4">Price & Yield</th>
                <th className="py-3.5 px-4">Submitter</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No listings match the selected moderation filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                    {/* Property / Project */}
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                          <Building size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{item.project}</span>
                            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300 font-mono">
                              {item.unit}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{item.tenancy}</p>
                          <span className="inline-block mt-1 text-[10px] font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Sector & Specs */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-gray-300 font-semibold">
                          <MapPin size={12} className="text-purple-400" />
                          <span>{item.sector}</span>
                        </div>
                        <p className="text-gray-400">{item.areaSqFt} sq.ft carpet</p>
                        <p className="text-[11px] text-gray-500">{item.floor}</p>
                      </div>
                    </td>

                    {/* Price & Yield */}
                    <td className="py-4 px-4">
                      <div>
                        <span className="font-extrabold text-white text-sm tracking-tight">{item.price}</span>
                        <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                          Prevailing yield ~8.2% ROI
                        </p>
                      </div>
                    </td>

                    {/* Submitter */}
                    <td className="py-4 px-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-200">{item.submitterName}</span>
                          {item.verifiedOwner && (
                            <span title="Verified ID">
                              <ShieldCheck size={13} className="text-emerald-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800">
                          {item.submitterRole}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-1">{item.submittedAt}</p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {item.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock size={11} />
                          Pending Review
                        </span>
                      )}
                      {item.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={11} />
                          Live on Portal
                        </span>
                      )}
                      {item.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                          <XCircle size={11} />
                          Rejected
                        </span>
                      )}
                      {item.status === 'FLAGGED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
                          <AlertTriangle size={11} />
                          Compliance Flag
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(item.id, item.project)}
                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/40 text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            title="Approve and Publish to Seeker Portal"
                          >
                            <CheckCircle2 size={13} />
                            <span>Approve</span>
                          </button>
                        )}
                        {item.status !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleReject(item.id, item.project)}
                            className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg border border-red-500/40 text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            title="Reject listing"
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        )}
                        {item.status !== 'FLAGGED' && (
                          <button
                            type="button"
                            onClick={() => handleFlag(item.id, item.project)}
                            className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Flag for abuse"
                          >
                            <AlertTriangle size={14} />
                          </button>
                        )}
                      </div>
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
