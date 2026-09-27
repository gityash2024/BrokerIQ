'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Download,
  Zap,
  TrendingUp,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export default function AgencyBillingPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-amber-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Agency Subscription & Invoices</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Razorpay automated billing, broker seat quota expansions, and tax invoice ledger.
            </p>
          </div>
        </div>

        <button
          onClick={() => showToast('Connecting to Razorpay checkout gateway...')}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-900/30"
        >
          <Zap size={14} />
          <span>Upgrade to Business Plan</span>
        </button>
      </div>

      {/* Plan Card & Usage Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-gray-900 to-gray-900 border border-amber-500/40 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Current Tier</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-white mt-2">PRO Agency Plan</h3>
            <p className="text-3xl font-extrabold text-amber-400 mt-1">₹4,999 <span className="text-xs text-gray-400 font-normal">/ month</span></p>
            <p className="text-xs text-gray-400 mt-3">
              Includes 10 Broker Seats, Housing.com lead webhook integration, and automated WhatsApp CRM outreach.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between mt-6">
            <span>Next Billing: Oct 1, 2026</span>
            <span className="text-white font-mono">Auto-Debit: ON</span>
          </div>
        </div>

        {/* Meters: Seats & WhatsApp */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white">Resource Quota Consumption</h3>

          {/* Seat Meter */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-300 font-medium">Broker Agent Seats</span>
              <span className="text-amber-400 font-bold">8 of 10 Seats Used (80%)</span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800">
              <div className="bg-amber-500 h-2 rounded-full" style={{ width: '80%' }} />
            </div>
          </div>

          {/* Leads Meter */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-300 font-medium">Monthly Active Leads Ingested</span>
              <span className="text-teal-400 font-bold">284 of 500 Leads (56%)</span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800">
              <div className="bg-teal-500 h-2 rounded-full" style={{ width: '56%' }} />
            </div>
          </div>

          {/* WhatsApp Meter */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-300 font-medium">Meta WhatsApp Outbound CRM Messages</span>
              <span className="text-purple-400 font-bold">5,420 of 10,000 Messages (54%)</span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: '54%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Ledger Table */}
      <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Razorpay Tax Invoices & Receipts</h3>
          <span className="text-xs text-gray-500">GST Registration: 07AAACG1234F1Z5</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Billing Period</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <tr className="hover:bg-gray-800/40">
              <td className="py-3.5 px-4 font-mono font-bold text-white">INV-2026-009</td>
              <td className="py-3.5 px-4 text-gray-300">Sep 1, 2026 – Sep 30, 2026</td>
              <td className="py-3.5 px-4 font-bold text-white">₹4,999.00</td>
              <td className="py-3.5 px-4 text-gray-400">Razorpay Auto-Debit (UPI)</td>
              <td className="py-3.5 px-4">
                <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  PAID
                </span>
              </td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => showToast('Downloading Tax Invoice INV-2026-009...')}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <Download size={14} />
                </button>
              </td>
            </tr>
            <tr className="hover:bg-gray-800/40">
              <td className="py-3.5 px-4 font-mono font-bold text-white">INV-2026-008</td>
              <td className="py-3.5 px-4 text-gray-300">Aug 1, 2026 – Aug 31, 2026</td>
              <td className="py-3.5 px-4 font-bold text-white">₹4,999.00</td>
              <td className="py-3.5 px-4 text-gray-400">Razorpay Auto-Debit (UPI)</td>
              <td className="py-3.5 px-4">
                <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  PAID
                </span>
              </td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => showToast('Downloading Tax Invoice INV-2026-008...')}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <Download size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
