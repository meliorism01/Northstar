import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Wallet,
  CheckCircle2,
  PauseCircle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Button,
  Tabs,
  AttentionBadge,
  StatusBadge,
  ReasonCodePill,
  EmptyState,
} from '../components/ui/Primitives';
import { CommunicationSandbox } from '../components/communication/CommunicationSandbox';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { REASON_CODE_META } from '../services/scoringEngine';
import { formatINR } from '../utils/formatters';

export function RescueCentrePage() {
  const orders = useOrdexaStore((s) => s.orders);
  const messagingExpenses = useOrdexaStore((s) => s.messagingExpenses);
  const selectedOrderId = useOrdexaStore((s) => s.selectedOrderId);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const approveIntervention = useOrdexaStore((s) => s.approveIntervention);
  const overrideIntervention = useOrdexaStore((s) => s.overrideIntervention);
  const holdOrder = useOrdexaStore((s) => s.holdOrder);
  const dispatchOrder = useOrdexaStore((s) => s.dispatchOrder);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);

  const [queueTab, setQueueTab] = useState('ACTIONABLE'); // 'ACTIONABLE' | 'HIGH' | 'RESCUED' | 'ALL'

  const filteredQueue = useMemo(() => {
    return orders.filter((o) => {
      if (queueTab === 'ACTIONABLE') {
        return (
          o.attentionLevel !== 'LOW' &&
          !['Delivered', 'RTO', 'Cancelled', 'Dispatched'].includes(o.status)
        );
      }
      if (queueTab === 'HIGH') return o.attentionLevel === 'HIGH';
      if (queueTab === 'RESCUED') return Boolean(o.rescued);
      return true;
    });
  }, [orders, queueTab]);

  const activeOrder = useMemo(
    () =>
      orders.find((o) => o.id === selectedOrderId) ||
      filteredQueue[0] ||
      orders[0] ||
      null,
    [orders, selectedOrderId, filteredQueue]
  );

  const stats = useMemo(() => {
    const actionable = orders.filter(
      (o) =>
        o.attentionLevel !== 'LOW' &&
        !['Delivered', 'RTO', 'Cancelled', 'Dispatched'].includes(o.status)
    ).length;
    const rescuedTotal = orders.filter((o) => o.rescued).length;
    return { actionable, rescuedTotal };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pre-Dispatch · Proportionate Intervention"
        title="AI RTO"
        accentWord="Rescue"
        subtitle="Match every flagged order with the lightest effective verification—landmark prompts, 1-tap WhatsApp confirmation, or optional partial UPI—before courier handoff."
        icon={ShieldCheck}
        iconTone="coral"
        actions={
          <Button variant="primary" size="sm" onClick={simulateShopifyWebhook}>
            <Zap className="w-3.5 h-3.5" /> Inject Risky COD Order
          </Button>
        }
      />

      {/* Top Rescale KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          title="Flagged Rescue Queue"
          value={String(stats.actionable)}
          delta="Actionable"
          subtitle="Awaiting merchant approval or buyer reply"
          icon={ShieldCheck}
          accent="coral"
        />
        <KpiCard
          title="Confirmed Order Rescues"
          value={String(stats.rescuedTotal)}
          delta="Verified Intent"
          subtitle="Landmark or UPI verified prior to manifest"
          icon={Sparkles}
          accent="peri"
        />
        <KpiCard
          title="Cumulative Outreach Spend"
          value={`₹${messagingExpenses.toFixed(2)}`}
          delta="Sub-Rupee Avg"
          subtitle="Simulated WhatsApp, SMS & Voice IVR ledger"
          icon={Wallet}
          accent="pink"
        />
      </div>

      {/* Main Split Workspace: Left Intervention Queue + Right Live Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4">
          <div className="rescale-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs
                items={[
                  { id: 'ACTIONABLE', label: 'Actionable', count: stats.actionable },
                  { id: 'HIGH', label: 'High Risk' },
                  { id: 'RESCUED', label: 'Rescued', count: stats.rescuedTotal },
                  { id: 'ALL', label: 'All' },
                ]}
                value={queueTab}
                onChange={setQueueTab}
              />
            </div>

            {filteredQueue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Queue clear!"
                description="All flagged orders in this view have been resolved. Inject a simulated COD webhook order to test another rescue."
                action={
                  <Button variant="primary" size="sm" onClick={simulateShopifyWebhook}>
                    Inject Simulated Order
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredQueue.map((order) => {
                  const isSelected = activeOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`rounded-[20px] p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#F4F5FC] border-[#9AA6EA] shadow-rescale-card'
                          : 'bg-white border-[#E3E6FA] hover:border-[#C5CAEC]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[15px] font-extrabold text-[#465478]">
                            {order.id}
                          </span>
                          <AttentionBadge level={order.attentionLevel} />
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[#6E7896]">
                        <span>
                          <strong className="text-[#465478]">{order.customerName}</strong> ·{' '}
                          {order.address.city} ({order.address.pincode})
                        </span>
                        <span className="font-display font-bold text-[#465478] num">
                          {formatINR(order.orderValue)} ({order.paymentMode})
                        </span>
                      </div>

                      {/* Reason Codes */}
                      {(order.reasonCodes || []).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {order.reasonCodes.map((rc) => (
                            <span key={rc} title={REASON_CODE_META[rc]?.description || rc}>
                              <ReasonCodePill code={rc} />
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Proportionate Recommendation Bar */}
                      <div className="mt-3 pt-3 border-t border-[#E6E9F8] flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[12px]">
                          <span className="text-[#8891AA]">Recommended: </span>
                          <span className="font-display font-bold text-[#545C9E]">
                            {order.recommendedIntervention}
                          </span>
                          <span className="text-[#8891AA] ml-1.5 num">
                            (₹{Number(order.interventionCost || 0).toFixed(2)} vs{' '}
                            {formatINR(order.estimatedRtoExposure)} risk)
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {['Pending Verification', 'Held for Review'].includes(order.status) && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => approveIntervention(order.id)}
                            >
                              Approve <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                          {order.status === 'Ready for Dispatch' && (
                            <Button
                              variant="success"
                              size="xs"
                              onClick={() => dispatchOrder(order.id)}
                            >
                              Manifest
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              overrideIntervention(
                                order.id,
                                'Ready for Dispatch',
                                'Approved manually in Rescue Centre'
                              )
                            }
                          >
                            Override
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => holdOrder(order.id)}
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Communication Sandbox */}
        <div className="lg:col-span-6">
          <CommunicationSandbox order={activeOrder} />
        </div>
      </div>
    </div>
  );
}
