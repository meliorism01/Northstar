import React, { useState, useMemo } from 'react';
import {
  Share2,
  ShieldCheck,
  Store,
  Package,
  MapPin,
  CreditCard,
  CheckCircle2,
  MessageSquare,
  GitMerge,
  Scissors,
  Search,
  Lock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { Button, ConfirmDialog, PageHeader, StatusBadge } from '../components/ui/Primitives';
import { formatDateTime, formatINR, formatPercent, maskPhone } from '../utils/formatters';

export function CustomerGraphPage() {
  const customers = useOrdexaStore((s) => s.customers);
  const orders = useOrdexaStore((s) => s.orders);
  const selectedCustomerId = useOrdexaStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);
  const updateIdentityRecord = useOrdexaStore((s) => s.updateIdentityRecord);

  const [search, setSearch] = useState('');
  const [activeNode, setActiveNode] = useState('customer');
  const [inspectorTab, setInspectorTab] = useState('profile');
  const [auditNote, setAuditNote] = useState('Verified phone and address evidence within merchant scope');
  const [separateTarget, setSeparateTarget] = useState(null);

  // Interactive Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const customer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || customers[0],
    [customers, selectedCustomerId]
  );

  const customerOrders = useMemo(
    () => orders.filter((o) => o.customerId === customer?.id),
    [orders, customer]
  );

  const deliverySuccessRate = useMemo(() => {
    if (!customer) return 0;
    const closed = customer.successfulDeliveries + customer.previousRtos;
    if (closed === 0) return 0;
    return (customer.successfulDeliveries / closed) * 100;
  }, [customer]);

  if (!customer) return null;

  const nodes = [
    {
      id: 'stores',
      type: 'STORE',
      edgeLabel: 'shops at',
      label: 'Connected Stores',
      sub: `${customer.stores.length} owned store(s)`,
      x: 118,
      y: 62,
      color: '#262B3E',
    },
    {
      id: 'orders',
      type: 'ORDER',
      edgeLabel: 'placed',
      label: 'Previous Orders',
      sub: `${customerOrders.length} order(s)`,
      x: 502,
      y: 62,
      color: '#262B3E',
    },
    {
      id: 'addresses',
      type: 'ADDRESS',
      edgeLabel: 'delivers to',
      label: 'Delivery Addresses',
      sub: `${customer.addresses.length} saved`,
      x: 92,
      y: 185,
      color: '#B59D73',
    },
    {
      id: 'payments',
      type: 'PAYMENT',
      edgeLabel: 'pays via',
      label: 'Payment Behaviour',
      sub: `${customer.codOrders} COD / ${customer.prepaidOrders} Pre`,
      x: 528,
      y: 185,
      color: '#B59D73',
    },
    {
      id: 'outcomes',
      type: 'OUTCOME',
      edgeLabel: 'resulted in',
      label: 'Delivery Outcomes',
      sub: `${customer.successfulDeliveries} Del • ${customer.previousRtos} RTO`,
      x: 132,
      y: 308,
      color: customer.previousRtos > 0 ? '#DC3545' : '#198754',
    },
    {
      id: 'interventions',
      type: 'INTERVENTION',
      edgeLabel: 'responded to',
      label: 'Prior Interventions',
      sub: `${customerOrders.filter((o) => (o.messages || []).length > 0 || o.rescued).length} logged`,
      x: 488,
      y: 308,
      color: '#262B3E',
    },
  ];

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-node="true"]')) return;
    setDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };

  const handlePointerUp = () => setDragging(false);

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Intelligence Graph"
        subtitle="Merchant-scoped identity resolution linking orders, addresses, payments, and delivery outcomes across your own stores."
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold bg-navy text-gold rounded-[3px]">
            <Lock className="w-3 h-3" /> Merchant-Scoped Only
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Customer Directory */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[4px] shadow-card flex flex-col max-h-[700px]">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer or city..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-[4px] text-navy focus:outline-none focus:border-navy"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {filteredCustomers.map((c) => {
              const active = c.id === customer.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setActiveNode('customer');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 transition-colors border-l-2 ${
                    active
                      ? 'bg-gold-subtle/70 border-l-gold'
                      : 'border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-navy-dark">{c.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.city} ({c.tier}) • {c.stores.length} store(s)
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono tabular-nums">
                    <span className="text-emerald-700 font-semibold">{c.successfulDeliveries} Del</span>
                    <span className={c.previousRtos > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                      {c.previousRtos} RTO
                    </span>
                    <span className="text-navy ml-auto">{c.identityResolution.confidence}% Match</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Interactive Zoom/Pan Graph Canvas */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[4px] shadow-card flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h3 className="font-sans text-sm font-bold text-navy-dark flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-gold-hover" /> Relationship Topology
              </h3>
              <p className="text-[11px] text-slate-500">Drag canvas to pan • Click nodes to inspect</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[4px] border border-slate-200">
              <button
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                className="p-1 text-navy hover:bg-white rounded-[3px]"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10px] text-navy tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                className="p-1 text-navy hover:bg-white rounded-[3px]"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetViewport}
                className="p-1 text-navy hover:bg-white rounded-[3px]"
                title="Reset View"
                aria-label="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative bg-surface-canvas border-b border-slate-200 overflow-hidden select-none ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              backgroundImage: 'radial-gradient(#D1D5DB 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          >
            <svg viewBox="0 0 620 370" className="w-full h-[355px]">
              <g transform={`translate(${pan.x + 310}, ${pan.y + 185}) scale(${zoom}) translate(-310, -185)`}>
                {/* Curved Cubic Bezier Edges + Labels */}
                {nodes.map((n) => {
                  const selected = activeNode === n.id;
                  const midX = (310 + n.x) / 2;
                  const midY = (185 + n.y) / 2;
                  const ctrlX = midX;
                  const ctrlY = n.y < 185 ? midY - 18 : midY + 18;
                  const pathD = `M 310 185 Q ${ctrlX} ${ctrlY} ${n.x} ${n.y}`;
                  return (
                    <g key={`edge-${n.id}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={selected ? '#B59D73' : '#CBD5E1'}
                        strokeWidth={selected ? 2.2 : 1.3}
                        strokeDasharray={selected ? '0' : '4 3'}
                      />
                      <rect
                        x={midX - 28}
                        y={ctrlY - 8}
                        width={56}
                        height={15}
                        rx={3}
                        fill="#FFFFFF"
                        stroke="#E2E8F0"
                      />
                      <text
                        x={midX}
                        y={ctrlY + 3}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="8.5"
                        fontFamily="Inter, sans-serif"
                      >
                        {n.edgeLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Typed Connected Nodes */}
                {nodes.map((n) => {
                  const selected = activeNode === n.id;
                  return (
                    <g
                      key={n.id}
                      data-node="true"
                      onClick={() => {
                        setActiveNode(n.id);
                        if (n.id === 'orders' || n.id === 'outcomes') setInspectorTab('profile');
                        if (n.id === 'addresses' || n.id === 'interventions') setInspectorTab('history');
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        x={n.x - 78}
                        y={n.y - 28}
                        width={156}
                        height={56}
                        rx={4}
                        fill={selected ? '#1C202E' : '#FFFFFF'}
                        stroke={selected ? '#C9B38C' : '#CBD5E1'}
                        strokeWidth={selected ? 2 : 1.1}
                      />
                      <rect x={n.x - 78} y={n.y - 28} width={156} height={4} rx={2} fill={n.color} />
                      <text
                        x={n.x}
                        y={n.y - 12}
                        textAnchor="middle"
                        fill={selected ? '#C9B38C' : '#64748B'}
                        fontSize="8"
                        fontWeight="700"
                        letterSpacing="0.8"
                      >
                        {n.type}
                      </text>
                      <text
                        x={n.x}
                        y={n.y + 3}
                        textAnchor="middle"
                        fill={selected ? '#FFFFFF' : '#1C202E'}
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="Inter, sans-serif"
                      >
                        {n.label}
                      </text>
                      <text
                        x={n.x}
                        y={n.y + 18}
                        textAnchor="middle"
                        fill={selected ? '#E3D5BC' : '#64748B'}
                        fontSize="9.5"
                        fontFamily="Inter, sans-serif"
                      >
                        {n.sub}
                      </text>
                    </g>
                  );
                })}

                {/* Central Customer Identity Node */}
                <g data-node="true" onClick={() => setActiveNode('customer')} className="cursor-pointer">
                  <rect
                    x={224}
                    y={143}
                    width={172}
                    height={84}
                    rx={6}
                    fill="#1C202E"
                    stroke="#C9B38C"
                    strokeWidth="2.5"
                  />
                  <text
                    x={310}
                    y={166}
                    textAnchor="middle"
                    fill="#C9B38C"
                    fontSize="8.5"
                    fontWeight="700"
                    letterSpacing="1.4"
                  >
                    CUSTOMER IDENTITY
                  </text>
                  <text
                    x={310}
                    y={187}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                  >
                    {customer.name}
                  </text>
                  <text
                    x={310}
                    y={205}
                    textAnchor="middle"
                    fill="#CBD5E1"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {maskPhone(customer.phone)}
                  </text>
                  <text
                    x={310}
                    y={219}
                    textAnchor="middle"
                    fill="#C9B38C"
                    fontSize="9"
                    fontFamily="Inter, sans-serif"
                  >
                    {customer.city} • {customer.pincode}
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* Focused Node Evidence Strip */}
          <div className="p-4 text-xs flex-1 bg-white">
            {activeNode === 'customer' && (
              <div>
                <div className="font-semibold text-navy-dark mb-1">Central Identity Summary</div>
                <p className="text-slate-600 leading-relaxed">
                  {customer.name} ({customer.id}) in {customer.city}, {customer.state} ({customer.pincode},{' '}
                  {customer.tier}). Responsiveness: <strong className="text-navy">{customer.responsiveness}</strong>.
                </p>
              </div>
            )}
            {activeNode === 'stores' && (
              <div>
                <div className="font-semibold text-navy-dark mb-2 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-gold-hover" /> Connected Merchant Stores
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customer.stores.map((st) => (
                    <span key={st} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-[3px] font-medium text-navy">
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activeNode === 'orders' && (
              <div>
                <div className="font-semibold text-navy-dark mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-gold-hover" /> Linked Orders ({customerOrders.length})
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {customerOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-[3px] border border-slate-200">
                      <span className="font-mono font-bold text-navy">{o.id}</span>
                      <span className="tabular-nums">{formatINR(o.orderValue)} ({o.paymentMode})</span>
                      <StatusBadge status={o.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeNode === 'addresses' && (
              <div>
                <div className="font-semibold text-navy-dark mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gold-hover" /> Delivery Addresses
                </div>
                <div className="space-y-1.5">
                  {customer.addresses.map((a) => (
                    <div key={a.id} className="bg-slate-50 p-2 rounded-[3px] border border-slate-200">
                      <div className="font-semibold text-navy-dark">{a.line1}</div>
                      <div className="text-slate-500">
                        Landmark: {a.landmark || 'Missing'} • {a.city} ({a.pincode})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeNode === 'payments' && (
              <div>
                <div className="font-semibold text-navy-dark mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-gold-hover" /> Payment Behaviour
                </div>
                <div className="text-slate-600 tabular-nums">
                  COD Orders: <strong className="text-navy">{customer.codOrders}</strong> • Prepaid Orders:{' '}
                  <strong className="text-navy">{customer.prepaidOrders}</strong>
                </div>
              </div>
            )}
            {activeNode === 'outcomes' && (
              <div>
                <div className="font-semibold text-navy-dark mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gold-hover" /> Delivery Outcomes
                </div>
                <div className="text-slate-600 tabular-nums">
                  Successful Deliveries: <strong className="text-emerald-700">{customer.successfulDeliveries}</strong> • Previous RTOs:{' '}
                  <strong className="text-red-600">{customer.previousRtos}</strong> • Prior NDRs:{' '}
                  <strong className="text-amber-700">{customer.priorNdrCount}</strong>
                </div>
              </div>
            )}
            {activeNode === 'interventions' && (
              <div>
                <div className="font-semibold text-navy-dark mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-gold-hover" /> Previous Interventions
                </div>
                <div className="text-slate-600">
                  {customer.addressHistory?.length > 0
                    ? customer.addressHistory.map((h, i) => <div key={i}>• {h.change}</div>)
                    : 'No manual interventions required previously.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabbed Detail & Identity Resolution Inspector */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-[4px] shadow-card flex flex-col">
          {/* Inspector Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 px-2 pt-2 gap-1">
            {[
              { id: 'profile', label: 'Profile & Orders' },
              { id: 'resolution', label: 'Identity Resolution' },
              { id: 'history', label: 'Activity & Addresses' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setInspectorTab(t.id)}
                className={`px-3 py-2 text-xs font-medium rounded-t-[4px] border-b-2 transition-colors ${
                  inspectorTab === t.id
                    ? 'border-navy text-navy-dark font-semibold bg-white'
                    : 'border-transparent text-slate-500 hover:text-navy-dark'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 flex-1 overflow-y-auto text-xs space-y-4">
            {inspectorTab === 'profile' && (
              <>
                <div className="grid grid-cols-2 gap-2.5 text-center tabular-nums">
                  <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500">Total Orders</div>
                    <div className="text-lg font-bold text-navy-dark mt-0.5">{customer.totalOrders}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500">Delivery Rate</div>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5">
                      {formatPercent(deliverySuccessRate, 0)}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500">Prior RTOs</div>
                    <div className="text-lg font-bold text-red-600 mt-0.5">{customer.previousRtos}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500">COD vs Prepaid</div>
                    <div className="text-sm font-bold text-navy-dark mt-1">
                      {customer.codOrders} / {customer.prepaidOrders}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-navy-dark mb-2">Merchant-Scoped Order History</div>
                  <div className="space-y-1.5">
                    {customerOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-[4px]">
                        <div>
                          <div className="font-mono font-bold text-navy-dark">{o.id}</div>
                          <div className="text-[10px] text-slate-500">{o.store}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold text-navy-dark tabular-nums">
                            {formatINR(o.orderValue)}
                          </div>
                          <StatusBadge status={o.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {inspectorTab === 'resolution' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <div className="font-semibold text-navy-dark">Matching Confidence</div>
                    <div className="text-[11px] text-slate-500">
                      Updated {formatDateTime(customer.identityResolution.lastUpdated)}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-emerald-700 tabular-nums">
                    {customer.identityResolution.confidence}%
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-navy-dark mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-gold-hover" /> Matching Evidence Factors
                  </div>
                  <ul className="space-y-1.5 text-slate-600">
                    {customer.identityResolution.factors.map((f, i) => (
                      <li key={i} className="bg-slate-50 px-3 py-2 rounded-[3px] border-l-2 border-gold">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-navy-dark mb-1.5">Matched Merchant Records</div>
                  <div className="space-y-2">
                    {customer.identityResolution.matchedRecords.map((rec) => (
                      <div key={rec.id} className="border border-slate-200 rounded-[4px] p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-navy-dark">{rec.id}</span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-[3px] border ${
                              rec.status === 'Separated'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : rec.status === 'Reviewable'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {rec.status} ({rec.confidence}%)
                          </span>
                        </div>
                        <div className="text-slate-500 mt-1">
                          {rec.store} • {rec.channel}
                        </div>
                        <div className="flex gap-2 mt-2.5">
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={rec.status === 'Merged' || rec.status === 'Primary'}
                            onClick={() => updateIdentityRecord(customer.id, rec.id, 'merge', auditNote)}
                          >
                            <GitMerge className="w-3 h-3" /> Confirm Merge
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={rec.status === 'Separated' || rec.status === 'Primary'}
                            onClick={() => setSeparateTarget(rec.id)}
                          >
                            <Scissors className="w-3 h-3" /> Separate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-navy-dark mb-1">Audit Reason Note</label>
                  <input
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy text-xs"
                  />
                </div>
              </>
            )}

            {inspectorTab === 'history' && (
              <>
                <div>
                  <div className="font-semibold text-navy-dark mb-2">Address Modification History</div>
                  {customer.addressHistory?.length > 0 ? (
                    <ul className="space-y-2 border-l-2 border-gold pl-3">
                      {customer.addressHistory.map((h, i) => (
                        <li key={i}>
                          <div className="text-navy-dark font-medium">{h.change}</div>
                          <div className="text-[10px] text-slate-400">{formatDateTime(h.date)}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-500 bg-slate-50 p-3 rounded-[4px] border border-slate-200">
                      No address edits recorded yet.
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-navy-dark mb-2">Identity Resolution Audit Log</div>
                  <div className="space-y-2 border-l-2 border-navy pl-3">
                    {(customer.identityResolution.auditLog || []).length > 0 ? (
                      customer.identityResolution.auditLog.map((log, i) => (
                        <div key={i}>
                          <div className="font-semibold text-navy-dark">{log.actor}</div>
                          <div className="text-slate-600">{log.action}</div>
                          <div className="text-[10px] text-slate-400">{formatDateTime(log.timestamp)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500">No manual resolution overrides logged.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(separateTarget)}
        onClose={() => setSeparateTarget(null)}
        onConfirm={() => {
          if (separateTarget) {
            updateIdentityRecord(customer.id, separateTarget, 'separate', auditNote);
          }
        }}
        title={`Separate Identity Record ${separateTarget}?`}
        description="Separating this record unlinks it from the merged customer profile and logs an entry in the identity resolution audit trail."
        confirmLabel="Separate Record"
        variant="danger"
      />
    </div>
  );
}
