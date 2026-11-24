import React, { useState, useMemo } from 'react';
import {
  Truck,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  MapPin,
  PhoneForwarded,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Button,
  Tabs,
  IconTile,
  inputClass,
  EmptyState,
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

export function NdrRecoveryPage() {
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const performNdrAction = useOrdexaStore((s) => s.performNdrAction);
  const simulateNdrRecovery = useOrdexaStore((s) => s.simulateNdrRecovery);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedNdrId, setSelectedNdrId] = useState(ndrCases[0]?.id || null);
  const [replyDraft, setReplyDraft] = useState(
    'Available tomorrow 11 AM – 4 PM; landmark is Opposite SBI Main Branch.'
  );

  const stats = useMemo(() => {
    const open = ndrCases.filter((n) => n.recoveryStatus !== 'Recovered');
    const critical = open.filter(
      (n) => n.attemptCount >= 2 || n.recoveryStatus === 'At Risk of RTO'
    );
    const recovered = ndrCases.filter((n) => n.recoveryStatus === 'Recovered');
    const exposureAtRisk = open.reduce((sum, n) => sum + (n.freightExposure || 160), 0);
    return {
      openCount: open.length,
      criticalCount: critical.length,
      recoveredCount: recovered.length,
      exposureAtRisk,
    };
  }, [ndrCases]);

  const filteredCases = useMemo(() => {
    if (statusFilter === 'ALL') return ndrCases;
    return ndrCases.filter((n) => n.recoveryStatus === statusFilter);
  }, [ndrCases, statusFilter]);

  const activeCase = useMemo(
    () =>
      ndrCases.find((n) => n.id === selectedNdrId) ||
      filteredCases[0] ||
      ndrCases[0] ||
      null,
    [ndrCases, selectedNdrId, filteredCases]
  );

  const getNdrBadgeClass = (status) => {
    if (status === 'Recovered') return 'bg-[#ECFEF6] text-[#17825B] border-[#C3F3DE]';
    if (status === 'Rescheduled') return 'bg-[#EEF2FF] text-[#545C9E] border-[#DFE1F5]';
    if (status === 'At Risk of RTO') return 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]';
    return 'bg-[#FFF5ED] text-[#D96030] border-[#FDE0CA]';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="In-Transit · Exception Management"
        title="NDR"
        accentWord="Recovery"
        subtitle="Intercept failed courier delivery attempts on Day 1—collect updated buyer landmarks or preferred delivery slots before Attempt #3 converts to RTO."
        icon={Truck}
        iconTone="coral"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Open NDR Exceptions"
          value={String(stats.openCount)}
          delta="Active"
          icon={Truck}
          accent="peri"
        />
        <KpiCard
          title="Attempt #2+ Critical"
          value={String(stats.criticalCount)}
          delta="High Priority"
          icon={AlertTriangle}
          accent="coral"
        />
        <KpiCard
          title="Recovered Shipments"
          value={String(stats.recoveredCount)}
          delta="Delivered"
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          title="Reverse Freight at Risk"
          value={formatINR(stats.exposureAtRisk)}
          delta="Saveable"
          icon={Wallet}
          accent="pink"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: NDR Queue */}
        <div className="lg:col-span-7 rescale-card p-5 space-y-4">
          <Tabs
            items={[
              { id: 'ALL', label: 'All Cases', count: ndrCases.length },
              { id: 'Pending Customer Response', label: 'Pending Reply' },
              { id: 'Rescheduled', label: 'Rescheduled' },
              { id: 'At Risk of RTO', label: 'At Risk of RTO' },
              { id: 'Recovered', label: 'Recovered', count: stats.recoveredCount },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {filteredCases.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No NDR cases in this bucket"
              description="Switch tabs above to inspect other courier delivery exceptions."
            />
          ) : (
            <div className="space-y-3">
              {filteredCases.map((ndr) => {
                const isSelected = activeCase?.id === ndr.id;
                return (
                  <div
                    key={ndr.id}
                    onClick={() => setSelectedNdrId(ndr.id)}
                    className={`rounded-[20px] p-4 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#F4F5FC] border-[#9AA6EA] shadow-rescale-card'
                        : 'bg-white border-[#E3E6FA] hover:border-[#C5CAEC]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[14.5px] font-extrabold text-[#465478]">
                          {ndr.orderId}
                        </span>
                        <span className="font-mono text-[11px] text-[#7584D6] bg-[#EEF0FA] px-2 py-0.5 rounded-full">
                          {ndr.id} · Attempt #{ndr.attemptCount}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold border ${getNdrBadgeClass(
                          ndr.recoveryStatus
                        )}`}
                      >
                        {ndr.recoveryStatus}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[#6E7896]">
                      <span>
                        <strong className="text-[#465478]">{ndr.customerName}</strong> · {ndr.city}{' '}
                        · {ndr.courier}
                      </span>
                      <span className="font-display font-bold text-[#465478] num">
                        Cart {formatINR(ndr.orderValue)} · Freight Risk{' '}
                        <span className="text-[#E05328]">{formatINR(ndr.freightExposure)}</span>
                      </span>
                    </div>

                    <div className="mt-2 text-[12px] text-[#5C6888] bg-[#F9FAFB] rounded-[12px] px-3 py-2 border border-[#EEF0FA]">
                      <span className="font-display font-bold text-[#465478]">Courier Remark: </span>
                      {ndr.ndrReason}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active NDR Action & Recovery Simulator */}
        <div className="lg:col-span-5 rescale-card p-6 space-y-5">
          {activeCase ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EEF0FA]">
                <div className="flex items-center gap-3">
                  <IconTile icon={Truck} tone="coral" size="md" />
                  <div>
                    <h3 className="font-display text-[17px] font-extrabold text-[#465478]">
                      {activeCase.orderId} · {activeCase.courier}
                    </h3>
                    <p className="text-[12px] text-[#8891AA]">
                      {activeCase.customerName} ({activeCase.city}) · Logged{' '}
                      {formatDateTime(activeCase.attemptDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 space-y-2 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-[#8891AA]">Exception Reason</span>
                  <span className="font-display font-bold text-[#465478]">
                    {activeCase.ndrReason}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8891AA]">Buyer Response</span>
                  <span className="font-display font-semibold text-[#545C9E]">
                    {activeCase.customerResponse}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8891AA]">Last Ops Action</span>
                  <span className="text-[#6E7896] text-right max-w-[220px]">
                    {activeCase.lastAction}
                  </span>
                </div>
              </div>

              {/* Merchant NDR Outreach Actions */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                  1. Trigger Automated Buyer NDR Outreach (₹0.85)
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    disabled={activeCase.recoveryStatus === 'Recovered'}
                    onClick={() =>
                      performNdrAction(activeCase.id, 'Request Delivery Rescheduling')
                    }
                  >
                    <CalendarClock className="w-4 h-4 text-[#7584D6]" />
                    Request Preferred Delivery Slot via WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    disabled={activeCase.recoveryStatus === 'Recovered'}
                    onClick={() =>
                      performNdrAction(activeCase.id, 'Request Updated Landmark / Pin')
                    }
                  >
                    <MapPin className="w-4 h-4 text-[#7584D6]" />
                    Request Voice/Text Landmark Pin for Courier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    disabled={activeCase.recoveryStatus === 'Recovered'}
                    onClick={() => performNdrAction(activeCase.id, 'Escalate for Manual Review')}
                  >
                    <PhoneForwarded className="w-4 h-4 text-[#FA6E43]" />
                    Escalate Attempt #{activeCase.attemptCount} to Ops Tele-Desk
                  </Button>
                </div>
              </div>

              {/* Simulate Successful Recovery */}
              <div className="rounded-[20px] bg-[#F4F5FC] border border-[#DFE1F5] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11.5px] font-display font-bold text-[#545C9E]">
                  <Sparkles className="w-4 h-4 text-[#7584D6]" />
                  2. Simulate Buyer Reply &amp; Re-Attempt Delivery
                </div>
                <textarea
                  rows={2}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  disabled={activeCase.recoveryStatus === 'Recovered'}
                  className={`${inputClass} bg-white`}
                />
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={activeCase.recoveryStatus === 'Recovered'}
                  onClick={() => simulateNdrRecovery(activeCase.id, replyDraft)}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {activeCase.recoveryStatus === 'Recovered'
                    ? 'Shipment Already Recovered & Delivered'
                    : `Simulate Re-Attempt Success (Save ${formatINR(activeCase.freightExposure)})`}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
