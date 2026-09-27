'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  PlusCircle,
  Play,
  CheckCircle2,
  ToggleRight,
  ToggleLeft,
  Users,
  MapPin,
  DollarSign,
  Zap,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface AllocationRule {
  id: string;
  name: string;
  source: string;
  condition: string;
  targetAssignee: string;
  mode: 'ROUND_ROBIN' | 'DIRECT_SPECIALIST' | 'BUDGET_TIER';
  active: boolean;
  leadsRouted: number;
}

const INITIAL_RULES: AllocationRule[] = [
  {
    id: 'rule-1',
    name: 'Sector-86 & 88A Commercial Shops',
    source: 'Housing.com & WhatsApp',
    condition: 'Sector in [86, 88A] & Type == Commercial',
    targetAssignee: 'Amit Verma & Saurabh Mehta',
    mode: 'ROUND_ROBIN',
    active: true,
    leadsRouted: 84,
  },
  {
    id: 'rule-2',
    name: 'High-Value Commercial SCO Plots (>₹1.5 Cr)',
    source: 'All Sources',
    condition: 'Budget >= ₹1,50,00,000 & Property == SCO Plot',
    targetAssignee: 'Rohan Deshmukh',
    mode: 'DIRECT_SPECIALIST',
    active: true,
    leadsRouted: 32,
  },
  {
    id: 'rule-3',
    name: 'Pre-Leased Rented Units (High Yield)',
    source: 'Marketplace Inquiries',
    condition: 'ROI Yield >= 7.5% · Verified Tenancy',
    targetAssignee: 'Priya Nair',
    mode: 'DIRECT_SPECIALIST',
    active: true,
    leadsRouted: 46,
  },
  {
    id: 'rule-4',
    name: 'Luxury Residential & Penthouses',
    source: 'Website & Walk-ins',
    condition: 'Type in [Apartment, Penthouse] & Sector == 90',
    targetAssignee: 'Neha Sharma & Ananya Gupta',
    mode: 'ROUND_ROBIN',
    active: false,
    leadsRouted: 19,
  },
];

export default function LeadAllocationRulesPage() {
  const [rules, setRules] = useState<AllocationRule[]>(INITIAL_RULES);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleRuleActive = (id: string, name: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = !r.active;
          showToast(`Rule "${name}" ${next ? 'ACTIVATED' : 'PAUSED'}.`);
          return { ...r, active: next };
        }
        return r;
      })
    );
  };

  const handleSimulateLead = () => {
    setSimulationResult('Processing synthetic lead: [Housing.com: Sector-86, SS Omnia G80, ₹75L]...');
    setTimeout(() => {
      setSimulationResult(
        '🎯 Matched Rule 1 ("Sector-86 & 88A Commercial") ➜ Successfully routed to Amit Verma via Round-Robin pool! WhatsApp notification dispatched.'
      );
      showToast('Lead simulation completed successfully!');
    }, 700);
  };

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
            <GitBranch size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Lead Allocation & Routing Rules Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Live Routing Active
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Automated rules to instantly distribute incoming leads by micro-market sector, property value, and agent specialty.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateLead}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition-all shadow-sm"
          >
            <Play size={13} className="fill-current" />
            <span>Simulate Inbound Lead</span>
          </button>
        </div>
      </div>

      {/* Simulation Result Banner */}
      {simulationResult && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-gray-900 to-gray-900 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-3 animate-in fade-in">
          <Sparkles size={16} className="text-amber-400 shrink-0" />
          <span className="flex-1 font-mono">{simulationResult}</span>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 rounded-2xl bg-gray-900/90 border transition-all ${
              rule.active ? 'border-amber-500/40 shadow-xl' : 'border-gray-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                  {rule.mode}
                </span>
                <h3 className="font-bold text-white text-sm mt-2">{rule.name}</h3>
              </div>

              <button
                type="button"
                onClick={() => toggleRuleActive(rule.id, rule.name)}
                className="text-gray-400 hover:text-white"
                title="Toggle Active Rule"
              >
                {rule.active ? (
                  <ToggleRight size={28} className="text-amber-400" />
                ) : (
                  <ToggleLeft size={28} className="text-gray-600" />
                )}
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-gray-950/80 border border-gray-800">
                <span className="text-[10px] text-gray-500 font-semibold uppercase block">Trigger Condition</span>
                <p className="font-mono text-gray-300 text-[11px] mt-0.5">{rule.condition}</p>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/80 border border-gray-800">
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold uppercase block">Source</span>
                  <span className="text-gray-300 text-[11px]">{rule.source}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase block">Assigned To</span>
                  <span className="text-amber-400 font-bold text-[11px]">{rule.targetAssignee}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
              <span>{rule.leadsRouted} leads automatically routed</span>
              <span className="text-emerald-400 font-semibold">Zero Latency Sync</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
