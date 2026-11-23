import React, { useMemo, useState } from 'react';
import {
  Truck,
  CalendarClock,
  CheckCircle2,
  MapPin,
  PhoneCall,
  FileEdit,
  ShieldAlert,
  Sparkles,
  Info,
} from 'lucide-react';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { Button, PageHeader } from '../components/ui/Primitives';
import { formatDateTime, formatINR } from '../utils/formatters';

function getNdrBadge(status) {
  const map = {
    'Pending Customer Response': 'bg-amber-50 text-amber-800 border-amber-200',
    Rescheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    Recovered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'At Risk of RTO': 'bg-red-50 text-red-700 border-red-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function NdrRecoveryPage() {
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const performNdrAction = useOrdexaStore((s) => s.performNdrAction);
  const simulateNdrRecovery = useOrdexaStore((s) => s.simulateNdrRecovery);

  const [selectedId, setSelectedId] = useState(ndrCases[0]?.id || null);
  const [replyInput, setReplyInput] = useState('Available tomorrow 5 PM – 7 PM, gate near Jain Temple');

  const selectedCase = useMemo(
    () => ndrCases.find((n) => n.id === selectedId) || ndrCases[0],
    [ndrCases, selectedId]
  );

  const stats = useMemo(() => {
    const total = ndrCases.length;
    const pending = ndrCases.filter((n) => n.recoveryStatus === 'Pending Customer Response').length;
    const rescheduled = ndrCases.filter((n) => n.recoveryStatus === 'Rescheduled').length;
    const recovered = ndrCases.filter((n) => n.recoveryStatus === 'Recovered').length;
    const atRisk = ndrCases.filter((n) => n.recoveryStatus === 'At Risk of RTO').length;
    return { total, pending, rescheduled, recovered, atRisk };
  }, [ndrCases]);

  const recoveryActions = [
    { label: 'Request Delivery Rescheduling', icon: CalendarClock },
    { label: 'Request Landmark', icon: MapPin },
    { label: 'Confirm Customer Availability', icon: PhoneCall },
    { label: 'Change Delivery Instructions', icon: FileEdit },
    { label: 'Escalate for Manual Review', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logistics & NDR Recovery"
        subtitle="Intercept failed courier delivery attempts with buyer re-confirmation, landmark updates, and hub re-attempt scheduling."
      />

      {/* Compact 5-Metric Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 tabular-nums">
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">Total NDR Cases</div>
          <div className="text-xl font-bold text-navy-dark mt-0.5">{stats.total}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">Pending Response</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{stats.pending}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">Rescheduled</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{stats.rescheduled}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">Recovered</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.recovered}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">At Risk of RTO</div>
          <div className="text-xl font-bold text-red-700 mt-0.5">{stats.atRisk}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Exception Queue Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-navy text-white flex items-center justify-between">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-gold" /> Active NDR Exception Queue
            </h3>
            <span className="font-mono text-[10px] text-gold">Select shipment to manage</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                  <th className="py-2.5 px-3.5">Shipment / Buyer</th>
                  <th className="py-2.5 px-3.5">Courier</th>
                  <th className="py-2.5 px-3.5">NDR Reason</th>
                  <th className="py-2.5 px-3.5">Attempt</th>
                  <th className="py-2.5 px-3.5">Customer Response</th>
                  <th className="py-2.5 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ndrCases.map((c) => {
                  const active = selectedCase?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer transition-colors ${
                        active ? 'bg-gold-subtle/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="font-mono font-bold text-navy-dark">{c.orderId}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.customerName} ({c.city})
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-navy border border-slate-200 rounded-[3px]">
                          {c.courier}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-700 max-w-[175px]">{c.ndrReason}</td>
                      <td className="py-2.5 px-3.5 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        <span className="font-mono font-bold text-navy-dark">#{c.attemptCount}</span>
                        <div className="text-[10px]">{formatDateTime(c.attemptDate)}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-[11px] text-navy max-w-[140px]">
                        {c.customerResponse}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[3px] text-[10px] font-semibold border whitespace-nowrap ${getNdrBadge(
                            c.recoveryStatus
                          )}`}
                        >
                          {c.recoveryStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shipment Timeline & Recovery Console */}
        <div className="lg:col-span-5 space-y-4">
          {selectedCase && (
            <div className="bg-white border border-slate-200 rounded-[4px] border-t-4 border-t-gold shadow-card p-5 space-y-4 text-xs">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div className="font-mono text-[11px] font-bold text-gold-hover">
                    {selectedCase.id} • {selectedCase.orderId}
                  </div>
                  <h3 className="font-sans text-base font-bold text-navy-dark mt-0.5">
                    {selectedCase.customerName} ({selectedCase.city})
                  </h3>
                  <div className="text-slate-500 mt-0.5">
                    {selectedCase.courier} • <strong className="text-navy">{selectedCase.ndrReason}</strong>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-[10px] uppercase text-slate-500">Exposure</div>
                  <div className="text-base font-bold text-red-700">
                    {formatINR(selectedCase.freightExposure)}
                  </div>
                </div>
              </div>

              {/* Delivery Attempt Timeline */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Delivery Attempt Timeline
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  {[
                    { step: 'Manifested', done: true },
                    { step: `Attempt #${selectedCase.attemptCount} NDR`, done: true, warn: true },
                    {
                      step: 'Buyer Outreach',
                      done: selectedCase.recoveryStatus !== 'At Risk of RTO',
                    },
                    {
                      step: selectedCase.recoveryStatus === 'Recovered' ? 'Recovered' : 'Re-attempt',
                      done: selectedCase.recoveryStatus === 'Recovered',
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className={`p-2 rounded-[3px] border font-medium ${
                        item.warn
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : item.done
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {item.step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Latest Action</div>
                <div className="text-navy-dark font-medium mt-0.5">{selectedCase.lastAction}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Trigger Recovery Action
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {recoveryActions.map((act) => {
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.label}
                        disabled={selectedCase.recoveryStatus === 'Recovered'}
                        onClick={() => performNdrAction(selectedCase.id, act.label)}
                        className="flex items-center justify-between px-3 py-2 rounded-[4px] border border-slate-200 bg-white hover:border-navy hover:bg-slate-50 text-navy-dark font-medium transition-colors disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-gold-hover" />
                          {act.label}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">Dispatch →</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Recovery Simulation */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Simulate Buyer Reply &amp; Recovery
                </div>
                <input
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  disabled={selectedCase.recoveryStatus === 'Recovered'}
                  className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy text-xs"
                />
                <Button
                  variant="success"
                  size="sm"
                  className="w-full"
                  disabled={selectedCase.recoveryStatus === 'Recovered'}
                  onClick={() => simulateNdrRecovery(selectedCase.id, replyInput)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedCase.recoveryStatus === 'Recovered'
                    ? 'Recovered & Delivered'
                    : 'Simulate Buyer Reply & Mark Recovered'}
                </Button>
              </div>
            </div>
          )}

          {/* Honest Future Capability Notice */}
          <div className="bg-navy text-white p-4 rounded-[4px] border-l-4 border-gold text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-gold">
                Future Capability: Courier Misconduct Verification
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed text-[11px]">
                GPS-based courier misconduct detection is presented strictly as a future roadmap
                capability and will only activate when verified courier GPS telemetry and call-log
                evidence are connected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
