'use client';

import React, { useState } from 'react';
import {
  Kanban,
  Search,
  Filter,
  Users,
  Building,
  Phone,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface PipelineLead {
  id: string;
  name: string;
  phone: string;
  propertyInquired: string;
  sector: string;
  budget: string;
  assignedAgent: string;
  stage: 'NEW' | 'CONTACTED' | 'SITE_VISIT' | 'NEGOTIATION' | 'WON';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM';
  daysInStage: number;
}

const INITIAL_PIPELINE_LEADS: PipelineLead[] = [
  {
    id: 'lead-101',
    name: 'Rohit Agrawal',
    phone: '+91 98111 55667',
    propertyInquired: 'SS Omnia - Shop G80',
    sector: 'Sector-86',
    budget: '₹75,00,000',
    assignedAgent: 'Amit Verma',
    stage: 'NEW',
    priority: 'URGENT',
    daysInStage: 1,
  },
  {
    id: 'lead-102',
    name: 'Sameer Bansal',
    phone: '+91 98222 66778',
    propertyInquired: 'SS Highpoint - Shop No-52',
    sector: 'Sector-86',
    budget: '₹55,000/mo',
    assignedAgent: 'Saurabh Mehta',
    stage: 'NEW',
    priority: 'HIGH',
    daysInStage: 2,
  },
  {
    id: 'lead-103',
    name: 'Kavita Chawla',
    phone: '+91 98333 77889',
    propertyInquired: 'Signature Signum-88A SCO',
    sector: 'Sector-88A',
    budget: '₹1,45,00,000',
    assignedAgent: 'Rohan Deshmukh',
    stage: 'CONTACTED',
    priority: 'HIGH',
    daysInStage: 3,
  },
  {
    id: 'lead-104',
    name: 'Manish Tiwari',
    phone: '+91 98444 88990',
    propertyInquired: 'Orris Market 89 - A-515',
    sector: 'Sector-89',
    budget: '₹38,00,000',
    assignedAgent: 'Priya Nair',
    stage: 'SITE_VISIT',
    priority: 'HIGH',
    daysInStage: 4,
  },
  {
    id: 'lead-105',
    name: 'Dr. Sanjay Gupta',
    phone: '+91 98555 99001',
    propertyInquired: 'Sapphire Ninety - SF-12',
    sector: 'Sector-90',
    budget: '₹62,000/mo',
    assignedAgent: 'Vikram Das',
    stage: 'NEGOTIATION',
    priority: 'URGENT',
    daysInStage: 6,
  },
  {
    id: 'lead-106',
    name: 'Tarun Saxena',
    phone: '+91 98666 11223',
    propertyInquired: 'DLF Regal Garden - 3BHK',
    sector: 'Sector-90',
    budget: '₹1,85,00,000',
    assignedAgent: 'Neha Sharma',
    stage: 'WON',
    priority: 'MEDIUM',
    daysInStage: 12,
  },
];

const STAGES = [
  { key: 'NEW', label: 'New Leads', color: 'border-blue-500/40' },
  { key: 'CONTACTED', label: 'Contacted', color: 'border-amber-500/40' },
  { key: 'SITE_VISIT', label: 'Site Visit', color: 'border-purple-500/40' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'border-teal-500/40' },
  { key: 'WON', label: 'Closed Won', color: 'border-emerald-500/40' },
];

export default function AgencyPipelinePage() {
  const [leads, setLeads] = useState<PipelineLead[]>(INITIAL_PIPELINE_LEADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const advanceStage = (id: string, currentStage: PipelineLead['stage']) => {
    const stageFlow: PipelineLead['stage'][] = ['NEW', 'CONTACTED', 'SITE_VISIT', 'NEGOTIATION', 'WON'];
    const currentIndex = stageFlow.indexOf(currentStage);
    if (currentIndex < stageFlow.length - 1) {
      const nextStage = stageFlow[currentIndex + 1];
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, stage: nextStage, daysInStage: 0 } : l))
      );
      showToast(`Lead stage advanced to "${nextStage}". Pipeline updated.`);
    }
  };

  const reassignAgent = (id: string, newAgent: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, assignedAgent: newAgent } : l))
    );
    showToast(`Lead reassigned to "${newAgent}". Notifications sent.`);
  };

  const filteredLeads = leads.filter((l) => {
    if (agentFilter !== 'ALL' && l.assignedAgent !== agentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.propertyInquired.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-amber-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Kanban size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Agency-Wide CRM Pipeline</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ₹14.2 Cr Pipeline Volume
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Live Kanban tracking of all client deals across Amit Verma, Priya Nair, Rohan Deshmukh, and team.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-900/90 p-4 rounded-2xl border border-gray-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead, property, sector..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
          <span className="text-gray-400">Filter by Broker:</span>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none"
          >
            <option value="ALL">All Agents (Agency Wide)</option>
            <option value="Amit Verma">Amit Verma</option>
            <option value="Priya Nair">Priya Nair</option>
            <option value="Rohan Deshmukh">Rohan Deshmukh</option>
            <option value="Saurabh Mehta">Saurabh Mehta</option>
            <option value="Vikram Das">Vikram Das</option>
            <option value="Neha Sharma">Neha Sharma</option>
          </select>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STAGES.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.stage === col.key);

          return (
            <div
              key={col.key}
              className="bg-gray-900/70 border border-gray-800/80 rounded-2xl p-3 flex flex-col min-h-[500px]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
                <span className="text-xs font-bold text-gray-200">{col.label}</span>
                <span className="text-[11px] font-bold text-gray-400 bg-gray-950 px-2 py-0.5 rounded-full border border-gray-800">
                  {colLeads.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3.5 rounded-xl bg-gray-950/90 border border-gray-800/90 shadow-sm hover:border-amber-500/40 transition-all text-xs space-y-2 group"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-white text-xs">{lead.name}</span>
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

                    <p className="text-[11px] text-gray-300 font-medium">{lead.propertyInquired}</p>

                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>{lead.sector}</span>
                      <span className="font-bold text-white">{lead.budget}</span>
                    </div>

                    {/* Agent Assigner Dropdown */}
                    <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Agent:</span>
                      <select
                        value={lead.assignedAgent}
                        onChange={(e) => reassignAgent(lead.id, e.target.value)}
                        className="bg-transparent text-amber-400 font-semibold focus:outline-none cursor-pointer text-right"
                      >
                        <option value="Amit Verma" className="bg-gray-900">Amit Verma</option>
                        <option value="Priya Nair" className="bg-gray-900">Priya Nair</option>
                        <option value="Rohan Deshmukh" className="bg-gray-900">Rohan Deshmukh</option>
                        <option value="Saurabh Mehta" className="bg-gray-900">Saurabh Mehta</option>
                        <option value="Vikram Das" className="bg-gray-900">Vikram Das</option>
                        <option value="Neha Sharma" className="bg-gray-900">Neha Sharma</option>
                      </select>
                    </div>

                    {/* Stage Advance Action */}
                    {lead.stage !== 'WON' && (
                      <button
                        type="button"
                        onClick={() => advanceStage(lead.id, lead.stage)}
                        className="w-full mt-1 py-1.5 rounded-lg bg-gray-800 hover:bg-amber-600 text-gray-300 hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <span>Advance Stage</span>
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
