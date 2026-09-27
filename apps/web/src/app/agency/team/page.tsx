'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  MoreVertical,
  ShieldCheck,
  CheckCircle2,
  X,
  CreditCard,
} from 'lucide-react';

interface AgentMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  specialization: string;
  activeLeads: number;
  closedDeals: number;
  revenueGenerated: string;
  status: 'ACTIVE' | 'ON_LEAVE';
  avatar: string;
}

const INITIAL_TEAM: AgentMember[] = [
  {
    id: 'agent-1',
    name: 'Amit Verma',
    email: 'amit.verma@founder-realty.in',
    phone: '+91 98712 34567',
    role: 'Senior Field Negotiator',
    specialization: 'Sector-86 & Sector-88A Commercial',
    activeLeads: 24,
    closedDeals: 4,
    revenueGenerated: '₹14,50,000',
    status: 'ACTIVE',
    avatar: 'AV',
  },
  {
    id: 'agent-2',
    name: 'Priya Nair',
    email: 'priya.nair@founder-realty.in',
    phone: '+91 98111 22334',
    role: 'Senior Commercial Consultant',
    specialization: 'Sector-89 & Sector-90 Retail',
    activeLeads: 19,
    closedDeals: 3,
    revenueGenerated: '₹11,20,000',
    status: 'ACTIVE',
    avatar: 'PN',
  },
  {
    id: 'agent-3',
    name: 'Rohan Deshmukh',
    email: 'rohan.deshmukh@founder-realty.in',
    phone: '+91 98222 33445',
    role: 'SCO Commercial Specialist',
    specialization: 'Signature Signum & SCO Plots',
    activeLeads: 21,
    closedDeals: 3,
    revenueGenerated: '₹9,80,000',
    status: 'ACTIVE',
    avatar: 'RD',
  },
  {
    id: 'agent-4',
    name: 'Saurabh Mehta',
    email: 'saurabh.mehta@founder-realty.in',
    phone: '+91 98333 44556',
    role: 'Retail Leasing Executive',
    specialization: 'SS Omnia & SS Highpoint',
    activeLeads: 15,
    closedDeals: 2,
    revenueGenerated: '₹7,30,000',
    status: 'ACTIVE',
    avatar: 'SM',
  },
  {
    id: 'agent-5',
    name: 'Ananya Gupta',
    email: 'ananya.gupta@founder-realty.in',
    phone: '+91 98444 55667',
    role: 'Dwarka Expressway Specialist',
    specialization: 'Luxury Residences & Penthouses',
    activeLeads: 18,
    closedDeals: 2,
    revenueGenerated: '₹6,50,000',
    status: 'ACTIVE',
    avatar: 'AG',
  },
  {
    id: 'agent-6',
    name: 'Vikram Das',
    email: 'vikram.das@founder-realty.in',
    phone: '+91 98555 66778',
    role: 'Field Broker',
    specialization: 'Orris Market & Sapphire Ninety',
    activeLeads: 12,
    closedDeals: 1,
    revenueGenerated: '₹4,20,000',
    status: 'ACTIVE',
    avatar: 'VD',
  },
  {
    id: 'agent-7',
    name: 'Neha Sharma',
    email: 'neha.sharma@founder-realty.in',
    phone: '+91 98666 77889',
    role: 'Residential Consultant',
    specialization: 'DLF Regal Garden & Sector-90',
    activeLeads: 14,
    closedDeals: 1,
    revenueGenerated: '₹3,80,000',
    status: 'ACTIVE',
    avatar: 'NS',
  },
  {
    id: 'agent-8',
    name: 'Kunal Patel',
    email: 'kunal.patel@founder-realty.in',
    phone: '+91 98777 88990',
    role: 'Junior Associate',
    specialization: 'Sector-88A Retail',
    activeLeads: 10,
    closedDeals: 1,
    revenueGenerated: '₹2,90,000',
    status: 'ACTIVE',
    avatar: 'KP',
  },
];

export default function AgencyTeamPage() {
  const [team, setTeam] = useState<AgentMember[]>(INITIAL_TEAM);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Invite modal form
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('Field Negotiator');
  const [inviteSpecialization, setInviteSpecialization] = useState('Sector-86 Commercial');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    if (team.length >= 10) {
      showToast('❌ Seat limit reached (10/10). Please upgrade plan to add more seats.');
      setShowInviteModal(false);
      return;
    }

    const newAgent: AgentMember = {
      id: `agent-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      phone: invitePhone || '+91 98000 00000',
      role: inviteRole,
      specialization: inviteSpecialization,
      activeLeads: 0,
      closedDeals: 0,
      revenueGenerated: '₹0',
      status: 'ACTIVE',
      avatar: inviteName.slice(0, 2).toUpperCase(),
    };

    setTeam((prev) => [newAgent, ...prev]);
    showToast(`✅ Invitation email sent to "${inviteName}" (${inviteEmail}). Seat allocated!`);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
  };

  const filteredTeam = team.filter((agent) => {
    const q = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(q) ||
      agent.email.toLowerCase().includes(q) ||
      agent.specialization.toLowerCase().includes(q)
    );
  });

  const totalSeats = 10;
  const usedSeats = team.length;

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
            <Users size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Team Agents & Seat Governance</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {usedSeats} of {totalSeats} Seats Utilized
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage agency broker seats, invite new team members, and monitor broker conversion metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-900/30"
          >
            <UserPlus size={14} />
            <span>Invite Agent ({totalSeats - usedSeats} seats left)</span>
          </button>
        </div>
      </div>

      {/* Quota Progress Banner */}
      <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
            {usedSeats}/{totalSeats}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Pro Agency Plan Active</span>
              <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                ₹4,999 / month
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              You are using {usedSeats} of your {totalSeats} included broker agent seats.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="w-40 bg-gray-800 rounded-full h-2 overflow-hidden hidden md:block">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all"
              style={{ width: `${(usedSeats / totalSeats) * 100}%` }}
            />
          </div>
          <button
            onClick={() => showToast('Redirecting to subscription seat addon checkout...')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold border border-gray-700 transition-all shrink-0"
          >
            + Add Extra Seats
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agent by name, email, specialization..."
            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>
        <span className="text-xs text-gray-400 font-medium">
          Showing {filteredTeam.length} Active Agents
        </span>
      </div>

      {/* Agents Roster Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
                <th className="py-3.5 px-4">Agent Name</th>
                <th className="py-3.5 px-4">Role & Specialization</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Active Leads</th>
                <th className="py-3.5 px-4">Closed Deals / Revenue</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTeam.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs">
                        {agent.avatar}
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm block">{agent.name}</span>
                        <span className="text-[10px] text-gray-500">ID: {agent.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-semibold text-gray-200">{agent.role}</p>
                      <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {agent.specialization}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-0.5 text-gray-300">
                      <p className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone size={11} className="text-gray-500" /> {agent.phone}
                      </p>
                      <p className="flex items-center gap-1.5 text-gray-400">
                        <Mail size={11} className="text-gray-500" /> {agent.email}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-white text-sm">{agent.activeLeads}</span>
                    <span className="text-gray-500 text-[11px] block">Pipeline Leads</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-emerald-400 text-sm block">{agent.revenueGenerated}</span>
                    <span className="text-gray-400 text-[11px]">{agent.closedDeals} Deals Closed</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => showToast(`Lead re-allocation initiated for ${agent.name}`)}
                      className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-semibold transition-all"
                    >
                      Assign Leads
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Agent Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-amber-400" />
                <h3 className="font-bold text-white text-base">Invite Agent to Agency</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Tarun Mehra"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="tarun@founder-realty.in"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+91 98123 45678"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Role Title</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="Field Negotiator">Field Negotiator</option>
                  <option value="Senior Commercial Consultant">Senior Commercial Consultant</option>
                  <option value="Retail Leasing Specialist">Retail Leasing Specialist</option>
                  <option value="SCO Commercial Associate">SCO Commercial Associate</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Primary Sector Specialization</label>
                <select
                  value={inviteSpecialization}
                  onChange={(e) => setInviteSpecialization(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="Sector-86 Commercial">Sector-86 Commercial (SS Omnia / Highpoint)</option>
                  <option value="Sector-88A Retail & SCO">Sector-88A Retail & SCO (Signature Signum)</option>
                  <option value="Sector-89 & 89A High-Street">Sector-89 & 89A High-Street (Orris Market)</option>
                  <option value="Sector-90 Mixed Use">Sector-90 Mixed Use (Sapphire / DLF)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 rounded-xl text-gray-400 hover:text-white bg-gray-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-900/30"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
