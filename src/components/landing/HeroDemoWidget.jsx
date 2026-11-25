import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  MapPin,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import {
  Button,
  AttentionBadge,
  StatusBadge,
  ReasonCodePill,
  IconTile,
} from '../ui/Primitives';
import { formatINR } from '../../utils/formatters';

const SCENARIOS = [
  {
    id: 'ORD-26410',
    buyer: 'Rahul Sharma',
    store: 'VedaGlow Botanicals',
    city: 'Jaipur · 302019 (Tier-2)',
    sku: 'Kumkumadi Radiance Facial Oil (30ml)',
    value: 2499,
    payment: 'COD',
    initialAttention: 'HIGH',
    initialStatus: 'Pending Verification',
    exposure: 214,
    outreachCost: 0.9,
    address: 'Plot 42, Shyam Nagar (Missing Landmark)',
    resolvedAddress: 'Plot 42, Shyam Nagar, Near Metro Pillar 78',
    reasonCodes: ['ADDRESS_INCOMPLETE', 'CONFIRMATION_PENDING'],
    intervention: 'Address Clarification via WhatsApp',
    buyerReply: 'Confirmed! Please deliver near Metro Pillar 78, Shyam Nagar.',
  },
  {
    id: 'ORD-26408',
    buyer: 'Vikas Yadav',
    store: 'ZariPulse WhatsApp & CSV',
    city: 'Lucknow · 226010 (Tier-2)',
    sku: 'Handcrafted Brass Urli Bowl (12-inch)',
    value: 3299,
    payment: 'COD',
    initialAttention: 'HIGH',
    initialStatus: 'Pending Verification',
    exposure: 268,
    outreachCost: 1.25,
    address: 'Sector 4 Gomti Nagar',
    resolvedAddress: 'Sector 4 Gomti Nagar · ₹150 UPI Token Paid',
    reasonCodes: ['REPEATED_COD_REFUSAL', 'HIGH_VALUE_ORDER'],
    intervention: 'Optional ₹150 Partial UPI Advance + ₹50 Off',
    buyerReply: 'Paid ₹150 UPI advance (Ref #UPI88412). Ready for dispatch!',
  },
  {
    id: 'ORD-26405',
    buyer: 'Priya Nair',
    store: 'VedaGlow Botanicals',
    city: 'Bengaluru · 560038 (Tier-1)',
    sku: 'Ayurvedic Scalp Therapy Kit',
    value: 1850,
    payment: 'Prepaid',
    initialAttention: 'LOW',
    initialStatus: 'Ready for Dispatch',
    exposure: 145,
    outreachCost: 0,
    address: 'Flat 404, Maple Residency, Opp CMH Gate 2',
    resolvedAddress: 'Flat 404, Maple Residency, Opp CMH Gate 2',
    reasonCodes: [],
    intervention: 'Auto-Approve for Courier Manifest',
    buyerReply: '6/6 prior deliveries verified — zero friction needed.',
  },
];

export function HeroDemoWidget() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [step, setStep] = useState('scored'); // 'scored' | 'outreach_sent' | 'rescued'

  const scenario = SCENARIOS[scenarioIdx];
  const isLowRisk = scenario.initialAttention === 'LOW';

  const currentAttention = step === 'rescued' ? 'LOW' : scenario.initialAttention;
  const currentStatus =
    isLowRisk || step === 'rescued'
      ? 'Ready for Dispatch'
      : step === 'outreach_sent'
        ? 'Awaiting Customer'
        : scenario.initialStatus;

  const selectScenario = (idx) => {
    setScenarioIdx(idx);
    setStep('scored');
  };

  return (
    <div className="bg-white rounded-[26px] border border-[#DFE1F5] shadow-rescale-card overflow-hidden">
      {/* Top Interactive Scenario Switcher */}
      <div className="px-5 sm:px-7 py-4 bg-[#F9FAFB] border-b border-[#EEF0FA] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={Sparkles} tone="peri" size="sm" />
          <div>
            <div className="font-display text-[14px] font-bold text-[#465478]">
              Interactive Pre-Dispatch Sandbox
            </div>
            <div className="text-[11.5px] text-[#8891AA]">
              Test NORTHSTAR&apos;s rules-based RTO scoring &amp; WhatsApp rescue live
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 bg-[#F1F2F9] border border-[#E3E6FA] rounded-full p-1">
          {SCENARIOS.map((sc, idx) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => selectScenario(idx)}
              className={`px-3 py-1.5 rounded-full text-[11.5px] font-display font-bold transition-all ${
                scenarioIdx === idx
                  ? 'bg-white text-[#465478] shadow-rescale-card'
                  : 'text-[#7C86A2] hover:text-[#465478]'
              }`}
            >
              {sc.id}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Body */}
      <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Incoming Order & Risk Explanation */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-[20px] bg-[#F9FAFB] border border-[#E3E6FA] p-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E8EBF8]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-[16px] font-extrabold text-[#465478]">
                    {scenario.id}
                  </span>
                  <span className="text-[11.5px] font-display font-semibold px-2.5 py-0.5 rounded-full bg-white border border-[#DFE1F5] text-[#545C9E]">
                    {scenario.payment} · {formatINR(scenario.value)}
                  </span>
                </div>
                <div className="text-[12.5px] text-[#6E7896] mt-1">
                  {scenario.buyer} · {scenario.city}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AttentionBadge level={currentAttention} />
                <StatusBadge status={currentStatus} />
              </div>
            </div>

            {/* Address & Reason Codes */}
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2.5 text-[12.5px]">
                <MapPin className="w-4 h-4 text-[#7584D6] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-display font-bold text-[#465478]">Delivery Address: </span>
                  <span className="text-[#6A7594]">
                    {step === 'rescued' ? scenario.resolvedAddress : scenario.address}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA] mb-1.5">
                  Triggered Risk Signals
                </div>
                {scenario.reasonCodes.length === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-display font-semibold text-[#17825B] bg-[#ECFEF6] border border-[#C3F3DE] px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Returning Buyer — Zero Risk Flags
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {scenario.reasonCodes.map((rc) => (
                      <ReasonCodePill key={rc} code={rc} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Exposure vs Intervention Economics */}
          <div className="mt-5 pt-4 border-t border-[#E8EBF8] grid grid-cols-3 gap-3">
            <div className="bg-white rounded-[14px] border border-[#E3E6FA] p-3">
              <div className="text-[10.5px] font-display font-semibold text-[#8891AA]">
                RTO Freight Exposure
              </div>
              <div className="font-display text-[16px] font-extrabold text-[#465478] mt-0.5 num">
                {formatINR(scenario.exposure)}
              </div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E6FA] p-3">
              <div className="text-[10.5px] font-display font-semibold text-[#8891AA]">
                Rescue Outreach
              </div>
              <div className="font-display text-[16px] font-extrabold text-[#7584D6] mt-0.5 num">
                ₹{scenario.outreachCost.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-[14px] border border-[#E3E6FA] p-3">
              <div className="text-[10.5px] font-display font-semibold text-[#8891AA]">
                Protected Margin
              </div>
              <div className="font-display text-[16px] font-extrabold text-[#17825B] mt-0.5 num">
                {formatINR(Math.round(scenario.exposure - scenario.outreachCost))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Proportionate Action & Buyer Simulation */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-[20px] bg-white border border-[#DFE1F5] p-5 shadow-rescale-card">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#7584D6]">
                <ShieldCheck className="w-4 h-4" />
                Proportionate AI Rescue
              </span>
              {step !== 'scored' && (
                <button
                  type="button"
                  onClick={() => setStep('scored')}
                  className="inline-flex items-center gap-1 text-[11px] font-display font-semibold text-[#8891AA] hover:text-[#465478]"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            <div className="rounded-[16px] bg-[#F4F5FC] border border-[#E3E6FA] p-3.5">
              <div className="text-[11px] text-[#7C86A2] font-medium">Recommended Intervention</div>
              <div className="font-display text-[14px] font-bold text-[#465478] mt-0.5">
                {scenario.intervention}
              </div>
            </div>

            {/* Simulated WhatsApp Thread */}
            <div className="mt-4 space-y-2.5 min-h-[116px]">
              {isLowRisk ? (
                <div className="rounded-[16px] bg-[#ECFEF6] border border-[#C3F3DE] p-3.5 text-[12.5px] text-[#17825B] font-medium">
                  {scenario.buyerReply} Cleared directly for courier manifest with ₹0.00 outreach cost.
                </div>
              ) : step === 'scored' ? (
                <div className="rounded-[16px] border border-dashed border-[#D5DAF2] p-4 text-[12px] text-[#7C86A2] leading-relaxed">
                  Click <strong className="text-[#465478]">Send Simulated WhatsApp</strong> below to request confirmation before generating a courier AWB.
                </div>
              ) : (
                <>
                  <div className="rounded-[16px] rounded-tr-xs bg-[#EEF0FA] border border-[#DFE1F5] px-3.5 py-2.5 text-[12px] text-[#465478]">
                    <span className="font-display font-bold text-[#545C9E] block text-[10.5px] mb-0.5">
                      NORTHSTAR WhatsApp Bot (Simulated)
                    </span>
                    Hi {scenario.buyer.split(' ')[0]}! Please confirm your {scenario.store} order{' '}
                    {scenario.id} ({formatINR(scenario.value)}) so we can prioritize dispatch.
                  </div>
                  {step === 'rescued' && (
                    <div className="rounded-[16px] rounded-tl-xs bg-[#ECFEF6] border border-[#C3F3DE] px-3.5 py-2.5 text-[12px] text-[#146C4B] animate-fade-up">
                      <span className="font-display font-bold block text-[10.5px] mb-0.5">
                        {scenario.buyer} · Verified Reply
                      </span>
                      {scenario.buyerReply}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F2F9] flex flex-wrap items-center justify-between gap-2">
            {isLowRisk ? (
              <Link to="/app/orders" className="w-full">
                <Button variant="primary" size="md" className="w-full">
                  Inspect in Order Queue <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : step === 'scored' ? (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setStep('outreach_sent')}
              >
                <MessageSquare className="w-4 h-4" />
                Send Simulated WhatsApp (₹{scenario.outreachCost.toFixed(2)})
              </Button>
            ) : step === 'outreach_sent' ? (
              <Button
                variant="outline"
                size="md"
                className="w-full border-[#7584D6] text-[#545C9E]"
                onClick={() => setStep('rescued')}
              >
                <CheckCircle2 className="w-4 h-4 text-[#2EB37E]" />
                Simulate Buyer Confirmation Reply
              </Button>
            ) : (
              <Link to="/app/rescue" className="w-full">
                <Button variant="success" size="md" className="w-full">
                  <Wallet className="w-4 h-4" />
                  Order Rescued! Open Full Rescue Centre
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
