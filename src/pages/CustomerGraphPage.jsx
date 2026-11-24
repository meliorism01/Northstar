import React, { useState, useMemo } from 'react';
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
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime, maskPhone } from '../utils/formatters';

export function CustomerGraphPage() {
  const navigate = useNavigate();
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
  const [selectedNodeKey, setSelectedNodeKey] = useState('center');
  const [confirmIdentity, setConfirmIdentity] = useState(null);

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

  if (!activeCustomer) return null;

  const deliveryRate =
    activeCustomer.totalOrders > 0
      ? Math.round((activeCustomer.successfulDeliveries / activeCustomer.totalOrders) * 100)
      : 100;

  const displayPhone = privacySettings.maskPhoneByDefault
    ? maskPhone(activeCustomer.phone)
    : `+91 ${activeCustomer.phone}`;

  const satelliteNodes = [
    {
      key: 'stores',
      x: 115,
      y: 95,
      category: 'OWNED CHANNELS',
      title: `${activeCustomer.stores.length} Store(s)`,
      sub: activeCustomer.stores[0],
      edgeLabel: 'shops at',
      color: '#7584D6',
      bg: '#F4F5FC',
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
      bg: '#EEFBFF',
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
      bg: '#FFF5F0',
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
      bg: '#FFF3FA',
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
      bg: '#EEFCF6',
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
      bg: '#F6F5FF',
    },
  ];

  const handleIdentityAction = (record, action) => {
    if (privacySettings.requireEvidenceForMerge) {
      setConfirmIdentity({ record, action });
    } else {
      updateIdentityRecord(
        activeCustomer.id,
        record.id,
        action,
        `Updated directly from Customer Intelligence Graph`
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity · Merchant-Scoped Graph"
        title="Customer"
        accentWord="Intelligence"
        subtitle="Privacy-first buyer identity resolution across your owned storefronts—linking addresses, landmarks, and COD outcomes without cross-merchant blacklists."
        icon={GitFork}
        iconTone="peri"
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ECFEF6] border border-[#C3F3DE] text-[11px] font-display font-bold text-[#17825B]">
            <Lock className="w-3 h-3" /> Merchant-Scoped Isolation Active
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (3 cols): Buyer Directory */}
        <div className="lg:col-span-3 rescale-card p-4 flex flex-col max-h-[680px]">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-[#7584D6] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={dirSearch}
              onChange={(e) => setDirSearch(e.target.value)}
              placeholder="Search buyer, city, PIN…"
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredCustomers.map((c) => {
              const isSelected = c.id === activeCustomer.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setSelectedNodeKey('center');
                  }}
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
                  <div className="mt-2 flex items-center justify-between text-[11px] font-display font-bold">
                    <span>
                      <span className="text-[#17825B]">{c.successfulDeliveries} Del</span>
                      <span className="text-[#C5CAEC] mx-1">·</span>
                      <span className={c.previousRtos > 0 ? 'text-[#E05328]' : 'text-[#8891AA]'}>
                        {c.previousRtos} RTO
                      </span>
                    </span>
                    <span className="text-[#7584D6] num">
                      {c.identityResolution.confidence}% Match
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN (5 cols): Interactive Dotted Relationship Topology */}
        <div className="lg:col-span-5 rescale-card p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-[16px] font-bold text-[#465478]">
                Relationship Topology
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
                aria-label="Zoom out"
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
                aria-label="Zoom in"
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
                aria-label="Reset view"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive SVG Graph Canvas */}
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
                {/* Connecting Edges */}
                {satelliteNodes.map((node) => {
                  const midX = (300 + node.x) / 2;
                  const midY = (220 + node.y) / 2;
                  return (
                    <g key={`edge-${node.key}`}>
                      <line
                        x1={300}
                        y1={220}
                        x2={node.x}
                        y2={node.y}
                        stroke="#CED4F2"
                        strokeWidth="1.8"
                        strokeDasharray="4 4"
                      />
                      <rect
                        x={midX - 34}
                        y={midY - 10}
                        width={68}
                        height={20}
                        rx={10}
                        fill="#FFFFFF"
                        stroke="#E3E6FA"
                      />
                      <text
                        x={midX}
                        y={midY + 3.5}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#7C86A2"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="600"
                      >
                        {node.edgeLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Satellite Nodes */}
                {satelliteNodes.map((node) => {
                  const isActive = selectedNodeKey === node.key;
                  return (
                    <g
                      key={node.key}
                      transform={`translate(${node.x - 76}, ${node.y - 32})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeKey(node.key);
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        width={152}
                        height={64}
                        rx={16}
                        fill="#FFFFFF"
                        stroke={isActive ? node.color : '#DFE1F5'}
                        strokeWidth={isActive ? '2.2' : '1.2'}
                      />
                      <rect
                        x={14}
                        y={0}
                        width={124}
                        height={3.5}
                        rx={2}
                        fill={node.color}
                      />
                      <text
                        x={76}
                        y={20}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill="#8891AA"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="800"
                        letterSpacing="0.08em"
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
                      <text
                        x={76}
                        y={52}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#7C86A2"
                        fontFamily="Inter, sans-serif"
                      >
                        {node.sub.length > 24 ? `${node.sub.slice(0, 22)}…` : node.sub}
                      </text>
                    </g>
                  );
                })}

                {/* Central Buyer Identity Pill Card */}
                <g
                  transform="translate(212, 174)"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeKey('center');
                  }}
                  className="cursor-pointer"
                >
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
                    letterSpacing="0.12em"
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
                  <text
                    x={88}
                    y={80}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#C9D0F3"
                    fontFamily="Manrope, sans-serif"
                    fontWeight="600"
                  >
                    {activeCustomer.city} · {activeCustomer.pincode}
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* Node Context Summary Footer */}
          <div className="mt-4 rounded-[16px] bg-[#F4F5FC] border border-[#E3E6FA] px-4 py-3 text-[12.5px] text-[#465478]">
            <span className="font-display font-bold text-[#545C9E]">
              Active Node Summary:{' '}
            </span>
            {activeCustomer.name} ({activeCustomer.id}) in {activeCustomer.city},{' '}
            {activeCustomer.state} ({activeCustomer.pincode}, {activeCustomer.tier}).
            Responsiveness: <strong>{activeCustomer.responsiveness}</strong>.
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): 3-Tab Profile / Identity / Addresses Inspector */}
        <div className="lg:col-span-4 rescale-card p-5 flex flex-col justify-between">
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
                  { id: 'profile', label: 'Profile & Orders' },
                  { id: 'identity', label: 'Identity Resolution' },
                  { id: 'addresses', label: 'Addresses' },
                ]}
                value={inspectorTab}
                onChange={setInspectorTab}
              />
            </div>

            {inspectorTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                    <div className="text-[10.5px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                      Total Orders
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#465478] mt-1 num">
                      {activeCustomer.totalOrders}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                    <div className="text-[10.5px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                      Delivery Rate
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#17825B] mt-1 num">
                      {deliveryRate}%
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                    <div className="text-[10.5px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                      Prior RTOs
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#E05328] mt-1 num">
                      {activeCustomer.previousRtos}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 text-center">
                    <div className="text-[10.5px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                      COD vs Prepaid
                    </div>
                    <div className="font-display text-[22px] font-extrabold text-[#545C9E] mt-1 num">
                      {activeCustomer.codOrders} / {activeCustomer.prepaidOrders}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11.5px] font-display font-bold text-[#465478] mb-2">
                    Merchant-Scoped Order History
                  </div>
                  <div className="space-y-2">
                    {customerOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(o.id);
                          navigate('/app/orders');
                        }}
                        className="w-full rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] hover:bg-white p-3 flex items-center justify-between gap-2 text-left transition-colors"
                      >
                        <div>
                          <div className="font-display text-[13px] font-bold text-[#465478]">
                            {o.id}
                          </div>
                          <div className="text-[11px] text-[#8891AA]">{o.store}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-[13px] font-bold text-[#465478] num mb-1">
                            {formatINR(o.orderValue)}
                          </div>
                          <StatusBadge status={o.status} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'identity' && (
              <div className="space-y-4">
                <Hint>
                  Confidence: <strong>{activeCustomer.identityResolution.confidence}%</strong>. Records can be separated or re-merged with full audit logging.
                </Hint>

                <div>
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#8891AA] mb-2">
                    Matching Signals
                  </div>
                  <ul className="space-y-1.5 text-[12px] text-[#5C6888]">
                    {activeCustomer.identityResolution.factors.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2EB37E] mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2.5">
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                    Linked Channel Records
                  </div>
                  {activeCustomer.identityResolution.matchedRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-[16px] border border-[#DFE1F5] bg-[#F9FAFB] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11.5px] font-bold text-[#465478]">
                          {rec.id}
                        </span>
                        <span
                          className={`text-[10.5px] font-display font-bold px-2.5 py-0.5 rounded-full ${
                            rec.status === 'Separated'
                              ? 'bg-[#FFF1EC] text-[#E05328]'
                              : 'bg-[#ECFEF6] text-[#17825B]'
                          }`}
                        >
                          {rec.status} ({rec.confidence}%)
                        </span>
                      </div>
                      <StoreBadge store={rec.store} />
                      <div className="pt-1 flex items-center gap-2">
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inspectorTab === 'addresses' && (
              <div className="space-y-4">
                {activeCustomer.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="rounded-[16px] border border-[#DFE1F5] bg-[#F9FAFB] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 font-display text-[12.5px] font-bold text-[#465478]">
                        <MapPin className="w-3.5 h-3.5 text-[#7584D6]" />
                        {addr.city} ({addr.pincode})
                      </span>
                      <span
                        className={`text-[10.5px] font-display font-bold px-2.5 py-0.5 rounded-full ${
                          addr.status === 'Verified'
                            ? 'bg-[#ECFEF6] text-[#17825B]'
                            : 'bg-[#FFF1EC] text-[#E05328]'
                        }`}
                      >
                        {addr.status}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-[#5C6888]">{addr.line1}</div>
                    {addr.landmark && (
                      <div className="text-[12px] text-[#17825B] font-semibold mt-0.5">
                        Landmark: {addr.landmark}
                      </div>
                    )}
                  </div>
                ))}

                {(activeCustomer.identityResolution.auditLog || []).length > 0 && (
                  <div className="pt-2 border-t border-[#EEF0FA] space-y-2">
                    <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#8891AA]">
                      Governance Audit Log
                    </div>
                    {activeCustomer.identityResolution.auditLog.map((log, i) => (
                      <div key={i} className="text-[11.5px] text-[#6E7896]">
                        <span className="font-bold text-[#465478]">{log.actor}:</span> {log.action}{' '}
                        <span className="text-[#9AA3BA]">({formatDateTime(log.timestamp)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#F1F2F9] flex items-center justify-between text-[11.5px] text-[#8891AA]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7584D6]" />
              Consent Tracking Enabled
            </span>
            <span>Retention: {privacySettings.dataRetentionDays}d</span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmIdentity)}
        onClose={() => setConfirmIdentity(null)}
        onConfirm={() => {
          if (!confirmIdentity) return;
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
        description="Evidence governance is active. This action updates merchant-scoped buyer link status and appends an immutable entry to the identity audit log."
        confirmLabel={confirmIdentity?.action === 'separate' ? 'Separate Record' : 'Confirm Merge'}
        variant={confirmIdentity?.action === 'separate' ? 'danger' : 'primary'}
      />
    </div>
  );
}
