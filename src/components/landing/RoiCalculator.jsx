import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ArrowRight, Info } from 'lucide-react';
import { Button, SectionEyebrow } from '../ui/Primitives';
import { formatINR, formatNumber } from '../../utils/formatters';

export function RoiCalculator() {
  const [monthlyOrders, setMonthlyOrders] = useState(4000);
  const [codPercent, setCodPercent] = useState(68);
  const [aov, setAov] = useState(1850);
  const [rtoRate, setRtoRate] = useState(24);
  const [forwardCost, setForwardCost] = useState(68);
  const [reverseCost, setReverseCost] = useState(74);

  const codOrders = Math.round((monthlyOrders * codPercent) / 100);
  const monthlyRtoOrders = Math.round((codOrders * rtoRate) / 100);
  const perRtoLogisticsLoss = forwardCost + reverseCost + 35; // +₹35 avg COD handling & packaging
  const monthlyLogisticsLeakage = monthlyRtoOrders * perRtoLogisticsLoss;

  // Conservative modeled assumption: 28% RTO reduction via pre-dispatch & NDR rescue
  const modeledReductionRate = 0.28;
  const ordersRescuedEst = Math.round(monthlyRtoOrders * modeledReductionRate);
  const estMessagingCost = Math.round(codOrders * 0.45 * 0.9); // ~45% COD orders need light outreach at ₹0.90
  const monthlyGrossSavings = ordersRescuedEst * perRtoLogisticsLoss;
  const monthlyNetSavings = Math.max(0, monthlyGrossSavings - estMessagingCost);
  const annualNetSavings = monthlyNetSavings * 12;
  const revenueProtected = ordersRescuedEst * aov;

  return (
    <section id="roi-calculator" className="py-20 bg-surface-muted border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <SectionEyebrow className="mb-3">Financial Impact Estimator</SectionEyebrow>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy">
            Quantify Your Monthly RTO Logistics Leakage
          </h2>
          <p className="mt-3 text-slateMuted">
            Adjust your store metrics below to model forward + reverse freight leakage and
            estimated net savings from proportionate pre-dispatch interventions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Sliders Panel */}
          <div className="lg:col-span-7 bg-white border border-slate-200 p-6 md:p-8 shadow-card">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200">
              <Calculator className="w-5 h-5 text-gold-hover" />
              <h3 className="font-serif text-lg font-bold text-navy">Your Store Parameters</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">Monthly Orders</span>
                  <span className="font-mono text-gold-hover">{formatNumber(monthlyOrders)}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="25000"
                  step="500"
                  value={monthlyOrders}
                  onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">COD Share (%)</span>
                  <span className="font-mono text-gold-hover">{codPercent}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  step="1"
                  value={codPercent}
                  onChange={(e) => setCodPercent(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">Average Order Value (AOV)</span>
                  <span className="font-mono text-gold-hover">{formatINR(aov)}</span>
                </div>
                <input
                  type="range"
                  min="499"
                  max="6000"
                  step="50"
                  value={aov}
                  onChange={(e) => setAov(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">Current COD RTO Rate</span>
                  <span className="font-mono text-red-600">{rtoRate}%</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="45"
                  step="1"
                  value={rtoRate}
                  onChange={(e) => setRtoRate(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">Avg. Forward Shipping</span>
                  <span className="font-mono text-gold-hover">{formatINR(forwardCost)}</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="180"
                  step="2"
                  value={forwardCost}
                  onChange={(e) => setForwardCost(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-navy">Avg. Reverse Shipping</span>
                  <span className="font-mono text-gold-hover">{formatINR(reverseCost)}</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="200"
                  step="2"
                  value={reverseCost}
                  onChange={(e) => setReverseCost(Number(e.target.value))}
                  className="w-full accent-[#262B3E]"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-gold-subtle/70 border border-gold/40 flex items-start gap-3">
              <Info className="w-4 h-4 text-navy flex-shrink-0 mt-0.5" />
              <p className="text-xs text-navy/80 leading-relaxed">
                <strong>Model Assumptions vs. Actual Merchant Results:</strong> Projections assume a
                conservative <strong>28% reduction</strong> in avoidable COD RTOs, ₹35 avg COD
                handling/packaging per failed shipment, and ₹0.90/message on ~45% flagged COD
                orders. Actual results vary by category, PIN-code mix, and courier SLA.
              </p>
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-5 bg-navy text-white p-6 md:p-8 flex flex-col justify-between border-t-4 border-t-gold">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-gold font-semibold">
                Modeled Financial Snapshot
              </div>

              <div className="mt-5 pb-5 border-b border-white/10">
                <div className="text-xs text-slate-300">Estimated Monthly Logistics Leakage</div>
                <div className="font-serif text-3xl font-bold text-red-300 mt-1">
                  {formatINR(monthlyLogisticsLeakage)}
                  <span className="text-xs font-sans font-normal text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Across ~{formatNumber(monthlyRtoOrders)} failed COD orders ({formatINR(perRtoLogisticsLoss)}/RTO)
                </div>
              </div>

              <div className="mt-5 pb-5 border-b border-white/10">
                <div className="text-xs text-gold-light">Estimated Net Freight Savings (After Messaging)</div>
                <div className="font-serif text-4xl font-bold text-gold mt-1">
                  {formatINR(monthlyNetSavings)}
                  <span className="text-xs font-sans font-normal text-slate-300"> / month</span>
                </div>
                <div className="text-xs text-emerald-300 mt-1">
                  ≈ {formatINR(annualNetSavings)} projected annual freight savings
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="bg-navy-dark p-3.5 border border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Est. Orders Rescued
                  </div>
                  <div className="font-serif text-xl font-bold text-white mt-1">
                    {formatNumber(ordersRescuedEst)}/mo
                  </div>
                </div>
                <div className="bg-navy-dark p-3.5 border border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    GMV Protected
                  </div>
                  <div className="font-serif text-xl font-bold text-white mt-1">
                    {formatINR(revenueProtected)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <Link to="/app/analytics" className="block">
                <Button variant="primary" size="lg" className="w-full">
                  Inspect Live Financial Analytics <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
