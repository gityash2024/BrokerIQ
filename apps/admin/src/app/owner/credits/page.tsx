'use client';

import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';

export default function OwnerCreditsPage() {
  const [balance, setBalance] = useState(250);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePurchase = (credits: number, price: string) => {
    setBalance((prev) => prev + credits);
    showToast(`🎉 ${credits} Boost Credits added to your balance! (Paid ${price})`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-sky-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Zap size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Visibility Boost Credits</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Feature your commercial shops at the top of buyer discovery search across Gurgaon.
            </p>
          </div>
        </div>

        <div className="px-4 py-2 rounded-xl bg-gray-950 border border-gray-800 text-center sm:text-right">
          <span className="text-[10px] text-gray-400 font-semibold uppercase block">Available Balance</span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono">{balance} Credits</span>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Starter Pack</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">100 Credits</h3>
            <p className="text-lg font-bold text-amber-400 mt-1">₹999</p>
            <p className="text-xs text-gray-400 mt-2">Boost 2 properties for 7 days on high-intent search feeds.</p>
          </div>
          <button
            onClick={() => handlePurchase(100, '₹999')}
            className="w-full mt-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-all"
          >
            Buy 100 Credits
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-gray-900 to-gray-900 border border-amber-500/50 flex flex-col justify-between shadow-xl relative">
          <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold uppercase">
            Most Popular
          </span>
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Growth Pack</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">250 Credits</h3>
            <p className="text-lg font-bold text-amber-400 mt-1">₹1,999</p>
            <p className="text-xs text-gray-300 mt-2">Boost 5 properties + featured banner placement on Discovery Home.</p>
          </div>
          <button
            onClick={() => handlePurchase(250, '₹1,999')}
            className="w-full mt-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30"
          >
            Buy 250 Credits
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Enterprise Pack</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">500 Credits</h3>
            <p className="text-lg font-bold text-amber-400 mt-1">₹3,499</p>
            <p className="text-xs text-gray-400 mt-2">Unlimited 30-day top ranking for full commercial portfolio.</p>
          </div>
          <button
            onClick={() => handlePurchase(500, '₹3,499')}
            className="w-full mt-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-all"
          >
            Buy 500 Credits
          </button>
        </div>
      </div>
    </div>
  );
}
