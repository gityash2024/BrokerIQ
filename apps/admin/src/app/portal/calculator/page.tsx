'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Building,
  Sparkles,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function SeekerCalculatorPage() {
  const [activeTab, setActiveTab] = useState<'EMI' | 'ROI'>('EMI');

  // EMI Calculator State
  const [loanAmount, setLoanAmount] = useState(5000000); // 50 Lakhs
  const [interestRate, setInterestRate] = useState(8.5); // 8.5%
  const [tenureYears, setTenureYears] = useState(20); // 20 years

  // ROI Calculator State
  const [purchasePrice, setPurchasePrice] = useState(7500000); // 75 Lakhs
  const [monthlyRent, setMonthlyRent] = useState(55000); // 55k
  const [annualMaintenance, setAnnualMaintenance] = useState(30000); // 30k

  // EMI Calculations
  const emiCalculations = useMemo(() => {
    const P = loanAmount;
    const r = interestRate / 12 / 100;
    const n = tenureYears * 12;

    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - P;

    return {
      monthlyEmi: Math.round(emi),
      totalInterest: Math.round(totalInterest),
      totalPayment: Math.round(totalPayment),
      principal: P,
    };
  }, [loanAmount, interestRate, tenureYears]);

  const emiPieData = [
    { name: 'Principal Loan Amount', value: emiCalculations.principal, color: '#E11D48' },
    { name: 'Total Interest Payable', value: emiCalculations.totalInterest, color: '#4B5563' },
  ];

  // ROI Calculations
  const roiCalculations = useMemo(() => {
    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / purchasePrice) * 100;
    const netRent = annualRent - annualMaintenance;
    const netYield = (netRent / purchasePrice) * 100;
    const paybackYears = (purchasePrice / netRent).toFixed(1);

    return {
      annualGrossRent: annualRent,
      grossYield: grossYield.toFixed(2),
      netAnnualRent: netRent,
      netYield: netYield.toFixed(2),
      paybackYears,
    };
  }, [purchasePrice, monthlyRent, annualMaintenance]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold">
            <Calculator size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Real Estate Financial Calculators</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Simulate monthly loan EMIs and commercial rental return on investment (ROI).
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs">
          <button
            onClick={() => setActiveTab('EMI')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'EMI'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Loan EMI Calculator
          </button>
          <button
            onClick={() => setActiveTab('ROI')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'ROI'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Commercial Rental Yield (ROI)
          </button>
        </div>
      </div>

      {/* CALCULATOR 1: LOAN EMI */}
      {activeTab === 'EMI' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
          {/* Sliders Input */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Loan Amount</span>
                <span className="text-rose-400 font-bold text-sm">
                  ₹{(loanAmount / 100000).toFixed(1)} Lakhs
                </span>
              </div>
              <input
                type="range"
                min={1000000}
                max={50000000}
                step={500000}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>₹10 Lakhs</span>
                <span>₹5 Crores</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Interest Rate (% p.a.)</span>
                <span className="text-rose-400 font-bold text-sm">{interestRate}%</span>
              </div>
              <input
                type="range"
                min={6}
                max={15}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>6%</span>
                <span>15%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Loan Tenure</span>
                <span className="text-rose-400 font-bold text-sm">{tenureYears} Years</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={tenureYears}
                onChange={(e) => setTenureYears(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>1 Year</span>
                <span>30 Years</span>
              </div>
            </div>
          </div>

          {/* EMI Results Box & Chart */}
          <div className="p-5 rounded-xl bg-gray-950/80 border border-gray-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Monthly Loan Payment</span>
              <p className="text-3xl font-extrabold text-white mt-1">
                ₹{emiCalculations.monthlyEmi.toLocaleString('en-IN')}{' '}
                <span className="text-xs text-gray-400 font-normal">/ month</span>
              </p>

              <div className="h-[140px] w-full my-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emiPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {emiPieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`]}
                      contentStyle={{ backgroundColor: '#030712', borderRadius: '8px', border: '1px solid #374151' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Principal Amount:
                  </span>
                  <span className="font-bold text-white">₹{emiCalculations.principal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-600" /> Total Interest:
                  </span>
                  <span className="font-bold text-rose-300">₹{emiCalculations.totalInterest.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                  <span className="text-gray-300 font-semibold">Total Payable:</span>
                  <span className="font-extrabold text-white">₹{emiCalculations.totalPayment.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 2: COMMERCIAL RENTAL YIELD */}
      {activeTab === 'ROI' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-900/90 p-6 rounded-2xl border border-gray-800 shadow-xl">
          {/* Sliders Input */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Property Purchase Price</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ₹{(purchasePrice / 100000).toFixed(1)} Lakhs
                </span>
              </div>
              <input
                type="range"
                min={2000000}
                max={50000000}
                step={500000}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>₹20 Lakhs</span>
                <span>₹5 Crores</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Expected Monthly Rent</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ₹{monthlyRent.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={500000}
                step={5000}
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>₹10,000</span>
                <span>₹5,00,000</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-gray-300">Annual Maintenance & Taxes</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ₹{annualMaintenance.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={200000}
                step={5000}
                value={annualMaintenance}
                onChange={(e) => setAnnualMaintenance(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>₹0</span>
                <span>₹2,00,000</span>
              </div>
            </div>
          </div>

          {/* ROI Yield Results Box */}
          <div className="p-5 rounded-xl bg-gray-950/80 border border-gray-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Net Annual Rental Yield</span>
                <p className="text-4xl font-extrabold text-emerald-400 mt-1">
                  {roiCalculations.netYield}% <span className="text-xs text-gray-400 font-normal">ROI</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gross Yield: <strong className="text-white">{roiCalculations.grossYield}%</strong>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-900 border border-gray-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Annual Gross Rent:</span>
                  <span className="font-bold text-white">₹{roiCalculations.annualGrossRent.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Net Annual Inflow:</span>
                  <span className="font-bold text-emerald-400">₹{roiCalculations.netAnnualRent.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                  <span className="text-gray-400">Capital Payback Period:</span>
                  <span className="font-bold text-white">{roiCalculations.paybackYears} Years</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300 flex items-center gap-2 mt-4">
              <Sparkles size={14} className="shrink-0" />
              <span>Gurgaon commercial corridor benchmark: 7.5% – 9.2% ROI prevailing yield.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
