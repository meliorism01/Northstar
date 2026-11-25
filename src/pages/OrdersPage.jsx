import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PackageCheck,
  Upload,
  Plus,
  CheckCircle2,
  Truck,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  Edit3,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Button,
  Tabs,
  StatusBadge,
  Drawer,
  Modal,
  ConfirmDialog,
  Field,
  inputClass,
  EmptyState,
  Hint,
} from '../components/ui/Primitives';
import {
  fetchOrders,
  fetchOrderById,
  createOrder,
  updateOrderMetadata,
  transitionOrderStatus,
  deleteOrderById,
  importOrdersFromCsv,
} from '../services/api/ordersApi';
import { fetchCustomerOrders } from '../services/api/customersApi';
import { useAuthStore, hasMinimumRole } from '../store/useAuthStore';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

const SAMPLE_POSTGRES_CSV = `orderNumber,customerName,customerPhone,customerEmail,productName,sku,quantity,unitPrice,discount,shippingFee,paymentMethod,paymentStatus,shippingAddress,customerNotes
ORD-CSV-901,Meera Joshi,9829011223,meera@example.in,Saffron Glow Facial Oil,VG-SAFFRON-30,2,1099.00,100.00,50.00,COD,PENDING,"House 18 Vaishali Nagar, Jaipur, Rajasthan 302021",Call before delivery
ORD-CSV-902,Karan Malhotra,9810455678,karan@example.in,Handwoven Linen Cushion Pair,KC-CUSHION-02,1,1450.00,0.00,0.00,PREPAID,PAID,"Flat 902 DLF Phase 4, Near Galleria Market, Gurugram 122009",Leave at security
ORD-CSV-903,Rohan Verma,9793112244,rohan@example.in,Brass Dhuna Loban Burner,KC-BRASS-11,1,2899.00,150.00,75.00,UPI,PAID,"Sector 8 Indira Nagar, Lucknow, UP 226016",Gift wrap requested`;

const STATUS_TABS = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'CREATED', label: 'Created' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function OrdersPage() {
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const currentRole = useAuthStore((s) => s.currentRole);
  const globalSearch = useOrdexaStore((s) => s.globalSearch);
  const addToast = useOrdexaStore((s) => s.addToast);

  const canWriteOrders = hasMinimumRole(currentRole, 'OPERATOR');
  const canDeleteOrders = hasMinimumRole(currentRole, 'MANAGER');

  // Query & Pagination State
  const [statusTab, setStatusTab] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);

  // Server Data State
  const [ordersPage, setOrdersPage] = useState({
    items: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Order Detail Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inspectedDetail, setInspectedDetail] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [editMeta, setEditMeta] = useState({
    shippingAddress: '',
    billingAddress: '',
    customerNotes: '',
    paymentStatus: 'PENDING',
  });
  const [savingMeta, setSavingMeta] = useState(false);

  // Customer Order History Modal
  const [customerHistoryModal, setCustomerHistoryModal] = useState({
    open: false,
    loading: false,
    data: null,
  });

  // Create Order Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    orderNumber: '',
    source: 'MANUAL',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    discount: '0',
    shippingFee: '0',
    shippingAddress: '',
    billingAddress: '',
    customerNotes: '',
    items: [
      {
        productName: 'Kumkumadi Radiance Facial Oil (30ml)',
        sku: 'VG-KUMKUM-30',
        quantity: 1,
        unitPrice: '1499.00',
      },
    ],
  });

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_POSTGRES_CSV);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [csvSummary, setCsvSummary] = useState(null);

  // Delete Confirm Dialog
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);

  const loadOrders = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setLoading(true);
    setError(null);
    try {
      const effectiveSearch = (localSearch || globalSearch || '').trim();
      const isoFrom = fromDate ? new Date(`${fromDate}T00:00:00Z`).toISOString() : '';
      const isoTo = toDate ? new Date(`${toDate}T23:59:59Z`).toISOString() : '';
      const data = await fetchOrders({
        search: effectiveSearch,
        orderStatus: statusTab,
        paymentStatus: paymentFilter,
        fromDate: isoFrom,
        toDate: isoTo,
        page,
        size: pageSize,
        sortBy,
        sortDir,
      });
      setOrdersPage(
        data || {
          items: [],
          page: 0,
          size: pageSize,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to load orders from PostgreSQL');
    } finally {
      setLoading(false);
    }
  }, [
    activeWorkspace?.merchantId,
    localSearch,
    globalSearch,
    statusTab,
    paymentFilter,
    fromDate,
    toDate,
    page,
    pageSize,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrderInspector = async (orderId) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    setStatusReason('');
    try {
      const detail = await fetchOrderById(orderId);
      setInspectedDetail(detail);
      setEditMeta({
        shippingAddress: detail.order.shippingAddress || '',
        billingAddress: detail.order.billingAddress || '',
        customerNotes: detail.order.customerNotes || '',
        paymentStatus: detail.order.paymentStatus || 'PENDING',
      });
    } catch (err) {
      addToast(err.message || 'Failed to load order details', 'warning');
      setDrawerOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openCustomerHistory = async (customerId) => {
    setCustomerHistoryModal({ open: true, loading: true, data: null });
    try {
      const detail = await fetchCustomerOrders(customerId);
      setCustomerHistoryModal({ open: true, loading: false, data: detail });
    } catch (err) {
      addToast(err.message || 'Failed to load customer order history', 'warning');
      setCustomerHistoryModal({ open: false, loading: false, data: null });
    }
  };

  const handleStatusTransition = async (orderId, newStatus) => {
    setTransitioning(true);
    try {
      const updated = await transitionOrderStatus(orderId, {
        newStatus,
        reason: statusReason.trim() || `Transitioned to ${newStatus} by operator`,
      });
      setInspectedDetail(updated);
      setEditMeta((prev) => ({
        ...prev,
        paymentStatus: updated.order.paymentStatus,
      }));
      setStatusReason('');
      addToast(`Order ${updated.order.orderNumber} moved to ${newStatus}`, 'success');
      await loadOrders();
    } catch (err) {
      addToast(err.message || 'Invalid status transition', 'warning');
    } finally {
      setTransitioning(false);
    }
  };

  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    if (!inspectedDetail?.order?.id) return;
    setSavingMeta(true);
    try {
      const updated = await updateOrderMetadata(inspectedDetail.order.id, editMeta);
      setInspectedDetail(updated);
      addToast(`Updated metadata for ${updated.order.orderNumber}`, 'success');
      await loadOrders();
    } catch (err) {
      addToast(err.message || 'Unable to update order metadata', 'warning');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirmDeleteOrder) return;
    try {
      await deleteOrderById(confirmDeleteOrder.id);
      addToast(`Deleted order ${confirmDeleteOrder.orderNumber}`, 'info');
      if (inspectedDetail?.order?.id === confirmDeleteOrder.id) {
        setDrawerOpen(false);
        setInspectedDetail(null);
      }
      setConfirmDeleteOrder(null);
      await loadOrders();
    } catch (err) {
      addToast(err.message || 'Order deletion not allowed', 'warning');
    }
  };

  // Create Order Modal Handlers
  const addLineItem = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productName: '', sku: '', quantity: 1, unitPrice: '499.00' },
      ],
    }));
  };

  const updateLineItem = (idx, field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));
  };

  const removeLineItem = (idx) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items,
    }));
  };

  const previewTotals = useMemo(() => {
    const subtotal = createForm.items.reduce((sum, item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      return sum + qty * price;
    }, 0);
    const discount = Math.max(0, Number(createForm.discount) || 0);
    const shippingFee = Math.max(0, Number(createForm.shippingFee) || 0);
    const total = Math.max(0, subtotal - discount + shippingFee);
    return { subtotal, discount, shippingFee, total };
  }, [createForm.items, createForm.discount, createForm.shippingFee]);

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.customerName.trim() || !createForm.customerPhone.trim()) {
      setCreateError('Customer full name and phone number are required.');
      return;
    }
    if (!createForm.shippingAddress.trim() || createForm.shippingAddress.trim().length < 5) {
      setCreateError('Please enter a complete shipping address (at least 5 characters).');
      return;
    }
    const invalidItem = createForm.items.some(
      (it) => !it.productName.trim() || !it.sku.trim() || Number(it.quantity) < 1
    );
    if (invalidItem) {
      setCreateError('Every line item requires a product name, SKU, and quantity >= 1.');
      return;
    }

    setCreatingOrder(true);
    try {
      const created = await createOrder({
        orderNumber: createForm.orderNumber.trim() || null,
        source: createForm.source,
        customerName: createForm.customerName.trim(),
        customerPhone: createForm.customerPhone.trim(),
        customerEmail: createForm.customerEmail.trim() || null,
        paymentMethod: createForm.paymentMethod,
        paymentStatus: createForm.paymentStatus,
        discount: Number(createForm.discount) || 0,
        shippingFee: Number(createForm.shippingFee) || 0,
        currency: 'INR',
        shippingAddress: createForm.shippingAddress.trim(),
        billingAddress:
          createForm.billingAddress.trim() || createForm.shippingAddress.trim(),
        customerNotes: createForm.customerNotes.trim() || null,
        items: createForm.items.map((it) => ({
          productName: it.productName.trim(),
          sku: it.sku.trim(),
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        })),
      });

      setCreateModalOpen(false);
      setCreateForm((prev) => ({
        ...prev,
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        shippingAddress: '',
        billingAddress: '',
        customerNotes: '',
      }));
      addToast(`Created order ${created.order.orderNumber} in PostgreSQL`, 'success');
      await loadOrders();
      setInspectedDetail(created);
      setDrawerOpen(true);
    } catch (err) {
      setCreateError(err.message || 'Failed to create order');
    } finally {
      setCreatingOrder(false);
    }
  };

  // CSV Import Handlers
  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ''));
      setCsvSummary(null);
      setCsvError('');
    };
    reader.readAsText(file);
  };

  const handleImportCsvSubmit = async () => {
    setCsvError('');
    setCsvSummary(null);
    if (!csvText.trim()) {
      setCsvError('Please provide CSV content with a header row and at least one order row.');
      return;
    }
    setImportingCsv(true);
    try {
      const summary = await importOrdersFromCsv(csvText);
      setCsvSummary(summary);
      addToast(
        `CSV Import: ${summary.importedOrdersCount} imported, ${summary.failedRowsCount} failed`,
        summary.failedRowsCount > 0 ? 'warning' : 'success'
      );
      await loadOrders();
    } catch (err) {
      setCsvError(err.message || 'CSV import failed');
    } finally {
      setImportingCsv(false);
    }
  };

  const kpiStats = useMemo(() => {
    const visible = ordersPage.items || [];
    const totalVisibleValue = visible.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0
    );
    const activeFulfilment = visible.filter((o) =>
      ['CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.orderStatus)
    ).length;
    const deliveredCount = visible.filter((o) => o.orderStatus === 'DELIVERED').length;
    return {
      totalElements: ordersPage.totalElements || 0,
      totalVisibleValue,
      activeFulfilment,
      deliveredCount,
    };
  }, [ordersPage]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`PostgreSQL Order Core · ${activeWorkspace?.businessName || 'Workspace'}`}
        title="Order"
        accentWord="Management"
        subtitle="Create, filter, transition, and import merchant-scoped orders persisted in PostgreSQL with full status audit history."
        icon={PackageCheck}
        iconTone="peri"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              data-testid="orders-refresh-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#7584D6] ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canWriteOrders && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="open-csv-import-btn"
                  onClick={() => {
                    setCsvSummary(null);
                    setCsvError('');
                    setCsvModalOpen(true);
                  }}
                >
                  <Upload className="w-3.5 h-3.5 text-[#7584D6]" /> CSV Import
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  data-testid="open-create-order-btn"
                  onClick={() => {
                    setCreateError('');
                    setCreateModalOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Create Order
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Matching Orders"
          value={String(kpiStats.totalElements)}
          delta={`Page ${ordersPage.page + 1}`}
          subtitle="Merchant-scoped PostgreSQL records"
          icon={PackageCheck}
          accent="peri"
        />
        <KpiCard
          title="In-Flight Fulfilment"
          value={String(kpiStats.activeFulfilment)}
          delta="Active Page"
          subtitle="Created, Confirmed, Processing & Shipped"
          icon={Clock}
          accent="coral"
        />
        <KpiCard
          title="Delivered on Page"
          value={String(kpiStats.deliveredCount)}
          delta="Completed"
          subtitle="Controlled lifecycle verified"
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          title="Page Order Volume"
          value={formatINR(kpiStats.totalVisibleValue)}
          delta="BigDecimal"
          subtitle="Server-calculated order totals"
          icon={Truck}
          accent="pink"
        />
      </div>

      {/* Filter & Table Card */}
      <div className="rescale-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={STATUS_TABS}
            value={statusTab}
            onChange={(val) => {
              setStatusTab(val);
              setPage(0);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              data-testid="orders-search-input"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search order #, buyer, phone…"
              className={`${inputClass} sm:w-52`}
            />

            <select
              value={paymentFilter}
              data-testid="orders-payment-filter"
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by payment status"
              className={`${inputClass} sm:w-40`}
            >
              <option value="ALL">All Payments</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              aria-label="From date"
              className={`${inputClass} sm:w-36`}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              aria-label="To date"
              className={`${inputClass} sm:w-36`}
            />

            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(':');
                setSortBy(field);
                setSortDir(dir);
                setPage(0);
              }}
              aria-label="Sort orders"
              className={`${inputClass} sm:w-44`}
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="totalAmount:desc">Amount: High → Low</option>
              <option value="totalAmount:asc">Amount: Low → High</option>
              <option value="orderNumber:asc">Order # (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-center justify-between gap-3 text-[12.5px] text-[#D13B56] font-display font-semibold"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="xs" onClick={loadOrders}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading / Empty / Data Table */}
        {loading && ordersPage.items.length === 0 ? (
          <div className="py-14 text-center text-[13.5px] font-display font-semibold text-[#6E7896]">
            Loading merchant orders from PostgreSQL…
          </div>
        ) : ordersPage.items.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No orders found in this merchant workspace"
            description="Create a new order manually, import a CSV batch, or clear active search filters."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {canWriteOrders && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCreateModalOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" /> Create First Order
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCsvModalOpen(true)}
                    >
                      <Upload className="w-3.5 h-3.5" /> Import CSV Batch
                    </Button>
                  </>
                )}
                {(statusTab !== 'ALL' || paymentFilter !== 'ALL' || localSearch || fromDate || toDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusTab('ALL');
                      setPaymentFilter('ALL');
                      setLocalSearch('');
                      setFromDate('');
                      setToDate('');
                      setPage(0);
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[18px] border border-[#EEF0FA]">
              <table className="w-full text-left border-collapse" data-testid="orders-table">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#EEF0FA] text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                    <th className="py-3.5 px-4">Order # &amp; Source</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Items &amp; Address</th>
                    <th className="py-3.5 px-4">Total &amp; Payment</th>
                    <th className="py-3.5 px-4">Order Status</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F9] text-[13px] bg-white">
                  {ordersPage.items.map((order) => (
                    <tr
                      key={order.id}
                      data-testid={`order-row-${order.orderNumber}`}
                      className="hover:bg-[#F9FAFB] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => openOrderInspector(order.id)}
                          className="font-display font-extrabold text-[#465478] hover:text-[#7584D6] block"
                        >
                          {order.orderNumber}
                        </button>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-display font-bold uppercase bg-[#F1F2F9] text-[#545C9E] border border-[#DFE1F5]">
                          {order.source}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => openCustomerHistory(order.customerId)}
                          className="font-display font-semibold text-[#465478] hover:text-[#7584D6] text-left"
                        >
                          {order.customerName}
                        </button>
                        <div className="text-[11.5px] text-[#8891AA] font-mono">
                          +91 {order.customerPhone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-display font-semibold text-[#465478] truncate max-w-[230px]">
                          {order.primaryProductSummary} ({order.itemCount} unit
                          {order.itemCount === 1 ? '' : 's'})
                        </div>
                        <div className="text-[11.5px] text-[#8891AA] truncate max-w-[230px]">
                          {order.shippingAddress}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-display font-extrabold text-[#465478] num">
                          {formatINR(order.totalAmount, true)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[10.5px] font-display font-bold text-[#545C9E]">
                            {order.paymentMethod}
                          </span>
                          <StatusBadge status={order.paymentStatus} />
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.orderStatus} />
                      </td>

                      <td className="py-3.5 px-4 text-[11.5px] text-[#7C86A2]">
                        {formatDateTime(order.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canWriteOrders && order.orderStatus === 'CREATED' && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() =>
                                handleStatusTransition(order.id, 'CONFIRMED')
                              }
                            >
                              Confirm
                            </Button>
                          )}
                          {canWriteOrders && order.orderStatus === 'CONFIRMED' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                handleStatusTransition(order.id, 'PROCESSING')
                              }
                            >
                              Process
                            </Button>
                          )}
                          {canWriteOrders && order.orderStatus === 'PROCESSING' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                handleStatusTransition(order.id, 'SHIPPED')
                              }
                            >
                              Ship
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            data-testid={`inspect-order-btn-${order.orderNumber}`}
                            onClick={() => openOrderInspector(order.id)}
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#6E7896]">
              <div>
                Showing page <strong>{ordersPage.page + 1}</strong> of{' '}
                <strong>{Math.max(1, ordersPage.totalPages)}</strong> (
                <strong>{ordersPage.totalElements}</strong> total orders)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={ordersPage.page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!ordersPage.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Order Detail & Lifecycle Slide-Over Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        widthClass="max-w-xl"
        title={
          inspectedDetail?.order ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-display text-[18px] font-extrabold text-[#465478]">
                {inspectedDetail.order.orderNumber}
              </span>
              <StatusBadge status={inspectedDetail.order.orderStatus} />
              <StatusBadge status={inspectedDetail.order.paymentStatus} />
            </div>
          ) : (
            'Order Details'
          )
        }
        subtitle={
          inspectedDetail?.order
            ? `${inspectedDetail.order.customerName} · Source: ${inspectedDetail.order.source} · Created ${formatDateTime(inspectedDetail.order.createdAt)}`
            : 'Loading order details…'
        }
        footer={
          inspectedDetail?.order && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              {canDeleteOrders &&
              ['CREATED', 'CANCELLED'].includes(inspectedDetail.order.orderStatus) ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDeleteOrder(inspectedDetail.order)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Order
                </Button>
              ) : (
                <span className="text-[11.5px] text-[#8891AA]">
                  Only CREATED or CANCELLED orders can be deleted.
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
            </div>
          )
        }
      >
        {detailLoading || !inspectedDetail ? (
          <div className="py-12 text-center text-[13px] text-[#7C86A2]">
            Loading order details from PostgreSQL…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Controlled Lifecycle State Transitions */}
            <div className="rounded-[20px] bg-[#F4F5FC] border border-[#E3E6FA] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#7584D6]">
                  Controlled Lifecycle Transitions
                </span>
                <span className="font-mono text-[11px] font-bold text-[#545C9E]">
                  Current: {inspectedDetail.order.orderStatus}
                </span>
              </div>

              {(inspectedDetail.order.allowedNextStatuses || []).length === 0 ? (
                <p className="text-[12.5px] text-[#6E7896]">
                  This order is in a terminal state (
                  <strong>{inspectedDetail.order.orderStatus}</strong>) and cannot transition further.
                </p>
              ) : canWriteOrders ? (
                <>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Optional status transition note / reason…"
                    className={`${inputClass} bg-white`}
                  />
                  <div className="flex flex-wrap gap-2">
                    {inspectedDetail.order.allowedNextStatuses.map((nextSt) => (
                      <Button
                        key={nextSt}
                        variant={nextSt === 'CANCELLED' ? 'danger' : 'primary'}
                        size="xs"
                        loading={transitioning}
                        data-testid={`transition-status-btn-${nextSt}`}
                        onClick={() =>
                          handleStatusTransition(inspectedDetail.order.id, nextSt)
                        }
                      >
                        {nextSt === 'CANCELLED' ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Move to {nextSt}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-[#8891AA]">
                  Your role ({currentRole}) has read-only access to order status transitions.
                </p>
              )}
            </div>

            {/* Customer Summary & Order History Button */}
            <div className="rounded-[18px] border border-[#DFE1F5] p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                  Merchant-Scoped Customer
                </div>
                <div className="mt-1 font-display text-[14.5px] font-bold text-[#465478]">
                  {inspectedDetail.customer.fullName}
                </div>
                <div className="text-[12px] text-[#6E7896]">
                  +91 {inspectedDetail.customer.phoneNumber}
                  {inspectedDetail.customer.email ? ` · ${inspectedDetail.customer.email}` : ''}
                </div>
                <div className="text-[11.5px] text-[#545C9E] font-semibold mt-1">
                  {inspectedDetail.customer.totalOrders} total order(s) · Lifetime Spend{' '}
                  {formatINR(inspectedDetail.customer.totalSpent, true)}
                </div>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => openCustomerHistory(inspectedDetail.customer.id)}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#7584D6]" /> Order History
              </Button>
            </div>

            {/* Line Items & Server-Calculated Totals */}
            <div className="rounded-[18px] border border-[#DFE1F5] overflow-hidden">
              <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#EEF0FA] font-display text-[12px] font-bold text-[#465478]">
                Order Items ({inspectedDetail.items.length})
              </div>
              <div className="divide-y divide-[#F1F2F9]">
                {inspectedDetail.items.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-[12.5px]"
                  >
                    <div>
                      <div className="font-display font-bold text-[#465478]">
                        {item.productName}
                      </div>
                      <div className="text-[11px] font-mono text-[#8891AA]">
                        SKU: {item.sku} · {item.quantity} × {formatINR(item.unitPrice, true)}
                      </div>
                    </div>
                    <div className="font-display font-extrabold text-[#465478] num">
                      {formatINR(item.totalPrice, true)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-[#F9FAFB] border-t border-[#EEF0FA] space-y-1 text-[12px]">
                <div className="flex justify-between text-[#6E7896]">
                  <span>Subtotal</span>
                  <span className="num">{formatINR(inspectedDetail.order.subtotal, true)}</span>
                </div>
                <div className="flex justify-between text-[#6E7896]">
                  <span>Discount</span>
                  <span className="num">−{formatINR(inspectedDetail.order.discount, true)}</span>
                </div>
                <div className="flex justify-between text-[#6E7896]">
                  <span>Shipping Fee</span>
                  <span className="num">+{formatINR(inspectedDetail.order.shippingFee, true)}</span>
                </div>
                <div className="flex justify-between font-display text-[14px] font-extrabold text-[#465478] pt-1 border-t border-[#E3E6FA]">
                  <span>Total ({inspectedDetail.order.paymentMethod})</span>
                  <span className="num">{formatINR(inspectedDetail.order.totalAmount, true)}</span>
                </div>
              </div>
            </div>

            {/* Editable Metadata Form */}
            <form
              onSubmit={handleSaveMetadata}
              className="rounded-[18px] border border-[#DFE1F5] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                  Shipping, Billing &amp; Payment Metadata
                </span>
                {canWriteOrders && (
                  <Button type="submit" variant="outline" size="xs" loading={savingMeta}>
                    <Edit3 className="w-3 h-3" /> Save Changes
                  </Button>
                )}
              </div>
              <Field label="Shipping Address">
                <input
                  type="text"
                  value={editMeta.shippingAddress}
                  disabled={!canWriteOrders}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, shippingAddress: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Payment Status">
                  <select
                    value={editMeta.paymentStatus}
                    disabled={!canWriteOrders}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, paymentStatus: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                    <option value="REFUNDED">REFUNDED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </Field>
                <Field label="Customer Notes">
                  <input
                    type="text"
                    value={editMeta.customerNotes}
                    disabled={!canWriteOrders}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, customerNotes: e.target.value })
                    }
                    placeholder="Delivery instructions…"
                    className={inputClass}
                  />
                </Field>
              </div>
            </form>

            {/* Immutable Order Status History */}
            <div>
              <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA] mb-2.5">
                Order Status Audit History ({inspectedDetail.statusHistory.length})
              </div>
              <div className="space-y-2">
                {inspectedDetail.statusHistory.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-[14px] bg-[#F9FAFB] border border-[#EEF0FA] px-3.5 py-2.5 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-[#465478]">
                        {h.previousStatus ? `${h.previousStatus} → ${h.newStatus}` : `Created (${h.newStatus})`}
                      </span>
                      <span className="text-[11px] text-[#9AA3BA]">
                        {formatDateTime(h.createdAt)}
                      </span>
                    </div>
                    <div className="text-[#6E7896] mt-0.5">
                      {h.reason} · <span className="text-[#545C9E] font-semibold">by {h.changedBy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create Order Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Order (PostgreSQL)"
        subtitle="Creates or reuses a merchant-scoped customer and calculates BigDecimal order totals on the server"
        widthClass="max-w-3xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={creatingOrder}
              data-testid="create-order-submit-btn"
              onClick={handleCreateOrderSubmit}
            >
              Create Order ({formatINR(previewTotals.total, true)})
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateOrderSubmit} className="space-y-5">
          {createError && (
            <div className="rounded-[14px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-2.5 text-[12.5px] text-[#D13B56] font-semibold">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Order Number (Optional)" hint="Auto-generated if left blank">
              <input
                type="text"
                data-testid="create-order-number"
                value={createForm.orderNumber}
                onChange={(e) => setCreateForm({ ...createForm, orderNumber: e.target.value })}
                placeholder="ORD-30101"
                className={inputClass}
              />
            </Field>
            <Field label="Order Source">
              <select
                value={createForm.source}
                onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                className={inputClass}
              >
                <option value="MANUAL">MANUAL</option>
                <option value="SHOPIFY">SHOPIFY</option>
                <option value="WOOCOMMERCE">WOOCOMMERCE</option>
              </select>
            </Field>
            <Field label="Payment Method" required>
              <select
                value={createForm.paymentMethod}
                onChange={(e) => {
                  const method = e.target.value;
                  setCreateForm({
                    ...createForm,
                    paymentMethod: method,
                    paymentStatus: method === 'COD' ? 'PENDING' : 'PAID',
                  });
                }}
                className={inputClass}
              >
                <option value="COD">COD (Cash on Delivery)</option>
                <option value="PREPAID">PREPAID</option>
                <option value="UPI">UPI</option>
                <option value="CARD">CARD</option>
                <option value="NETBANKING">NETBANKING</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Customer Full Name" required>
              <input
                type="text"
                data-testid="create-customer-name"
                value={createForm.customerName}
                onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                placeholder="Rahul Sharma"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Customer Phone" required>
              <input
                type="text"
                data-testid="create-customer-phone"
                value={createForm.customerPhone}
                onChange={(e) => setCreateForm({ ...createForm, customerPhone: e.target.value })}
                placeholder="9811456723"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Customer Email">
              <input
                type="email"
                value={createForm.customerEmail}
                onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })}
                placeholder="rahul@example.in"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Shipping Address" required>
            <input
              type="text"
              data-testid="create-shipping-address"
              value={createForm.shippingAddress}
              onChange={(e) => setCreateForm({ ...createForm, shippingAddress: e.target.value })}
              placeholder="Plot 42, Shyam Nagar, Near Metro Pillar 78, Jaipur 302019"
              className={inputClass}
              required
            />
          </Field>

          {/* Order Items Builder */}
          <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-[13px] font-bold text-[#465478]">
                Order Line Items
              </span>
              <Button type="button" variant="outline" size="xs" onClick={addLineItem}>
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            </div>

            {createForm.items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white p-3 rounded-[14px] border border-[#DFE1F5]"
              >
                <div className="sm:col-span-5">
                  <Field label="Product Name" required>
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateLineItem(idx, 'productName', e.target.value)}
                      placeholder="Product Name"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="SKU" required>
                    <input
                      type="text"
                      value={item.sku}
                      onChange={(e) => updateLineItem(idx, 'sku', e.target.value)}
                      placeholder="SKU-01"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Qty" required>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2 flex items-center gap-1.5">
                  <Field label="Unit ₹" required className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  {createForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="mb-1 p-2 text-[#D13B56] hover:bg-[#FFF0F2] rounded-full"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Discount (INR)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={createForm.discount}
                onChange={(e) => setCreateForm({ ...createForm, discount: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Shipping Fee (INR)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={createForm.shippingFee}
                onChange={(e) => setCreateForm({ ...createForm, shippingFee: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Customer Notes">
              <input
                type="text"
                value={createForm.customerNotes}
                onChange={(e) => setCreateForm({ ...createForm, customerNotes: e.target.value })}
                placeholder="Optional delivery note"
                className={inputClass}
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* CSV Batch Import Modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="PostgreSQL CSV Order Import"
        subtitle="Validates headers, phone numbers, monetary values, and duplicate order numbers with detailed row-level error reporting"
        widthClass="max-w-3xl"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCsvText(SAMPLE_POSTGRES_CSV);
                setCsvSummary(null);
                setCsvError('');
              }}
            >
              Load Sample CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={importingCsv}
              data-testid="csv-import-submit-btn"
              onClick={handleImportCsvSubmit}
            >
              <FileSpreadsheet className="w-4 h-4" /> Execute CSV Import
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Hint>
            Required columns:{' '}
            <code>
              customerName,customerPhone,productName,sku,quantity,unitPrice,paymentMethod,shippingAddress
            </code>{' '}
            (Optional: <code>orderNumber,customerEmail,discount,shippingFee,paymentStatus,customerNotes</code>)
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
              onChange={handleCsvFileUpload}
              className="block w-full text-[12.5px] text-[#5C6888] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-display file:font-bold file:bg-[#EEF0FA] file:text-[#545C9E] hover:file:bg-[#E3E6FA]"
            />
          </Field>

          <Field label="CSV Content">
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className={`${inputClass} font-mono text-[11.5px]`}
            />
          </Field>

          {csvSummary && (
            <div
              data-testid="csv-import-summary"
              className="rounded-[18px] bg-[#F9FAFB] border border-[#DFE1F5] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-[14px] font-extrabold text-[#465478]">
                  Import Summary: {csvSummary.importedOrdersCount} / {csvSummary.totalRowsProcessed}{' '}
                  Rows Imported
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold ${
                    csvSummary.failedRowsCount === 0
                      ? 'bg-[#ECFEF6] text-[#17825B]'
                      : 'bg-[#FFF5ED] text-[#D96030]'
                  }`}
                >
                  {csvSummary.failedRowsCount} Failed Row(s)
                </span>
              </div>

              {csvSummary.errors && csvSummary.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-display font-bold uppercase text-[#D13B56]">
                    Row Validation Errors (Not Imported)
                  </div>
                  {csvSummary.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="rounded-[12px] bg-[#FFF0F2] border border-[#FECDD6] px-3 py-2 text-[12px] text-[#D13B56]"
                    >
                      <strong>Row #{err.rowNumber} ({err.orderNumber}):</strong> {err.errorMessage}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Customer Order History Modal */}
      <Modal
        open={customerHistoryModal.open}
        onClose={() => setCustomerHistoryModal({ open: false, loading: false, data: null })}
        title={
          customerHistoryModal.data?.customer
            ? `Customer Profile: ${customerHistoryModal.data.customer.fullName}`
            : 'Customer Order History'
        }
        subtitle="Merchant-scoped customer profile and complete PostgreSQL order history"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setCustomerHistoryModal({ open: false, loading: false, data: null })
            }
          >
            Close
          </Button>
        }
      >
        {customerHistoryModal.loading || !customerHistoryModal.data ? (
          <div className="py-10 text-center text-[13px] text-[#7C86A2]">
            Loading customer history…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                  Phone Number
                </div>
                <div className="font-mono text-[13.5px] font-bold text-[#465478] mt-1">
                  +91 {customerHistoryModal.data.customer.phoneNumber}
                </div>
              </div>
              <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                  Total Orders
                </div>
                <div className="font-display text-[18px] font-extrabold text-[#465478] mt-1 num">
                  {customerHistoryModal.data.customer.totalOrders}
                </div>
              </div>
              <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                  Total Spend
                </div>
                <div className="font-display text-[18px] font-extrabold text-[#17825B] mt-1 num">
                  {formatINR(customerHistoryModal.data.customer.totalSpent, true)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-display text-[12.5px] font-bold text-[#465478]">
                Order History ({customerHistoryModal.data.recentOrders.length})
              </div>
              {customerHistoryModal.data.recentOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-[14px] border border-[#E3E6FA] bg-[#F9FAFB] px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-display text-[13.5px] font-bold text-[#465478]">
                      {ord.orderNumber} · {ord.primaryProductSummary}
                    </div>
                    <div className="text-[11.5px] text-[#8891AA]">
                      {formatDateTime(ord.createdAt)} · {ord.shippingAddress}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[13.5px] font-extrabold text-[#465478] num mb-1">
                      {formatINR(ord.totalAmount, true)}
                    </div>
                    <StatusBadge status={ord.orderStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDeleteOrder)}
        onClose={() => setConfirmDeleteOrder(null)}
        onConfirm={handleDeleteOrder}
        title={`Delete Order ${confirmDeleteOrder?.orderNumber}?`}
        description="Safe deletion policy: Only orders in CREATED or CANCELLED status can be deleted. This permanently removes the order from your merchant workspace."
        confirmLabel="Delete Order"
        variant="danger"
      />
    </div>
  );
}
