'use client';

import React, { useState } from 'react';
import {
  BadgeCheck,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck,
  Clock,
  Eye,
  Download,
  AlertCircle,
  Building,
} from 'lucide-react';

interface KYCApplicant {
  id: string;
  name: string;
  role: 'Property Owner' | 'Broker Agent' | 'Agency Manager';
  phone: string;
  email: string;
  panNumber: string;
  aadhaarNumber: string;
  reraReg?: string;
  propertyCount: number;
  documents: {
    name: string;
    type: 'AADHAAR' | 'PAN' | 'DEED' | 'RERA';
    verified: boolean;
  }[];
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  submittedAt: string;
}

const INITIAL_KYC_APPLICANTS: KYCApplicant[] = [
  {
    id: 'kyc-1',
    name: 'Deepak Singhania',
    role: 'Property Owner',
    phone: '+91 98992 48292',
    email: 'deepak.owner@brokeriq.in',
    panNumber: 'AAAPS4921K',
    aadhaarNumber: 'XXXX-XXXX-4921',
    propertyCount: 3,
    documents: [
      { name: 'Aadhaar_Card_Deepak.pdf', type: 'AADHAAR', verified: true },
      { name: 'PAN_Card_Deepak.pdf', type: 'PAN', verified: true },
      { name: 'Registry_SS_Omnia_G80.pdf', type: 'DEED', verified: true },
    ],
    status: 'PENDING',
    submittedAt: 'Today, 11:30 AM',
  },
  {
    id: 'kyc-2',
    name: 'Rajesh Sharma',
    role: 'Agency Manager',
    phone: '+91 98101 23456',
    email: 'rajesh.sharma@founder-realty.in',
    panNumber: 'BKGPS8210M',
    aadhaarNumber: 'XXXX-XXXX-8210',
    reraReg: 'HRERA-PKL-GGM-1294-2023',
    propertyCount: 14,
    documents: [
      { name: 'HRERA_Broker_License.pdf', type: 'RERA', verified: true },
      { name: 'Company_PAN_FounderRealty.pdf', type: 'PAN', verified: true },
      { name: 'Aadhaar_Rajesh.pdf', type: 'AADHAAR', verified: true },
    ],
    status: 'PENDING',
    submittedAt: 'Today, 09:15 AM',
  },
  {
    id: 'kyc-3',
    name: 'Ashwani Goyal',
    role: 'Property Owner',
    phone: '+91 62602 45484',
    email: 'ashwani.goyal@gmail.com',
    panNumber: 'CHRPG3918B',
    aadhaarNumber: 'XXXX-XXXX-3918',
    propertyCount: 2,
    documents: [
      { name: 'Aadhaar_Ashwani.pdf', type: 'AADHAAR', verified: true },
      { name: 'PAN_Card.pdf', type: 'PAN', verified: true },
      { name: 'Allotment_Signum88A_SCO309.pdf', type: 'DEED', verified: true },
    ],
    status: 'PENDING',
    submittedAt: 'Yesterday',
  },
  {
    id: 'kyc-4',
    name: 'Vineet Kumar',
    role: 'Property Owner',
    phone: '+91 99113 89167',
    email: 'vineet.kumar@outlook.com',
    panNumber: 'DJRPK7281Q',
    aadhaarNumber: 'XXXX-XXXX-7281',
    propertyCount: 1,
    documents: [
      { name: 'Aadhaar_Card.pdf', type: 'AADHAAR', verified: true },
      { name: 'PAN_Document.pdf', type: 'PAN', verified: false },
      { name: 'Orris_Market89_Agreement.pdf', type: 'DEED', verified: true },
    ],
    status: 'PENDING',
    submittedAt: 'Yesterday',
  },
  {
    id: 'kyc-5',
    name: 'Amit Verma',
    role: 'Broker Agent',
    phone: '+91 98712 34567',
    email: 'amit.verma@founder-realty.in',
    panNumber: 'ELRPV5021J',
    aadhaarNumber: 'XXXX-XXXX-5021',
    reraReg: 'HRERA-AGT-9021',
    propertyCount: 8,
    documents: [
      { name: 'Aadhaar_Amit.pdf', type: 'AADHAAR', verified: true },
      { name: 'RERA_Agent_Card.pdf', type: 'RERA', verified: true },
    ],
    status: 'VERIFIED',
    submittedAt: '3 days ago',
  },
];

export default function SellerKYCPage() {
  const [applicants, setApplicants] = useState<KYCApplicant[]>(INITIAL_KYC_APPLICANTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleGrantBadge = (id: string, name: string) => {
    setApplicants((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: 'VERIFIED' as const } : app))
    );
    showToast(`✅ Verified Seller Badge granted to "${name}". Badge activated on marketplace!`);
  };

  const handleRejectKYC = (id: string, name: string) => {
    setApplicants((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: 'REJECTED' as const } : app))
    );
    showToast(`❌ KYC rejected for "${name}". Re-upload requested.`);
  };

  const filteredApplicants = applicants.filter((app) => {
    if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q) ||
        app.phone.includes(q) ||
        app.panNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = applicants.filter((a) => a.status === 'PENDING').length;
  const verifiedCount = applicants.filter((a) => a.status === 'VERIFIED').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-teal-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <BadgeCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Seller & Broker KYC Verification</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                {pendingCount} Pending Badges
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Review government IDs, PAN records, and title deeds to grant green "Verified Owner" trust badges.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-900/90 p-4 rounded-2xl border border-gray-800 shadow-lg">
        <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'PENDING' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('VERIFIED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'VERIFIED' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ALL' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            All Applicants ({applicants.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by seller name, PAN, phone..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      </div>

      {/* KYC Applicants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredApplicants.map((app) => (
          <div
            key={app.id}
            className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl hover:border-teal-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Applicant Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-sm">
                    {app.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{app.name}</span>
                      <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                        {app.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {app.phone} · {app.email}
                    </p>
                  </div>
                </div>

                <div>
                  {app.status === 'VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck size={13} />
                      Verified Badge Active
                    </span>
                  ) : app.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Clock size={13} />
                      Pending Approval
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                      <XCircle size={13} />
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* ID & Tax Info */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-gray-950/80 border border-gray-800 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">PAN Number</span>
                  <span className="font-mono text-gray-200 font-bold">{app.panNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">Aadhaar (Masked)</span>
                  <span className="font-mono text-gray-200 font-bold">{app.aadhaarNumber}</span>
                </div>
                {app.reraReg && (
                  <div className="col-span-2 pt-1 border-t border-gray-800">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold block">RERA License</span>
                    <span className="font-mono text-teal-400 font-semibold">{app.reraReg}</span>
                  </div>
                )}
              </div>

              {/* Attached Documents List */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Uploaded Verification Documents ({app.documents.length})
                </span>
                {app.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-950/60 border border-gray-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-teal-400 shrink-0" />
                      <span className="text-gray-300 truncate font-mono text-[11px]">{doc.name}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 shrink-0">
                      Legible · OCR Passed
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Submitted {app.submittedAt}</span>

              <div className="flex items-center gap-2">
                {app.status !== 'REJECTED' && (
                  <button
                    type="button"
                    onClick={() => handleRejectKYC(app.id, app.name)}
                    className="px-3 py-1.5 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-950/40 text-xs font-semibold transition-all"
                  >
                    Reject
                  </button>
                )}
                {app.status !== 'VERIFIED' && (
                  <button
                    type="button"
                    onClick={() => handleGrantBadge(app.id, app.name)}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-900/30 flex items-center gap-1.5"
                  >
                    <ShieldCheck size={14} />
                    <span>Grant Verified Badge</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
