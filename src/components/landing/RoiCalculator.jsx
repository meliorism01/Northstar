import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, TrendingUp, ShieldCheck, ArrowRight, Info } from 'lucide-react';
import { Button, IconTile, SectionEyebrow } from '../ui/Primitives';
import { formatINR, formatNumber } from '../../utils/formatters';

export function RoiCalculator() {
  const [monthlyOrders, setMonthlyOrders] = useState(6000);
  const [codShare, setCodShare] = useState(68);
  const [baselineRtoRate, setBaselineRtoRate] = useState(24);
  const [avgFreightRtoCost, setAvgFreightRtoCost] = useState(165);
  const [inventoryHandlingCost, setInventoryHandlingCost] = useState(45);
  const [rescueEfficiency, setRescueEfficiency] = useState(32);

  const metrics = useMemo(() => {
    const codOrders = Math.round((monthlyOrders * codShare) / 100);
    const baselineRtoOrders = Math.round((codOrders * baselineRtoRate) / 100);
    const costPerRto = avgFreightRtoCost + inventoryHandlingCost;
    const monthlyRtoLeakage = baselineRtoOrders * costPerRto;

    const flaggedOrders = Math.round(codOrders * 0.38);
    const outreachSpend = Math.round(flaggedOrders * 1.05);

    const preventedRtos = Math.round((baselineRtoOrders * rescueEfficiency) / 100);
    const grossFreightProtected = preventedRtos * costPerRto;
    const netMonthlySavings = Math.max(0, grossFreightProtected - outreachSpend);
    const annualRunRate = netMonthlySavings * 12;
    const newRtoRate =
      codOrders > 0
        ? Math.max(0, ((baselineRtoOrders - preventedRtos) / codOrders) * 100)
        : 0;

    return {
      codOrders,
      baselineRtoOrders,
      costPerRto,
      monthlyRtoLeakage,
      outreachSpend,
      preventedRtos,
      netMonthlySavings,
      annualRunRate,
      newRtoRate,
    };
  }, [
    monthlyOrders,
    codShare,
    baselineRtoRate,
    avgFreightRtoCost,
    inventoryHandlingCost,
    rescueEfficiency,
  ]);

  const sliders = [
    {
      label: 'Monthly Store Orders',
      valueDisplay: `${formatNumber(monthlyOrders)} orders`,
      min: 500,
      max: 50000,
      step: 500,
      value: monthlyOrders,
      onChange: setMonthlyOrders,
    },
    {
      label: 'Cash-on-Delivery (COD) Share',
      valueDisplay: `${codShare}%`,
      min: 20,
      max: 95,
      step: 1,
      value: codShare,
      onChange: setCodShare,
    },
    {
      label: 'Current COD RTO Rate',
      valueDisplay: `${baselineRtoRate}%`,
      min: 8,
      max: 45,
      step: 1,
      value: baselineRtoRate,
      onChange: setBaselineRtoRate,
    },
    {
      label: 'Forward + Reverse Freight per RTO',
      valueDisplay: formatINR(avgFreightRtoCost),
      min: 90,
      max: 350,
      step: 5,
      value: avgFreightRtoCost,
      onChange: setAvgFreightRtoCost,
    },
    {
      label: 'Packaging & Inventory Lockup per RTO',
      valueDisplay: formatINR(inventoryHandlingCost),
      min: 15,
      max: 180,
      step: 5,
      value: inventoryHandlingCost,
      onChange: setInventoryHandlingCost,
    },
    {
      label: 'Estimated RTO Reduction (Conservative)',
      valueDisplay: `${rescueEfficiency}%`,
      min: 15,
      max: 50,
      step: 1,
      value: rescueEfficiency,
      onChange: setRescueEfficiency,
    },
  ];

  return (
    <section id="roi-calculator" className="py-20 px-4 sm:px-8 relative">
      <div className="max-w-[1220px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionEyebrow>Unit Economics Simulator</SectionEyebrow>
          <h2 className="mt-4 font-display text-[32px] sm:text-[42px] font-extrabold text-[#465478] tracking-[-0.035em] leading-[1.12]">
            Quantify your preventable{' '}
            <span className="rescale-gradient-text">RTO freight</span> leakage.
          </h2>
          <p className="mt-3 text-[15px] text-[#6E7896] leading-relaxed">
            Model forward + reverse courier freight, packaging burn, and WhatsApp verification spend transparently before deploying rules.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: 6 Interactive Sliders Card */}
          <div className="lg:col-span-7 rescale-card p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center gap-3 pb-5 border-b border-[#F1F2F9]">
              <IconTile icon={Calculator} tone="peri" size="md" />
              <div>
                <h3 className="font-display text-[17px] font-bold text-[#465478]">
                  Storefront Volume &amp; Freight Inputs
                </h3>
                <p className="text-[12.5px] text-[#8891AA]">
                  Drag sliders to match your Indian D2C shipping profile
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-6 py-6">
              {sliders.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-[12.5px] font-display font-semibold text-[#5C6888]">
                      {s.label}
                    </label>
                    <span className="font-display text-[13px] font-extrabold text-[#465478] bg-[#F1F2F9] px-2.5 py-0.5 rounded-full num">
                      {s.valueDisplay}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.value}
                    onChange={(e) => s.onChange(Number(e.target.value))}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-[16px] bg-[#F4F5FC] border border-[#E3E6FA] px-4 py-3 flex items-start gap-2.5 text-[12px] text-[#5C6888]">
              <Info className="w-4 h-4 text-[#7584D6] flex-shrink-0 mt-0.5" />
              <span>
                NORTHSTAR deducts estimated WhatsApp/SMS outreach costs ({formatINR(metrics.outreachSpend)}/mo) from gross freight protected so savings remain conservative and audit-ready.
              </span>
            </div>
          </div>

          {/* Right: Rescale Featured Savings Summary Card */}
          <div className="lg:col-span-5 rounded-[26px] p-6 sm:p-8 bg-white border border-[#DFE1F5] shadow-panel flex flex-col justify-between relative overflow-hidden">
            <img
              src="/template-assets/pastel-glow.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 object-cover opacity-55"
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF0FA] border border-[#DFE1F5] text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#545C9E]">
                <TrendingUp className="w-3.5 h-3.5 text-[#7584D6]" />
                Estimated Net Monthly Impact
              </div>

              <div className="mt-4 font-display text-[38px] sm:text-[44px] font-extrabold text-[#465478] tracking-[-0.04em] leading-none num">
                {formatINR(metrics.netMonthlySavings)}
              </div>
              <p className="text-[13px] text-[#7C86A2] mt-2">
                Net monthly margin protected ({formatINR(metrics.annualRunRate)} annualized run-rate)
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11.5px] text-[#8891AA] font-medium">
                      Current Monthly RTO Leakage
                    </div>
                    <div className="text-[12px] text-[#6E7896] mt-0.5">
                      {formatNumber(metrics.baselineRtoOrders)} failed COD shipments × {formatINR(metrics.costPerRto)}
                    </div>
                  </div>
                  <div className="font-display text-[17px] font-extrabold text-[#E05328] num">
                    {formatINR(metrics.monthlyRtoLeakage)}
                  </div>
                </div>

                <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11.5px] text-[#8891AA] font-medium">
                      Prevented RTO Shipments
                    </div>
                    <div className="text-[12px] text-[#6E7896] mt-0.5">
                      COD RTO drops from {baselineRtoRate}% → {metrics.newRtoRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="font-display text-[17px] font-extrabold text-[#17825B] num">
                    {formatNumber(metrics.preventedRtos)} / mo
                  </div>
                </div>

                <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#7584D6]" />
                    <span className="text-[12.5px] font-display font-semibold text-[#465478]">
                      Verification Spend Deducted
                    </span>
                  </div>
                  <span className="font-display text-[14px] font-bold text-[#545C9E] num">
                    −{formatINR(metrics.outreachSpend)}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-7 pt-5 border-t border-[#EEF0FA] flex flex-col sm:flex-row gap-3">
              <Link to="/app/financial" className="flex-1">
                <Button variant="primary" size="lg" className="w-full">
                  Open Financial Ledger <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
