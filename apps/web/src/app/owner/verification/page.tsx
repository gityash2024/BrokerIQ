'use client';

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  UploadCloud,
  Check,
  Building,
} from 'lucide-react';

export default function OwnerVerificationPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Owner Trust & KYC Badges</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                100% Verified
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Verified owners receive 4.2x higher buyer inquiry rates and priority ranking on the BrokerIQ Marketplace.
            </p>
          </div>
        </div>
      </div>

      {/* Verification Steps Card */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl space-y-4">
        {/* Item 1 */}
        <div className="flex items-start justify-between p-4 rounded-xl bg-gray-950/70 border border-gray-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mt-0.5">
              <Check size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Mobile Phone & Email OTP</h3>
              <p className="text-xs text-gray-400 mt-0.5">+91 98992 48292 · deepak.owner@brokeriq.in</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
            Verified
          </span>
        </div>

        {/* Item 2 */}
        <div className="flex items-start justify-between p-4 rounded-xl bg-gray-950/70 border border-gray-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mt-0.5">
              <Check size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Government Identity (Aadhaar & PAN)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Aadhaar: XXXX-XXXX-4921 · PAN: AAAPS4921K</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
            Verified
          </span>
        </div>

        {/* Item 3 */}
        <div className="flex items-start justify-between p-4 rounded-xl bg-gray-950/70 border border-gray-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mt-0.5">
              <Check size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Property Ownership Deed & Allotment</h3>
              <p className="text-xs text-gray-400 mt-0.5">SS Omnia Registry Deed (Shop G80) Approved by Admin</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
            Badge Granted
          </span>
        </div>
      </div>
    </div>
  );
}
