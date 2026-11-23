import React, { useMemo, useState } from 'react';
import { Info, ArrowUpDown, Calendar } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { PageHeader } from '../components/ui/Primitives';
import { formatINR, formatPercent } from '../utils/formatters';

const NAVY = '#262B3E';
const GOLD = '#C9B38C';
const EMERALD = '#198754';
const RED = '#DC3545';
const SLATE = '#687693';

const DATE_RANGES = [
  { id: '7D', label: 'Last 7 Days', multiplier: 1 },
  { id: '30D', label: 'Last 30 Days', multiplier: 3.4 },
  { id: 'QTD', label: 'Quarter to Date', multiplier: 8.2 },
];

export function AnalyticsPage() {
  const orders = useOrdexaStore((s) => s.orders);
  const messagingExpenses = useOrdexaStore((s) => s.messagingExpenses);
  const [dateRange, setDateRange] = useState('7D');
  const [skuSort, setSkuSort] = useState({ field: 'avoided', dir: 'desc' });

  const mult = DATE_RANGES.find((r) => r.id === dateRange)?.multiplier ?? 1;

  const summary = useMemo(() => {
    const rescuedDelivered = orders.filter((o) => o.rescued && o.status === 'Delivered');
    const rescuedInProgress = orders.filter(
      (o) => o.rescued && ['Ready for Dispatch', 'Dispatched'].includes(o.status)
    );
    const cancelledPreDispatch = orders.filter((o) => o.status === 'Cancelled');

    const verifiedSavings = Math.round(
      rescuedDelivered.reduce((s, o) => s + (o.estimatedRtoExposure || 175), 0) * mult
    );
    const estimatedPipelineSavings = Math.round(
      rescuedInProgress.reduce((s, o) => s + (o.estimatedRtoExposure || 175), 0) * mult
    );
    const totalAvoided = verifiedSavings + estimatedPipelineSavings;

    const codOrders = orders.filter((o) => o.paymentMode === 'COD' || o.paymentMode === 'Partial Prepaid');
    const verifiedCod = codOrders.filter((o) => o.customerConfirmed).length;
    const preDispatchVerifyRate = codOrders.length ? (verifiedCod / codOrders.length) * 100 : 0;

    const closed = orders.filter((o) => o.status === 'Delivered' || o.status === 'RTO');
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    const deliverySuccessRate = closed.length ? (delivered / closed.length) * 100 : 0;

    const forwardTotal = Math.round(
      orders
        .filter((o) => !['Pending Verification', 'Held for Review', 'Cancelled'].includes(o.status))
        .reduce((s, o) => s + (o.forwardShippingCost || 70), 0) * mult
    );
    const reverseTotal = Math.round(
      orders
        .filter((o) => o.status === 'RTO')
        .reduce((s, o) => s + (o.reverseShippingCost || 76), 0) * mult
    );
    const codCharges = Math.round(
      orders.filter((o) => o.paymentMode === 'COD' && o.status !== 'Cancelled').length * 35 * mult
    );
    const partialDiscounts = Math.round(
      orders.filter((o) => o.paymentMode === 'Partial Prepaid').length * 50 * mult
    );
    const scaledMessaging = Number((messagingExpenses * mult).toFixed(2));
    const netFinancialImpact = Math.round(totalAvoided - scaledMessaging - partialDiscounts);

    return {
      totalAvoided,
      verifiedSavings,
      estimatedPipelineSavings,
      successfulInterventions: Math.round((rescuedDelivered.length + rescuedInProgress.length) * mult),
      cancelledCount: cancelledPreDispatch.length,
      preDispatchVerifyRate,
      deliverySuccessRate,
      opsHoursSaved: (((rescuedDelivered.length + rescuedInProgress.length) * 0.45 + 6.5) * mult).toFixed(1),
      forwardTotal,
      reverseTotal,
      codCharges,
      partialDiscounts,
      scaledMessaging,
      netFinancialImpact,
    };
  }, [orders, messagingExpenses, mult]);

  const funnelData = useMemo(() => {
    const flagged = orders.filter((o) => o.attentionLevel !== 'LOW').length;
    const contacted = orders.filter((o) => (o.messages || []).length > 0 || o.rescued).length;
    const confirmed = orders.filter((o) => o.rescued && o.status !== 'Cancelled').length;
    const delivered = orders.filter((o) => o.rescued && o.status === 'Delivered').length;
    return [
      { stage: 'Flagged Risk', count: Math.round(flagged * mult) },
      { stage: 'Outreach Sent', count: Math.round(Math.max(contacted, confirmed) * mult) },
      { stage: 'Verified/Rescued', count: Math.round(confirmed * mult) },
      { stage: 'Delivered', count: Math.round(delivered * mult) },
    ];
  }, [orders, mult]);

  const codVsPrepaid = useMemo(() => {
    const calc = (modeFilter) => {
      const subset = orders.filter(modeFilter);
      const del = subset.filter((o) => o.status === 'Delivered').length;
      const rto = subset.filter((o) => o.status === 'RTO').length;
      const closed = del + rto || 1;
      return {
        deliveryRate: Math.round((del / closed) * 100),
        rtoRate: Math.round((rto / closed) * 100),
      };
    };
    const cod = calc((o) => o.paymentMode === 'COD');
    const pre = calc((o) => o.paymentMode !== 'COD');
    return [
      { type: 'COD Orders', Delivered: cod.deliveryRate, RTO: cod.rtoRate },
      { type: 'Prepaid / Partial', Delivered: pre.deliveryRate, RTO: pre.rtoRate },
    ];
  }, [orders]);

  const rtoTrends = [
    { week: 'Wk 1', baselineRto: 26, ordexaRto: 24 },
    { week: 'Wk 2', baselineRto: 25, ordexaRto: 20 },
    { week: 'Wk 3', baselineRto: 27, ordexaRto: 17 },
    { week: 'Wk 4', baselineRto: 26, ordexaRto: 14 },
  ];

  const effectivenessData = [
    { name: 'Address Clarify', rescuedPct: 84 },
    { name: 'WA Confirm', rescuedPct: 88 },
    { name: 'Partial UPI', rescuedPct: 67 },
    { name: 'NDR Recovery', rescuedPct: 76 },
  ];

  const leakageByState = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const st = o.address.state || 'Other';
      if (!map[st]) map[st] = { state: st, exposure: 0 };
      if (o.status === 'RTO' || o.attentionLevel === 'HIGH' || o.status === 'NDR Open') {
        map[st].exposure += Math.round((o.estimatedRtoExposure || 175) * mult);
      }
    });
    return Object.values(map)
      .filter((x) => x.exposure > 0)
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 6);
  }, [orders, mult]);

  const skuTableRows = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (!map[o.sku]) {
        map[o.sku] = {
          sku: o.sku,
          skuName: o.skuName,
          totalOrders: 0,
          rescuedCount: 0,
          rtoCount: 0,
          avoided: 0,
          rtoLoss: 0,
        };
      }
      map[o.sku].totalOrders += 1;
      if (o.rescued && o.status !== 'Cancelled' && o.status !== 'RTO') {
        map[o.sku].rescuedCount += 1;
        map[o.sku].avoided += Math.round((o.estimatedRtoExposure || 175) * mult);
      }
      if (o.status === 'RTO') {
        map[o.sku].rtoCount += 1;
        map[o.sku].rtoLoss += Math.round((o.forwardShippingCost + o.reverseShippingCost + 35) * mult);
      }
    });
    const list = Object.values(map).map((r) => ({
      ...r,
      net: r.avoided - r.rtoLoss,
    }));
    const dir = skuSort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => (a[skuSort.field] - b[skuSort.field]) * dir);
  }, [orders, mult, skuSort]);

  const toggleSkuSort = (field) => {
    setSkuSort((p) => (p.field === field ? { field, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial Leakage Analytics"
        subtitle="Audit forward shipping, reverse freight, COD fees, and messaging expenses—separating verified delivered rescues from modeled pipeline savings."
        actions={
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-[4px] p-0.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-[3px] transition-colors ${
                  dateRange === r.id
                    ? 'bg-navy text-white font-semibold'
                    : 'text-slate-600 hover:text-navy-dark'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Accounting Methodology Notice */}
      <div className="px-4 py-2.5 bg-gold-subtle/80 border border-gold/60 rounded-[4px] text-xs text-navy-dark flex items-start gap-2.5">
        <Info className="w-4 h-4 text-navy flex-shrink-0 mt-0.5" />
        <div>
          <strong>Conservative Accounting Policy:</strong> Verified Delivered Rescue Savings (
          <strong className="tabular-nums">{formatINR(summary.verifiedSavings)}</strong>) are separated from
          In-Transit Modeled Savings (
          <strong className="tabular-nums">{formatINR(summary.estimatedPipelineSavings)}</strong>).
          Pre-dispatch cancelled orders ({summary.cancelledCount}) are never counted as rescued deliveries.
        </div>
      </div>

      {/* Hierarchical Financial KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {/* Primary Highlight */}
        <div className="md:col-span-4 p-5 bg-navy text-white flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-gold font-semibold">
              Net Financial Rescue Impact ({dateRange})
            </div>
            <div className="text-3xl font-bold text-white mt-1.5 tabular-nums">
              {summary.netFinancialImpact >= 0 ? '+' : ''}
              {formatINR(summary.netFinancialImpact)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs tabular-nums">
            <span className="text-slate-300">
              Verified: <strong className="text-emerald-300">{formatINR(summary.verifiedSavings)}</strong>
            </span>
            <span className="text-slate-300">
              Modeled: <strong className="text-gold">{formatINR(summary.estimatedPipelineSavings)}</strong>
            </span>
          </div>
        </div>

        {/* Secondary Operational KPIs */}
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-slate-100 tabular-nums">
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Est. Freight Avoided</div>
            <div className="text-lg font-bold text-navy-dark mt-1">{formatINR(summary.totalAvoided)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{summary.successfulInterventions} interventions</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Pre-Dispatch Verify</div>
            <div className="text-lg font-bold text-navy-dark mt-1">
              {formatPercent(summary.preDispatchVerifyRate)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">COD intent confirmed</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Delivery Success</div>
            <div className="text-lg font-bold text-emerald-700 mt-1">
              {formatPercent(summary.deliverySuccessRate)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Closed orders</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Messaging Expenses</div>
            <div className="text-lg font-bold text-navy-dark mt-1">
              {formatINR(summary.scaledMessaging, true)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">WhatsApp + SMS + IVR</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Ops Hours Saved</div>
            <div className="text-lg font-bold text-navy-dark mt-1">{summary.opsHoursSaved} hrs</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Automated triage</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] uppercase font-semibold text-slate-500">Forward + Reverse</div>
            <div className="text-lg font-bold text-navy-dark mt-1">
              {formatINR(summary.forwardTotal + summary.reverseTotal)}
            </div>
            <div className="text-[11px] text-red-600 mt-0.5">Reverse: {formatINR(summary.reverseTotal)}</div>
          </div>
        </div>
      </div>

      {/* Unit Economics Ledger Strip */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card p-4">
        <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-3">
          Unit Economics Cost Breakdown ({dateRange})
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums text-xs">
          <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-200">
            <div className="text-slate-500">Forward Shipping</div>
            <div className="text-base font-bold text-navy-dark mt-0.5">{formatINR(summary.forwardTotal)}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-200">
            <div className="text-slate-500">Reverse Shipping (RTO)</div>
            <div className="text-base font-bold text-red-700 mt-0.5">{formatINR(summary.reverseTotal)}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-200">
            <div className="text-slate-500">COD Handling Fees</div>
            <div className="text-base font-bold text-navy-dark mt-0.5">{formatINR(summary.codCharges)}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-200">
            <div className="text-slate-500">UPI Incentives / Disc.</div>
            <div className="text-base font-bold text-amber-700 mt-0.5">{formatINR(summary.partialDiscounts)}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-200">
            <div className="text-slate-500">Messaging Spend</div>
            <div className="text-base font-bold text-navy-dark mt-0.5">{formatINR(summary.scaledMessaging, true)}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-[4px] border border-emerald-200">
            <div className="text-emerald-800 font-semibold">= Net Rescue Impact</div>
            <div className="text-base font-bold text-emerald-800 mt-0.5">
              {summary.netFinancialImpact >= 0 ? '+' : ''}
              {formatINR(summary.netFinancialImpact)}
            </div>
          </div>
        </div>
      </div>

      {/* 6 Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">1. Order Intervention Funnel</h3>
          <p className="text-[11px] text-slate-500 mb-3">Conversion from flagged risk to verified delivery</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: NAVY }} />
                <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                <Tooltip />
                <Bar dataKey="count" name="Orders" fill={NAVY} barSize={36} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">2. COD vs Prepaid Performance (%)</h3>
          <p className="text-[11px] text-slate-500 mb-3">Delivery success vs RTO rate by payment type</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={codVsPrepaid}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: NAVY }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: SLATE }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Delivered" fill={EMERALD} barSize={28} radius={[3, 3, 0, 0]} />
                <Bar dataKey="RTO" fill={RED} barSize={28} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">3. RTO Rate Trend (%): Baseline vs ORDEXA</h3>
          <p className="text-[11px] text-slate-500 mb-3">Weekly progression of avoidable COD returns</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rtoTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: SLATE }} />
                <YAxis domain={[10, 32]} tick={{ fontSize: 11, fill: SLATE }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="baselineRto" name="Industry Baseline %" stroke={RED} strokeDasharray="4 4" strokeWidth={2} />
                <Line type="monotone" dataKey="ordexaRto" name="ORDEXA Assisted %" stroke={NAVY} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">4. Intervention Effectiveness (%)</h3>
          <p className="text-[11px] text-slate-500 mb-3">Successful resolution rate by intervention playbook</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={effectivenessData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: NAVY }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: SLATE }} />
                <Tooltip />
                <Bar dataKey="rescuedPct" name="Resolution %" fill={GOLD} barSize={34} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">5. Logistics Leakage &amp; Exposure by State (₹)</h3>
          <p className="text-[11px] text-slate-500 mb-3">States contributing highest RTO &amp; NDR freight exposure</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leakageByState} layout="vertical" margin={{ left: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} />
                <YAxis type="category" dataKey="state" width={95} tick={{ fontSize: 11, fill: NAVY }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="exposure" name="Freight Exposure" fill={RED} barSize={18} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-card">
          <h3 className="font-sans text-sm font-bold text-navy-dark mb-0.5">6. Financial Impact by SKU (₹)</h3>
          <p className="text-[11px] text-slate-500 mb-3">Avoided freight exposure vs realized RTO loss per SKU</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skuTableRows.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="sku" tick={{ fontSize: 10, fill: NAVY }} />
                <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend />
                <Bar dataKey="avoided" name="Avoided Loss (₹)" fill={EMERALD} barSize={20} radius={[3, 3, 0, 0]} />
                <Bar dataKey="rtoLoss" name="Realized RTO (₹)" fill={RED} barSize={20} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Accompanying SKU-Level Financial Data Table */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-sans text-sm font-bold text-navy-dark">SKU-Level Financial Performance</h3>
            <p className="text-[11px] text-slate-500">Click column headers to sort by freight savings or RTO loss</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th
                  onClick={() => toggleSkuSort('totalOrders')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-navy-dark"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Orders <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSkuSort('rescuedCount')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-navy-dark"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Rescued <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSkuSort('avoided')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-navy-dark"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Est. Avoided <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSkuSort('rtoLoss')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-navy-dark"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Realized RTO Loss <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSkuSort('net')}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-navy-dark"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Net Impact <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {skuTableRows.map((row) => (
                <tr key={row.sku} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-navy-dark">{row.sku}</td>
                  <td className="py-2.5 px-4 text-slate-700">{row.skuName}</td>
                  <td className="py-2.5 px-4 text-right font-mono">{row.totalOrders}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                    {row.rescuedCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                    {formatINR(row.avoided)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-red-700">
                    {formatINR(row.rtoLoss)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-bold ${
                      row.net >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {row.net >= 0 ? '+' : ''}
                    {formatINR(row.net)}
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
