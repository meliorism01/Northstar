import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitFork,
  Search,
  ZoomIn,
  ZoomOut,
  Lock,
  Users,
  UserPlus,
  RefreshCw,
  Package,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Info,
  CreditCard,
  Repeat,
  X,
  Sparkles,
  PanelLeftOpen,
  PanelRightOpen,
  Wallet,
  TrendingUp,
  Award,
  XCircle,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  PageHeader,
  Button,
  Tabs,
  Avatar,
  IconTile,
  inputClass,
  EmptyState,
} from '../components/ui/Primitives';
import {
  fetchIntelligenceOverview,
  fetchIntelligentCustomers,
  fetchCustomer360,
  fetchCustomerGraph,
  fetchProductIntelligence,
  fetchProductCoPurchases,
  fetchProductSkuDetail,
} from '../services/api/intelligenceApi';
import { useAuthStore } from '../store/useAuthStore';
import { formatINR, formatDateTime } from '../utils/formatters';

const selectClass = inputClass;

const SEGMENT_META = {
  LOYAL_CUSTOMER: {
    label: 'Loyal Customer',
    bg: 'bg-[#ECFEF6]',
    text: 'text-[#17825B]',
    border: 'border-[#BCEFD9]',
  },
  HIGH_VALUE_CUSTOMER: {
    label: 'High Value',
    bg: 'bg-[#EEF0FA]',
    text: 'text-[#4B5399]',
    border: 'border-[#CFD5F6]',
  },
  REPEAT_CUSTOMER: {
    label: 'Repeat Customer',
    bg: 'bg-[#E9FAFF]',
    text: 'text-[#0E7490]',
    border: 'border-[#BAE6FD]',
  },
  NEW_CUSTOMER: {
    label: 'New Customer',
    bg: 'bg-[#F8FAFC]',
    text: 'text-[#475569]',
    border: 'border-[#E2E8F0]',
  },
  COD_HEAVY_CUSTOMER: {
    label: 'COD Heavy',
    bg: 'bg-[#FFF7ED]',
    text: 'text-[#C2410C]',
    border: 'border-[#FED7AA]',
  },
  INACTIVE_CUSTOMER: {
    label: 'Inactive Customer',
    bg: 'bg-[#FEF9C3]',
    text: 'text-[#854D0E]',
    border: 'border-[#FDE047]',
  },
  CANCELLATION_PRONE_CUSTOMER: {
    label: 'Cancellation Prone',
    bg: 'bg-[#FFF1EC]',
    text: 'text-[#CC3F14]',
    border: 'border-[#FBCFC0]',
  },
};

const EDGE_THEMES = {
  PLACED: {
    stroke: '#0EA5E9',
    pillBg: '#E0F2FE',
    pillBorder: '#7DD3FC',
    text: '#0369A1',
    label: 'PLACED',
  },
  CONTAINS: {
    stroke: '#10B981',
    pillBg: '#D1FAE5',
    pillBorder: '#6EE7B7',
    text: '#047857',
    label: 'CONTAINS',
  },
  BELONGS_TO: {
    stroke: '#6366F1',
    pillBg: '#EEF2FF',
    pillBorder: '#A5B4FC',
    text: '#4338CA',
    label: 'SEGMENT',
  },
};

// Stage & Card Geometry (1:1 CSS Pixels for Big, Razor-Sharp Readability)
const STAGE_W = 820;
const STAGE_H = 640;
const CARD_W = 236;
const CARD_H = 92;
const CUSTOMER_CARD_W = 264;
const CUSTOMER_CARD_H = 102;

function buildSmoothEdgePath(src, tgt) {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2;

  const c1x = src.x;
  const c1y = src.y + dy * 0.52;
  const c2x = tgt.x;
  const c2y = tgt.y - dy * 0.52;

  if (Math.abs(dy) < 55) {
    return {
      d: `M ${src.x} ${src.y} C ${src.x + dx * 0.5} ${src.y}, ${tgt.x - dx * 0.5} ${tgt.y}, ${tgt.x} ${tgt.y}`,
      labelX: mx,
      labelY: my,
    };
  }

  return {
    d: `M ${src.x} ${src.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tgt.x} ${tgt.y}`,
    labelX: mx,
    labelY: my,
  };
}

function SegmentPill({ segmentId, className = '' }) {
  const meta = SEGMENT_META[segmentId] || {
    label: segmentId?.replace(/_/g, ' ') || 'Unclassified',
    bg: 'bg-[#F8FAFC]',
    text: 'text-[#475569]',
    border: 'border-[#E2E8F0]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold border max-w-full truncate ${meta.bg} ${meta.text} ${meta.border} ${className}`}
      title={meta.label}
    >
      {meta.label}
    </span>
  );
}

/**
 * FRONTEND GRAPH DATA VALIDATION
 * Guarantees strictly 1 CUSTOMER node and only connected ORDER, consolidated PRODUCT, and assigned SEGMENT nodes.
 */
function validateIndividualCustomerGraph(rawGraph, expectedCustomerId) {
  if (!rawGraph || !Array.isArray(rawGraph.nodes) || !Array.isArray(rawGraph.edges) || !expectedCustomerId) {
    return { valid: false, nodes: [], edges: [], orderCount: 0, error: 'Invalid graph payload' };
  }

  const expectedCustNodeId = `customer:${expectedCustomerId}`;
  const customerNodes = rawGraph.nodes.filter(
    (n) => n.type === 'CUSTOMER' && n.id === expectedCustNodeId
  );
  if (customerNodes.length !== 1) {
    return {
      valid: false,
      nodes: [],
      edges: [],
      orderCount: 0,
      error: 'Individual customer graph must contain exactly one matching CUSTOMER node.',
    };
  }

  const centralCustomer = customerNodes[0];
  const nodeMap = new Map(rawGraph.nodes.map((n) => [n.id, n]));

  const validOrderIds = new Set();
  const validPlacedEdges = [];
  rawGraph.edges.forEach((e) => {
    if (
      e.type === 'PLACED' &&
      e.source === expectedCustNodeId &&
      nodeMap.get(e.target)?.type === 'ORDER'
    ) {
      validOrderIds.add(e.target);
      validPlacedEdges.push(e);
    }
  });

  const validSegmentIds = new Set();
  const validBelongsEdges = [];
  rawGraph.edges.forEach((e) => {
    if (
      e.type === 'BELONGS_TO' &&
      e.source === expectedCustNodeId &&
      nodeMap.get(e.target)?.type === 'SEGMENT'
    ) {
      validSegmentIds.add(e.target);
      validBelongsEdges.push(e);
    }
  });

  const validProductIds = new Set();
  const validContainsEdges = [];
  rawGraph.edges.forEach((e) => {
    if (
      e.type === 'CONTAINS' &&
      validOrderIds.has(e.source) &&
      nodeMap.get(e.target)?.type === 'PRODUCT'
    ) {
      validProductIds.add(e.target);
      validContainsEdges.push(e);
    }
  });

  const validatedNodes = [
    centralCustomer,
    ...[...validSegmentIds].map((id) => nodeMap.get(id)).filter(Boolean),
    ...[...validOrderIds].map((id) => nodeMap.get(id)).filter(Boolean),
    ...[...validProductIds].map((id) => nodeMap.get(id)).filter(Boolean),
  ];

  const validatedNodeIdSet = new Set(validatedNodes.map((n) => n.id));
  const validatedEdges = [
    ...validBelongsEdges,
    ...validPlacedEdges,
    ...validContainsEdges,
  ].filter((e) => validatedNodeIdSet.has(e.source) && validatedNodeIdSet.has(e.target));

  return {
    valid: true,
    nodes: validatedNodes,
    edges: validatedEdges,
    orderCount: validOrderIds.size,
    productCount: validProductIds.size,
    segmentCount: validSegmentIds.size,
    error: null,
  };
}

/**
 * 4-TIER CONSTELLATION LAYOUT ENGINE (1:1 CSS Pixel Coordinates, Zero Overlap, Large Readable Scale)
 * - Tier 1 (Top Crown): Assigned Behavioral Segments
 * - Tier 2 (Center Hub): Selected Customer Hero Node
 * - Tier 3 (Mid Orbit): Customer's Orders
 * - Tier 4 (Lower Constellation): Consolidated Products aligned beneath parent orders
 */
function computeIndividualCustomerLayout(nodes = [], edges = [], containerWidth = 720, containerHeight = 610) {
  const cx = STAGE_W / 2;
  const customerY = 248;

  const customerNode = nodes.find((n) => n.type === 'CUSTOMER');
  const segmentNodes = nodes.filter((n) => n.type === 'SEGMENT');
  const orderNodes = nodes.filter((n) => n.type === 'ORDER');
  const productNodes = nodes.filter((n) => n.type === 'PRODUCT');

  const positions = {};
  if (customerNode) {
    positions[customerNode.id] = { x: cx, y: customerY };
  }

  const H_GAP = 258;

  // Tier 1: Segments Crown above Customer Hub
  const segCount = segmentNodes.length;
  if (segCount > 0) {
    const totalW = (segCount - 1) * H_GAP;
    segmentNodes.forEach((seg, idx) => {
      const archCurve = segCount > 2 ? Math.abs(idx - (segCount - 1) / 2) * 14 : 0;
      positions[seg.id] = {
        x: Math.round(cx - totalW / 2 + idx * H_GAP),
        y: Math.round(78 + archCurve),
      };
    });
  }

  // Tier 3: Orders Row/Arc below Customer Hub
  const ordCount = orderNodes.length;
  if (ordCount > 0) {
    const totalW = (ordCount - 1) * H_GAP;
    orderNodes.forEach((ord, idx) => {
      const archCurve = ordCount > 2 ? Math.abs(idx - (ordCount - 1) / 2) * 12 : 0;
      positions[ord.id] = {
        x: Math.round(cx - totalW / 2 + idx * H_GAP),
        y: Math.round(418 - archCurve),
      };
    });
  }

  // Tier 4: Consolidated Products aligned with average X of their connected Orders
  const prodCount = productNodes.length;
  if (prodCount > 0) {
    const sortedProducts = productNodes
      .map((prod, idx) => {
        const parentOrders = edges
          .filter((e) => e.type === 'CONTAINS' && e.target === prod.id)
          .map((e) => positions[e.source]?.x)
          .filter((x) => typeof x === 'number');
        const avgX =
          parentOrders.length > 0
            ? parentOrders.reduce((a, b) => a + b, 0) / parentOrders.length
            : cx + (idx - (prodCount - 1) / 2) * H_GAP;
        return { prod, avgX };
      })
      .sort((a, b) => a.avgX - b.avgX);

    const totalW = (prodCount - 1) * H_GAP;
    sortedProducts.forEach((item, idx) => {
      const archCurve = prodCount > 2 ? Math.abs(idx - (prodCount - 1) / 2) * 10 : 0;
      positions[item.prod.id] = {
        x: Math.round(cx - totalW / 2 + idx * H_GAP),
        y: Math.round(576 - archCurve),
      };
    });
  }

  // Collision-avoidance safety pass
  const MIN_DX = 254;
  const MIN_DY = 114;
  const ids = Object.keys(positions);
  for (let iter = 0; iter < 16; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const pA = positions[idA];
        const pB = positions[idB];
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        if (Math.abs(dx) < MIN_DX && Math.abs(dy) < MIN_DY) {
          const overlapX = MIN_DX - Math.abs(dx);
          const sign = dx >= 0 ? 1 : -1;
          const shift = Math.ceil(overlapX / 2) + 6;
          if (idA !== customerNode?.id) pA.x -= sign * shift;
          if (idB !== customerNode?.id) pB.x += sign * shift;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Compute comfortable auto-fit zoom & pan for actual container dimensions
  let minX = cx - 150;
  let maxX = cx + 150;
  let minY = customerY - 70;
  let maxY = customerY + 70;
  Object.entries(positions).forEach(([id, pos]) => {
    const halfW = id === customerNode?.id ? CUSTOMER_CARD_W / 2 + 16 : CARD_W / 2 + 14;
    const halfH = id === customerNode?.id ? CUSTOMER_CARD_H / 2 + 16 : CARD_H / 2 + 14;
    minX = Math.min(minX, pos.x - halfW);
    maxX = Math.max(maxX, pos.x + halfW);
    minY = Math.min(minY, pos.y - halfH);
    maxY = Math.max(maxY, pos.y + halfH);
  });

  const contentW = Math.max(320, maxX - minX);
  const contentH = Math.max(260, maxY - minY);
  const usableW = Math.max(420, containerWidth - 36);
  const usableH = Math.max(420, containerHeight - 88);

  // Keep zoom generous (minimum 0.84x) so node typography stays big, bold, and effortless to read
  const rawFit = Math.min(usableW / contentW, usableH / contentH);
  const fitZoom = Math.max(0.84, Math.min(1.08, Number(rawFit.toFixed(2))));

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const fitPan = {
    x: Math.round(containerWidth / 2 - midX * fitZoom),
    y: Math.round((containerHeight - 24) / 2 - midY * fitZoom + 12),
  };

  return { positions, fitZoom, fitPan, center: { x: cx, y: customerY } };
}

export function CustomerGraphPage() {
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);

  const [activeTab, setActiveTab] = useState('graph');
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);

  // 1. Workspace Overview KPIs
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // 2. Left Panel: Customer Directory State
  const [directoryPage, setDirectoryPage] = useState(null);
  const [dirLoading, setDirLoading] = useState(true);
  const [dirError, setDirError] = useState(null);
  const [dirSearch, setDirSearch] = useState('');
  const [dirSegment, setDirSegment] = useState('ALL');
  const [dirSortBy, setDirSortBy] = useState('totalSpend');
  const [dirSortDir, setDirSortDir] = useState('desc');
  const [dirPageIdx, setDirPageIdx] = useState(0);

  // Selected Customer State — NULL on initial load
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // 3. Center Panel: Individual Customer Graph State
  const [customerGraph, setCustomerGraph] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [orbitCenter, setOrbitCenter] = useState({ x: 410, y: 248 });
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState(null);
  const [hoveredGraphNodeId, setHoveredGraphNodeId] = useState(null);
  const [graphLayerFilter, setGraphLayerFilter] = useState('ALL');
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasDragging, setCanvasDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  // 4. Right Panel & Expanded Modal: Synchronized Customer 360 Details
  const [customer360, setCustomer360] = useState(null);
  const [customer360Loading, setCustomer360Loading] = useState(false);
  const [customer360Error, setCustomer360Error] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('summary');
  const [customer360ModalOpen, setCustomer360ModalOpen] = useState(false);
  const [customer360ModalTab, setCustomer360ModalTab] = useState('overview');

  // Mobile drawer toggles
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  // 5. Product Intelligence Tab State
  const [productsPage, setProductsPage] = useState(null);
  const [coPurchases, setCoPurchases] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [productSortBy, setProductSortBy] = useState('totalRevenue');
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedSkuDetail, setSelectedSkuDetail] = useState(null);
  const [skuDetailLoading, setSkuDetailLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await fetchIntelligenceOverview();
      setOverview(data);
    } catch (err) {
      setOverviewError(err?.message || 'Failed to load Customer Intelligence overview.');
    } finally {
      setOverviewLoading(false);
    }
  }, [activeWorkspace?.merchantId]);

  const loadDirectory = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setDirLoading(true);
    setDirError(null);
    try {
      const data = await fetchIntelligentCustomers({
        search: dirSearch.trim() || undefined,
        segment: dirSegment !== 'ALL' ? dirSegment : undefined,
        sortBy: dirSortBy,
        sortDir: dirSortDir,
        page: dirPageIdx,
        size: 10,
      });
      setDirectoryPage(data);
    } catch (err) {
      setDirError(err?.message || 'Failed to load Customer Directory.');
    } finally {
      setDirLoading(false);
    }
  }, [
    activeWorkspace?.merchantId,
    dirSearch,
    dirSegment,
    dirSortBy,
    dirSortDir,
    dirPageIdx,
  ]);

  const applyAutoLayout = useCallback((validatedGraph) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cw = rect?.width || 660;
    const ch = rect?.height || 610;
    const layout = computeIndividualCustomerLayout(
      validatedGraph.nodes,
      validatedGraph.edges,
      cw,
      ch
    );
    setNodePositions(layout.positions);
    setOrbitCenter(layout.center);
    setZoom(layout.fitZoom);
    setPan(layout.fitPan);
  }, []);

  const loadSelectedCustomerIntelligence = useCallback(
    async (custId) => {
      if (!custId) {
        setCustomerGraph(null);
        setCustomer360(null);
        setNodePositions({});
        setSelectedGraphNodeId(null);
        return;
      }

      setCustomerGraph(null);
      setNodePositions({});
      setSelectedGraphNodeId(null);
      setHoveredGraphNodeId(null);
      setGraphLayerFilter('ALL');
      setGraphLoading(true);
      setGraphError(null);
      setCustomer360Loading(true);
      setCustomer360Error(null);

      try {
        const [rawGraph, c360Data] = await Promise.all([
          fetchCustomerGraph(custId),
          fetchCustomer360(custId),
        ]);

        const validated = validateIndividualCustomerGraph(rawGraph, custId);
        if (!validated.valid) {
          setGraphError(validated.error || 'Received invalid customer graph data.');
          setCustomerGraph(null);
        } else {
          setCustomerGraph(validated);
          setSelectedGraphNodeId(`customer:${custId}`);
          // Compute layout using measured viewport width/height
          requestAnimationFrame(() => applyAutoLayout(validated));
        }

        setCustomer360(c360Data);
      } catch (err) {
        const msg = err?.message || 'Failed to load selected customer intelligence graph.';
        setGraphError(msg);
        setCustomer360Error(msg);
      } finally {
        setGraphLoading(false);
        setCustomer360Loading(false);
      }
    },
    [applyAutoLayout]
  );

  const loadProductInsights = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const [prodData, coPurchaseData] = await Promise.all([
        fetchProductIntelligence({
          search: productSearch.trim() || undefined,
          sortBy: productSortBy,
          page: 0,
          size: 30,
        }),
        fetchProductCoPurchases({ minCoPurchases: 1, limit: 20 }),
      ]);
      setProductsPage(prodData);
      setCoPurchases(coPurchaseData || []);
      const items = prodData?.items || [];
      if (items.length > 0) {
        setSelectedSku((prev) =>
          prev && items.some((p) => p.sku === prev) ? prev : items[0].sku
        );
      } else {
        setSelectedSku(null);
        setSelectedSkuDetail(null);
      }
    } catch (err) {
      setProductsError(err?.message || 'Failed to load Product Intelligence.');
    } finally {
      setProductsLoading(false);
    }
  }, [activeWorkspace?.merchantId, productSearch, productSortBy]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadSelectedCustomerIntelligence(selectedCustomerId);
    }
  }, [selectedCustomerId, loadSelectedCustomerIntelligence]);

  // Re-center graph smoothly when user toggles Expand / Collapse Graph view
  useEffect(() => {
    if (customerGraph && customerGraph.orderCount > 0) {
      const timer = setTimeout(() => applyAutoLayout(customerGraph), 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isGraphExpanded, customerGraph, applyAutoLayout]);

  useEffect(() => {
    if (activeTab === 'products') {
      loadProductInsights();
    }
  }, [activeTab, loadProductInsights]);

  useEffect(() => {
    if (!selectedSku || activeTab !== 'products') return;
    let active = true;
    setSkuDetailLoading(true);
    fetchProductSkuDetail(selectedSku)
      .then((detail) => {
        if (active) setSelectedSkuDetail(detail);
      })
      .catch(() => {
        if (active) setSelectedSkuDetail(null);
      })
      .finally(() => {
        if (active) setSkuDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSku, activeTab]);

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomerId(customerId);
    setMobileDirectoryOpen(false);
    if (activeTab !== 'graph') {
      setActiveTab('graph');
    }
  };

  const resetGraphLayout = () => {
    if (!customerGraph) return;
    applyAutoLayout(customerGraph);
  };

  const displayedGraph = useMemo(() => {
    if (!customerGraph) return { nodes: [], edges: [] };
    if (graphLayerFilter === 'ALL') return customerGraph;

    const allowedTypes =
      graphLayerFilter === 'COMMERCE'
        ? new Set(['CUSTOMER', 'ORDER', 'PRODUCT'])
        : new Set(['CUSTOMER', 'SEGMENT']);

    const nodes = customerGraph.nodes.filter((n) => allowedTypes.has(n.type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = customerGraph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return { nodes, edges };
  }, [customerGraph, graphLayerFilter]);

  const activeFocusNodeId = hoveredGraphNodeId || selectedGraphNodeId;

  const selectedGraphNode = useMemo(
    () => (customerGraph?.nodes || []).find((n) => n.id === selectedGraphNodeId) || null,
    [customerGraph, selectedGraphNodeId]
  );

  const connectedNodeIds = useMemo(() => {
    const set = new Set();
    if (!activeFocusNodeId || !displayedGraph.edges) return set;
    set.add(activeFocusNodeId);
    displayedGraph.edges.forEach((e) => {
      if (e.source === activeFocusNodeId) set.add(e.target);
      if (e.target === activeFocusNodeId) set.add(e.source);
    });
    return set;
  }, [displayedGraph.edges, activeFocusNodeId]);

  const handleViewportMouseMove = (e) => {
    if (draggingNodeId && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const stageX = (e.clientX - rect.left - pan.x) / zoom - nodeDragOffset.x;
      const stageY = (e.clientY - rect.top - pan.y) / zoom - nodeDragOffset.y;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.round(stageX),
          y: Math.round(stageY),
        },
      }));
      return;
    }
    if (canvasDragging) {
      setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
    }
  };

  const refreshAll = () => {
    loadOverview();
    loadDirectory();
    if (selectedCustomerId) {
      loadSelectedCustomerIntelligence(selectedCustomerId);
    }
    if (activeTab === 'products') {
      loadProductInsights();
    }
  };

  // LEFT PANEL: Customer Directory Content
  const renderDirectoryPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-extrabold text-[#465478] truncate">
            Customer Directory ({directoryPage?.totalElements ?? 0})
          </h3>
          <p className="text-[11px] text-[#7C86A2] truncate">
            Click a customer to render their constellation
          </p>
        </div>
        {(dirSearch || dirSegment !== 'ALL' || dirSortBy !== 'totalSpend') && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setDirSearch('');
              setDirSegment('ALL');
              setDirSortBy('totalSpend');
              setDirSortDir('desc');
              setDirPageIdx(0);
            }}
          >
            Reset
          </Button>
        )}
      </div>

      <div className="relative shrink-0">
        <Search className="w-4 h-4 text-[#7584D6] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={dirSearch}
          onChange={(e) => {
            setDirSearch(e.target.value);
            setDirPageIdx(0);
          }}
          placeholder="Search name or phone…"
          className={`${inputClass} pl-9 text-[12px] h-9`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 shrink-0">
        <select
          value={dirSegment}
          onChange={(e) => {
            setDirSegment(e.target.value);
            setDirPageIdx(0);
          }}
          className={`${selectClass} text-[11.5px] h-9 px-2.5 truncate`}
        >
          <option value="ALL">All Segments</option>
          {Object.entries(SEGMENT_META).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </select>

        <select
          value={`${dirSortBy}:${dirSortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split(':');
            setDirSortBy(field);
            setDirSortDir(dir);
            setDirPageIdx(0);
          }}
          className={`${selectClass} text-[11.5px] h-9 px-2.5 truncate`}
        >
          <option value="totalSpend:desc">Highest Spend</option>
          <option value="totalSpend:asc">Lowest Spend</option>
          <option value="totalOrders:desc">Most Orders</option>
          <option value="totalOrders:asc">Fewest Orders</option>
          <option value="lastOrderAt:desc">Recent Orders</option>
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
        {dirError ? (
          <div className="rounded-[16px] bg-[#FFF1EC] border border-[#FBCFC0] p-4 text-center space-y-2">
            <div className="text-[12px] text-[#CC3F14] font-bold break-words">{dirError}</div>
            <Button variant="outline" size="xs" onClick={loadDirectory}>
              Retry
            </Button>
          </div>
        ) : dirLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((skeleton) => (
              <div
                key={skeleton}
                className="h-[122px] rounded-[18px] bg-[#F4F6FC] border border-[#E3E6FA] animate-pulse"
              />
            ))}
          </div>
        ) : !directoryPage?.items || directoryPage.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            description="Clear your search or segment filter, or create an order in Order Management."
          />
        ) : (
          directoryPage.items.map((cust) => {
            const isSelected = cust.customerId === selectedCustomerId;
            return (
              <button
                key={cust.customerId}
                type="button"
                onClick={() => handleSelectCustomer(cust.customerId)}
                className={`w-full h-[122px] text-left p-3.5 rounded-[18px] border transition-all flex flex-col justify-between overflow-hidden relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#EEF0FA] via-[#F4F6FE] to-[#ECFAFF] border-[#7584D6] shadow-[0_10px_24px_-10px_rgba(84,92,158,0.28)]'
                    : 'bg-white border-[#E3E6FA] hover:border-[#C7CEF2] hover:bg-[#FAFBFD]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={cust.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-display text-[13.5px] font-extrabold text-[#465478] truncate"
                      title={cust.fullName}
                    >
                      {cust.fullName}
                    </div>
                    <div className="font-mono text-[10.5px] text-[#7584D6] truncate">
                      +91 {cust.phoneNumber}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                  <SegmentPill segmentId={cust.primarySegment} />
                  {cust.segmentIds.length > 1 && (
                    <span className="text-[10px] font-display font-bold text-[#7C86A2] shrink-0">
                      +{cust.segmentIds.length - 1}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-[#E6E9F8]/90 flex items-center justify-between gap-2 text-[11px] font-display font-bold min-w-0">
                  <span className="text-[#545C9E] shrink-0">
                    {cust.purchaseMetrics.totalOrders} Order(s) ·{' '}
                    <span className="font-normal text-[#8891AA]">
                      {cust.purchaseMetrics.lastOrderAt
                        ? new Date(cust.purchaseMetrics.lastOrderAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </span>
                  </span>
                  <span className="text-[#17825B] num truncate">
                    {formatINR(cust.purchaseMetrics.totalSpend, true)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {directoryPage && directoryPage.totalPages > 1 && (
        <div className="pt-2.5 border-t border-[#EEF0FA] flex items-center justify-between text-[11.5px] shrink-0">
          <Button
            variant="outline"
            size="xs"
            disabled={dirPageIdx <= 0}
            onClick={() => setDirPageIdx((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </Button>
          <span className="font-display font-bold text-[#5C6888]">
            Page {directoryPage.page + 1} / {directoryPage.totalPages}
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={!directoryPage.hasNext}
            onClick={() => setDirPageIdx((p) => p + 1)}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  // RIGHT PANEL: Synchronized Customer Intelligence Details Content
  const renderRightDetailsPanelContent = () => {
    if (!selectedCustomerId) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
          <IconTile icon={Sparkles} tone="peri" size="lg" />
          <div className="font-display text-[15.5px] font-extrabold text-[#465478]">
            Customer 360 Inspector
          </div>
          <p className="text-[12px] text-[#7C86A2] leading-relaxed">
            Select a customer on the left to inspect their lifetime spend, COD/Prepaid split, segment evidence, and individual node telemetry.
          </p>
        </div>
      );
    }

    if (customer360Loading) {
      return (
        <div className="space-y-3 py-2">
          <div className="h-28 rounded-[18px] bg-[#F4F6FC] animate-pulse" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-[80px] rounded-[14px] bg-[#F4F6FC] animate-pulse" />
            <div className="h-[80px] rounded-[14px] bg-[#F4F6FC] animate-pulse" />
            <div className="h-[80px] rounded-[14px] bg-[#F4F6FC] animate-pulse" />
            <div className="h-[80px] rounded-[14px] bg-[#F4F6FC] animate-pulse" />
          </div>
          <div className="h-56 rounded-[16px] bg-[#F4F6FC] animate-pulse" />
        </div>
      );
    }

    if (customer360Error || !customer360) {
      return (
        <div className="rounded-[16px] bg-[#FFF1EC] border border-[#FBCFC0] p-4 text-center space-y-2">
          <div className="text-[12.5px] font-bold text-[#CC3F14] break-words">
            {customer360Error || 'Unable to load customer details.'}
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => loadSelectedCustomerIntelligence(selectedCustomerId)}
          >
            Retry
          </Button>
        </div>
      );
    }

    const { profile, productPreferences } = customer360;

    return (
      <div className="flex flex-col h-full min-h-0 gap-3.5">
        <div className="rounded-[18px] bg-gradient-to-br from-[#F4F6FE] via-[#FFFFFF] to-[#EEFBFF] border border-[#DFE3F7] p-3.5 space-y-2.5 shrink-0 overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={profile.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <h4
                className="font-display text-[15.5px] font-extrabold text-[#465478] truncate"
                title={profile.fullName}
              >
                {profile.fullName}
              </h4>
              <div className="font-mono text-[11px] text-[#7584D6] truncate">
                +91 {profile.phoneNumber}
              </div>
              {profile.email && (
                <div className="text-[10.5px] text-[#8891AA] truncate" title={profile.email}>
                  {profile.email}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 max-h-[50px] overflow-hidden">
            {profile.segmentIds.map((segId) => (
              <SegmentPill key={segId} segmentId={segId} />
            ))}
          </div>

          <Button
            variant="primary"
            size="xs"
            className="w-full justify-center"
            onClick={() => {
              setCustomer360ModalTab('overview');
              setCustomer360ModalOpen(true);
            }}
          >
            Open Customer 360 <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 shrink-0">
          <div className="h-[80px] rounded-[14px] bg-[#F9FAFB] border border-[#E3E6FA] p-3 flex flex-col justify-between overflow-hidden">
            <div className="text-[9.5px] font-display font-bold uppercase tracking-wider text-[#8891AA] truncate">
              Total Orders
            </div>
            <div className="font-display text-[17px] font-extrabold text-[#465478] num truncate">
              {profile.purchaseMetrics.totalOrders}
            </div>
            <div className="text-[10px] text-[#7C86A2] truncate">
              {profile.purchaseMetrics.repeatPurchaseCount} repeat order(s)
            </div>
          </div>

          <div className="h-[80px] rounded-[14px] bg-[#F9FAFB] border border-[#E3E6FA] p-3 flex flex-col justify-between overflow-hidden">
            <div className="text-[9.5px] font-display font-bold uppercase tracking-wider text-[#8891AA] truncate">
              Total Spending
            </div>
            <div className="font-display text-[17px] font-extrabold text-[#17825B] num truncate">
              {formatINR(profile.purchaseMetrics.totalSpend, true)}
            </div>
            <div className="text-[10px] text-[#7C86A2] truncate">Qualifying CLV</div>
          </div>

          <div className="h-[80px] rounded-[14px] bg-[#F9FAFB] border border-[#E3E6FA] p-3 flex flex-col justify-between overflow-hidden">
            <div className="text-[9.5px] font-display font-bold uppercase tracking-wider text-[#8891AA] truncate">
              Avg Order Value
            </div>
            <div className="font-display text-[16px] font-extrabold text-[#465478] num truncate">
              {formatINR(profile.purchaseMetrics.averageOrderValue, true)}
            </div>
            <div className="text-[10px] text-[#7C86A2] truncate">
              Max: {formatINR(profile.purchaseMetrics.highestOrderValue, true)}
            </div>
          </div>

          <div className="h-[80px] rounded-[14px] bg-[#F9FAFB] border border-[#E3E6FA] p-3 flex flex-col justify-between overflow-hidden">
            <div className="text-[9.5px] font-display font-bold uppercase tracking-wider text-[#8891AA] truncate">
              Last Order Date
            </div>
            <div className="font-display text-[11.5px] font-extrabold text-[#465478] truncate">
              {profile.purchaseMetrics.lastOrderAt
                ? new Date(profile.purchaseMetrics.lastOrderAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </div>
            <div className="text-[10px] text-[#7C86A2] truncate">
              {profile.purchaseMetrics.daysSinceLastQualifyingOrder ?? 0}d since order
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 bg-[#F1F2F9] p-1 rounded-[12px] border border-[#E3E6FA] shrink-0">
          {[
            { id: 'summary', label: 'Behavior' },
            { id: 'segments', label: 'Segments' },
            { id: 'products', label: 'Products' },
            { id: 'node', label: 'Node Info' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRightPanelTab(t.id)}
              className={`py-1.5 px-1 rounded-[9px] font-display text-[11px] font-bold truncate transition-all ${
                rightPanelTab === t.id
                  ? 'bg-white text-[#465478] shadow-xs border border-[#DFE1F5]'
                  : 'text-[#6E7896] hover:text-[#465478]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {rightPanelTab === 'summary' && (
            <>
              <div className="rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-3.5 space-y-2.5 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-display text-[12px] font-extrabold text-[#465478] flex items-center gap-1.5 truncate">
                    <CreditCard className="w-3.5 h-3.5 text-[#7584D6] shrink-0" /> Payment Mix
                  </span>
                  <span className="text-[10.5px] font-display font-bold text-[#545C9E] shrink-0">
                    {profile.paymentBehaviour.codPercentage}% COD
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E3E6FA] overflow-hidden flex">
                  <div
                    style={{ width: `${profile.paymentBehaviour.codPercentage}%` }}
                    className="bg-[#FA845D] h-full transition-all duration-300"
                  />
                  <div
                    style={{ width: `${profile.paymentBehaviour.prepaidPercentage}%` }}
                    className="bg-[#2EB37E] h-full transition-all duration-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#5C6888]">
                  <div className="rounded-[10px] bg-white border border-[#E3E6FA] px-2.5 py-1.5 truncate">
                    COD: <strong className="text-[#465478]">{profile.paymentBehaviour.codOrders}</strong>
                  </div>
                  <div className="rounded-[10px] bg-white border border-[#E3E6FA] px-2.5 py-1.5 truncate">
                    Prepaid:{' '}
                    <strong className="text-[#465478]">{profile.paymentBehaviour.prepaidOrders}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-3.5 space-y-2.5 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-display text-[12px] font-extrabold text-[#465478] flex items-center gap-1.5 truncate">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#2EB37E] shrink-0" /> Order Outcomes
                  </span>
                  <span className="text-[10.5px] font-display font-bold text-[#CC3F14] shrink-0">
                    {profile.orderOutcomes.cancellationPercentage}% Cancelled
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="h-[54px] rounded-[10px] bg-white border border-[#E3E6FA] p-1.5 flex flex-col justify-center overflow-hidden">
                    <div className="text-[9px] font-bold uppercase text-[#8891AA] truncate">
                      Delivered
                    </div>
                    <div className="font-display text-[14.5px] font-extrabold text-[#17825B] num">
                      {profile.orderOutcomes.deliveredOrders}
                    </div>
                  </div>
                  <div className="h-[54px] rounded-[10px] bg-white border border-[#E3E6FA] p-1.5 flex flex-col justify-center overflow-hidden">
                    <div className="text-[9px] font-bold uppercase text-[#8891AA] truncate">
                      Pending
                    </div>
                    <div className="font-display text-[14.5px] font-extrabold text-[#545C9E] num">
                      {profile.orderOutcomes.pendingOrders}
                    </div>
                  </div>
                  <div className="h-[54px] rounded-[10px] bg-white border border-[#E3E6FA] p-1.5 flex flex-col justify-center overflow-hidden">
                    <div className="text-[9px] font-bold uppercase text-[#8891AA] truncate">
                      Cancelled
                    </div>
                    <div className="font-display text-[14.5px] font-extrabold text-[#CC3F14] num">
                      {profile.orderOutcomes.cancelledOrders}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-[#7C86A2] flex items-start gap-1.5 leading-snug">
                  <Info className="w-3.5 h-3.5 text-[#7584D6] shrink-0 mt-0.5" />
                  <span className="break-words">{profile.orderOutcomes.dataQualityNote}</span>
                </div>
              </div>
            </>
          )}

          {rightPanelTab === 'segments' &&
            profile.segments.map((seg) => (
              <div
                key={seg.segmentId}
                className="rounded-[14px] border border-[#E3E6FA] bg-[#F9FAFB] p-3 space-y-1.5 overflow-hidden"
              >
                <SegmentPill segmentId={seg.segmentId} />
                <div className="font-display text-[12px] font-bold text-[#465478] break-words">
                  {seg.reason}
                </div>
                <div className="font-mono text-[10px] text-[#7584D6] bg-white border border-[#E3E6FA] rounded-lg px-2 py-1 break-words">
                  Rule: {seg.thresholdApplied}
                </div>
              </div>
            ))}

          {rightPanelTab === 'products' &&
            (productPreferences.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-[#7C86A2]">
                No non-cancelled products purchased yet.
              </div>
            ) : (
              productPreferences.map((prod) => (
                <div
                  key={prod.sku}
                  onClick={() => setSelectedGraphNodeId(`product:${prod.sku}`)}
                  className="cursor-pointer rounded-[14px] border border-[#E3E6FA] bg-[#F9FAFB] hover:bg-[#EEF0FA] p-3 flex items-center justify-between gap-2 transition-all overflow-hidden"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-display text-[12.5px] font-extrabold text-[#465478] truncate"
                      title={prod.productName}
                    >
                      {prod.productName}
                    </div>
                    <div className="text-[10.5px] text-[#6E7896] truncate">
                      {prod.sku} · <strong>{prod.totalUnitsPurchased}</strong> unit(s)
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-[12.5px] font-extrabold text-[#17825B] num">
                      {formatINR(prod.totalSpend, true)}
                    </div>
                    {prod.repeatPurchased && (
                      <span className="text-[9.5px] font-display font-bold text-[#0E7490] block">
                        Repeated SKU
                      </span>
                    )}
                  </div>
                </div>
              ))
            ))}

          {rightPanelTab === 'node' &&
            (!selectedGraphNode ? (
              <div className="py-6 text-center text-[12px] text-[#7C86A2]">
                Click any node card in the graph to inspect its telemetry.
              </div>
            ) : (
              <div className="rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-3.5 space-y-2.5 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold bg-[#EEF0FA] text-[#545C9E] shrink-0">
                    {selectedGraphNode.type} NODE
                  </span>
                  <span className="font-mono text-[10px] text-[#7C86A2] truncate">
                    {selectedGraphNode.sublabel}
                  </span>
                </div>
                <div
                  className="font-display text-[14.5px] font-extrabold text-[#465478] truncate"
                  title={selectedGraphNode.label}
                >
                  {selectedGraphNode.label}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {Object.entries(selectedGraphNode.metrics || {})
                    .filter(([k]) => !['customerId', 'orderId', 'segments'].includes(k))
                    .map(([k, v]) => {
                      const formattedVal =
                        k.toLowerCase().includes('spend') ||
                        k.toLowerCase().includes('amount') ||
                        k.toLowerCase().includes('value')
                          ? formatINR(v, true)
                          : k.toLowerCase().includes('at') && v
                            ? formatDateTime(v)
                            : String(v ?? '—');
                      return (
                        <div
                          key={k}
                          className="h-[58px] rounded-[10px] bg-white border border-[#E3E6FA] p-2 flex flex-col justify-between overflow-hidden"
                        >
                          <div className="text-[9px] font-bold uppercase text-[#8891AA] truncate">
                            {k.replace(/([A-Z])/g, ' $1')}
                          </div>
                          <div
                            className="font-display text-[11.5px] font-extrabold text-[#465478] truncate"
                            title={formattedVal}
                          >
                            {formattedVal}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  // Render an individual crisp HTML/Tailwind Graph Node Card on the 1:1 stage
  const renderGraphNodeCard = (node) => {
    const pos = nodePositions[node.id] || { x: STAGE_W / 2, y: 248 };
    const isCustomer = node.type === 'CUSTOMER';
    const isSelected = node.id === selectedGraphNodeId;
    const isHovered = node.id === hoveredGraphNodeId;
    const isConnected = !activeFocusNodeId || connectedNodeIds.has(node.id);

    const cardW = isCustomer ? CUSTOMER_CARD_W : CARD_W;
    const cardH = isCustomer ? CUSTOMER_CARD_H : CARD_H;

    const handleCardMouseDown = (e) => {
      e.stopPropagation();
      setSelectedGraphNodeId(node.id);
      setRightPanelTab('node');
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const pointerStageX = (e.clientX - rect.left - pan.x) / zoom;
        const pointerStageY = (e.clientY - rect.top - pan.y) / zoom;
        setNodeDragOffset({
          x: pointerStageX - pos.x,
          y: pointerStageY - pos.y,
        });
      }
      setDraggingNodeId(node.id);
    };

    if (isCustomer) {
      return (
        <div
          key={node.id}
          data-graph-node="true"
          onMouseEnter={() => setHoveredGraphNodeId(node.id)}
          onMouseLeave={() => setHoveredGraphNodeId(null)}
          onMouseDown={handleCardMouseDown}
          style={{
            left: pos.x - cardW / 2,
            top: pos.y - cardH / 2,
            width: cardW,
            height: cardH,
            opacity: isConnected ? 1 : 0.35,
          }}
          className={`absolute rounded-[22px] p-3.5 bg-gradient-to-br from-[#424B8C] via-[#5561B0] to-[#6A78E2] text-white border-2 transition-shadow duration-150 cursor-grab active:cursor-grabbing flex items-center gap-3 overflow-hidden ${
            isSelected
              ? 'border-[#34D399] shadow-[0_0_0_4px_rgba(52,211,153,0.25),0_18px_36px_-10px_rgba(66,75,140,0.55)]'
              : isHovered
                ? 'border-[#9BEBFF] shadow-[0_0_0_4px_rgba(155,235,255,0.28),0_18px_36px_-10px_rgba(66,75,140,0.5)]'
                : 'border-[#95A0F2] shadow-[0_16px_34px_-10px_rgba(66,75,140,0.45)]'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/18 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-xs">
            <Users className="w-6 h-6 text-[#9BEBFF]" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10.5px] font-display font-extrabold uppercase tracking-[0.12em] text-[#9BEBFF] truncate">
                Customer Hub
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/16 text-[10px] font-mono font-bold text-white shrink-0">
                {node.metrics?.totalOrders ?? 0} Ord
              </span>
            </div>
            <div
              className="font-display text-[16.5px] font-extrabold text-white leading-tight truncate"
              title={node.label}
            >
              {node.label}
            </div>
            <div className="font-mono text-[12px] font-semibold text-[#E2E7FF] truncate">
              {node.sublabel} · {formatINR(node.metrics?.totalSpend ?? 0, true)}
            </div>
          </div>
        </div>
      );
    }

    const typeStyles = {
      SEGMENT: {
        icon: Award,
        iconBg: 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5]',
        topBar: 'bg-gradient-to-r from-[#6366F1] to-[#A5B4FC]',
        eyebrow: 'text-[#4F46E5]',
        eyebrowText: 'Behavioral Segment',
        border: 'border-[#C7D2FE]',
        hoverRing: 'ring-[#6366F1]/25',
      },
      ORDER: {
        icon: ShoppingBag,
        iconBg: 'bg-[#E0F2FE] border-[#BAE6FD] text-[#0284C7]',
        topBar: 'bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]',
        eyebrow: 'text-[#0284C7]',
        eyebrowText: `Order · ${node.metrics?.orderStatus || ''}`,
        border: 'border-[#93C5FD]',
        hoverRing: 'ring-[#0EA5E9]/25',
      },
      PRODUCT: {
        icon: Package,
        iconBg: 'bg-[#D1FAE5] border-[#A7F3D0] text-[#059669]',
        topBar: 'bg-gradient-to-r from-[#10B981] to-[#34D399]',
        eyebrow: 'text-[#059669]',
        eyebrowText: `Product · ${node.metrics?.unitsPurchased ?? 1} Unit(s)`,
        border: 'border-[#6EE7B7]',
        hoverRing: 'ring-[#10B981]/25',
      },
    };

    const st = typeStyles[node.type] || typeStyles.ORDER;
    const NodeIcon = st.icon;

    return (
      <div
        key={node.id}
        data-graph-node="true"
        onMouseEnter={() => setHoveredGraphNodeId(node.id)}
        onMouseLeave={() => setHoveredGraphNodeId(null)}
        onMouseDown={handleCardMouseDown}
        style={{
          left: pos.x - cardW / 2,
          top: pos.y - cardH / 2,
          width: cardW,
          height: cardH,
          opacity: isConnected ? 1 : 0.32,
        }}
        className={`absolute rounded-[20px] bg-white/98 backdrop-blur-md border-2 p-3 transition-all duration-150 cursor-grab active:cursor-grabbing flex items-center gap-3 overflow-hidden ${
          isSelected
            ? 'border-[#10B981] ring-4 ring-[#10B981]/20 shadow-[0_16px_32px_-10px_rgba(16,185,129,0.28)]'
            : isHovered
              ? `${st.border} ring-4 ${st.hoverRing} shadow-[0_16px_32px_-10px_rgba(70,84,120,0.2)]`
              : `${st.border} shadow-[0_10px_24px_-10px_rgba(58,68,133,0.14)]`
        }`}
      >
        {/* Top Accent Ribbon */}
        <div className={`absolute top-0 left-5 right-5 h-[3.5px] rounded-b-full ${st.topBar}`} />

        <div
          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${st.iconBg}`}
        >
          <NodeIcon className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
          <div
            className={`text-[10.5px] font-display font-extrabold uppercase tracking-[0.07em] truncate ${st.eyebrow}`}
            title={st.eyebrowText}
          >
            {st.eyebrowText}
          </div>
          <div
            className="font-display text-[15px] font-extrabold text-[#2D3858] leading-snug truncate"
            title={node.label}
          >
            {node.label}
          </div>
          <div
            className="font-mono text-[11.5px] font-semibold text-[#5B6787] truncate"
            title={node.sublabel}
          >
            {node.sublabel}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer-First Relationship Exploration · PostgreSQL Intelligence"
        title="Customer"
        accentWord="Intelligence Graph"
        subtitle="Select an individual customer from the directory to explore their orders, consolidated products, and behavioral segment constellation."
        icon={GitFork}
        iconTone="peri"
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ECFEF6] border border-[#C3F3DE] text-[11px] font-display font-bold text-[#17825B]">
            <Lock className="w-3 h-3" /> Merchant-Scoped Isolation
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              items={[
                { id: 'graph', label: 'Constellation Graph' },
                { id: 'segments', label: 'Segment Overview' },
                { id: 'products', label: 'Product Intelligence' },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  overviewLoading || dirLoading || graphLoading ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {overviewError && (
        <div className="rounded-[18px] bg-[#FFF1EC] border border-[#FBCFC0] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-[13px] text-[#CC3F14] font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{overviewError}</span>
          </div>
          <Button variant="outline" size="xs" onClick={loadOverview}>
            Retry
          </Button>
        </div>
      )}

      {/* SYMMETRIC 3x3 SPOTLIGHT KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[
          {
            label: 'Total Customers',
            value: overview ? overview.totalCustomers : '—',
            sub: `${overview?.totalOrders ?? 0} total orders in workspace`,
            icon: Users,
            tone: 'peri',
            valueColor: 'text-[#465478]',
          },
          {
            label: 'New Customers',
            value: overview ? overview.newCustomers : '—',
            sub: 'First-time buyers (1 recorded order)',
            icon: UserPlus,
            tone: 'violet',
            valueColor: 'text-[#545C9E]',
          },
          {
            label: 'Repeat Customers',
            value: overview ? overview.repeatCustomers : '—',
            sub: 'Returning buyers (2+ recorded orders)',
            icon: Repeat,
            tone: 'cyan',
            valueColor: 'text-[#0E7490]',
          },
          {
            label: 'High-Value Customers',
            value: overview ? overview.highValueCustomers : '—',
            sub: 'Top merchant spend percentile (P75)',
            icon: Award,
            tone: 'indigo',
            valueColor: 'text-[#4B5399]',
          },
          {
            label: 'Inactive Customers',
            value: overview ? overview.inactiveCustomers : '—',
            sub: '>30 days since last qualifying order',
            icon: Clock,
            tone: 'amber',
            valueColor: 'text-[#854D0E]',
          },
          {
            label: 'Average Customer LTV',
            value: overview ? formatINR(overview.averageCustomerLifetimeValue, true) : '—',
            sub: 'Mean qualifying spend per customer',
            icon: Wallet,
            tone: 'emerald',
            valueColor: 'text-[#17825B]',
          },
          {
            label: 'Average Order Value',
            value: overview ? formatINR(overview.averageOrderValue, true) : '—',
            sub: 'Across all non-cancelled orders',
            icon: ShoppingBag,
            tone: 'sky',
            valueColor: 'text-[#465478]',
          },
          {
            label: 'Repeat Purchase Rate',
            value: overview ? `${overview.repeatPurchaseRate}%` : '—',
            sub: `${overview?.loyalCustomers ?? 0} loyal customer(s) active`,
            icon: TrendingUp,
            tone: 'emerald',
            valueColor: 'text-[#17825B]',
          },
          {
            label: 'Cancellation Rate',
            value: overview ? `${overview.customerCancellationRate}%` : '—',
            sub: `${overview?.cancelledOrders ?? 0} cancelled order(s) recorded`,
            icon: XCircle,
            tone: 'coral',
            valueColor: 'text-[#CC3F14]',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rescale-card rescale-card-hover min-h-[120px] px-5 py-4 flex items-center gap-4 border border-[#E3E6FA] overflow-hidden"
          >
            <IconTile icon={kpi.icon} tone={kpi.tone} size="lg" />
            <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
              <div className="flex items-baseline justify-between gap-3 min-w-0">
                <span className="text-[13.5px] font-display font-black uppercase tracking-[0.07em] text-[#465478] truncate">
                  {kpi.label}
                </span>
                <span
                  className={`font-display text-[28px] xl:text-[32px] font-black tracking-[-0.03em] num leading-none shrink-0 ${kpi.valueColor}`}
                >
                  {overviewLoading ? '…' : kpi.value}
                </span>
              </div>
              <div className="text-[13.5px] font-medium text-[#64748B] truncate mt-1">
                {kpi.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PRIMARY WORKSPACE: SYMMETRIC 3-PANEL COCKPIT (With Full-Width Graph Expand Toggle) */}
      {activeTab === 'graph' && (
        <div className="space-y-3">
          <div className="flex lg:hidden items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileDirectoryOpen(true)}
            >
              <PanelLeftOpen className="w-4 h-4" /> Customer Directory (
              {directoryPage?.totalElements ?? 0})
            </Button>
            {selectedCustomerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileDetailsOpen(true)}
              >
                <PanelRightOpen className="w-4 h-4" /> Customer 360 Details
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* LEFT PANEL (Desktop): CUSTOMER DIRECTORY */}
            {!isGraphExpanded && (
              <div className="hidden lg:flex lg:col-span-3 lg:h-[760px] flex-col rescale-card p-4 border border-[#E3E6FA] overflow-hidden">
                {renderDirectoryPanelContent()}
              </div>
            )}

            {/* CENTRE PANEL: HIGH-CONTRAST HTML+SVG CONSTELLATION GRAPH */}
            <div
              className={`${
                isGraphExpanded ? 'lg:col-span-12' : 'lg:col-span-6'
              } lg:h-[760px] flex flex-col rescale-card p-5 gap-3.5 border border-[#E3E6FA] overflow-hidden transition-all duration-200`}
            >
              <div className="flex items-center justify-between gap-3 shrink-0 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
                    <h3 className="font-display text-[16.5px] font-extrabold text-[#465478] truncate">
                      {customer360?.profile
                        ? `${customer360.profile.fullName} — Constellation Topology`
                        : 'Individual Customer Relationship Graph'}
                    </h3>
                  </div>
                  <p className="text-[12px] text-[#7C86A2] truncate mt-0.5">
                    {selectedCustomerId
                      ? 'Drag any card to sculpt · Hover to animate signal paths · Click to inspect'
                      : 'Choose a customer from the left directory to project their relationship constellation'}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1 bg-[#F4F6FC] border border-[#DFE1F5] rounded-full p-1 shrink-0">
                  {selectedCustomerId && customerGraph && customerGraph.orderCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))
                        }
                        className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#5C6888] transition-colors"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-[11.5px] font-mono font-bold text-[#465478] num">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))
                        }
                        className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#5C6888] transition-colors"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={resetGraphLayout}
                        className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-[#7584D6] transition-colors"
                        title="Fit & reset layout"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsGraphExpanded((v) => !v)}
                    className="hidden lg:flex w-7 h-7 rounded-full hover:bg-white items-center justify-center text-[#545C9E] transition-colors"
                    title={isGraphExpanded ? 'Exit expanded view' : 'Expand graph full-width'}
                  >
                    {isGraphExpanded ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* GRAPH VIEWPORT STATES */}
              {!selectedCustomerId ? (
                <div className="relative flex-1 min-h-[580px] rounded-[22px] border border-[#DFE3F7] bg-gradient-to-b from-[#FAFBFD] via-[#F4F6FE] to-[#ECF8FF] rescale-dotted flex flex-col items-center justify-center p-8 text-center overflow-hidden">
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60"
                    aria-hidden="true"
                  >
                    <div className="w-[440px] h-[440px] rounded-full border border-dashed border-[#C7D0F5]" />
                    <div className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-[#AEB9EE]" />
                    <div className="absolute w-[160px] h-[160px] rounded-full bg-gradient-to-tr from-[#7584D6]/20 to-[#80E5FF]/25 blur-2xl" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center space-y-3.5 max-w-md">
                    <div className="w-16 h-16 rounded-[22px] bg-white border border-[#DFE1F5] shadow-rescale-card text-[#545C9E] flex items-center justify-center">
                      <GitFork className="w-8 h-8 text-[#7584D6]" />
                    </div>
                    <h4 className="font-display text-[19.5px] font-extrabold text-[#465478]">
                      Select a customer to explore their intelligence graph.
                    </h4>
                    <p className="text-[13.5px] text-[#6E7896] leading-relaxed">
                      Pick any customer from the directory on the left to project their individual order orbit, consolidated product purchases, and behavioral segments.
                    </p>
                    {directoryPage?.items?.length > 0 && (
                      <div className="pt-1">
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() =>
                            handleSelectCustomer(directoryPage.items[0].customerId)
                          }
                        >
                          <Sparkles className="w-4 h-4" /> Explore{' '}
                          {directoryPage.items[0].fullName}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : graphLoading ? (
                <div className="flex-1 min-h-[580px] rounded-[22px] border border-[#E3E6FA] bg-gradient-to-b from-[#FAFBFD] to-[#F3F5FD] flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-[#545C9E] animate-spin" />
                  <div className="font-display text-[15.5px] font-bold text-[#465478]">
                    Projecting customer intelligence constellation…
                  </div>
                </div>
              ) : graphError ? (
                <div className="flex-1 min-h-[580px] rounded-[22px] border border-[#FBCFC0] bg-[#FFF1EC] flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-[#CC3F14]" />
                  <div className="font-display text-[15.5px] font-bold text-[#CC3F14]">
                    {graphError}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSelectedCustomerIntelligence(selectedCustomerId)}
                  >
                    Retry Graph Load
                  </Button>
                </div>
              ) : !customerGraph || customerGraph.orderCount === 0 ? (
                <div className="flex-1 min-h-[580px] rounded-[22px] border border-[#E3E6FA] bg-[#F9FAFB] flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <ShoppingBag className="w-9 h-9 text-[#8891AA]" />
                  <h4 className="font-display text-[17.5px] font-extrabold text-[#465478]">
                    Not enough order history to generate a relationship graph.
                  </h4>
                  <p className="text-[13.5px] text-[#7C86A2] max-w-sm">
                    This customer has no recorded orders in the active merchant workspace yet.
                  </p>
                </div>
              ) : (
                <div
                  ref={viewportRef}
                  onMouseDown={(e) => {
                    if (e.target.closest('[data-graph-node="true"]')) return;
                    setCanvasDragging(true);
                    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                  }}
                  onMouseMove={handleViewportMouseMove}
                  onMouseUp={() => {
                    setCanvasDragging(false);
                    setDraggingNodeId(null);
                  }}
                  onMouseLeave={() => {
                    setCanvasDragging(false);
                    setDraggingNodeId(null);
                    setHoveredGraphNodeId(null);
                  }}
                  className="relative flex-1 min-h-[580px] rounded-[22px] border border-[#D4DCF7] bg-gradient-to-br from-[#FAFBFD] via-[#F2F5FE] to-[#EAF8FF] rescale-dotted overflow-hidden cursor-grab active:cursor-grabbing select-none"
                >
                  {/* Floating Top-Left Layer Switcher Pills */}
                  <div className="absolute top-3.5 left-3.5 z-20 inline-flex items-center gap-1 bg-white/95 backdrop-blur-md border border-[#DFE1F5] rounded-full p-1 shadow-sm">
                    {[
                      { id: 'ALL', label: 'Full Constellation' },
                      { id: 'COMMERCE', label: 'Orders & Products' },
                      { id: 'SEGMENTS', label: 'Segments Crown' },
                    ].map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => setGraphLayerFilter(layer.id)}
                        className={`px-3.5 py-1.5 rounded-full font-display text-[11.5px] font-bold transition-all ${
                          graphLayerFilter === layer.id
                            ? 'bg-[#545C9E] text-white shadow-xs'
                            : 'text-[#5C6888] hover:text-[#465478]'
                        }`}
                      >
                        {layer.label}
                      </button>
                    ))}
                  </div>

                  {/* Unified 1:1 CSS Pixel Transform Stage (SVG Curves Underlay + Crisp HTML Cards Overlay) */}
                  <div
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: '0 0',
                      width: STAGE_W,
                      height: STAGE_H,
                    }}
                    className="absolute top-0 left-0 pointer-events-none"
                  >
                    {/* SVG Orbital Rings & Smooth Bezier Connectors */}
                    <svg
                      width={STAGE_W}
                      height={STAGE_H}
                      className="overflow-visible absolute top-0 left-0 pointer-events-none"
                    >
                      <defs>
                        <radialGradient id="hub-ambient-glow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.22" />
                          <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      <circle
                        cx={orbitCenter.x}
                        cy={orbitCenter.y}
                        r={190}
                        fill="url(#hub-ambient-glow)"
                      />
                      <ellipse
                        cx={orbitCenter.x}
                        cy={orbitCenter.y}
                        rx={280}
                        ry={175}
                        fill="none"
                        stroke="#C9D3F8"
                        strokeWidth="1.5"
                        strokeDasharray="6 8"
                        opacity="0.75"
                      />
                      <ellipse
                        cx={orbitCenter.x}
                        cy={orbitCenter.y}
                        rx={420}
                        ry={315}
                        fill="none"
                        stroke="#D4DCF9"
                        strokeWidth="1.3"
                        strokeDasharray="5 10"
                        opacity="0.6"
                      />

                      {displayedGraph.edges.map((edge) => {
                        const src = nodePositions[edge.source];
                        const tgt = nodePositions[edge.target];
                        if (!src || !tgt) return null;

                        const isHighlighted =
                          activeFocusNodeId &&
                          (edge.source === activeFocusNodeId ||
                            edge.target === activeFocusNodeId);
                        const edgeTheme = EDGE_THEMES[edge.type] || EDGE_THEMES.BELONGS_TO;
                        const curve = buildSmoothEdgePath(src, tgt);

                        return (
                          <g key={edge.id}>
                            {isHighlighted && (
                              <path
                                d={curve.d}
                                fill="none"
                                stroke={edgeTheme.stroke}
                                strokeWidth="7"
                                strokeLinecap="round"
                                opacity="0.18"
                              />
                            )}
                            <path
                              d={curve.d}
                              fill="none"
                              stroke={isHighlighted ? edgeTheme.stroke : '#AEB9EA'}
                              strokeWidth={isHighlighted ? 3 : 2}
                              strokeDasharray={
                                edge.type === 'BELONGS_TO' ? '6 5' : undefined
                              }
                              strokeLinecap="round"
                              opacity={!activeFocusNodeId || isHighlighted ? 0.98 : 0.35}
                            />

                            {isHighlighted && (
                              <circle r="4.5" fill={edgeTheme.stroke}>
                                <animateMotion
                                  dur="2s"
                                  repeatCount="indefinite"
                                  path={curve.d}
                                />
                              </circle>
                            )}

                            {/* Crisp Readable Midpoint Relationship Pill */}
                            <g
                              opacity={!activeFocusNodeId || isHighlighted ? 1 : 0.42}
                              transform={`translate(${curve.labelX - 44}, ${curve.labelY - 12})`}
                            >
                              <rect
                                width={88}
                                height={24}
                                rx={12}
                                fill={isHighlighted ? edgeTheme.pillBg : '#FFFFFF'}
                                stroke={isHighlighted ? edgeTheme.stroke : edgeTheme.pillBorder}
                                strokeWidth={isHighlighted ? 1.8 : 1.3}
                              />
                              <text
                                x={44}
                                y={15.5}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="800"
                                letterSpacing="0.05em"
                                fill={edgeTheme.text}
                                fontFamily="Manrope, sans-serif"
                              >
                                {edgeTheme.label}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Crisp HTML/Tailwind Node Cards Layer */}
                    <div className="pointer-events-auto">
                      {displayedGraph.nodes.map((node) => renderGraphNodeCard(node))}
                    </div>
                  </div>

                  {/* Floating Glassmorphic Bottom Legend Dock */}
                  <div className="absolute bottom-3.5 left-3.5 right-3.5 z-20 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur-md border border-[#DFE1F5] rounded-[14px] px-4 py-2.5 text-[12px] shadow-sm">
                    <div className="flex flex-wrap items-center gap-3.5 font-display font-bold text-[#465478]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#545C9E]" />1 Customer Hub
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#0EA5E9]" />
                        {customerGraph.orderCount} Order(s)
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                        {customerGraph.productCount} Product(s)
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#6366F1]" />
                        {customerGraph.segmentCount} Segment(s)
                      </span>
                    </div>
                    <div className="font-mono text-[11px] font-semibold text-[#6E7896]">
                      {displayedGraph.nodes.length} nodes · {displayedGraph.edges.length} links
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANEL (Desktop): SYNCHRONIZED CUSTOMER INTELLIGENCE DETAILS */}
            {!isGraphExpanded && (
              <div className="hidden lg:flex lg:col-span-3 lg:h-[760px] flex-col rescale-card p-4 border border-[#E3E6FA] overflow-hidden">
                {renderRightDetailsPanelContent()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SYMMETRIC BEHAVIORAL SEGMENTS OVERVIEW */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {(overview?.segmentDistribution || []).map((seg) => (
            <div
              key={seg.segmentId}
              className="rescale-card rescale-card-hover h-[255px] p-5 flex flex-col justify-between border border-[#E3E6FA] overflow-hidden"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <SegmentPill segmentId={seg.segmentId} />
                  <span className="font-display text-[12.5px] font-extrabold text-[#545C9E] num shrink-0">
                    {seg.customerCount} ({seg.percentageOfCustomers}%)
                  </span>
                </div>
                <h4 className="font-display text-[15.5px] font-extrabold text-[#465478] truncate">
                  {seg.segmentName}
                </h4>
                <p className="text-[12px] text-[#6E7896] line-clamp-2">{seg.description}</p>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[#EEF0FA] min-w-0">
                <div
                  className="rounded-[10px] bg-[#F9FAFB] border border-[#E3E6FA] px-3 py-1.5 font-mono text-[10.5px] text-[#465478] truncate"
                  title={seg.thresholdRule}
                >
                  Rule: <strong>{seg.thresholdRule}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="rounded-[10px] bg-[#F9FAFB] border border-[#E3E6FA] px-2.5 py-1.5 truncate">
                    Spend:{' '}
                    <strong className="text-[#17825B]">
                      {formatINR(seg.totalSegmentSpend, true)}
                    </strong>
                  </div>
                  <div className="rounded-[10px] bg-[#F9FAFB] border border-[#E3E6FA] px-2.5 py-1.5 truncate">
                    Avg:{' '}
                    <strong className="text-[#465478]">
                      {formatINR(seg.averageCustomerSpend, true)}
                    </strong>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full justify-center"
                  onClick={() => {
                    setDirSegment(seg.segmentId);
                    setDirPageIdx(0);
                    setActiveTab('graph');
                  }}
                >
                  Filter Directory by {seg.segmentName}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: PRODUCT INTELLIGENCE & CO-PURCHASES */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {productsError && (
            <div className="rounded-[18px] bg-[#FFF1EC] border border-[#FBCFC0] p-4 flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#CC3F14]">{productsError}</span>
              <Button variant="outline" size="xs" onClick={loadProductInsights}>
                Retry
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 rescale-card p-5 space-y-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[16px] font-extrabold text-[#465478] truncate">
                    Product Performance & Repeat Buyers
                  </h3>
                  <p className="text-[12px] text-[#7C86A2] truncate">
                    Normalized by merchant SKU · Click any product row to inspect its customer buyers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search SKU or product…"
                    className={`${inputClass} text-[12px] py-1.5 w-44`}
                  />
                  <select
                    value={productSortBy}
                    onChange={(e) => setProductSortBy(e.target.value)}
                    className={`${selectClass} text-[12px] py-1.5 w-40`}
                  >
                    <option value="totalRevenue">Sort by Revenue</option>
                    <option value="unitsPurchased">Sort by Units Sold</option>
                    <option value="uniqueCustomers">Sort by Unique Buyers</option>
                    <option value="repeatCustomerCount">Sort by Repeat Buyers</option>
                  </select>
                </div>
              </div>

              {productsLoading ? (
                <div className="py-12 text-center text-[13px] text-[#7C86A2]">
                  Calculating product analytics from PostgreSQL order items…
                </div>
              ) : !productsPage?.items || productsPage.items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No products purchased yet"
                  description="Create or import orders in Order Management to generate product performance analytics."
                />
              ) : (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productsPage.items.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0FA" />
                        <XAxis dataKey="sku" tick={{ fontSize: 11, fill: '#6E7896' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6E7896' }} />
                        <Tooltip
                          formatter={(value, name) =>
                            name === 'totalRevenue'
                              ? [formatINR(value, true), 'Revenue']
                              : [value, 'Units Sold']
                          }
                        />
                        <Bar dataKey="totalRevenue" fill="#545C9E" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {productsPage.items.map((p) => {
                      const isSelected = p.sku === selectedSku;
                      return (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => setSelectedSku(p.sku)}
                          className={`w-full h-[76px] text-left rounded-[16px] border p-3.5 flex items-center justify-between gap-3 transition-all overflow-hidden ${
                            isSelected
                              ? 'bg-[#EEF0FA] border-[#9AA6EA]'
                              : 'bg-[#F9FAFB] border-[#E3E6FA] hover:bg-white'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-display text-[13.5px] font-extrabold text-[#465478] truncate">
                                {p.productName}
                              </span>
                              <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-white border border-[#DFE1F5] text-[#545C9E] shrink-0">
                                {p.sku}
                              </span>
                            </div>
                            <div className="text-[11.5px] text-[#6E7896] mt-1 truncate">
                              <strong>{p.unitsPurchased}</strong> units ·{' '}
                              <strong>{p.uniqueCustomers}</strong> customer(s) ·{' '}
                              <strong>{p.repeatCustomerCount}</strong> repeat (
                              {p.repeatCustomerRatePercent}%)
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-[15px] font-extrabold text-[#17825B] num">
                              {formatINR(p.totalRevenue, true)}
                            </div>
                            <div className="text-[10.5px] text-[#7584D6]">
                              Avg {formatINR(p.averageUnitPrice, true)} / unit
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rescale-card p-5 space-y-4 overflow-hidden">
                <h4 className="font-display text-[15px] font-extrabold text-[#465478] truncate">
                  Frequently Co-Purchased Product Pairs ({coPurchases.length})
                </h4>
                {coPurchases.length === 0 ? (
                  <div className="py-6 text-center text-[12.5px] text-[#7C86A2]">
                    No multi-product co-purchase combinations observed yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                    {coPurchases.map((pair) => (
                      <div
                        key={`${pair.skuA}-${pair.skuB}`}
                        className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 space-y-1.5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span
                            className="font-display text-[12.5px] font-extrabold text-[#465478] truncate"
                            title={`${pair.productNameA} + ${pair.productNameB}`}
                          >
                            {pair.productNameA} + {pair.productNameB}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-[#ECFEF6] text-[#17825B] border border-[#BCEFD9] shrink-0">
                            {pair.orderSupportPercentage}% Support
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6E7896] break-words">
                          {pair.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rescale-card p-5 space-y-3 overflow-hidden">
                <h4 className="font-display text-[15px] font-extrabold text-[#465478] truncate">
                  Customer Buyers for SKU: {selectedSku || '—'}
                </h4>

                {skuDetailLoading || !selectedSkuDetail ? (
                  <div className="py-6 text-center text-[12.5px] text-[#7C86A2]">
                    {selectedSku
                      ? 'Loading customer buyers for selected SKU…'
                      : 'Select a product on the left to inspect its customer buyers.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {selectedSkuDetail.buyers.map((buyer) => (
                      <div
                        key={buyer.customerId}
                        className="h-[64px] rounded-[14px] bg-[#F9FAFB] border border-[#E3E6FA] p-3 flex items-center justify-between gap-2 overflow-hidden"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-display text-[13px] font-bold text-[#465478] truncate">
                              {buyer.fullName}
                            </span>
                            {buyer.repeatBuyer && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#ECFEF6] text-[#17825B] shrink-0">
                                Repeat Buyer
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#7C86A2] truncate">
                            {buyer.ordersCount} order(s) · {buyer.unitsPurchased} units ·{' '}
                            {formatINR(buyer.totalSpentOnProduct, true)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleSelectCustomer(buyer.customerId)}
                        >
                          Explore Graph
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE DRAWER: CUSTOMER DIRECTORY */}
      {mobileDirectoryOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-[#1E2438]/40 backdrop-blur-xs flex">
          <div className="w-80 max-w-[88vw] bg-white h-full p-4 overflow-y-auto shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EEF0FA]">
              <span className="font-display text-[14px] font-extrabold text-[#465478]">
                Select Customer
              </span>
              <button
                type="button"
                onClick={() => setMobileDirectoryOpen(false)}
                className="p-1 rounded-lg text-[#7C86A2] hover:bg-[#F9FAFB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderDirectoryPanelContent()}
          </div>
        </div>
      )}

      {/* MOBILE DRAWER: CUSTOMER DETAILS */}
      {mobileDetailsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-[#1E2438]/40 backdrop-blur-xs flex justify-end">
          <div className="w-88 max-w-[90vw] bg-white h-full p-4 overflow-y-auto shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EEF0FA]">
              <span className="font-display text-[14px] font-extrabold text-[#465478]">
                Customer Intelligence Details
              </span>
              <button
                type="button"
                onClick={() => setMobileDetailsOpen(false)}
                className="p-1 rounded-lg text-[#7C86A2] hover:bg-[#F9FAFB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderRightDetailsPanelContent()}
          </div>
        </div>
      )}

      {/* SYNCHRONIZED FULL CUSTOMER 360 MODAL */}
      <AnimatePresence>
        {customer360ModalOpen && customer360 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1E2438]/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-[26px] border border-[#DFE1F5] shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-[#F6F7FE] via-white to-[#EFF9FF] border-b border-[#EEF0FA] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={customer360.profile.fullName} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[19px] font-extrabold text-[#465478] truncate">
                        {customer360.profile.fullName} — Customer 360 Profile
                      </h3>
                      {customer360.profile.segmentIds.map((segId) => (
                        <SegmentPill key={segId} segmentId={segId} />
                      ))}
                    </div>
                    <p className="text-[12.5px] text-[#6E7896] truncate">
                      +91 {customer360.profile.phoneNumber}
                      {customer360.profile.email ? ` · ${customer360.profile.email}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer360ModalOpen(false)}
                  className="p-2 rounded-full hover:bg-[#F1F2F9] text-[#6E7896] shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 pt-3 border-b border-[#EEF0FA]">
                <Tabs
                  items={[
                    { id: 'overview', label: 'Purchase & Payment Summary' },
                    {
                      id: 'segments',
                      label: `Segment Explanations (${customer360.profile.segments.length})`,
                    },
                    {
                      id: 'products',
                      label: `Product Preferences (${customer360.productPreferences.length})`,
                    },
                    {
                      id: 'timeline',
                      label: `Purchase Timeline (${customer360.timeline.length})`,
                    },
                  ]}
                  value={customer360ModalTab}
                  onChange={setCustomer360ModalTab}
                />
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {customer360ModalTab === 'overview' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="h-[88px] rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-[#8891AA] truncate">
                        Total Spend (CLV)
                      </div>
                      <div className="font-display text-[20px] font-extrabold text-[#17825B] num truncate">
                        {formatINR(customer360.profile.purchaseMetrics.totalSpend, true)}
                      </div>
                    </div>
                    <div className="h-[88px] rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-[#8891AA] truncate">
                        Average Order Value
                      </div>
                      <div className="font-display text-[20px] font-extrabold text-[#465478] num truncate">
                        {formatINR(customer360.profile.purchaseMetrics.averageOrderValue, true)}
                      </div>
                    </div>
                    <div className="h-[88px] rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-[#8891AA] truncate">
                        Repeat Purchases
                      </div>
                      <div className="font-display text-[20px] font-extrabold text-[#545C9E] num truncate">
                        {customer360.profile.purchaseMetrics.repeatPurchaseCount}
                      </div>
                    </div>
                    <div className="h-[88px] rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-[#8891AA] truncate">
                        Distinct Products
                      </div>
                      <div className="font-display text-[20px] font-extrabold text-[#465478] num truncate">
                        {customer360.profile.purchaseMetrics.distinctProductsPurchased}
                      </div>
                    </div>
                  </div>
                )}

                {customer360ModalTab === 'segments' && (
                  <div className="space-y-3">
                    {customer360.profile.segments.map((seg) => (
                      <div
                        key={seg.segmentId}
                        className="rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-4 space-y-2 overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <SegmentPill segmentId={seg.segmentId} />
                          <span className="font-mono text-[11px] text-[#7584D6] truncate">
                            Rule: {seg.thresholdApplied}
                          </span>
                        </div>
                        <div className="font-display text-[13.5px] font-bold text-[#465478] break-words">
                          {seg.reason}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Object.entries(seg.evidence || {}).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#DFE1F5] text-[11px] font-mono text-[#465478] max-w-full truncate"
                            >
                              {k}: <strong>{String(v ?? '—')}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customer360ModalTab === 'products' && (
                  <div className="space-y-2.5">
                    {customer360.productPreferences.map((prod) => (
                      <div
                        key={prod.sku}
                        className="h-[68px] rounded-[16px] border border-[#E3E6FA] bg-[#F9FAFB] p-3.5 flex items-center justify-between gap-3 overflow-hidden"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[13.5px] font-extrabold text-[#465478] truncate">
                            {prod.productName} ({prod.sku})
                          </div>
                          <div className="text-[12px] text-[#6E7896] truncate">
                            {prod.totalUnitsPurchased} unit(s) across {prod.ordersCount} order(s)
                          </div>
                        </div>
                        <div className="font-display text-[15px] font-extrabold text-[#17825B] num shrink-0">
                          {formatINR(prod.totalSpend, true)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {customer360ModalTab === 'timeline' && (
                  <div className="space-y-2.5">
                    {customer360.timeline.map((ev) => (
                      <div
                        key={ev.eventId}
                        className="rounded-[14px] border border-[#E3E6FA] bg-[#F9FAFB] p-3 flex items-start justify-between gap-3 overflow-hidden"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <Clock className="w-4 h-4 text-[#7584D6] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-display text-[13px] font-bold text-[#465478] truncate">
                              {ev.title}
                            </div>
                            {ev.description && (
                              <div className="text-[11.5px] text-[#6E7896] break-words">
                                {ev.description}
                              </div>
                            )}
                            <div className="text-[10.5px] text-[#8891AA] mt-0.5">
                              {formatDateTime(ev.occurredAt)}
                            </div>
                          </div>
                        </div>
                        {ev.amount != null && (
                          <span className="font-display text-[13px] font-extrabold text-[#465478] num shrink-0">
                            {formatINR(ev.amount, true)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
