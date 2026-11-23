import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Upload,
  Plus,
  Search,
  X,
  ShieldAlert,
  Share2,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { useOrdexaStore } from '../store/useOrdexaStore';
import {
  AttentionBadge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  ReasonCodePill,
  StatusBadge,
  StoreBadge,
} from '../components/ui/Primitives';
import { formatINR, formatShortDate, maskPhone, formatDateTime } from '../utils/formatters';

const SAMPLE_CSV = `customer_name,phone,order_value,payment_mode,address_line1,landmark,city,state,pincode,courier
Karan Mehta,9811223344,2350,COD,Sector 18 Noida,,Noida,Uttar Pradesh,201301,Delhivery
Divya Nair,9845667788,1799,Prepaid,12th Main HAL 2nd Stage,Near ESI Hospital,Bengaluru,Karnataka,560008,Blue Dart`;

const STATUS_TABS = [
  'ALL',
  'Pending Verification',
  'Awaiting Customer',
  'Held for Review',
  'Ready for Dispatch',
  'Dispatched',
  'NDR Open',
  'Delivered',
  'RTO',
];

export function OrdersPage() {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const globalSearch = useOrdexaStore((s) => s.globalSearch);
  const setGlobalSearch = useOrdexaStore((s) => s.setGlobalSearch);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);
  const addManualOrder = useOrdexaStore((s) => s.addManualOrder);
  const importCsvOrders = useOrdexaStore((s) => s.importCsvOrders);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);
  const dispatchOrder = useOrdexaStore((s) => s.dispatchOrder);
  const cancelOrder = useOrdexaStore((s) => s.cancelOrder);
  const recordDeliveryOutcome = useOrdexaStore((s) => s.recordDeliveryOutcome);
  const bulkApproveOrders = useOrdexaStore((s) => s.bulkApproveOrders);
  const bulkHoldOrders = useOrdexaStore((s) => s.bulkHoldOrders);
  const bulkDispatchOrders = useOrdexaStore((s) => s.bulkDispatchOrders);
  const bulkCancelOrders = useOrdexaStore((s) => s.bulkCancelOrders);

  // Filters, Sorting & Pagination
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [attentionFilter, setAttentionFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState({ field: 'date', dir: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Bulk selection & Confirmations
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCancelConfirm, setBulkCancelConfirm] = useState(false);
  const [drawerCancelConfirm, setDrawerCancelConfirm] = useState(null);

  // Inspection Drawer & Modals
  const [inspectedOrderId, setInspectedOrderId] = useState(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const [manualForm, setManualForm] = useState({
    store: 'VedaGlow Botanicals',
    customerName: '',
    phone: '',
    orderValue: '1999',
    paymentMode: 'COD',
    line1: '',
    landmark: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    courier: 'Delhivery',
    skuName: 'Kumkumadi Night Elixir Combo',
  });

  const [csvRaw, setCsvRaw] = useState(SAMPLE_CSV);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [colMap, setColMap] = useState({
    customerName: 'customer_name',
    phone: 'phone',
    orderValue: 'order_value',
    paymentMode: 'payment_mode',
    line1: 'address_line1',
    landmark: 'landmark',
    city: 'city',
    state: 'state',
    pincode: 'pincode',
  });

  const inspectedOrder = useMemo(
    () => orders.find((o) => o.id === inspectedOrderId) || null,
    [orders, inspectedOrderId]
  );

  const stores = useMemo(() => [...new Set(orders.map((o) => o.store))], [orders]);

  const statusCounts = useMemo(() => {
    const counts = { ALL: orders.length };
    STATUS_TABS.slice(1).forEach((st) => {
      counts[st] = orders.filter((o) => o.status === st).length;
    });
    return counts;
  }, [orders]);

  const filteredAndSortedOrders = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (storeFilter !== 'ALL' && o.store !== storeFilter) return false;
      if (attentionFilter !== 'ALL' && o.attentionLevel !== attentionFilter) return false;
      if (paymentFilter !== 'ALL' && o.paymentMode !== paymentFilter) return false;
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (dateFilter === 'TODAY' && !o.date.startsWith('2026-11-23')) return false;
      if (q) {
        const hay = `${o.id} ${o.customerName} ${o.address.city} ${o.store} ${o.courier}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const attRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...list].sort((a, b) => {
      const mul = sortBy.dir === 'asc' ? 1 : -1;
      if (sortBy.field === 'orderValue') return (a.orderValue - b.orderValue) * mul;
      if (sortBy.field === 'attentionLevel') return (attRank[a.attentionLevel] - attRank[b.attentionLevel]) * mul;
      if (sortBy.field === 'id') return a.id.localeCompare(b.id) * mul;
      return (new Date(a.date).getTime() - new Date(b.date).getTime()) * mul;
    });
  }, [orders, storeFilter, attentionFilter, paymentFilter, statusFilter, dateFilter, globalSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedOrders.slice(start, start + pageSize);
  }, [filteredAndSortedOrders, safePage, pageSize]);

  const toggleSort = (field) => {
    setSortBy((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = pagedOrders.map((o) => o.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.customerName.trim() || !manualForm.line1.trim() || !manualForm.city.trim()) return;
    const created = addManualOrder(manualForm);
    setManualModalOpen(false);
    setInspectedOrderId(created.id);
  };

  const parseCsvText = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setCsvErrors(['CSV must contain a header row and at least one order row.']);
      setCsvPreview([]);
      return;
    }
    const headers = lines[0].split(',').map((h) => h.trim());
    const errors = [];
    const rows = [];

    lines.slice(1).forEach((line, idx) => {
      const vals = line.split(',').map((v) => v.trim());
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = vals[i] ?? '';
      });
      const mapped = {
        customerName: obj[colMap.customerName] || '',
        phone: obj[colMap.phone] || '',
        orderValue: Number(obj[colMap.orderValue]) || 0,
        paymentMode: obj[colMap.paymentMode] || 'COD',
        line1: obj[colMap.line1] || '',
        landmark: obj[colMap.landmark] || '',
        city: obj[colMap.city] || '',
        state: obj[colMap.state] || 'Maharashtra',
        pincode: obj[colMap.pincode] || '',
        courier: obj.courier || 'Shiprocket',
      };
      if (!mapped.customerName) errors.push(`Row ${idx + 2}: Missing customer name.`);
      if (!mapped.orderValue || mapped.orderValue <= 0) errors.push(`Row ${idx + 2}: Invalid order value.`);
      if (!/^\d{6}$/.test(mapped.pincode)) errors.push(`Row ${idx + 2}: PIN code "${mapped.pincode}" should be 6 digits.`);
      rows.push(mapped);
    });

    setCsvErrors(errors);
    setCsvPreview(rows);
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setCsvRaw(content);
      parseCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = () => {
    if (csvPreview.length === 0 || csvErrors.length > 0) return;
    importCsvOrders(csvPreview);
    setCsvModalOpen(false);
  };

  const allPageSelected =
    pagedOrders.length > 0 && pagedOrders.every((o) => selectedIds.includes(o.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders Queue"
        subtitle="Multi-channel order ingestion, risk classification, bulk actions, and pre-dispatch verification."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => simulateShopifyWebhook()}>
              <Zap className="w-3.5 h-3.5 text-gold-hover" /> Simulate Webhook
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCsvModalOpen(true);
                parseCsvText(csvRaw);
              }}
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </Button>
            <Button variant="primary" size="sm" onClick={() => setManualModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Create Order
            </Button>
          </>
        }
      />

      {/* Main Enterprise Table Container */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
        {/* Inline Shopify-style Status Tabs */}
        <div className="flex items-center gap-1 px-3 pt-2.5 border-b border-slate-200 overflow-x-auto bg-slate-50/50">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'border-navy text-navy-dark font-semibold bg-white rounded-t-[4px]'
                    : 'border-transparent text-slate-600 hover:text-navy-dark'
                }`}
              >
                <span>{tab === 'ALL' ? 'All Orders' : tab}</span>
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-navy text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {statusCounts[tab] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by Order ID, customer name, city, or courier..."
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-[4px] focus:outline-none focus:border-navy text-navy"
            />
          </div>

          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs border border-slate-200 rounded-[4px] text-navy bg-white focus:outline-none focus:border-navy"
          >
            <option value="ALL">All Stores</option>
            {stores.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            value={attentionFilter}
            onChange={(e) => {
              setAttentionFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs border border-slate-200 rounded-[4px] text-navy bg-white focus:outline-none focus:border-navy"
          >
            <option value="ALL">All Attention</option>
            <option value="HIGH">HIGH Attention</option>
            <option value="MEDIUM">MEDIUM Attention</option>
            <option value="LOW">LOW Attention</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs border border-slate-200 rounded-[4px] text-navy bg-white focus:outline-none focus:border-navy"
          >
            <option value="ALL">All Payments</option>
            <option value="COD">COD</option>
            <option value="Prepaid">Prepaid</option>
            <option value="Partial Prepaid">Partial Prepaid</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2.5 text-xs border border-slate-200 rounded-[4px] text-navy bg-white focus:outline-none focus:border-navy"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today (23 Nov)</option>
          </select>
        </div>

        {/* Contextual Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2 bg-navy text-white flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums">{selectedIds.length} order(s) selected</span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] text-gold hover:underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  bulkApproveOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Recommended
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  bulkHoldOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                <PauseCircle className="w-3.5 h-3.5" /> Hold
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  bulkDispatchOrders(selectedIds);
                  setSelectedIds([]);
                }}
              >
                <Truck className="w-3.5 h-3.5" /> Dispatch Ready
              </Button>
              <Button
                variant="danger"
                size="xs"
                onClick={() => setBulkCancelConfirm(true)}
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Selected
              </Button>
            </div>
          </div>
        )}

        {/* Dense Order Table */}
        {pagedOrders.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Search}
              title="No orders match the current filters"
              description="Adjust your search query or reset status/payment filters to view orders."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGlobalSearch('');
                    setStoreFilter('ALL');
                    setAttentionFilter('ALL');
                    setPaymentFilter('ALL');
                    setStatusFilter('ALL');
                    setDateFilter('ALL');
                  }}
                >
                  Reset Filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1140px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-600">
                  <th className="py-2.5 px-3 w-9">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all orders on page"
                      className="rounded border-slate-300 accent-[#262B3E]"
                    />
                  </th>
                  <th
                    onClick={() => toggleSort('id')}
                    className="py-2.5 px-3 cursor-pointer hover:text-navy-dark select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      Order <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort('date')}
                    className="py-2.5 px-3 cursor-pointer hover:text-navy-dark select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3">Store</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th
                    onClick={() => toggleSort('orderValue')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-dark select-none"
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Total <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th
                    onClick={() => toggleSort('attentionLevel')}
                    className="py-2.5 px-3 cursor-pointer hover:text-navy-dark select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      Attention <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3">Reason Codes</th>
                  <th className="py-2.5 px-3">Recommended</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedOrders.map((order) => {
                  const isChecked = selectedIds.includes(order.id);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setInspectedOrderId(order.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-gold-subtle/60' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td className="py-2.5 px-3" onClick={(e) => toggleRowSelect(order.id, e)}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          aria-label={`Select ${order.id}`}
                          className="rounded border-slate-300 accent-[#262B3E]"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-navy-dark whitespace-nowrap">
                        {order.id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap tabular-nums">
                        {formatShortDate(order.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <StoreBadge store={order.store} />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-navy-dark leading-tight">{order.customerName}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.address.city}, {order.address.pincode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {maskPhone(order.phone)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-navy-dark tabular-nums whitespace-nowrap">
                        {formatINR(order.orderValue)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] border whitespace-nowrap ${
                            order.paymentMode === 'COD'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {order.paymentMode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <AttentionBadge level={order.attentionLevel} />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[190px]">
                          {order.reasonCodes.length > 0 ? (
                            order.reasonCodes.slice(0, 2).map((code) => (
                              <ReasonCodePill key={code} code={code} />
                            ))
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-medium">CLEAN</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-navy whitespace-nowrap">
                        {order.recommendedIntervention}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Showing{' '}
              <strong>
                {filteredAndSortedOrders.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredAndSortedOrders.length)}
              </strong>{' '}
              of <strong>{filteredAndSortedOrders.length}</strong> orders
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 px-2 border border-slate-200 rounded-[4px] bg-white text-navy text-xs"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <span className="px-2 font-mono text-[11px] tabular-nums">
              Page {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Order Detail Slide-Over Drawer */}
      {inspectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-deep/55 backdrop-blur-[1px]">
          <div className="w-full max-w-lg bg-white h-full shadow-elevated flex flex-col border-l border-slate-200">
            <div className="px-5 py-3.5 bg-navy text-white flex items-center justify-between border-b border-gold/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gold font-bold">{inspectedOrder.id}</span>
                  <span className="text-[11px] text-slate-300">• {inspectedOrder.courier}</span>
                </div>
                <h3 className="font-sans text-base font-bold text-white mt-0.5 tabular-nums">
                  {inspectedOrder.customerName} — {formatINR(inspectedOrder.orderValue)}
                </h3>
              </div>
              <button
                onClick={() => setInspectedOrderId(null)}
                className="text-slate-300 hover:text-gold p-1 rounded"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <AttentionBadge level={inspectedOrder.attentionLevel} />
                <StatusBadge status={inspectedOrder.status} />
                <StoreBadge store={inspectedOrder.store} />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-[4px] border border-slate-200">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Item / SKU</div>
                  <div className="font-semibold text-navy-dark mt-0.5">{inspectedOrder.skuName}</div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">{inspectedOrder.sku}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Shipping Address</div>
                  <div className="font-semibold text-navy-dark mt-0.5">{inspectedOrder.address.line1}</div>
                  <div className="text-slate-600">
                    Landmark:{' '}
                    <span className={inspectedOrder.address.landmark ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                      {inspectedOrder.address.landmark || 'Missing Landmark'}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {inspectedOrder.address.city}, {inspectedOrder.address.state} – {inspectedOrder.address.pincode}
                  </div>
                </div>
              </div>

              {/* Risk Diagnosis */}
              <div className="border border-slate-200 rounded-[4px] p-3.5">
                <div className="font-sans text-xs font-bold text-navy-dark mb-2">
                  Risk Diagnosis &amp; Recommendation
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {inspectedOrder.reasonCodes.length > 0 ? (
                    inspectedOrder.reasonCodes.map((c) => <ReasonCodePill key={c} code={c} />)
                  ) : (
                    <span className="text-emerald-700 font-semibold">No Risk Flags</span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">{inspectedOrder.explanation}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 tabular-nums">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Recommended</div>
                    <div className="font-semibold text-navy-dark">{inspectedOrder.recommendedIntervention}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">RTO Exposure</div>
                    <div className="font-mono font-bold text-red-700">{formatINR(inspectedOrder.estimatedRtoExposure)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Outreach Cost</div>
                    <div className="font-mono font-bold text-navy-dark">{formatINR(inspectedOrder.interventionCost, true)}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <div className="font-sans text-xs font-bold text-navy-dark">Workflow Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => {
                      setSelectedOrderId(inspectedOrder.id);
                      setInspectedOrderId(null);
                      navigate('/app/rescue');
                    }}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Open in Rescue Centre
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      setSelectedCustomerId(inspectedOrder.customerId);
                      setInspectedOrderId(null);
                      navigate('/app/graph');
                    }}
                  >
                    <Share2 className="w-3.5 h-3.5" /> View Customer Graph
                  </Button>
                  {!['Delivered', 'RTO', 'Cancelled'].includes(inspectedOrder.status) && (
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => setDrawerCancelConfirm(inspectedOrder.id)}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Order
                    </Button>
                  )}
                </div>

                {(inspectedOrder.status === 'Ready for Dispatch' ||
                  inspectedOrder.status === 'Dispatched' ||
                  inspectedOrder.status === 'NDR Open') && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {inspectedOrder.status === 'Ready for Dispatch' && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => dispatchOrder(inspectedOrder.id)}
                      >
                        <Truck className="w-3.5 h-3.5" /> Dispatch to {inspectedOrder.courier}
                      </Button>
                    )}
                    <Button
                      variant="success"
                      size="xs"
                      onClick={() => recordDeliveryOutcome(inspectedOrder.id, 'Delivered')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => recordDeliveryOutcome(inspectedOrder.id, 'NDR Open')}
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Trigger NDR
                    </Button>
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => recordDeliveryOutcome(inspectedOrder.id, 'RTO')}
                    >
                      Record RTO
                    </Button>
                  </div>
                )}
              </div>

              {/* Order Timeline */}
              <div>
                <div className="font-sans text-xs font-bold text-navy-dark mb-2">Order Activity Log</div>
                <div className="space-y-2.5 border-l-2 border-gold pl-3.5">
                  {(inspectedOrder.history || []).map((h, i) => (
                    <div key={i}>
                      <div className="font-semibold text-navy-dark">{h.type}</div>
                      <div className="text-slate-600">{h.detail}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(h.timestamp)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cancel Confirmation */}
      <ConfirmDialog
        open={bulkCancelConfirm}
        onClose={() => setBulkCancelConfirm(false)}
        onConfirm={() => {
          bulkCancelOrders(selectedIds);
          setSelectedIds([]);
        }}
        title={`Cancel ${selectedIds.length} Selected Order(s)?`}
        description="Selected active orders will be marked Cancelled prior to dispatch and excluded from rescued delivery metrics."
        confirmLabel="Cancel Selected Orders"
      />

      {/* Drawer Single Cancel Confirmation */}
      <ConfirmDialog
        open={Boolean(drawerCancelConfirm)}
        onClose={() => setDrawerCancelConfirm(null)}
        onConfirm={() => {
          if (drawerCancelConfirm) cancelOrder(drawerCancelConfirm);
        }}
        title={`Cancel Order ${drawerCancelConfirm}?`}
        description="This cancels the order prior to courier dispatch to avoid forward and reverse freight loss."
        confirmLabel="Cancel Order"
      />

      {/* Manual Order Modal */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Create Manual Order"
        subtitle="Enter an order from WhatsApp, Instagram, or phone to run instant ORDEXA risk scoring."
      >
        <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-navy mb-1">Store Channel</label>
              <select
                value={manualForm.store}
                onChange={(e) => setManualForm({ ...manualForm, store: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy bg-white"
              >
                <option>VedaGlow Botanicals</option>
                <option>KoraCraft Home &amp; Living</option>
                <option>ZariPulse WhatsApp &amp; CSV</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Customer Full Name *</label>
              <input
                required
                value={manualForm.customerName}
                onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                placeholder="e.g., Rohan Verma"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Phone Number *</label>
              <input
                required
                value={manualForm.phone}
                onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                placeholder="98XXXXXXXX"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Order Value (₹) *</label>
              <input
                type="number"
                required
                min="100"
                value={manualForm.orderValue}
                onChange={(e) => setManualForm({ ...manualForm, orderValue: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Payment Mode</label>
              <select
                value={manualForm.paymentMode}
                onChange={(e) => setManualForm({ ...manualForm, paymentMode: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy bg-white"
              >
                <option value="COD">COD</option>
                <option value="Prepaid">Prepaid</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Courier Partner</label>
              <select
                value={manualForm.courier}
                onChange={(e) => setManualForm({ ...manualForm, courier: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy bg-white"
              >
                <option>Delhivery</option>
                <option>Shiprocket</option>
                <option>Blue Dart</option>
                <option>Shadowfax</option>
                <option>ClickPost</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-navy mb-1">Address Line 1 *</label>
              <input
                required
                value={manualForm.line1}
                onChange={(e) => setManualForm({ ...manualForm, line1: e.target.value })}
                placeholder="House / Flat / Street"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">Landmark (Optional)</label>
              <input
                value={manualForm.landmark}
                onChange={(e) => setManualForm({ ...manualForm, landmark: e.target.value })}
                placeholder="Leave blank to test ADDRESS_INCOMPLETE"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">City *</label>
              <input
                required
                value={manualForm.city}
                onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
                placeholder="e.g., Jaipur"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">PIN Code *</label>
              <input
                required
                value={manualForm.pincode}
                onChange={(e) => setManualForm({ ...manualForm, pincode: e.target.value })}
                placeholder="6-digit PIN"
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-navy mb-1">State</label>
              <input
                value={manualForm.state}
                onChange={(e) => setManualForm({ ...manualForm, state: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Ingest &amp; Score Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import & Map CSV Orders"
        subtitle="Validate columns, check PIN codes, and bulk-ingest social commerce or dropshipping orders."
        widthClass="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-[4px] border border-slate-200">
            <div className="flex items-center gap-2 text-navy font-semibold">
              <FileSpreadsheet className="w-4 h-4 text-gold-hover" />
              Upload a .csv file or edit the sample payload below
            </div>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="text-xs" />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(colMap).slice(0, 5).map(([field, colName]) => (
              <div key={field}>
                <label className="block text-[10px] uppercase text-slate-500 mb-0.5">{field}</label>
                <input
                  value={colName}
                  onChange={(e) => setColMap({ ...colMap, [field]: e.target.value })}
                  className="w-full h-7 px-2 border border-slate-200 rounded-[4px] font-mono text-[11px] text-navy"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block font-semibold text-navy mb-1">CSV Content</label>
            <textarea
              rows={5}
              value={csvRaw}
              onChange={(e) => {
                setCsvRaw(e.target.value);
                parseCsvText(e.target.value);
              }}
              className="w-full p-2.5 border border-slate-200 rounded-[4px] font-mono text-[11px] text-navy"
            />
          </div>

          {csvErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-red-700 space-y-1">
              <div className="font-bold">Validation Errors ({csvErrors.length}):</div>
              {csvErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {csvPreview.length > 0 && csvErrors.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] p-3 text-emerald-800">
              <strong>Validation Passed:</strong> {csvPreview.length} order(s) ready to import &amp; score.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setCsvModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={csvPreview.length === 0 || csvErrors.length > 0}
              onClick={handleConfirmCsvImport}
            >
              Import {csvPreview.length} Orders
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
