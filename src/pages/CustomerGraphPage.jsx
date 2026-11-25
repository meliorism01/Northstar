import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  MapPin,
  Link2,
  Unlink,
  CheckCircle2,
  Lock,
  Users,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Tabs,
  Avatar,
  StatusBadge,
  StoreBadge,
  ConfirmDialog,
  inputClass,
  Hint,
  EmptyState,
} from '../components/ui/Primitives';
import { fetchCustomers, fetchCustomerOrders } from '../services/api/customersApi';
import { useAuthStore } from '../store/useAuthStore';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime, maskPhone } from '../utils/formatters';

export function CustomerGraphPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);

  // Mode Toggle: 'live' (PostgreSQL Customers & Order History) vs 'sandbox' (Multi-Store Topology Demo)
  const [viewMode, setViewMode] = useState('live');

  // Live PostgreSQL Customers State
  const [pgCustomers, setPgCustomers] = useState([]);
  const [pgSearch, setPgSearch] = useState('');
  const [pgLoading, setPgLoading] = useState(true);
  const [selectedPgCustomerId, setSelectedPgCustomerId] = useState(null);
  const [selectedPgDetail, setSelectedPgDetail] = useState(null);
  const [pgDetailLoading, setPgDetailLoading] = useState(false);

  // Sandbox Graph State (preserved intact)
  const customers = useOrdexaStore((s) => s.customers);
  const orders = useOrdexaStore((s) => s.orders);
  const privacySettings = useOrdexaStore((s) => s.privacySettings);
  const selectedCustomerId = useOrdexaStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const updateIdentityRecord = useOrdexaStore((s) => s.updateIdentityRecord);

  const [dirSearch, setDirSearch] = useState('');
  const [inspectorTab, setInspectorTab] = useState('profile');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [confirmIdentity, setConfirmIdentity] = useState(null);

  const loadPgCustomers = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setPgLoading(true);
    try {
      const pageData = await fetchCustomers({ search: pgSearch, page: 0, size: 50 });
      const items = pageData?.items || [];
      setPgCustomers(items);
      if (items.length > 0) {
        setSelectedPgCustomerId((prev) =>
          prev && items.some((c) => c.id === prev) ? prev : items[0].id
        );
      } else {
        setSelectedPgCustomerId(null);
        setSelectedPgDetail(null);
      }
    } catch {
      setPgCustomers([]);
    } finally {
      setPgLoading(false);
    }
  }, [activeWorkspace?.merchantId, pgSearch]);

  useEffect(() => {
    if (viewMode === 'live') {
      loadPgCustomers();
    }
  }, [viewMode, loadPgCustomers]);

  useEffect(() => {
    if (viewMode !== 'live' || !selectedPgCustomerId) return;
    let active = true;
    setPgDetailLoading(true);
    fetchCustomerOrders(selectedPgCustomerId)
      .then((data) => {
        if (active) setSelectedPgDetail(data);
      })
      .catch(() => {
        if (active) setSelectedPgDetail(null);
      })
      .finally(() => {
        if (active) setPgDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewMode, selectedPgCustomerId]);

  const filteredCustomers = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.pincode.includes(q)
    );
  }, [customers, dirSearch]);

  const activeCustomer = useMemo(
    () =>
      customers.find((c) => c.id === selectedCustomerId) ||
      filteredCustomers[0] ||
      customers[0],
    [customers, selectedCustomerId, filteredCustomers]
  );

  const customerOrders = useMemo(
    () =>
      activeCustomer ? orders.filter((o) => o.customerId === activeCustomer.id) : [],
    [orders, activeCustomer]
  );

  const deliveryRate =
    activeCustomer && activeCustomer.totalOrders > 0
      ? Math.round((activeCustomer.successfulDeliveries / activeCustomer.totalOrders) * 100)
      : 100;

  const displayPhone = activeCustomer
    ? privacySettings.maskPhoneByDefault
      ? maskPhone(activeCustomer.phone)
      : `+91 ${activeCustomer.phone}`
    : '';

  const satelliteNodes = activeCustomer
    ? [
        {
          key: 'stores',
          x: 115,
          y: 95,
          category: 'OWNED CHANNELS',
          title: `${activeCustomer.stores.length} Store(s)`,
          sub: activeCustomer.stores[0],
          edgeLabel: 'shops at',
          color: '#7584D6',
        },
        {
          key: 'orders',
          x: 485,
          y: 95,
          category: 'ORDER HISTORY',
          title: `${activeCustomer.totalOrders} Orders`,
          sub: `${customerOrders.length} active in workspace`,
          edgeLabel: 'placed',
          color: '#52CEEE',
        },
        {
          key: 'addresses',
          x: 95,
          y: 225,
          category: 'ADDRESSES',
          title: `${activeCustomer.addresses.length} Saved`,
          sub: `${activeCustomer.city} · ${activeCustomer.pincode}`,
          edgeLabel: 'ships to',
          color: '#FA845D',
        },
        {
          key: 'payment',
          x: 505,
          y: 225,
          category: 'PAYMENT MIX',
          title: `${activeCustomer.codOrders} COD / ${activeCustomer.prepaidOrders} Pre`,
          sub: activeCustomer.tier,
          edgeLabel: 'pays via',
          color: '#EC7CC0',
        },
        {
          key: 'outcomes',
          x: 125,
          y: 350,
          category: 'OUTCOMES',
          title: `${activeCustomer.successfulDeliveries} Del · ${activeCustomer.previousRtos} RTO`,
          sub: `${deliveryRate}% Reliability`,
          edgeLabel: 'resulted in',
          color: '#2EB37E',
        },
        {
          key: 'identity',
          x: 475,
          y: 350,
          category: 'IDENTITY MATCH',
          title: `${activeCustomer.identityResolution.confidence}% Match`,
          sub: `${activeCustomer.identityResolution.matchedRecords.length} linked record(s)`,
          edgeLabel: 'resolved via',
          color: '#8C8CF5',
        },
      ]
    : [];

  const handleIdentityAction = (record, action) => {
    if (privacySettings.requireEvidenceForMerge) {
      setConfirmIdentity({ record, action });
    } else {
      updateIdentityRecord(
        activeCustomer.id,
        record.id,
        action,
        'Updated directly from Customer Intelligence Graph'
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity · Merchant-Scoped Customers & Graph"
        title="Customer"
        accentWord="Intelligence"
        subtitle="Inspect live merchant-scoped PostgreSQL customer records and order history, or explore the multi-store identity topology sandbox."
        icon={GitFork}
        iconTone="peri"
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ECFEF6] border border-[#C3F3DE] text-[11px] font-display font-bold text-[#17825B]">
            <Lock className="w-3 h-3" /> Merchant-Scoped Isolation Active
          </span>
        }
        actions={
          <Tabs
            items={[
              { id: 'live', label: 'PostgreSQL Customers (Live)' },
              { id: 'sandbox', label: 'Topology Sandbox (Demo)' },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        }
      />

      {viewMode === 'live' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Live PostgreSQL Customers Directory */}
          <div className="lg:col-span-4 rescale-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pgSearch}
                  onChange={(e) => setPgSearch(e.target.value)}
                  placeholder="Search name, phone, email…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadPgCustomers}>
                <RefreshCw className={`w-3.5 h-3.5 ${pgLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {pgLoading && pgCustomers.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#7C86A2]">
                Loading PostgreSQL customers…
              </div>
            ) : pgCustomers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers in this workspace yet"
                description="Customers are automatically created and linked when you create or import orders in Order Management."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/app/orders')}
                  >
                    Go to Order Management
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {pgCustomers.map((c) => {
                  const isSelected = c.id === selectedPgCustomerId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedPgCustomerId(c.id)}
                      className={`w-full text-left p-3.5 rounded-[18px] border transition-all ${
                        isSelected
                          ? 'bg-[#EEF0FA] border-[#9AA6EA] shadow-rescale-card'
                          : 'bg-white border-[#E3E6FA] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-[14px] font-bold text-[#465478] truncate">
                          {c.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-[#7584D6]">
                          +91 {c.phoneNumber}
                        </span>
                      </div>
                      {c.email && (
                        <div className="text-[11.5px] text-[#8891AA] truncate">{c.email}</div>
                      )}
                      <div className="mt-2 pt-2 border-t border-[#E6E9F8] flex items-center justify-between text-[11.5px] font-display font-bold">
                        <span className="text-[#545C9E]">{c.totalOrders} Order(s)</span>
                        <span className="text-[#17825B] num">
                          {formatINR(c.totalSpent, true)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected PostgreSQL Customer Details & Order History */}
          <div className="lg:col-span-8 rescale-card p-6 space-y-6">
            {pgDetailLoading || !selectedPgDetail ? (
              <div className="py-16 text-center text-[13.5px] text-[#7C86A2]">
                {pgCustomers.length === 0
                  ? 'Create an order in Order Management to populate your merchant customer graph.'
                  : 'Select a customer on the left to inspect their order history.'}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#EEF0FA]">
                  <div className="flex items-center gap-3.5">
                    <Avatar name={selectedPgDetail.customer.fullName} size="lg" />
                    <div>
                      <h3 className="font-display text-[19px] font-extrabold text-[#465478]">
                        {selectedPgDetail.customer.fullName}
                      </h3>
                      <p className="text-[12.5px] text-[#6E7896]">
                        +91 {selectedPgDetail.customer.phoneNumber}
                        {selectedPgDetail.customer.email
                          ? ` · ${selectedPgDetail.customer.email}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/app/orders')}
                  >
                    View in Order Queue
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                    <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                      Total Orders
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#465478] mt-1 num">
                      {selectedPgDetail.customer.totalOrders}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                    <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                      Lifetime Spend
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#17825B] mt-1 num">
                      {formatINR(selectedPgDetail.customer.totalSpent, true)}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                    <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                      First Order
                    </div>
                    <div className="font-display text-[12.5px] font-bold text-[#465478] mt-1.5">
                      {formatDateTime(selectedPgDetail.customer.firstOrderAt)}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                    <div className="text-[10.5px] font-display font-bold uppercase text-[#8891AA]">
                      Last Order
                    </div>
                    <div className="font-display text-[12.5px] font-bold text-[#465478] mt-1.5">
                      {formatDateTime(selectedPgDetail.customer.lastOrderAt)}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-display text-[15px] font-bold text-[#465478] mb-3">
                    Merchant-Scoped PostgreSQL Order History ({selectedPgDetail.recentOrders.length})
                  </h4>
                  <div className="space-y-2.5">
                    {selectedPgDetail.recentOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[14.5px] font-extrabold text-[#465478]">
                              {ord.orderNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-white text-[#545C9E] border border-[#DFE1F5]">
                              {ord.source}
                            </span>
                            <StatusBadge status={ord.orderStatus} />
                            <StatusBadge status={ord.paymentStatus} />
                          </div>
                          <div className="text-[12.5px] text-[#5C6888] mt-1">
                            {ord.primaryProductSummary} ({ord.itemCount} unit
                            {ord.itemCount === 1 ? '' : 's'})
                          </div>
                          <div className="text-[11.5px] text-[#8891AA] mt-0.5">
                            {ord.shippingAddress} · {formatDateTime(ord.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-[16px] font-extrabold text-[#465478] num">
                            {formatINR(ord.totalAmount, true)}
                          </div>
                          <div className="text-[11px] font-semibold text-[#7584D6]">
                            {ord.paymentMethod}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* SANDBOX TOPOLOGY DEMO VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-3 rescale-card p-4 flex flex-col max-h-[680px]">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Search sandbox buyer, city…"
                className={`${inputClass} pl-9`}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredCustomers.map((c) => {
                const isSelected = c.id === activeCustomer?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`w-full text-left p-3 rounded-[16px] border transition-all ${
                      isSelected
                        ? 'bg-[#EEF0FA] border-[#C9D0F3] shadow-rescale-card'
                        : 'bg-white border-transparent hover:bg-[#F9FAFB] hover:border-[#EEF0FA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-[13.5px] font-bold text-[#465478] truncate">
                        {c.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#8891AA]">{c.id}</span>
                    </div>
                    <div className="text-[11.5px] text-[#7C86A2] mt-0.5">
                      {c.city} ({c.tier}) · {c.stores.length} store(s)
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 rescale-card p-5 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-display text-[16px] font-bold text-[#465478]">
                  Relationship Topology (Sandbox)
                </h3>
                <p className="text-[11.5px] text-[#8891AA]">
                  Drag canvas to pan · Click any node to inspect signals
                </p>
              </div>

              <div className="inline-flex items-center gap-1 bg-[#F9FAFB] border border-[#DFE1F5] rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.12).toFixed(2))))}
                  className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#5C6888]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono font-bold text-[#465478] num">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.35, Number((z + 0.12).toFixed(2))))}
                  className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#5C6888]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#7584D6]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              onMouseDown={(e) => {
                setDragging(true);
                setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              onMouseMove={(e) => {
                if (!dragging) return;
                setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
              }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              className="relative rounded-[20px] border border-[#E3E6FA] bg-[#F9FAFB] rescale-dotted overflow-hidden cursor-grab active:cursor-grabbing select-none h-[430px]"
            >
              <svg viewBox="0 0 600 440" className="w-full h-full">
                <g
                  transform={`translate(${pan.x}, ${pan.y}) translate(300, 220) scale(${zoom}) translate(-300, -220)`}
                >
                  {satelliteNodes.map((node) => (
                    <line
                      key={`edge-${node.key}`}
                      x1={300}
                      y1={220}
                      x2={node.x}
                      y2={node.y}
                      stroke="#CED4F2"
                      strokeWidth="1.8"
                      strokeDasharray="4 4"
                    />
                  ))}
                  {satelliteNodes.map((node) => (
                    <g
                      key={node.key}
                      transform={`translate(${node.x - 76}, ${node.y - 32})`}
                    >
                      <rect
                        width={152}
                        height={64}
                        rx={16}
                        fill="#FFFFFF"
                        stroke="#DFE1F5"
                        strokeWidth="1.2"
                      />
                      <rect x={14} y={0} width={124} height={3.5} rx={2} fill={node.color} />
                      <text
                        x={76}
                        y={20}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill="#8891AA"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                      >
                        {node.category}
                      </text>
                      <text
                        x={76}
                        y={37}
                        textAnchor="middle"
                        fontSize="11.5"
                        fill="#465478"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                      >
                        {node.title}
                      </text>
                    </g>
                  ))}
                  {activeCustomer && (
                    <g transform="translate(212, 174)">
                      <rect
                        width={176}
                        height={92}
                        rx={22}
                        fill="#545C9E"
                        stroke="#8C95E8"
                        strokeWidth="2"
                      />
                      <text
                        x={88}
                        y={24}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill="#80E5FF"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                      >
                        CUSTOMER IDENTITY
                      </text>
                      <text
                        x={88}
                        y={46}
                        textAnchor="middle"
                        fontSize="14"
                        fill="#FFFFFF"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                      >
                        {activeCustomer.name}
                      </text>
                      <text
                        x={88}
                        y={64}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="#E3E6FA"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {displayPhone}
                      </text>
                    </g>
                  )}
                </g>
              </svg>
            </div>
          </div>

          <div className="lg:col-span-4 rescale-card p-5 flex flex-col justify-between">
            {activeCustomer && (
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-[#F1F2F9]">
                  <Avatar name={activeCustomer.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[16px] font-extrabold text-[#465478] truncate">
                      {activeCustomer.name}
                    </div>
                    <div className="text-[12px] text-[#8891AA] truncate">
                      {displayPhone} · {activeCustomer.email}
                    </div>
                  </div>
                </div>

                <div className="my-4">
                  <Tabs
                    items={[
                      { id: 'profile', label: 'Profile' },
                      { id: 'identity', label: 'Identity Resolution' },
                      { id: 'addresses', label: 'Addresses' },
                    ]}
                    value={inspectorTab}
                    onChange={setInspectorTab}
                  />
                </div>

                {inspectorTab === 'profile' && (
                  <div className="space-y-3">
                    {customerOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(o.id);
                          navigate('/app/rescue');
                        }}
                        className="w-full rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-3 flex items-center justify-between text-left"
                      >
                        <span className="font-display text-[13px] font-bold text-[#465478]">
                          {o.id}
                        </span>
                        <StatusBadge status={o.status} />
                      </button>
                    ))}
                  </div>
                )}

                {inspectorTab === 'identity' && (
                  <div className="space-y-3">
                    <Hint>
                      Confidence: <strong>{activeCustomer.identityResolution.confidence}%</strong>
                    </Hint>
                    {activeCustomer.identityResolution.matchedRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-[16px] border border-[#DFE1F5] bg-[#F9FAFB] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11.5px] font-bold text-[#465478]">
                            {rec.id}
                          </span>
                          <StoreBadge store={rec.store} />
                        </div>
                        {rec.status !== 'Separated' ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleIdentityAction(rec, 'separate')}
                          >
                            <Unlink className="w-3 h-3 text-[#E05328]" /> Separate Identity
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleIdentityAction(rec, 'merge')}
                          >
                            <Link2 className="w-3 h-3" /> Re-Merge Record
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {inspectorTab === 'addresses' && (
                  <div className="space-y-3">
                    {activeCustomer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="rounded-[16px] border border-[#DFE1F5] bg-[#F9FAFB] p-3.5"
                      >
                        <div className="font-display text-[12.5px] font-bold text-[#465478] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#7584D6]" />
                          {addr.city} ({addr.pincode})
                        </div>
                        <div className="text-[12px] text-[#5C6888] mt-1">{addr.line1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-[#F1F2F9] flex items-center justify-between text-[11.5px] text-[#8891AA]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#7584D6]" />
                Consent Tracking Enabled
              </span>
              <span className="inline-flex items-center gap-1 text-[#2EB37E]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Isolated
              </span>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmIdentity)}
        onClose={() => setConfirmIdentity(null)}
        onConfirm={() => {
          if (!confirmIdentity || !activeCustomer) return;
          updateIdentityRecord(
            activeCustomer.id,
            confirmIdentity.record.id,
            confirmIdentity.action,
            'Verified by Ops Reviewer under Governance Policy'
          );
        }}
        title={
          confirmIdentity?.action === 'separate'
            ? `Separate Record ${confirmIdentity?.record?.id}?`
            : `Confirm Identity Merge for ${confirmIdentity?.record?.id}?`
        }
        description="Evidence governance is active. This action updates merchant-scoped buyer link status."
        confirmLabel={confirmIdentity?.action === 'separate' ? 'Separate Record' : 'Confirm Merge'}
        variant={confirmIdentity?.action === 'separate' ? 'danger' : 'primary'}
      />
    </div>
  );
}
