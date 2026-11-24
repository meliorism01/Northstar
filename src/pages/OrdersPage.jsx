import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  Upload,
  Plus,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Truck,
  PauseCircle,
  XCircle,
  Eye,
  MessageSquare,
  GitFork,
  FileSpreadsheet,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Button,
  Tabs,
  AttentionBadge,
  StatusBadge,
  StoreBadge,
  ReasonCodePill,
  Drawer,
  Modal,
  ConfirmDialog,
  Field,
  inputClass,
  EmptyState,
  Hint,
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { REASON_CODE_META } from '../services/scoringEngine';
import { formatINR, formatDateTime, maskPhone } from '../utils/formatters';

const SAMPLE_CSV = `customerName,phone,orderValue,paymentMode,line1,landmark,city,state,pincode,courier,skuName
Meera Joshi,9829011223,2199,COD,House 18 Vaishali Nagar,,Jaipur,Rajasthan,302021,Delhivery,Saffron Glow Cream
Karan Malhotra,9810455678,1450,Prepaid,Flat 902 DLF Phase 4,Near Galleria Market,Gurugram,Haryana,122009,BlueDart,Handwoven Cushion Pair
Rohan Verma,9793112244,2899,COD,Sector 8 Indira Nagar,,Lucknow,Uttar Pradesh,226016,Shiprocket,Brass Dhuna Loban Burner`;

export function OrdersPage() {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const customers = useOrdexaStore((s) => s.customers);
  const stores = useOrdexaStore((s) => s.stores);
  const privacySettings = useOrdexaStore((s) => s.privacySettings);
  const globalSearch = useOrdexaStore((s) => s.globalSearch);
  const selectedOrderId = useOrdexaStore((s) => s.selectedOrderId);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);

  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);
  const addManualOrder = useOrdexaStore((s) => s.addManualOrder);
  const importCsvOrders = useOrdexaStore((s) => s.importCsvOrders);
  const approveIntervention = useOrdexaStore((s) => s.approveIntervention);
  const overrideIntervention = useOrdexaStore((s) => s.overrideIntervention);
  const holdOrder = useOrdexaStore((s) => s.holdOrder);
  const cancelOrder = useOrdexaStore((s) => s.cancelOrder);
  const dispatchOrder = useOrdexaStore((s) => s.dispatchOrder);
  const recordDeliveryOutcome = useOrdexaStore((s) => s.recordDeliveryOutcome);

  const bulkApproveOrders = useOrdexaStore((s) => s.bulkApproveOrders);
  const bulkHoldOrders = useOrdexaStore((s) => s.bulkHoldOrders);
  const bulkDispatchOrders = useOrdexaStore((s) => s.bulkDispatchOrders);
  const bulkCancelOrders = useOrdexaStore((s) => s.bulkCancelOrders);

  const [statusTab, setStatusTab] = useState('ALL');
  const [attentionFilter, setAttentionFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [confirmCancelState, setConfirmCancelState] = useState({ open: false, ids: [] });

  const [manualForm, setManualForm] = useState({
    store: 'VedaGlow Botanicals',
    customerName: '',
    phone: '',
    skuName: 'Kumkumadi Radiance Facial Oil',
    orderValue: '2199',
    paymentMode: 'COD',
    courier: 'Delhivery',
    line1: '',
    landmark: '',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302019',
  });
  const [manualError, setManualError] = useState('');

  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [csvError, setCsvError] = useState('');

  const inspectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );

  const inspectedCustomer = useMemo(
    () =>
      inspectedOrder
        ? customers.find((c) => c.id === inspectedOrder.customerId) || null
        : null,
    [customers, inspectedOrder]
  );

  const statusTabs = useMemo(() => {
    const countFor = (st) => orders.filter((o) => o.status === st).length;
    return [
      { id: 'ALL', label: 'All Orders', count: orders.length },
      { id: 'Pending Verification', label: 'Pending', count: countFor('Pending Verification') },
      { id: 'Awaiting Customer', label: 'Awaiting Reply', count: countFor('Awaiting Customer') },
      { id: 'Held for Review', label: 'Held', count: countFor('Held for Review') },
      { id: 'Ready for Dispatch', label: 'Ready', count: countFor('Ready for Dispatch') },
      { id: 'Dispatched', label: 'Dispatched', count: countFor('Dispatched') },
      { id: 'Delivered', label: 'Delivered', count: countFor('Delivered') },
      { id: 'RTO', label: 'RTO', count: countFor('RTO') },
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = (localSearch || globalSearch).trim().toLowerCase();
    return orders.filter((o) => {
      if (statusTab !== 'ALL' && o.status !== statusTab) return false;
      if (attentionFilter !== 'ALL' && o.attentionLevel !== attentionFilter) return false;
      if (storeFilter !== 'ALL' && o.store !== storeFilter) return false;
      if (query) {
        const hay = `${o.id} ${o.customerName} ${o.address.city} ${o.address.pincode} ${o.skuName} ${o.courier}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [orders, statusTab, attentionFilter, storeFilter, localSearch, globalSearch]);

  const kpis = useMemo(() => {
    const highRisk = orders.filter((o) => o.attentionLevel === 'HIGH').length;
    const readyCount = orders.filter((o) => o.status === 'Ready for Dispatch').length;
    const activeExposure = orders
      .filter((o) => !['Delivered', 'Cancelled'].includes(o.status) && o.attentionLevel !== 'LOW')
      .reduce((sum, o) => sum + (o.estimatedRtoExposure || 150), 0);
    return { highRisk, readyCount, activeExposure };
  }, [orders]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openInspector = (orderId) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.customerName.trim() || !manualForm.line1.trim() || !manualForm.city.trim()) {
      setManualError('Buyer name, street address line, and city are required.');
      return;
    }
    setManualError('');
    const created = addManualOrder(manualForm);
    setManualModalOpen(false);
    setManualForm((f) => ({ ...f, customerName: '', phone: '', line1: '', landmark: '' }));
    if (created?.id) {
      openInspector(created.id);
    }
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleImportCsv = () => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setCsvError('Provide a header row and at least one order row.');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.trim());
    const parsedRows = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      return obj;
    });
    const valid = parsedRows.filter((r) => r.customerName);
    if (valid.length === 0) {
      setCsvError('Column "customerName" is required in CSV rows.');
      return;
    }
    setCsvError('');
    importCsvOrders(valid);
    setCsvModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Pre-Dispatch Queue"
        title="Order"
        accentWord="Management"
        subtitle="Score incoming COD & prepaid orders with deterministic reason codes, import live CSV batches, and run proportionate verification."
        icon={PackageCheck}
        iconTone="peri"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCsvModalOpen(true)}>
              <Upload className="w-3.5 h-3.5 text-[#7584D6]" /> CSV Import (Live)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setManualModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 text-[#7584D6]" /> Manual Order
            </Button>
            <Button variant="primary" size="sm" onClick={simulateShopifyWebhook}>
              <Zap className="w-3.5 h-3.5" /> Simulate Webhook
            </Button>
          </>
        }
      />

      {/* Top Rescale KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Workspace Orders"
          value={String(orders.length)}
          delta={`${filteredOrders.length} Shown`}
          icon={PackageCheck}
          accent="peri"
        />
        <KpiCard
          title="High Attention COD"
          value={String(kpis.highRisk)}
          delta="Needs Check"
          icon={AlertTriangle}
          accent="coral"
        />
        <KpiCard
          title="Ready for Dispatch"
          value={String(kpis.readyCount)}
          delta="Verified"
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          title="Freight Exposure Flagged"
          value={formatINR(kpis.activeExposure)}
          delta="Protected"
          icon={Truck}
          accent="pink"
        />
      </div>

      {/* Filters + Tabs Card */}
      <div className="rescale-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs items={statusTabs} value={statusTab} onChange={setStatusTab} />

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter ID, buyer, PIN, SKU…"
              className={`${inputClass} sm:w-56`}
            />

            <select
              value={attentionFilter}
              onChange={(e) => setAttentionFilter(e.target.value)}
              aria-label="Filter by attention level"
              className={`${inputClass} sm:w-40`}
            >
              <option value="ALL">All Attention</option>
              <option value="HIGH">High Attention</option>
              <option value="MEDIUM">Medium Attention</option>
              <option value="LOW">Low Attention</option>
            </select>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              aria-label="Filter by store"
              className={`${inputClass} sm:w-48`}
            >
              <option value="ALL">All Channels</option>
              {stores.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Select Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="rounded-[18px] bg-[#EEF0FA] border border-[#CFD5F4] px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
            <span className="font-display text-[13px] font-bold text-[#465478]">
              {selectedIds.length} order(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  bulkApproveOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                Approve Interventions
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  bulkDispatchOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                Manifest Ready
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  bulkHoldOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                Hold Review
              </Button>
              <Button
                variant="danger"
                size="xs"
                onClick={() => setConfirmCancelState({ open: true, ids: selectedIds })}
              >
                Cancel Pre-Dispatch
              </Button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No matching orders"
            description="Adjust your status tab or attention filter, or simulate a fresh Shopify webhook order."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusTab('ALL');
                  setAttentionFilter('ALL');
                  setStoreFilter('ALL');
                  setLocalSearch('');
                }}
              >
                Clear All Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-[#EEF0FA]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#EEF0FA] text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredOrders.length > 0 &&
                        selectedIds.length === filteredOrders.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all visible orders"
                      className="rounded border-[#C5CAEC] text-[#7584D6] focus:ring-[#7584D6]"
                    />
                  </th>
                  <th className="py-3.5 px-3">Order &amp; Store</th>
                  <th className="py-3.5 px-3">Buyer &amp; Destination</th>
                  <th className="py-3.5 px-3">Cart &amp; Mode</th>
                  <th className="py-3.5 px-3">RTO Attention &amp; Signals</th>
                  <th className="py-3.5 px-3">Recommended Action</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F9] text-[13px] bg-white">
                {filteredOrders.map((order) => {
                  const checked = selectedIds.includes(order.id);
                  const displayPhone = privacySettings.maskPhoneByDefault
                    ? maskPhone(order.phone)
                    : `+91 ${order.phone}`;
                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-[#F9FAFB] transition-colors ${
                        checked ? 'bg-[#F5F6FD]' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectRow(order.id)}
                          aria-label={`Select ${order.id}`}
                          className="rounded border-[#C5CAEC] text-[#7584D6] focus:ring-[#7584D6]"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => openInspector(order.id)}
                          className="font-display font-extrabold text-[#465478] hover:text-[#7584D6]"
                        >
                          {order.id}
                        </button>
                        <div className="mt-1">
                          <StoreBadge store={order.store} />
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-display font-semibold text-[#465478]">
                          {order.customerName}
                        </div>
                        <div className="text-[11.5px] text-[#8891AA]">
                          {displayPhone} · {order.address.city} ({order.address.pincode})
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-display font-bold text-[#465478] num">
                          {formatINR(order.orderValue)}{' '}
                          <span className="text-[11px] font-semibold text-[#7584D6]">
                            ({order.paymentMode})
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[#8891AA] truncate max-w-[180px]">
                          {order.skuName}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <AttentionBadge level={order.attentionLevel} />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(order.reasonCodes || []).slice(0, 2).map((code) => (
                            <ReasonCodePill key={code} code={code} />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-display text-[12.5px] font-bold text-[#465478]">
                          {order.recommendedIntervention}
                        </div>
                        <div className="text-[11px] text-[#8891AA] num">
                          Exposure {formatINR(order.estimatedRtoExposure)} · Cost ₹
                          {Number(order.interventionCost || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 pr-4 pl-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {['Pending Verification', 'Held for Review'].includes(order.status) && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => approveIntervention(order.id)}
                            >
                              Approve
                            </Button>
                          )}
                          {order.status === 'Ready for Dispatch' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => dispatchOrder(order.id)}
                            >
                              Manifest
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openInspector(order.id)}
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Slide-Over Drawer */}
      <Drawer
        open={drawerOpen && Boolean(inspectedOrder)}
        onClose={() => setDrawerOpen(false)}
        widthClass="max-w-xl"
        title={
          inspectedOrder ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-display text-[18px] font-extrabold text-[#465478]">
                {inspectedOrder.id}
              </span>
              <AttentionBadge level={inspectedOrder.attentionLevel} />
              <StatusBadge status={inspectedOrder.status} />
            </div>
          ) : (
            'Order Details'
          )
        }
        subtitle={
          inspectedOrder
            ? `${inspectedOrder.customerName} · ${inspectedOrder.store} · ${inspectedOrder.courier}`
            : ''
        }
        footer={
          inspectedOrder && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/app/rescue');
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#7584D6]" /> Open in WhatsApp Sandbox
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
            </div>
          )
        }
      >
        {inspectedOrder && (
          <div className="space-y-6">
            {/* Risk Explanation Box */}
            <div className="rounded-[20px] bg-[#F4F5FC] border border-[#E3E6FA] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#7584D6]">
                  Rules-Based Risk Explanation
                </span>
                <span className="font-mono text-[11.5px] font-bold text-[#545C9E] num">
                  Score: {inspectedOrder.riskPoints ?? 0} pts
                </span>
              </div>
              <p className="text-[13px] text-[#465478] leading-relaxed">
                {inspectedOrder.explanation}
              </p>
              {(inspectedOrder.reasonCodes || []).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#DFE1F5]">
                  {inspectedOrder.reasonCodes.map((code) => (
                    <div key={code} className="text-[12px]">
                      <ReasonCodePill code={code} />
                      <span className="text-[#6E7896] ml-2">
                        {REASON_CODE_META[code]?.description || code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buyer & Address Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[18px] border border-[#DFE1F5] p-4">
                <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                  Delivery Address
                </div>
                <div className="mt-1.5 font-display text-[13.5px] font-bold text-[#465478]">
                  {inspectedOrder.address.line1}
                </div>
                <div className="text-[12.5px] text-[#6E7896] mt-0.5">
                  {inspectedOrder.address.landmark ? (
                    <span className="text-[#17825B] font-semibold">
                      Landmark: {inspectedOrder.address.landmark}
                    </span>
                  ) : (
                    <span className="text-[#E05328] font-semibold">Missing Landmark</span>
                  )}
                </div>
                <div className="text-[12px] text-[#8891AA] mt-1">
                  {inspectedOrder.address.city}, {inspectedOrder.address.state} —{' '}
                  {inspectedOrder.address.pincode}
                </div>
              </div>

              <div className="rounded-[18px] border border-[#DFE1F5] p-4 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                    Merchant-Scoped Buyer Profile
                  </div>
                  <div className="mt-1.5 font-display text-[13.5px] font-bold text-[#465478]">
                    {inspectedOrder.customerName}
                  </div>
                  {inspectedCustomer && (
                    <div className="text-[12px] text-[#6E7896] mt-1">
                      {inspectedCustomer.successfulDeliveries} Delivered ·{' '}
                      {inspectedCustomer.previousRtos} Prior RTOs ·{' '}
                      {inspectedCustomer.responsiveness}
                    </div>
                  )}
                </div>
                {inspectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(inspectedCustomer.id);
                      setDrawerOpen(false);
                      navigate('/app/graph');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-display font-bold text-[#7584D6] hover:text-[#545C9E]"
                  >
                    <GitFork className="w-3.5 h-3.5" /> View in Customer Graph
                  </button>
                )}
              </div>
            </div>

            {/* Workflow Lifecycle Controls */}
            <div className="rounded-[18px] border border-[#DFE1F5] p-4 space-y-3">
              <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                Workflow Actions &amp; Outcomes
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => approveIntervention(inspectedOrder.id)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve ({inspectedOrder.recommendedIntervention})
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    overrideIntervention(
                      inspectedOrder.id,
                      'Ready for Dispatch',
                      'Merchant manual override to Ready for Dispatch'
                    )
                  }
                >
                  Override → Ready
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => dispatchOrder(inspectedOrder.id)}
                >
                  <Truck className="w-3.5 h-3.5" /> Manifest Courier
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => holdOrder(inspectedOrder.id)}
                >
                  <PauseCircle className="w-3.5 h-3.5" /> Hold Order
                </Button>
                <Button
                  variant="success"
                  size="xs"
                  onClick={() => recordDeliveryOutcome(inspectedOrder.id, 'Delivered')}
                >
                  Mark Delivered
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => recordDeliveryOutcome(inspectedOrder.id, 'NDR Open')}
                >
                  Trigger NDR
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() =>
                    setConfirmCancelState({ open: true, ids: [inspectedOrder.id] })
                  }
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel Pre-Dispatch
                </Button>
              </div>
            </div>

            {/* Order Audit Trail */}
            <div>
              <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA] mb-2.5">
                Order Event Timeline
              </div>
              <div className="space-y-2.5">
                {(inspectedOrder.history || []).map((ev, idx) => (
                  <div
                    key={`${ev.timestamp}-${idx}`}
                    className="rounded-[14px] bg-[#F9FAFB] border border-[#EEF0FA] px-3.5 py-2.5 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-[#465478]">{ev.type}</span>
                      <span className="text-[11px] text-[#9AA3BA]">
                        {formatDateTime(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-[#6E7896] mt-0.5">{ev.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Manual Order Modal */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Create Manual Order"
        subtitle="Scores the order immediately through ORDEXA's rules-based RTO risk engine"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleManualSubmit}>
              Create &amp; Score Order
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {manualError && (
            <div className="sm:col-span-2 rounded-[14px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-2.5 text-[12.5px] text-[#D13B56] font-semibold">
              {manualError}
            </div>
          )}
          <Field label="Storefront Channel" required>
            <select
              value={manualForm.store}
              onChange={(e) => setManualForm({ ...manualForm, store: e.target.value })}
              className={inputClass}
            >
              {stores.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buyer Full Name" required>
            <input
              type="text"
              value={manualForm.customerName}
              onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
              placeholder="e.g., Aditi Kulkarni"
              className={inputClass}
            />
          </Field>
          <Field label="10-Digit Mobile">
            <input
              type="text"
              value={manualForm.phone}
              onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
              placeholder="9811223344"
              className={inputClass}
            />
          </Field>
          <Field label="SKU / Product Name">
            <input
              type="text"
              value={manualForm.skuName}
              onChange={(e) => setManualForm({ ...manualForm, skuName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Order Value (INR)" required>
            <input
              type="number"
              value={manualForm.orderValue}
              onChange={(e) => setManualForm({ ...manualForm, orderValue: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Payment Mode" required>
            <select
              value={manualForm.paymentMode}
              onChange={(e) => setManualForm({ ...manualForm, paymentMode: e.target.value })}
              className={inputClass}
            >
              <option value="COD">COD (Cash on Delivery)</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </Field>
          <Field label="Street Address Line 1" required className="sm:col-span-2">
            <input
              type="text"
              value={manualForm.line1}
              onChange={(e) => setManualForm({ ...manualForm, line1: e.target.value })}
              placeholder="Plot / Flat / Colony (leave short to test ADDRESS_INCOMPLETE)"
              className={inputClass}
            />
          </Field>
          <Field label="Delivery Landmark (Optional)" hint="Leave blank to trigger Address Clarification">
            <input
              type="text"
              value={manualForm.landmark}
              onChange={(e) => setManualForm({ ...manualForm, landmark: e.target.value })}
              placeholder="Near Metro Pillar 40"
              className={inputClass}
            />
          </Field>
          <Field label="Courier Partner">
            <select
              value={manualForm.courier}
              onChange={(e) => setManualForm({ ...manualForm, courier: e.target.value })}
              className={inputClass}
            >
              <option value="Delhivery">Delhivery</option>
              <option value="Shiprocket">Shiprocket</option>
              <option value="BlueDart">BlueDart</option>
              <option value="Xpressbees">Xpressbees</option>
            </select>
          </Field>
          <Field label="City" required>
            <input
              type="text"
              value={manualForm.city}
              onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="PIN Code" required>
            <input
              type="text"
              value={manualForm.pincode}
              onChange={(e) => setManualForm({ ...manualForm, pincode: e.target.value })}
              className={inputClass}
            />
          </Field>
        </form>
      </Modal>

      {/* Live CSV Batch Import Modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Live CSV Batch Order Import"
        subtitle="Upload a .csv file or edit the CSV rows below — runs live locally in your browser"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCsvText(SAMPLE_CSV)}>
              Load Sample Rows
            </Button>
            <Button variant="primary" size="sm" onClick={handleImportCsv}>
              <FileSpreadsheet className="w-4 h-4" /> Import &amp; Score CSV Batch
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Hint>
            Supported columns: <code>customerName,phone,orderValue,paymentMode,line1,landmark,city,state,pincode,courier,skuName</code>
          </Hint>
          {csvError && (
            <div className="rounded-[14px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-2.5 text-[12.5px] text-[#D13B56] font-semibold">
              {csvError}
            </div>
          )}
          <Field label="Upload Local .CSV File">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="block w-full text-[12.5px] text-[#5C6888] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-display file:font-bold file:bg-[#EEF0FA] file:text-[#545C9E] hover:file:bg-[#E3E6FA]"
            />
          </Field>
          <Field label="CSV Payload Preview / Editor">
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className={`${inputClass} font-mono text-[11.5px]`}
            />
          </Field>
        </div>
      </Modal>

      {/* Confirm Pre-Dispatch Cancel */}
      <ConfirmDialog
        open={confirmCancelState.open}
        onClose={() => setConfirmCancelState({ open: false, ids: [] })}
        onConfirm={() => {
          if (confirmCancelState.ids.length === 1) {
            cancelOrder(confirmCancelState.ids[0]);
          } else {
            bulkCancelOrders(confirmCancelState.ids);
            setSelectedIds([]);
          }
        }}
        title="Cancel Order(s) Prior to Dispatch?"
        description="Pre-dispatch cancellations avoid courier freight loss, and ORDEXA tracks them in a separate accounting bucket rather than inflating delivered rescue totals."
        confirmLabel="Confirm Pre-Dispatch Cancel"
        variant="danger"
      />
    </div>
  );
}
