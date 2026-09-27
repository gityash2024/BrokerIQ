'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Phone,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Building,
} from 'lucide-react';

interface AgentLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  property: string;
  sector: string;
  budget: string;
  stage: 'NEW' | 'CONTACTED' | 'SITE_VISIT' | 'NEGOTIATION' | 'WON';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM';
  lastInteraction: string;
}

const INITIAL_AGENT_LEADS: AgentLead[] = [
  {
    id: 'ld-1',
    name: 'Rohit Agrawal',
    phone: '+91 98111 55667',
    email: 'rohit.agrawal@gmail.com',
    property: 'SS Omnia - Shop G80',
    sector: 'Sector-86',
    budget: '₹75,00,000',
    stage: 'NEW',
    priority: 'URGENT',
    lastInteraction: '10 mins ago',
  },
  {
    id: 'ld-2',
    name: 'Sameer Bansal',
    phone: '+91 98222 66778',
    email: 'sameer.bansal@techcorp.in',
    property: 'SS Highpoint - Shop No-52',
    sector: 'Sector-86',
    budget: '₹55,000/mo',
    stage: 'CONTACTED',
    priority: 'HIGH',
    lastInteraction: '2 hours ago',
  },
  {
    id: 'ld-3',
    name: 'Kavita Chawla',
    phone: '+91 98333 77889',
    email: 'kavita.chawla@yahoo.com',
    property: 'Signature Signum-88A SCO',
    sector: 'Sector-88A',
    budget: '₹1,45,00,000',
    stage: 'SITE_VISIT',
    priority: 'HIGH',
    lastInteraction: 'Yesterday',
  },
  {
    id: 'ld-4',
    name: 'Manish Tiwari',
    phone: '+91 98444 88990',
    email: 'manish.tiwari@retailchain.com',
    property: 'Orris Market 89 - A-515',
    sector: 'Sector-89',
    budget: '₹38,00,000',
    stage: 'NEGOTIATION',
    priority: 'URGENT',
    lastInteraction: '2 days ago',
  },
  {
    id: 'ld-5',
    name: 'Sunil Bhatia',
    phone: '+91 98555 12345',
    email: 'sunil.bhatia@gmail.com',
    property: 'DLF Regal Garden - 3BHK',
    sector: 'Sector-90',
    budget: '₹1,85,00,000',
    stage: 'WON',
    priority: 'MEDIUM',
    lastInteraction: 'Last week',
  },
];

export default function AgentLeadsPage() {
  const [leads, setLeads] = useState<AgentLead[]>(INITIAL_AGENT_LEADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const advanceStage = (id: string, currentStage: AgentLead['stage']) => {
    const order: AgentLead['stage'][] = ['NEW', 'CONTACTED', 'SITE_VISIT', 'NEGOTIATION', 'WON'];
    const idx = order.indexOf(currentStage);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, stage: next, lastInteraction: 'Just now' } : l))
      );
      showToast(`Lead stage advanced to "${next}".`);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (stageFilter !== 'ALL' && l.stage !== stageFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.property.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q) ||
        l.phone.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-teal-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">My Assigned Field Leads</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Personal client pipeline with direct 1-tap WhatsApp and phone calling shortcuts.
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead by name, property, phone..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
          <span className="text-gray-400">Stage:</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none"
          >
            <option value="ALL">All Stages</option>
            <option value="NEW">New Leads</option>
            <option value="CONTACTED">Contacted</option>
            <option value="SITE_VISIT">Site Visit Scheduled</option>
            <option value="NEGOTIATION">Negotiation</option>
            <option value="WON">Closed Won</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
              <th className="py-3.5 px-4">Client Name & Priority</th>
              <th className="py-3.5 px-4">Property Inquired</th>
              <th className="py-3.5 px-4">Budget</th>
              <th className="py-3.5 px-4">Stage</th>
              <th className="py-3.5 px-4">Direct Outreach</th>
              <th className="py-3.5 px-4 text-right">Stage Advance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{lead.name}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        lead.priority === 'URGENT'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {lead.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{lead.phone}</p>
                </td>
                <td className="py-4 px-4">
                  <p className="font-semibold text-gray-200">{lead.property}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPin size={11} className="text-teal-400" /> {lead.sector}
                  </p>
                </td>
                <td className="py-4 px-4 font-bold text-white text-sm">{lead.budget}</td>
                <td className="py-4 px-4">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                    {lead.stage}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${lead.phone}`}
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-teal-600 text-gray-300 hover:text-white transition-colors"
                      title="Direct Phone Call"
                    >
                      <Phone size={14} />
                    </a>
                    <a
                      href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `Hi ${lead.name}, Amit Verma here regarding ${lead.property}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-800 transition-colors"
                      title="WhatsApp Inquiry"
                    >
                      <MessageSquare size={14} />
                    </a>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  {lead.stage !== 'WON' ? (
                    <button
                      type="button"
                      onClick={() => advanceStage(lead.id, lead.stage)}
                      className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-lg border border-teal-500/40 text-[11px] font-bold transition-all inline-flex items-center gap-1"
                    >
                      <span>Next Stage</span>
                      <ArrowRight size={12} />
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold text-xs flex items-center justify-end gap-1">
                      <CheckCircle2 size={13} /> Won
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
