import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
  PauseCircle,
  XCircle,
  Truck,
  Share2,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { REASON_CODE_META } from '../services/scoringEngine';
import {
  AttentionBadge,
  Button,
  ConfirmDialog,
  PageHeader,
  ReasonCodePill,
  StatusBadge,
} from '../components/ui/Primitives';
import { CommunicationSandbox } from '../components/communication/CommunicationSandbox';
import { formatINR } from '../utils/formatters';

export function RescueCentrePage() {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const selectedOrderId = useOrdexaStore((s) => s.selectedOrderId);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);
  const approveIntervention = useOrdexaStore((s) => s.approveIntervention);
  const overrideIntervention = useOrdexaStore((s) => s.overrideIntervention);
  const holdOrder = useOrdexaStore((s) => s.holdOrder);
  const cancelOrder = useOrdexaStore((s) => s.cancelOrder);
  const dispatchOrder = useOrdexaStore((s) => s.dispatchOrder);
  const recordDeliveryOutcome = useOrdexaStore((s) => s.recordDeliveryOutcome);

  const [queueFilter, setQueueFilter] = useState('ACTIONABLE');
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverrideBox, setShowOverrideBox] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const sortedQueue = useMemo(() => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    let list = [...orders];
    if (queueFilter === 'ACTIONABLE') {
      list = list.filter((o) =>
        ['Pending Verification', 'Awaiting Customer', 'Held for Review', 'Ready for Dispatch'].includes(o.status)
      );
    } else if (queueFilter === 'HIGH') {
      list = list.filter((o) => o.attentionLevel === 'HIGH');
    }
    return list.sort((a, b) => rank[a.attentionLevel] - rank[b.attentionLevel]);
  }, [orders, queueFilter]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || sortedQueue[0] || orders[0],
    [orders, selectedOrderId, sortedQueue]
  );

  if (!activeOrder) return null;

  const isClosed = ['Delivered', 'RTO', 'Cancelled'].includes(activeOrder.status);
  const riskScorePct = Math.min(100, Math.max(8, activeOrder.riskPoints || 12));
  const scoreBarColor =
    activeOrder.attentionLevel === 'HIGH'
      ? 'bg-red-600'
      : activeOrder.attentionLevel === 'MEDIUM'
      ? 'bg-amber-500'
      : 'bg-emerald-600';

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI RTO Rescue Centre"
        subtitle="Transparent rules-based risk assessment, proportionate intervention recommendations, and human-in-the-loop merchant decisions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Compact Priority Queue */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[4px] shadow-card flex flex-col max-h-[900px] overflow-hidden">
          <div className="px-3.5 py-2.5 bg-navy text-white flex items-center justify-between">
            <span className="text-xs font-semibold tabular-nums">
              Rescue Queue ({sortedQueue.length})
            </span>
            <div className="inline-flex bg-navy-deep p-0.5 rounded-[4px]">
              {[
                { id: 'ACTIONABLE', label: 'Active' },
                { id: 'HIGH', label: 'High' },
                { id: 'ALL', label: 'All' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setQueueFilter(t.id)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-[3px] ${
                    queueFilter === t.id ? 'bg-gold text-navy-dark' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {sortedQueue.map((o) => {
              const selected = o.id === activeOrder.id;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOrderId(o.id);
                    setShowOverrideBox(false);
                  }}
                  className={`w-full text-left px-3.5 py-3 transition-colors border-l-4 ${
                    selected
                      ? 'bg-gold-subtle/70 border-l-gold'
                      : 'border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-navy-dark">{o.id}</span>
                    <AttentionBadge level={o.attentionLevel} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="font-semibold text-navy-dark">{o.customerName}</span>
                    <span className="font-mono font-bold text-navy-dark tabular-nums">
                      {formatINR(o.orderValue)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {o.address.city} • {o.paymentMode} • {o.recommendedIntervention}
                  </div>
                  <div className="mt-1.5">
                    <StatusBadge status={o.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: 3-Stage Decision Card + Communication Sandbox */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
            {/* Order Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3 bg-slate-50/60">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-navy-dark">{activeOrder.id}</span>
                  <AttentionBadge level={activeOrder.attentionLevel} />
                  <StatusBadge status={activeOrder.status} />
                </div>
                <h2 className="font-sans text-base font-bold text-navy-dark tabular-nums">
                  {activeOrder.customerName} — {formatINR(activeOrder.orderValue)} ({activeOrder.paymentMode})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeOrder.address.line1}
                  {activeOrder.address.landmark
                    ? `, Landmark: ${activeOrder.address.landmark}`
                    : ' • [Missing Landmark]'}
                  {' '}• {activeOrder.address.city}, {activeOrder.address.state} ({activeOrder.address.pincode})
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setSelectedCustomerId(activeOrder.customerId);
                  navigate('/app/graph');
                }}
              >
                <Share2 className="w-3.5 h-3.5" /> Customer Graph
              </Button>
            </div>

            {/* Stage 1: Risk Assessment & Stage 2: Recommended Intervention */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Stage 1: Risk Assessment */}
              <div className="md:col-span-7 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-gold-hover" /> 1. Risk Assessment
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-navy-dark tabular-nums">
                    Risk Score: {riskScorePct}/100
                  </span>
                </div>

                {/* Risk Score Meter */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBarColor} transition-all`} style={{ width: `${riskScorePct}%` }} />
                </div>

                {activeOrder.reasonCodes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {activeOrder.reasonCodes.map((code) => (
                      <div key={code} className="bg-slate-50 p-2.5 rounded-[4px] border border-slate-200">
                        <div className="flex items-center gap-2">
                          <ReasonCodePill code={code} />
                          <span className="text-xs font-semibold text-navy-dark">
                            {REASON_CODE_META[code]?.label || code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {REASON_CODE_META[code]?.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] p-3 text-xs text-emerald-800">
                    No active risk flags. Verified address and strong merchant-scoped delivery history.
                  </div>
                )}
              </div>

              {/* Stage 2: Recommended Intervention & Unit Economics */}
              <div className="md:col-span-5 p-5 bg-navy text-white flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gold font-semibold">
                    2. Recommended Intervention
                  </div>
                  <div className="font-sans text-base font-bold text-white">
                    {activeOrder.recommendedIntervention}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeOrder.explanation}
                  </p>

                  <div className="pt-3 border-t border-white/10 space-y-2 text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Est. RTO Exposure</span>
                      <span className="font-mono font-bold text-red-300">
                        {formatINR(activeOrder.estimatedRtoExposure)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Intervention Cost</span>
                      <span className="font-mono font-bold text-gold">
                        {formatINR(activeOrder.interventionCost, true)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10">
                      <span className="text-emerald-300 font-semibold">Expected Net Impact</span>
                      <span className="font-mono font-bold text-emerald-300">
                        +{formatINR(activeOrder.expectedFinancialImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span className="truncate">{activeOrder.engineVersion}</span>
                </div>
              </div>
            </div>

            {/* Stage 3: Merchant Decision Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  3. Merchant Decision
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => approveIntervention(activeOrder.id)}
                    disabled={isClosed}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOverrideBox((v) => !v)}
                    disabled={isClosed}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Override
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => holdOrder(activeOrder.id)}
                    disabled={isClosed}
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Hold
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={isClosed}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </Button>

                  {activeOrder.status === 'Ready for Dispatch' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => dispatchOrder(activeOrder.id)}
                    >
                      <Truck className="w-3.5 h-3.5" /> Dispatch Now
                    </Button>
                  )}
                  {(activeOrder.status === 'Dispatched' || activeOrder.status === 'Ready for Dispatch') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recordDeliveryOutcome(activeOrder.id, 'Delivered')}
                      >
                        Mark Delivered
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recordDeliveryOutcome(activeOrder.id, 'NDR Open')}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Trigger NDR
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {showOverrideBox && (
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-[4px] flex flex-wrap gap-2 items-center">
                  <input
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder="Reason for overriding recommendation (e.g., Buyer confirmed on phone)..."
                    className="flex-1 min-w-[220px] h-8 px-2.5 text-xs border border-slate-200 rounded-[4px] text-navy"
                  />
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => {
                      overrideIntervention(
                        activeOrder.id,
                        'Ready for Dispatch',
                        overrideNote.trim() || 'Merchant manually cleared for dispatch'
                      );
                      setShowOverrideBox(false);
                      setOverrideNote('');
                    }}
                  >
                    Apply Override → Ready for Dispatch
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Communication Sandbox */}
          <CommunicationSandbox order={activeOrder} />
        </div>
      </div>

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => cancelOrder(activeOrder.id)}
        title={`Cancel Order ${activeOrder.id}?`}
        description="Cancelling pre-dispatch prevents forward and reverse shipping charges. Cancelled orders are tracked separately from rescued deliveries."
        confirmLabel="Cancel Order"
      />
    </div>
  );
}
