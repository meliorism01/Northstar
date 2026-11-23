import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PackageCheck,
  AlertTriangle,
  MessageSquare,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

const DEMO_STEPS = [
  {
    id: 0,
    tag: 'STEP 01 • INGESTION',
    title: 'Incoming ₹2,499 COD Order',
    subtitle: 'ORD-26410 • VedaGlow Botanicals • Jaipur (302019)',
    status: 'Pending Verification',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    icon: PackageCheck,
    detail: 'Customer: Rahul Sharma • Payment: Cash on Delivery • Line 1: "Plot 42, Shyam Nagar"',
  },
  {
    id: 1,
    tag: 'STEP 02 • RISK DIAGNOSIS',
    title: 'Missing Delivery Landmark Detected',
    subtitle: 'Reason Code: ADDRESS_INCOMPLETE • Attention: MEDIUM',
    status: 'Risk Flagged',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-400/30',
    icon: AlertTriangle,
    detail: 'Courier navigation risk in Tier-2 PIN 302019. Estimated round-trip RTO exposure: ₹185.',
    reasonCode: 'ADDRESS_INCOMPLETE',
  },
  {
    id: 2,
    tag: 'STEP 03 • PROPORTIONATE INTERVENTION',
    title: 'WhatsApp Clarification Requested',
    subtitle: 'Cost: ₹0.90 • Non-intrusive 1-tap prompt sent',
    status: 'Awaiting Customer',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    icon: MessageSquare,
    detail: '"Hello Rahul! Please confirm order ₹2,499 and share a nearby landmark for Plot 42, Shyam Nagar."',
  },
  {
    id: 3,
    tag: 'STEP 04 • BUYER RESPONSE',
    title: 'Customer Supplies Landmark',
    subtitle: 'Replied in 2m 14s via WhatsApp',
    status: 'Landmark Verified',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    icon: MapPin,
    detail: 'Customer replied: "Confirmed! Please deliver Near Shyam Nagar Metro Pillar 78."',
  },
  {
    id: 4,
    tag: 'STEP 05 • RESCUED & CLEARED',
    title: 'Order Ready for Dispatch',
    subtitle: 'READY FOR DISPATCH • Est. Logistics Exposure Avoided: ₹185',
    status: 'READY FOR DISPATCH',
    badgeColor: 'bg-emerald-500 text-white border-emerald-400',
    icon: CheckCircle2,
    detail: 'Address synced to Customer Intelligence Graph & courier label enriched automatically.',
    exposureAvoided: 185,
  },
];

export function HeroDemoWidget() {
  const [stepIndex, setStepIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % DEMO_STEPS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const current = DEMO_STEPS[stepIndex];
  const Icon = current.icon;

  return (
    <div className="bg-navy-dark border border-gold/30 shadow-elevated overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-navy-deep border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-gold font-semibold">
            Live Rescue Simulation • ORD-26410
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPlay((v) => !v)}
            className="text-[11px] text-slate-300 hover:text-gold flex items-center gap-1 font-mono"
            title={autoPlay ? 'Pause autoplay' : 'Resume autoplay'}
          >
            <Play className="w-3 h-3" /> {autoPlay ? 'AUTO' : 'PAUSED'}
          </button>
          <button
            onClick={() => {
              setStepIndex(0);
              setAutoPlay(true);
            }}
            className="text-[11px] text-slate-300 hover:text-gold p-1"
            title="Restart simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Step Progress Track */}
      <div className="grid grid-cols-5 border-b border-white/10">
        {DEMO_STEPS.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => {
              setStepIndex(idx);
              setAutoPlay(false);
            }}
            className={`py-2 text-center font-mono text-[10px] font-bold tracking-wider transition-colors border-r border-white/5 last:border-r-0 ${
              idx === stepIndex
                ? 'bg-gold text-navy-dark'
                : idx < stepIndex
                ? 'bg-navy text-gold'
                : 'bg-navy-dark text-slate-400 hover:text-white'
            }`}
          >
            0{idx + 1}
          </button>
        ))}
      </div>

      {/* Dynamic Stage */}
      <div className="p-6 min-h-[265px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-mono text-[11px] text-gold tracking-widest font-semibold">
                {current.tag}
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border ${current.badgeColor}`}
              >
                {current.status}
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 bg-navy border border-gold/40 flex items-center justify-center flex-shrink-0 text-gold">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-white leading-snug">
                  {current.title}
                </h3>
                <p className="text-xs text-gold-light mt-0.5">{current.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-navy/80 border-l-2 border-gold text-xs text-slate-200 leading-relaxed">
              {current.detail}
            </div>

            {current.reasonCode && (
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-[10px] bg-red-500/20 text-red-200 border border-red-400/30 px-2 py-0.5">
                  {current.reasonCode}
                </span>
                <span className="font-mono text-[10px] bg-white/10 text-slate-200 px-2 py-0.5">
                  COD • {formatINR(2499)}
                </span>
              </div>
            )}

            {current.exposureAvoided && (
              <div className="mt-3 flex items-center justify-between bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  Estimated Logistics Exposure Avoided
                </div>
                <div className="font-serif font-bold text-emerald-300 text-base">
                  {formatINR(current.exposureAvoided)}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Order Metadata Strip */}
        <div className="mt-5 pt-3.5 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Order Value</div>
            <div className="font-serif text-sm font-bold text-white mt-0.5">{formatINR(2499)}</div>
          </div>
          <div className="border-x border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Intervention Cost</div>
            <div className="font-serif text-sm font-bold text-gold mt-0.5">₹0.90</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Est. Freight Saved</div>
            <div className="font-serif text-sm font-bold text-emerald-400 mt-0.5">
              {stepIndex === 4 ? formatINR(185) : 'Evaluating...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
