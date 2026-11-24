import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Truck,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Tabs,
  SectionTitle,
  ProgressBar,
  ReasonCodePill,
} from '../components/ui/Primitives';
import {
  CHART,
  axisProps,
  gridProps,
  ChartTooltip,
  MirroredCapsuleChart,
  PopOutDonutChart,
} from '../components/charts/ChartKit';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { REASON_CODE_META } from '../services/scoringEngine';
import { formatINR } from '../utils/formatters';

export function AnalyticsPage() {
  const orders = useOrdexaStore((s) => s.orders);
  const customers = useOrdexaStore((s) => s.customers);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);

  const [windowRange, setWindowRange] = useState('30D'); // '7D' | '30D' | 'QTD'

  const analytics = useMemo(() => {
    const total = Math.max(1, orders.length);
    const codOrders = orders.filter((o) => o.paymentMode === 'COD');
    const prepaidOrPartial = orders.filter((o) => o.paymentMode !== 'COD');
    const delivered = orders.filter((o) => o.status === 'Delivered');
    const rescued = orders.filter((o) => o.rescued);

    const deliveryPlusRescuePct = (((delivered.length + rescued.length) / total) * 100).toFixed(1);
    const prepaidShare = ((prepaidOrPartial.length / total) * 100).toFixed(1);

    // Reason Code Frequency
    const codeCounts = {};
    orders.forEach((o) => {
      (o.reasonCodes || []).forEach((rc) => {
        codeCounts[rc] = (codeCounts[rc] || 0) + 1;
      });
    });

    const palette = ['#FF9FD7', '#72E1FF', '#4A78D6', '#8C8CF5'];
    const reasonDonut = Object.entries(codeCounts)
      .slice(0, 4)
      .map(([code, count], idx) => ({
        name: REASON_CODE_META[code]?.label?.split(' ')[0] || code,
        code,
        value: count,
        color: palette[idx % palette.length],
      }));

    // Courier Aggregation
    const courierMap = {};
    orders.forEach((o) => {
      if (!courierMap[o.courier]) {
        courierMap[o.courier] = { courier: o.courier, Verified: 0, Flagged: 0, totalValue: 0 };
      }
      if (o.attentionLevel === 'LOW' || o.rescued || o.status === 'Delivered') {
        courierMap[o.courier].Verified += 1;
      } else {
        courierMap[o.courier].Flagged += 1;
      }
      courierMap[o.courier].totalValue += o.orderValue;
    });

    // City / PIN Cohort Table
    const cityMap = {};
    orders.forEach((o) => {
      const key = `${o.address.city}-${o.address.pincode}`;
      if (!cityMap[key]) {
        cityMap[key] = {
          city: o.address.city,
          pincode: o.address.pincode,
          orders: 0,
          highRisk: 0,
          exposure: 0,
        };
      }
      cityMap[key].orders += 1;
      if (o.attentionLevel === 'HIGH') cityMap[key].highRisk += 1;
      cityMap[key].exposure += o.estimatedRtoExposure || 150;
    });

    const ndrInterceptPct =
      ndrCases.length > 0
        ? Math.round(
            (ndrCases.filter((n) => n.recoveryStatus !== 'At Risk of RTO').length /
              ndrCases.length) *
              100
          )
        : 84;

    return {
      codCount: codOrders.length,
      deliveryPlusRescuePct,
      prepaidShare,
      ndrInterceptPct,
      reasonDonut,
      codeCounts,
      courierChart: Object.values(courierMap),
      cityCohorts: Object.values(cityMap).sort((a, b) => b.exposure - a.exposure),
    };
  }, [orders, ndrCases]);

  const capsuleTrend = useMemo(() => {
    if (windowRange === '7D') {
      return [
        { label: 'D1', top: 38, bottom: 20 },
        { label: 'D2', top: 44, bottom: 18 },
        { label: 'D3', top: 41, bottom: 22 },
        { label: 'D4', top: 49, bottom: 16 },
        { label: 'D5', top: 53, bottom: 15 },
        { label: 'D6', top: 50, bottom: 17 },
        { label: 'D7', top: 55, bottom: 13 },
      ];
    }
    if (windowRange === 'QTD') {
      return [
        { label: 'W1', top: 34, bottom: 28 },
        { label: 'W3', top: 39, bottom: 25 },
        { label: 'W5', top: 43, bottom: 22 },
        { label: 'W7', top: 48, bottom: 19 },
        { label: 'W9', top: 52, bottom: 16 },
        { label: 'W11', top: 56, bottom: 14 },
      ];
    }
    return [
      { label: 'W1', top: 36, bottom: 26 },
      { label: 'W2', top: 42, bottom: 22 },
      { label: 'W3', top: 48, bottom: 18 },
      { label: 'W4', top: 54, bottom: 14 },
    ];
  }, [windowRange]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights · Cohort & Courier Telemetry"
        title="Operational"
        accentWord="Analytics"
        subtitle="Track COD conversion health, reason-code distribution, courier SLA variance, and Tier-1/2/3 PIN code risk density."
        icon={BarChart3}
        iconTone="peri"
        actions={
          <Tabs
            items={[
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
              { id: 'QTD', label: 'Quarter' },
            ]}
            value={windowRange}
            onChange={setWindowRange}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Verified + Rescued Share"
          value={`${analytics.deliveryPlusRescuePct}%`}
          delta="+6.4% vs base"
          icon={TrendingUp}
          accent="peri"
        />
        <KpiCard
          title="Prepaid & Partial UPI"
          value={`${analytics.prepaidShare}%`}
          delta={`${analytics.codCount} COD`}
          icon={Sparkles}
          accent="cyan"
        />
        <KpiCard
          title="Day-1 NDR Intercept"
          value={`${analytics.ndrInterceptPct}%`}
          delta="Attempt #1"
          icon={Truck}
          accent="coral"
        />
        <KpiCard
          title="Buyer Profiles Indexed"
          value={String(customers.length)}
          delta="Merchant-Scoped"
          icon={MapPin}
          accent="pink"
        />
      </div>

      {/* Row 1: Rescale Capsule Trend + Pop-Out Reason Code Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <SectionTitle
            title={`Cohort Fulfilment Velocity (${windowRange})`}
            subtitle="Upward periwinkle capsules show verified dispatches; downward coral capsules show flagged RTO risk"
          />
          <div className="rescale-card p-6 flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-5 text-[12px] font-display font-semibold text-[#5C6888] mb-4">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7584D6]" />
                Verified &amp; Rescued
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FA9A7C]" />
                Flagged RTO Exposure
              </span>
            </div>
            <MirroredCapsuleChart
              data={capsuleTrend}
              topLabel="Verified & Rescued"
              bottomLabel="Flagged Exposure"
              maxVal={60}
              unitSuffix="%"
            />
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          <SectionTitle
            title="Risk Signal Mix"
            subtitle="Triggered rules across workspace orders"
          />
          <div className="rescale-card p-6 flex-1">
            <PopOutDonutChart
              items={analytics.reasonDonut}
              calloutTitle="Rules Engine"
              calloutSubtitle="Explainable"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Courier Partner Bar Chart + Destination PIN Risk Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 rescale-card p-6">
          <h3 className="font-display text-[16.5px] font-bold text-[#465478]">
            Courier Partner Verification Split
          </h3>
          <p className="text-[12px] text-[#8891AA] mb-5">
            Verified dispatches vs. unverified high-attention shipments per carrier
          </p>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.courierChart} barGap={6}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="courier" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="Verified"
                  name="Verified / Rescued"
                  fill={CHART.peri}
                  radius={[8, 8, 8, 8]}
                  barSize={20}
                />
                <Bar
                  dataKey="Flagged"
                  name="Flagged Risk"
                  fill={CHART.coral}
                  radius={[8, 8, 8, 8]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 rescale-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-[16.5px] font-bold text-[#465478]">
              PIN Code Exposure Hotspots
            </h3>
            <p className="text-[12px] text-[#8891AA] mb-4">
              Destination clusters ranked by cumulative RTO freight exposure
            </p>

            <div className="space-y-3">
              {analytics.cityCohorts.slice(0, 5).map((row) => (
                <div
                  key={`${row.city}-${row.pincode}`}
                  className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-display text-[13.5px] font-bold text-[#465478]">
                      {row.city} · <span className="font-mono text-[#7584D6]">{row.pincode}</span>
                    </span>
                    <span className="font-display text-[13px] font-extrabold text-[#465478] num">
                      {formatINR(row.exposure)} exposure
                    </span>
                  </div>
                  <ProgressBar
                    value={row.highRisk}
                    max={Math.max(1, row.orders)}
                    tone={row.highRisk > 0 ? 'coral' : 'peri'}
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-[#8891AA]">
                    <span>{row.orders} order(s)</span>
                    <span>{row.highRisk} high-attention COD</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#EEF0FA] flex flex-wrap gap-1.5">
            {Object.keys(analytics.codeCounts).map((code) => (
              <ReasonCodePill key={code} code={code} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
