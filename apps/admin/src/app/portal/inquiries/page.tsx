'use client';

import React from 'react';
import {
  MessageSquare,
  Building,
  Phone,
  Clock,
  CheckCircle2,
  CalendarCheck,
  MapPin,
} from 'lucide-react';

interface ContactedInquiry {
  id: string;
  sellerName: string;
  sellerRole: string;
  sellerPhone: string;
  property: string;
  sector: string;
  inquiryDate: string;
  status: 'SITE_VISIT_SCHEDULED' | 'IN_DISCUSSION' | 'PROPOSAL_RECEIVED';
  lastMessage: string;
}

const INQUIRIES_LOG: ContactedInquiry[] = [
  {
    id: 'inq-1',
    sellerName: 'Amit Verma',
    sellerRole: 'Senior Negotiator · Founder Realty',
    sellerPhone: '+91 98712 34567',
    property: 'SS Omnia - Shop G80',
    sector: 'Sector-86',
    inquiryDate: 'Today, 10:15 AM',
    status: 'SITE_VISIT_SCHEDULED',
    lastMessage: 'Site visit confirmed for today 11:00 AM at ground floor atrium.',
  },
  {
    id: 'inq-2',
    sellerName: 'Deepak Singhania',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 98992 48292',
    property: 'SS Highpoint - Shop No-52',
    sector: 'Sector-86',
    inquiryDate: 'Yesterday',
    status: 'IN_DISCUSSION',
    lastMessage: 'Owner sent 9-year pre-lease deed copy with Vishal Mega Mart.',
  },
  {
    id: 'inq-3',
    sellerName: 'Ashwani Goyal',
    sellerRole: 'Verified Owner',
    sellerPhone: '+91 62602 45484',
    property: 'Signature Signum-88A - SCO-309',
    sector: 'Sector-88A',
    inquiryDate: '3 days ago',
    status: 'PROPOSAL_RECEIVED',
    lastMessage: 'Commercial SCO plot with ground + 1st floor construction rights.',
  },
];

export default function SeekerInquiriesPage() {
  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold">
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Contacted Sellers & Inquiries Log</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Record of brokers and owners you have contacted, site visit schedules, and property proposals.
            </p>
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-4">
        {INQUIRIES_LOG.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-rose-500/40 transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-white text-sm">{item.sellerName}</span>
                <span className="text-[10px] text-gray-400 font-medium">({item.sellerRole})</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    item.status === 'SITE_VISIT_SCHEDULED'
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : item.status === 'IN_DISCUSSION'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}
                >
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>

              <p className="text-xs text-rose-400 font-semibold mt-1 flex items-center gap-1">
                <Building size={13} /> {item.property} ({item.sector})
              </p>

              <p className="text-xs text-gray-300 mt-1.5 p-2 rounded-lg bg-gray-950/60 border border-gray-800 max-w-xl">
                "{item.lastMessage}"
              </p>

              <p className="text-[11px] text-gray-500 font-mono mt-1">Initiated: {item.inquiryDate}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <a
                href={`tel:${item.sellerPhone}`}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Phone size={13} />
                <span>Call</span>
              </a>

              <a
                href={`https://wa.me/${item.sellerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${item.sellerName}, following up on our discussion for ${item.property}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <MessageSquare size={13} />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
