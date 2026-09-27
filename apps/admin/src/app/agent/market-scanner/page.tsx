'use client';

import React, { useState } from 'react';
import {
  ScanLine,
  UploadCloud,
  Camera,
  Sparkles,
  CheckCircle2,
  FileText,
  Building,
  MapPin,
  Phone,
  ArrowRight,
  RefreshCw,
  Edit2,
  Save,
  Check,
} from 'lucide-react';

interface ExtractedUnit {
  id: string;
  sector: string;
  project: string;
  unit: string;
  areaSqFt: number;
  floor: string;
  status: string;
  contactName: string;
  contactPhone: string;
  confidence: number;
  imported: boolean;
}

const SAMPLE_GURGAON_REGISTER: ExtractedUnit[] = [
  {
    id: 'scan-1',
    sector: 'Sector-86',
    project: 'SS Omnia',
    unit: 'G80',
    areaSqFt: 449,
    floor: 'Ground Floor (GF)',
    status: 'Ready Shop · High Footfall Corridor',
    contactName: 'Deepak Singhania',
    contactPhone: '9899248292',
    confidence: 98,
    imported: false,
  },
  {
    id: 'scan-2',
    sector: 'Sector-86',
    project: 'SS Highpoint',
    unit: 'Shop No-52',
    areaSqFt: 534,
    floor: 'First Floor (FF)',
    status: 'Rented @ ₹100/sq.ft to Vishal Mega Mart',
    contactName: 'Deepak Singhania',
    contactPhone: '9899248292',
    confidence: 96,
    imported: false,
  },
  {
    id: 'scan-3',
    sector: 'Sector-88A',
    project: 'Signature Signum-88A',
    unit: 'SCO-309',
    areaSqFt: 850,
    floor: 'Ground + 1st Floor (Corner)',
    status: 'Ready for Fitouts · Corner Facing',
    contactName: 'Ashwani Goyal',
    contactPhone: '6260245484',
    confidence: 99,
    imported: false,
  },
  {
    id: 'scan-4',
    sector: 'Sector-89',
    project: 'Orris Market 89',
    unit: 'A-515',
    areaSqFt: 380,
    floor: 'Second Floor (SF)',
    status: 'Pre-leased to Fast Food Chain @ 8.2% ROI',
    contactName: 'Vineet Kumar',
    contactPhone: '9911389167',
    confidence: 94,
    imported: false,
  },
  {
    id: 'scan-5',
    sector: 'Sector-90',
    project: 'Sapphire Ninety',
    unit: 'SF-12',
    areaSqFt: 620,
    floor: 'Second Floor (SF)',
    status: 'Rented to Corporate Bank ATM & Branch',
    contactName: 'Gaurav Kapoor',
    contactPhone: '9811456789',
    confidence: 97,
    imported: false,
  },
];

export default function MarketListingScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedUnit[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLoadSampleRegister = () => {
    setIsScanning(true);
    setScanProgress(15);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanning(false);
            setExtractedData(SAMPLE_GURGAON_REGISTER);
            showToast('✅ 5 structured commercial listings extracted from Gurgaon physical register!');
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  const handleImportSingle = (id: string, projectName: string, unit: string) => {
    setExtractedData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, imported: true } : item))
    );
    showToast(`✅ "${projectName} ${unit}" imported into My Inventory & CRM!`);
  };

  const handleImportAll = () => {
    setExtractedData((prev) => prev.map((item) => ({ ...item, imported: true })));
    showToast('🎉 All 5 physical listings successfully imported into your inventory!');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-gray-900 border border-teal-500 shadow-2xl text-white text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
            <ScanLine size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">AI Physical Listing Book Scanner</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                Gurgaon Commercial OCR Engine
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Photograph printed property registers to automatically extract structured unit, pricing, and owner contact records.
            </p>
          </div>
        </div>

        <button
          onClick={handleLoadSampleRegister}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-teal-900/30 disabled:opacity-60 active:scale-98"
        >
          <Sparkles size={15} />
          <span>Load Sample Register (Gurgaon Catalog)</span>
        </button>
      </div>

      {/* Ingestion & Scanning Laser Box */}
      <div className="relative rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center overflow-hidden shadow-2xl">
        {/* Animated Scanning Radar / Laser Beam */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_15px_#2dd4bf] animate-[bounce_1.5s_infinite]" />
            <div className="absolute inset-0 bg-teal-500/5 backdrop-blur-[1px]" />
          </div>
        )}

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-950/80 border border-teal-800 text-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-teal-900/40">
            {isScanning ? (
              <RefreshCw size={28} className="animate-spin text-teal-400" />
            ) : (
              <ScanLine size={32} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">
              {isScanning ? 'AI Engine Scanning Physical Register...' : 'Scan or Ingest Register Page'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Supports device camera snapshots, scanned PDFs, or high-res photos of printed broker registers.
            </p>
          </div>

          {isScanning && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-mono">Extracting Sector 86–90 listings...</span>
                <span className="text-teal-400 font-bold">{scanProgress}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {!isScanning && extractedData.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                onClick={handleLoadSampleRegister}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Sparkles size={14} />
                <span>Demo 1-Tap Sample Scan</span>
              </button>
              <button
                onClick={() => showToast('Camera capture initialized on connected device')}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-semibold border border-gray-800 transition-all flex items-center gap-2"
              >
                <Camera size={14} />
                <span>Snap Camera Photo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Extracted Structured Records Review */}
      {extractedData.length > 0 && (
        <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-400" />
              <h3 className="font-bold text-white text-sm">
                Extracted Listings ({extractedData.length} Units Found)
              </h3>
            </div>

            <button
              onClick={handleImportAll}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Import All to My Inventory</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/60">
                  <th className="py-3 px-4">Project & Unit</th>
                  <th className="py-3 px-4">Sector & Specs</th>
                  <th className="py-3 px-4">Status & Tenancy</th>
                  <th className="py-3 px-4">Owner Contact</th>
                  <th className="py-3 px-4">OCR Confidence</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {extractedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{item.project}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-teal-300 font-mono font-bold text-xs">
                          {item.unit}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-gray-200">{item.sector}</p>
                      <p className="text-gray-400 text-[11px]">{item.areaSqFt} sq.ft · {item.floor}</p>
                    </td>

                    <td className="py-3.5 px-4 text-gray-300">
                      <p className="line-clamp-2 max-w-xs">{item.status}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{item.contactName}</p>
                      <p className="font-mono text-teal-400 text-[11px]">{item.contactPhone}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[10px]">
                        {item.confidence}% Match
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {item.imported ? (
                        <span className="text-emerald-400 font-bold text-xs inline-flex items-center gap-1">
                          <CheckCircle2 size={13} /> Imported
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImportSingle(item.id, item.project, item.unit)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-500/40 text-[11px] font-bold transition-all shadow-sm"
                        >
                          Import Unit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
