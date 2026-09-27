'use client';

import React, { useState } from 'react';
import {
  Building,
  Search,
  Filter,
  MapPin,
  Share2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface AgencyProperty {
  id: string;
  project: string;
  unit: string;
  sector: string;
  areaSqFt: number;
  floor: string;
  price: string;
  category: 'Commercial Retail' | 'SCO Plot' | 'Pre-Leased Rented' | 'Residential Luxury';
  tenancy: string;
  assignedAgent: string;
  status: 'AVAILABLE' | 'UNDER_OFFER' | 'RENTED';
}

const AGENCY_CATALOG: AgencyProperty[] = [
  {
    id: 'prop-1',
    project: 'SS Omnia',
    unit: 'Shop G80',
    sector: 'Sector-86',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    price: '₹75,00,000',
    category: 'Commercial Retail',
    tenancy: 'Ready Shop · High Footfall Commercial Corridor',
    assignedAgent: 'Amit Verma',
    status: 'AVAILABLE',
  },
  {
    id: 'prop-2',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    sector: 'Sector-86',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    price: '₹55,000/mo',
    category: 'Pre-Leased Rented',
    tenancy: 'Rented @ ₹100/sq.ft to Vishal Mega Mart (9-yr lease)',
    assignedAgent: 'Saurabh Mehta',
    status: 'RENTED',
  },
  {
    id: 'prop-3',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    sector: 'Sector-88A',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor',
    price: '₹1,45,00,000',
    category: 'SCO Plot',
    tenancy: 'Commercial SCO Plot · Approved for F&B / Gym',
    assignedAgent: 'Rohan Deshmukh',
    status: 'AVAILABLE',
  },
  {
    id: 'prop-4',
    project: 'Orris Market 89',
    unit: 'A-515',
    sector: 'Sector-89',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    price: '₹38,00,000',
    category: 'Commercial Retail',
    tenancy: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    assignedAgent: 'Priya Nair',
    status: 'UNDER_OFFER',
  },
  {
    id: 'prop-5',
    project: 'Sapphire Ninety',
    unit: 'SF-12',
    sector: 'Sector-90',
    areaSqFt: 620,
    floor: 'Second Floor (SF)',
    price: '₹62,000/mo',
    category: 'Pre-Leased Rented',
    tenancy: 'Rented to Corporate Bank ATM & Branch',
    assignedAgent: 'Vikram Das',
    status: 'RENTED',
  },
  {
    id: 'prop-6',
    project: 'DLF Regal Garden',
    unit: 'Tower 4 - 1402',
    sector: 'Sector-90',
    areaSqFt: 1750,
    floor: '14th Floor',
    price: '₹1,85,00,000',
    category: 'Residential Luxury',
    tenancy: 'Ready to Move · 3BHK + Servants Quarter',
    assignedAgent: 'Neha Sharma',
    status: 'AVAILABLE',
  },
];

export default function AgencyInventoryPage() {
  const [properties, setProperties] = useState<AgencyProperty[]>(AGENCY_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShareBrochure = (projectName: string, unit: string) => {
    showToast(`Brochure link for ${projectName} (${unit}) copied to clipboard!`);
  };

  const filteredProperties = properties.filter((p) => {
    if (sectorFilter !== 'ALL' && p.sector !== sectorFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.project.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        p.sector.toLowerCase().includes(q) ||
        p.assignedAgent.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-amber-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Building size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Agency Shared Property Catalog</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              54 Commercial & luxury units from the Gurgaon register available for team pitch and client allocation.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project, unit, broker..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
          <span className="text-gray-400">Sector:</span>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none"
          >
            <option value="ALL">All Sectors (Gurgaon)</option>
            <option value="Sector-86">Sector-86</option>
            <option value="Sector-88A">Sector-88A</option>
            <option value="Sector-89">Sector-89</option>
            <option value="Sector-90">Sector-90</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
              <th className="py-3.5 px-4">Project / Complex</th>
              <th className="py-3.5 px-4">Sector & Carpet</th>
              <th className="py-3.5 px-4">Price / Rent</th>
              <th className="py-3.5 px-4">Tenancy Status</th>
              <th className="py-3.5 px-4">Assigned Broker</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredProperties.map((p) => (
              <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      <Building size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">{p.project}</span>
                        <span className="text-[10px] text-gray-300 font-mono px-1.5 py-0.2 rounded bg-gray-800">
                          {p.unit}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-400">{p.category}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <p className="text-gray-300 font-semibold">{p.sector}</p>
                  <p className="text-gray-500 text-[11px]">{p.areaSqFt} sq.ft · {p.floor}</p>
                </td>
                <td className="py-4 px-4">
                  <span className="font-bold text-white text-sm">{p.price}</span>
                </td>
                <td className="py-4 px-4 text-gray-300">
                  <p className="line-clamp-2 max-w-xs text-[11px]">{p.tenancy}</p>
                </td>
                <td className="py-4 px-4">
                  <span className="font-semibold text-amber-300">{p.assignedAgent}</span>
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === 'AVAILABLE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : p.status === 'RENTED'
                        ? 'bg-blue-950 text-blue-400 border border-blue-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => handleShareBrochure(p.project, p.unit)}
                    className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Share Property Brochure"
                  >
                    <Share2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
