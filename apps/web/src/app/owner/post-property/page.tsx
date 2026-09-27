'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Building,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  ShieldCheck,
  Sparkles,
  MapPin,
  Check,
} from 'lucide-react';

export default function PostPropertyWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [propertyType, setPropertyType] = useState('Commercial Shop');
  const [sector, setSector] = useState('Sector-86');
  const [complexName, setComplexName] = useState('SS Omnia');
  const [unitNumber, setUnitNumber] = useState('Shop G88');

  const [carpetArea, setCarpetArea] = useState('480');
  const [floor, setFloor] = useState('Ground Floor (GF)');
  const [isCorner, setIsCorner] = useState(true);
  const [furnishing, setFurnishing] = useState('Bareshell Ready');

  const [listingType, setListingType] = useState<'SALE' | 'RENT'>('SALE');
  const [askingPrice, setAskingPrice] = useState('₹82,00,000');
  const [tenancyNotes, setTenancyNotes] = useState('Ready for retail possession with high atrium footfall.');
  const [uploadDeed, setUploadDeed] = useState(true);

  const [isPublished, setIsPublished] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublished(true);
    showToast('🎉 Property listed successfully! Sent to Super Admin moderation queue.');
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
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
            <PlusCircle size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">3-Step Property Listing Wizard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              List your property on the BrokerIQ Marketplace and connect directly with verified buyers & agents.
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-gray-800">
          <div
            className={`p-3 rounded-xl border text-xs transition-all ${
              currentStep === 1
                ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                : currentStep > 1
                ? 'bg-gray-950 border-gray-800 text-emerald-400'
                : 'bg-gray-950 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                {currentStep > 1 ? <Check size={11} /> : '1'}
              </span>
              <span>Step 1: Basics & Location</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs transition-all ${
              currentStep === 2
                ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                : currentStep > 2
                ? 'bg-gray-950 border-gray-800 text-emerald-400'
                : 'bg-gray-950 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                {currentStep > 2 ? <Check size={11} /> : '2'}
              </span>
              <span>Step 2: Specs & Dimensions</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs transition-all ${
              currentStep === 3
                ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                : 'bg-gray-950 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Step 3: Pricing & Verification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Published Success Screen */}
      {isPublished ? (
        <div className="p-8 rounded-2xl bg-gray-900 border border-emerald-500/40 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">Listing Submitted Successfully!</h2>
          <p className="text-sm text-gray-300 max-w-md mx-auto">
            Your property <strong>{complexName} ({unitNumber})</strong> in {sector} has been submitted with title deed verification attached.
          </p>

          <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 max-w-sm mx-auto text-left text-xs space-y-1.5">
            <p className="text-gray-400">Type: <span className="text-white font-semibold">{propertyType}</span></p>
            <p className="text-gray-400">Area: <span className="text-white font-semibold">{carpetArea} sq.ft ({floor})</span></p>
            <p className="text-gray-400">Asking: <span className="text-emerald-400 font-bold">{askingPrice}</span></p>
            <p className="text-emerald-400 font-semibold flex items-center gap-1 mt-2">
              <ShieldCheck size={14} /> Title Deed Attached for Instant Green Badge
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <Link
              href="/owner/properties"
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md"
            >
              Go to My Properties
            </Link>
            <button
              onClick={() => {
                setIsPublished(false);
                setCurrentStep(1);
              }}
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
            >
              List Another Unit
            </button>
          </div>
        </div>
      ) : (
        /* Wizard Form Container */
        <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white border-b border-gray-800 pb-3">
                Step 1: Property Type & Micro-Market Location
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Property Category</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  >
                    <option value="Commercial Shop">Commercial Retail Shop</option>
                    <option value="Commercial SCO Plot">Commercial SCO Plot</option>
                    <option value="Pre-Leased Rented">Pre-Leased Rented Commercial</option>
                    <option value="Luxury Apartment">Luxury Residential Apartment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Sector (Gurgaon Corridor)</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  >
                    <option value="Sector-86">Sector-86 (SS Omnia, SS Highpoint)</option>
                    <option value="Sector-88A">Sector-88A (Signature Signum-88A)</option>
                    <option value="Sector-89">Sector-89 (Orris Market 89)</option>
                    <option value="Sector-90">Sector-90 (Sapphire Ninety, DLF)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Project / Complex Name</label>
                  <input
                    type="text"
                    value={complexName}
                    onChange={(e) => setComplexName(e.target.value)}
                    placeholder="e.g. SS Omnia, SS Highpoint"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Unit / Shop Number</label>
                  <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g. Shop G80, SCO-309"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <span>Continue to Specs</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white border-b border-gray-800 pb-3">
                Step 2: Specifications, Dimensions & Attributes
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Carpet Area (sq.ft)</label>
                  <input
                    type="number"
                    value={carpetArea}
                    onChange={(e) => setCarpetArea(e.target.value)}
                    placeholder="e.g. 480"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Floor Level</label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  >
                    <option value="Ground Floor (GF)">Ground Floor (GF)</option>
                    <option value="First Floor (FF)">First Floor (FF)</option>
                    <option value="Second Floor (SF)">Second Floor (SF)</option>
                    <option value="Lower Ground Floor (LGF)">Lower Ground Floor (LGF)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Furnishing Status</label>
                  <select
                    value={furnishing}
                    onChange={(e) => setFurnishing(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  >
                    <option value="Bareshell Ready">Bareshell Ready</option>
                    <option value="Fully Furnished Fitouts">Fully Furnished Fitouts</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="cornerToggle"
                    checked={isCorner}
                    onChange={(e) => setIsCorner(e.target.checked)}
                    className="rounded bg-gray-950 border-gray-800 text-sky-500 w-4 h-4"
                  />
                  <label htmlFor="cornerToggle" className="text-gray-300 font-semibold cursor-pointer">
                    Corner Facing / Double Height Unit
                  </label>
                </div>
              </div>

              {/* Photos Dropzone preview */}
              <div className="mt-4 p-6 rounded-xl border border-dashed border-gray-800 bg-gray-950/60 text-center">
                <UploadCloud size={24} className="text-sky-400 mx-auto mb-2" />
                <p className="text-xs text-gray-300 font-semibold">Upload Unit Photos or Elevation Renders</p>
                <p className="text-[11px] text-gray-500 mt-0.5">PNG, JPG, or PDF up to 10MB each</p>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <span>Continue to Pricing</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white border-b border-gray-800 pb-3">
                Step 3: Pricing, Tenancy & Trust Badge Verification
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Listing Type</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setListingType('SALE')}
                      className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
                        listingType === 'SALE'
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      For Sale
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingType('RENT')}
                      className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
                        listingType === 'RENT'
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-gray-950 border-gray-800 text-gray-400'
                      }`}
                    >
                      For Rent / Lease
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Asking Price / Monthly Rent</label>
                  <input
                    type="text"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    placeholder="e.g. ₹82,00,000 or ₹65,000/mo"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-400 font-semibold mb-1">Tenancy & Key Highlights</label>
                  <textarea
                    rows={2}
                    value={tenancyNotes}
                    onChange={(e) => setTenancyNotes(e.target.value)}
                    placeholder="e.g. Ready Shop or Pre-leased @ ₹100/sq.ft to renowned retailer"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white"
                  />
                </div>
              </div>

              {/* Instant Verification Upload */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                  <ShieldCheck size={16} />
                  <span>Attach Ownership Registry Document for Instant Verified Badge</span>
                </div>
                <p className="text-gray-300 text-[11px]">
                  Attaching your Conveyance Deed or Allotment Letter grants your listing the trusted green badge on the public marketplace.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-gray-900 border border-gray-800 text-[10px] text-gray-300 font-mono">
                    Registry_Deed_Signed.pdf
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Attached (1.4 MB)</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-900/30"
                >
                  <Sparkles size={14} />
                  <span>Publish Property to Marketplace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
