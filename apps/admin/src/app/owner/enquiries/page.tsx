'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Phone,
  Building,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface InboundEnquiry {
  id: string;
  buyerName: string;
  phone: string;
  email: string;
  property: string;
  sector: string;
  inquiryType: 'BUY' | 'RENT';
  budget: string;
  notes: string;
  receivedAt: string;
  status: 'NEW' | 'CONTACTED' | 'VISIT_PLANNED';
}

const INBOUND_ENQUIRIES: InboundEnquiry[] = [
  {
    id: 'enq-1',
    buyerName: 'Vikram Malhotra',
    phone: '+91 98109 87654',
    email: 'vikram.seeker@brokeriq.in',
    property: 'SS Omnia - Shop G80',
    sector: 'Sector-86',
    inquiryType: 'BUY',
    budget: '₹75,00,000',
    notes: 'Interested in purchasing for ready electronics franchise. When can we meet for site visit?',
    receivedAt: '25 mins ago',
    status: 'NEW',
  },
  {
    id: 'enq-2',
    buyerName: 'Dr. Arvinder Sethi',
    phone: '+91 98222 11990',
    email: 'dr.sethi@clinic.in',
    property: 'SS Highpoint - Shop No-52',
    sector: 'Sector-86',
    inquiryType: 'RENT',
    budget: '₹55,000/mo',
    notes: 'Looking for pre-leased commercial property with steady rental ROI. Please share lease deed copy.',
    receivedAt: '2 hours ago',
    status: 'NEW',
  },
  {
    id: 'enq-3',
    buyerName: 'Neeraj Mehra',
    phone: '+91 98333 44112',
    email: 'neeraj.mehra@fnbbrands.com',
    property: 'AIPL Joy District - Food Court K-12',
    sector: 'Sector-88A',
    inquiryType: 'BUY',
    budget: '₹42,00,000',
    notes: 'Looking for kiosk / food court pre-leased asset. Please confirm current monthly payout.',
    receivedAt: 'Yesterday',
    status: 'CONTACTED',
  },
];

export default function OwnerEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<InboundEnquiry[]>(INBOUND_ENQUIRIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const markContacted = (id: string, name: string) => {
    setEnquiries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'CONTACTED' as const } : e))
    );
    showToast(`Lead for ${name} marked as contacted.`);
  };

  const filteredEnquiries = enquiries.filter(
    (e) =>
      e.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.property.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Inbound Buyer & Tenant Enquiries</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Direct inquiries from property seekers and retail investors looking to buy or lease your commercial units.
            </p>
          </div>
        </div>
      </div>

      {/* Enquiries Feed */}
      <div className="space-y-4">
        {filteredEnquiries.map((enq) => (
          <div
            key={enq.id}
            className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-sky-500/40 transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-white text-sm">{enq.buyerName}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    enq.status === 'NEW'
                      ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                      : 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  }`}
                >
                  {enq.status}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">({enq.receivedAt})</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-300 font-semibold mt-1.5">
                <span className="text-sky-400 flex items-center gap-1">
                  <Building size={13} /> {enq.property}
                </span>
                <span>• Budget: {enq.budget}</span>
              </div>

              <p className="text-xs text-gray-400 mt-2 max-w-2xl bg-gray-950/60 p-2.5 rounded-xl border border-gray-800/80">
                "{enq.notes}"
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
              <a
                href={`tel:${enq.phone}`}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-sky-600 text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Phone size={13} />
                <span>Call Buyer</span>
              </a>

              <a
                href={`https://wa.me/${enq.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${enq.buyerName}, Deepak Singhania here regarding your inquiry for ${enq.property}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <MessageSquare size={13} />
                <span>WhatsApp</span>
              </a>

              {enq.status === 'NEW' && (
                <button
                  type="button"
                  onClick={() => markContacted(enq.id, enq.buyerName)}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Mark Contacted
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
