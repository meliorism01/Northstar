import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  SectionTitle,
  Hint,
  Button,
} from '../components/ui/Primitives';
import { CHART, axisProps, gridProps, ChartTooltip } from '../components/charts/ChartKit';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR } from '../utils/formatters';

export function FinancialIntelligencePage() {
  const orders = useOrdexaStore((s) => s.orders);
  const messagingExpenses = useOrdexaStore((s) => s.messagingExpenses);

  const [sortBy, setSortBy] = useState('exposure'); // 'exposure' | 'value' | 'orders'

  const ledger = useMemo(() => {
    const verifiedDeliveredRescues = orders.filter(
      (o) => o.rescued && o.status === 'Delivered'
    );
    const pipelineRescues = orders.filter(
      (o) => o.rescued && !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
    );
    const preDispatchCancelled = orders.filter((o) => o.status === 'Cancelled');
    const actualRtos = orders.filter((o) => o.status === 'RTO');

    const verifiedGross = verifiedDeliveredRescues.reduce(
      (s, o) => s + (o.estimatedRtoExposure || 155),
      0
    );
    // Conservative 72% realization factor on pipeline rescues not yet delivered
    const pipelineAdjusted = pipelineRescues.reduce(
      (s, o) => s + Math.round((o.estimatedRtoExposure || 155) * 0.72),
      0
    );
    // Pre-dispatch cancellations avoid forward + reverse courier freight, tracked separately
    const cancelledFreightAvoided = preDispatchCancelled.reduce(
      (s, o) => s + ((o.forwardShippingCost || 72) + (o.reverseShippingCost || 78)),
      0
    );
    const rtoLossIncurred = actualRtos.reduce(
      (s, o) => s + (o.estimatedRtoExposure || 165),
      0
    );

    const netConservativeSavings = Math.max(
      0,
      Math.round(verifiedGross + pipelineAdjusted - messagingExpenses)
    );

    // SKU Margin & Exposure Table
    const skuMap = {};
    orders.forEach((o) => {
      const key = o.skuName || o.sku || 'Catalog Item';
      if (!skuMap[key]) {
        skuMap[key] = {
          skuName: key,
          orders: 0,
          gmv: 0,
          exposure: 0,
          rescuedCount: 0,
        };
      }
      skuMap[key].orders += 1;
      skuMap[key].gmv += o.orderValue;
      skuMap[key].exposure += o.estimatedRtoExposure || 150;
      if (o.rescued) skuMap[key].rescuedCount += 1;
    });

    const skuRows = Object.values(skuMap).sort((a, b) => {
      if (sortBy === 'value') return b.gmv - a.gmv;
      if (sortBy === 'orders') return b.orders - a.orders;
      return b.exposure - a.exposure;
    });

    return {
      verifiedDeliveredRescues,
      pipelineRescues,
      preDispatchCancelled,
      verifiedGross,
      pipelineAdjusted,
      cancelledFreightAvoided,
      rtoLossIncurred,
      netConservativeSavings,
      skuRows,
    };
  }, [orders, messagingExpenses, sortBy]);

  const monthlyCurve = [
    { month: 'Jun', BaselineLeakage: 18400, NetProtected: 7200 },
    { month: 'Jul', BaselineLeakage: 19200, NetProtected: 9800 },
    { month: 'Aug', BaselineLeakage: 17600, NetProtected: 11400 },
    { month: 'Sep', BaselineLeakage: 20500, NetProtected: 14900 },
    { month: 'Oct', BaselineLeakage: 19800, NetProtected: 16800 },
    {
      month: 'Nov',
      BaselineLeakage: 21200,
      NetProtected: 17400 + ledger.netConservativeSavings,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unit Economics · Conservative Attribution"
        title="Financial"
        accentWord="Intelligence"
        subtitle="Audit-ready RTO savings ledger separating verified delivered rescues, risk-adjusted pipeline rescues, and pre-dispatch cancellations minus outreach spend."
        icon={Wallet}
        iconTone="peri"
      />

      <Hint>
        <strong>Conservative Attribution Policy:</strong> NORTHSTAR never counts pre-dispatch cancelled orders as &ldquo;rescued revenue.&rdquo; Pre-dispatch cancellations are isolated under <em>Freight Burn Avoided</em>, while net rescue savings deduct every rupee of WhatsApp/SMS/IVR outreach spend.
      </Hint>

      {/* 4 Financial Ledger Buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Net Conservative Savings"
          value={formatINR(ledger.netConservativeSavings)}
          delta="Net of Spend"
          subtitle={`Verified (${formatINR(ledger.verifiedGross)}) + 72% Pipeline`}
          icon={ShieldCheck}
          accent="emerald"
        />
        <KpiCard
          title="Verified Delivered Rescues"
          value={formatINR(ledger.verifiedGross)}
          delta={`${ledger.verifiedDeliveredRescues.length} Orders`}
          subtitle="Completed doorstep deliveries after rescue"
          icon={TrendingUp}
          accent="peri"
        />
        <KpiCard
          title="Freight Avoided (Cancelled)"
          value={formatINR(ledger.cancelledFreightAvoided)}
          delta={`${ledger.preDispatchCancelled.length} Pre-Cancel`}
          subtitle="Tracked separately from delivered rescues"
          icon={XCircle}
          accent="coral"
        />
        <KpiCard
          title="Messaging & IVR Spend"
          value={`₹${messagingExpenses.toFixed(2)}`}
          delta="Deducted"
          subtitle={`Realized RTO Loss: ${formatINR(ledger.rtoLossIncurred)}`}
          icon={MessageSquare}
          accent="pink"
        />
      </div>

      {/* Area Chart: Baseline RTO Leakage vs Protected Margin */}
      <div className="rescale-card p-6">
        <SectionTitle
          title="Monthly RTO Freight Leakage vs. Net Protected Margin"
          subtitle="6-month trajectory incorporating live workspace rescues"
        />
        <div className="h-[280px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyCurve}>
              <defs>
                <linearGradient id="periGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.peri} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={CHART.peri} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.coral} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={CHART.coral} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => formatINR(v)} />} />
              <Area
                type="monotone"
                dataKey="BaselineLeakage"
                name="Unmitigated RTO Exposure"
                stroke={CHART.coral}
                strokeWidth={2.4}
                fill="url(#coralGrad)"
              />
              <Area
                type="monotone"
                dataKey="NetProtected"
                name="Net Margin Protected"
                stroke={CHART.peri}
                strokeWidth={2.6}
                fill="url(#periGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sortable SKU-Level RTO Exposure Table */}
      <div className="rescale-card overflow-hidden">
        <div className="p-6 border-b border-[#EEF0FA] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[17px] font-bold text-[#465478]">
              SKU-Level Freight Exposure &amp; Rescue Attribution
            </h3>
            <p className="text-[12.5px] text-[#8891AA]">
              Identify catalog items carrying the highest COD reverse-logistics risk
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={sortBy === 'exposure' ? 'primary' : 'outline'}
              size="xs"
              onClick={() => setSortBy('exposure')}
            >
              <ArrowUpDown className="w-3 h-3" /> Sort Exposure
            </Button>
            <Button
              variant={sortBy === 'value' ? 'primary' : 'outline'}
              size="xs"
              onClick={() => setSortBy('value')}
            >
              Sort GMV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#EEF0FA] text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                <th className="py-3.5 px-6">Product / SKU</th>
                <th className="py-3.5 px-4">Orders</th>
                <th className="py-3.5 px-4">Gross Order Value</th>
                <th className="py-3.5 px-4">RTO Freight Exposure</th>
                <th className="py-3.5 px-6 text-right">Rescued Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F9] text-[13px]">
              {ledger.skuRows.map((row) => (
                <tr key={row.skuName} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-3.5 px-6 font-display font-bold text-[#465478]">
                    {row.skuName}
                  </td>
                  <td className="py-3.5 px-4 num text-[#5C6888]">{row.orders}</td>
                  <td className="py-3.5 px-4 font-display font-bold text-[#465478] num">
                    {formatINR(row.gmv)}
                  </td>
                  <td className="py-3.5 px-4 font-display font-bold text-[#E05328] num">
                    {formatINR(row.exposure)}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#ECFEF6] text-[#17825B] border border-[#C3F3DE] text-[11.5px] font-display font-bold num">
                      {row.rescuedCount} rescued
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
