import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Play,
  ClipboardCheck,
  RefreshCw,
  Search,
  Settings2,
  AlertTriangle,
  Info,
  Clock,
  ChevronLeft,
  ChevronRight,
  Layers,
  UserCheck,
  FileSearch,
} from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  Button,
  Tabs,
  Drawer,
  Modal,
  Field,
  inputClass,
  EmptyState,
} from '../components/ui/Primitives';
import {
  fetchInterventionsOverview,
  fetchInterventionQueue,
  evaluateOrderIntervention,
  fetchRecommendationDetail,
  approveInterventionAction,
  rejectInterventionAction,
  executeInterventionAction,
  recordInterventionOutcome,
  refreshRecommendation,
  fetchInterventionPolicy,
  updateInterventionPolicy,
  fetchCustomerConsent,
  updateCustomerConsent,
} from '../services/api/interventionsApi';
import { fetchOrders } from '../services/api/ordersApi';
import { useAuthStore, hasMinimumRole } from '../store/useAuthStore';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

const BUCKET_TABS = [
  { id: 'ACTIVE', label: 'Active Queue' },
  { id: 'AWAITING_APPROVAL', label: 'Awaiting Action Approval' },
  { id: 'AWAITING_EXECUTION_OR_OUTCOME', label: 'Awaiting Execution / Outcome' },
  { id: 'RECENTLY_COMPLETED', label: 'Recently Completed' },
  { id: 'ALL_HISTORY', label: 'All History' },
];

const INTERVENTION_TYPES = [
  'COD_CONFIRMATION',
  'ADDRESS_CLARIFICATION',
  'HUMAN_REVIEW',
  'OPTIONAL_PARTIAL_ADVANCE',
  'NO_INTERVENTION',
];

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];

const OUTCOME_TYPES = [
  { value: 'CUSTOMER_CONFIRMED_INTENT', label: 'Customer Confirmed Intent (Verified)' },
  { value: 'ADDRESS_DETAILS_PROVIDED', label: 'Address / Landmark Details Provided (Verified)' },
  { value: 'CUSTOMER_DENIED_ORDER', label: 'Customer Denied Placing Order (Verified)' },
  { value: 'CUSTOMER_REQUESTED_CANCELLATION', label: 'Customer Requested Cancellation (Verified)' },
  { value: 'PARTIAL_ADVANCE_VOLUNTARILY_PAID', label: 'Voluntary Partial Advance Elected (Verified)' },
  { value: 'PARTIAL_ADVANCE_DECLINED', label: 'Voluntary Partial Advance Declined (Verified)' },
  { value: 'NO_ANSWER_INCONCLUSIVE', label: 'No Answer — Inconclusive (Not Fraud/Rejection)' },
  { value: 'BUSY_INCONCLUSIVE', label: 'Line Busy — Inconclusive (Not Fraud/Rejection)' },
  { value: 'CONTACT_DELIVERY_FAILED', label: 'Contact Transport Failed — Neutral' },
  { value: 'HUMAN_REVIEW_RESOLVED', label: 'Human Review Evidence Resolved' },
  { value: 'HUMAN_REVIEW_UNRESOLVED', label: 'Human Review Still Unresolved' },
];

const STATUS_BADGE = {
  RECOMMENDED: 'bg-[#EEF2FF] text-[#545C9E] border-[#DFE1F5]',
  ACTION_APPROVAL_PENDING: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  ACTION_APPROVED: 'bg-[#EEFBFF] text-[#0E7490] border-[#CCF2FE]',
  ACTION_REJECTED: 'bg-[#F1F2F9] text-[#5C6888] border-[#DFE1F5]',
  EXECUTION_PENDING: 'bg-[#EEFBFF] text-[#0E7490] border-[#CCF2FE]',
  EXECUTING: 'bg-[#EEFBFF] text-[#0E7490] border-[#CCF2FE]',
  EXECUTED: 'bg-[#F6F5FF] text-[#6D28D9] border-[#E6E5FD]',
  OUTCOME_PENDING: 'bg-[#F6F5FF] text-[#6D28D9] border-[#E6E5FD]',
  COMPLETED: 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]',
  EXPIRED: 'bg-[#F1F2F9] text-[#6A7594] border-[#DFE1F5]',
  SUPERSEDED: 'bg-[#F1F2F9] text-[#6A7594] border-[#DFE1F5]',
  FAILED: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
};

const PRIORITY_BADGE = {
  HIGH: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
  MEDIUM: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  LOW: 'bg-[#EEF2FF] text-[#545C9E] border-[#DFE1F5]',
  NONE: 'bg-[#F1F2F9] text-[#6A7594] border-[#DFE1F5]',
};

const RISK_BADGE = {
  LOW: 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]',
  MEDIUM: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  HIGH: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
};

function Pill({ value, styleMap = {} }) {
  if (!value) return <span className="text-[12px] text-[#8891AA]">—</span>;
  const cls = styleMap[value] || 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold border ${cls}`}
    >
      {String(value).replace(/_/g, ' ')}
    </span>
  );
}

export function InterventionsPage() {
  const currentRole = useAuthStore((s) => s.currentRole);
  const addToast = useOrdexaStore((s) => s.addToast);
  const canOperate = hasMinimumRole(currentRole, 'OPERATOR');
  const canConfigure = hasMinimumRole(currentRole, 'ADMIN');

  const [overview, setOverview] = useState(null);
  const [queuePage, setQueuePage] = useState({
    items: [],
    page: 0,
    size: 12,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Queue filters
  const [bucket, setBucket] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(0);

  // Detail drawer state
  const [selectedRecId, setSelectedRecId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [historyTab, setHistoryTab] = useState('evidence');

  // Customer consent state inside detail drawer
  const [consentInfo, setConsentInfo] = useState(null);
  const [consentStatusDraft, setConsentStatusDraft] = useState('GRANTED');
  const [consentSaving, setConsentSaving] = useState(false);

  // Record Outcome modal state
  const [outcomeModalItem, setOutcomeModalItem] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({
    outcomeType: 'CUSTOMER_CONFIRMED_INTENT',
    resolvedFieldsCsv: '',
    triggerReEvaluation: true,
  });

  // Evaluate Workspace Order modal state
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [workspaceOrders, setWorkspaceOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderToEval, setSelectedOrderToEval] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  // Merchant Policy modal state
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState(null);
  const [policySaving, setPolicySaving] = useState(false);

  const notify = useCallback(
    (title, message, tone = 'info') => {
      addToast({ title: String(title || ''), message: String(message || ''), tone });
    },
    [addToast]
  );

  const loadQueueAndOverview = useCallback(async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const [ov, q] = await Promise.all([
        fetchInterventionsOverview(),
        fetchInterventionQueue({
          bucket,
          search: search.trim() || undefined,
          type: typeFilter || undefined,
          priority: priorityFilter || undefined,
          activeOnly: bucket !== 'ALL_HISTORY',
          page,
          size: 12,
          sortBy: 'evaluatedAt',
          sortDir: 'desc',
        }),
      ]);
      setOverview(ov);
      setQueuePage(q || { items: [], page: 0, size: 12, totalElements: 0, totalPages: 0, hasNext: false });
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to load NBIE intervention queue');
    } finally {
      setLoading(false);
    }
  }, [bucket, search, typeFilter, priorityFilter, page]);

  useEffect(() => {
    loadQueueAndOverview();
  }, [loadQueueAndOverview]);

  const openDetail = useCallback(
    async (recId) => {
      setSelectedRecId(recId);
      setDetailLoading(true);
      setConsentInfo(null);
      try {
        const d = await fetchRecommendationDetail(recId);
        setDetail(d);
        if (d?.recommendation?.customerId) {
          try {
            const c = await fetchCustomerConsent(d.recommendation.customerId);
            setConsentInfo(c);
            setConsentStatusDraft(c?.effectiveConsentStatus || 'UNKNOWN');
          } catch {
            // Non-blocking consent read
          }
        }
      } catch (err) {
        notify('Failed to load recommendation', err?.message || 'Request failed', 'danger');
      } finally {
        setDetailLoading(false);
      }
    },
    [notify]
  );

  const handleOpenEvaluateModal = async () => {
    setEvalModalOpen(true);
    setOrdersLoading(true);
    try {
      const res = await fetchOrders({ page: 0, size: 25, sortBy: 'createdAt', sortDir: 'desc' });
      const items = res?.items || [];
      setWorkspaceOrders(items);
      if (items.length > 0 && !selectedOrderToEval) {
        setSelectedOrderToEval(items[0].id);
      }
    } catch (err) {
      notify('Unable to load orders', err?.message || 'Failed to fetch orders', 'danger');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleEvaluateOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrderToEval) return;
    setEvaluating(true);
    try {
      const evaluated = await evaluateOrderIntervention(selectedOrderToEval, true);
      notify(
        'NBIE Evaluation Complete',
        `Order ${evaluated.orderId}: ${evaluated.evaluationStatus} (recommendation only — order status unchanged)`,
        'success'
      );
      setEvalModalOpen(false);
      await loadQueueAndOverview();
      if (evaluated?.recommendationId) {
        await openDetail(evaluated.recommendationId);
      }
    } catch (err) {
      notify('Evaluation failed', err?.message || 'Unable to evaluate order', 'danger');
    } finally {
      setEvaluating(false);
    }
  };

  const handleApproveAction = async (itemId) => {
    setActionBusy(true);
    try {
      const updated = await approveInterventionAction(itemId, {
        note: decisionNote.trim() || undefined,
      });
      setDetail(updated);
      setDecisionNote('');
      notify(
        'Intervention Action Approved',
        'Action authorized for sandbox execution. Order status was NOT modified.',
        'success'
      );
      await loadQueueAndOverview();
    } catch (err) {
      notify('Action approval failed', err?.message || 'Request failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectAction = async (itemId) => {
    setActionBusy(true);
    try {
      const updated = await rejectInterventionAction(itemId, {
        note: decisionNote.trim() || undefined,
      });
      setDetail(updated);
      setDecisionNote('');
      notify(
        'Intervention Action Rejected',
        'Proposed intervention skipped. Order was NOT cancelled or declined.',
        'info'
      );
      await loadQueueAndOverview();
    } catch (err) {
      notify('Action rejection failed', err?.message || 'Request failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleExecuteAction = async (itemId) => {
    setActionBusy(true);
    try {
      const updated = await executeInterventionAction(itemId, {
        note: decisionNote.trim() || undefined,
      });
      setDetail(updated);
      notify(
        'Intervention Executed (Sandbox)',
        'Dispatched via sandbox adapter. Awaiting verified customer outcome.',
        'success'
      );
      await loadQueueAndOverview();
    } catch (err) {
      notify('Execution blocked', err?.message || 'Consent or policy check failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecordOutcomeSubmit = async (e) => {
    e.preventDefault();
    if (!outcomeModalItem) return;
    setActionBusy(true);
    try {
      const resolvedFields = outcomeForm.resolvedFieldsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await recordInterventionOutcome(outcomeModalItem.itemId, {
        outcomeType: outcomeForm.outcomeType,
        outcomeSource: 'OPERATOR_RECORDED',
        resolvedFields: resolvedFields.length > 0 ? resolvedFields : undefined,
        triggerReEvaluation: Boolean(outcomeForm.triggerReEvaluation),
      });
      setDetail(updated);
      setSelectedRecId(updated?.recommendation?.recommendationId || selectedRecId);
      setOutcomeModalItem(null);
      notify(
        'Intervention Outcome Recorded',
        `Recorded ${outcomeForm.outcomeType.replace(/_/g, ' ')} without mutating order status.`,
        'success'
      );
      await loadQueueAndOverview();
    } catch (err) {
      notify('Failed to record outcome', err?.message || 'Request failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRefreshRecommendation = async () => {
    if (!detail?.recommendation?.recommendationId) return;
    setActionBusy(true);
    try {
      const refreshed = await refreshRecommendation(detail.recommendation.recommendationId);
      setDetail(refreshed);
      setSelectedRecId(refreshed?.recommendation?.recommendationId || selectedRecId);
      notify('Recommendation Refreshed', 'Re-evaluated against current order, RTO, and consent state.', 'info');
      await loadQueueAndOverview();
    } catch (err) {
      notify('Refresh failed', err?.message || 'Request failed', 'danger');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveCustomerConsent = async () => {
    const customerId = detail?.recommendation?.customerId;
    if (!customerId) return;
    setConsentSaving(true);
    try {
      const updated = await updateCustomerConsent(customerId, {
        consentStatus: consentStatusDraft,
        permittedChannels: ['VOICE_SANDBOX'],
        consentSource: 'OPERATOR_VERIFIED',
      });
      setConsentInfo(updated);
      notify(
        'Customer Consent Updated',
        `Effective consent is now ${updated.effectiveConsentStatus}. Click "Refresh evaluation" to re-run NBIE filters.`,
        'success'
      );
    } catch (err) {
      notify('Consent update failed', err?.message || 'Request failed', 'danger');
    } finally {
      setConsentSaving(false);
    }
  };

  const handleOpenPolicyModal = async () => {
    try {
      const pol = await fetchInterventionPolicy();
      setPolicyForm(pol);
      setPolicyModalOpen(true);
    } catch (err) {
      notify('Unable to load policy', err?.message || 'Request failed', 'danger');
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!policyForm) return;
    setPolicySaving(true);
    try {
      await updateInterventionPolicy({
        ...policyForm,
        partialAdvanceMinOrderValue: Number(policyForm.partialAdvanceMinOrderValue || 2500),
        codConfirmationMinOrderValue: Number(policyForm.codConfirmationMinOrderValue || 0),
        enabledChannels:
          Array.isArray(policyForm.enabledChannels) && policyForm.enabledChannels.length > 0
            ? policyForm.enabledChannels
            : ['VOICE_SANDBOX'],
      });
      setPolicyModalOpen(false);
      notify('NBIE Policy Saved', 'Merchant intervention guardrails updated.', 'success');
      await loadQueueAndOverview();
    } catch (err) {
      notify('Policy update failed', err?.message || 'Request failed', 'danger');
    } finally {
      setPolicySaving(false);
    }
  };

  const renderActionCard = (actionItem) => {
    if (!actionItem) return null;
    const isNoIntervention = actionItem.type === 'NO_INTERVENTION';
    const canApproveOrReject =
      canOperate &&
      !isNoIntervention &&
      (actionItem.status === 'RECOMMENDED' || actionItem.status === 'ACTION_APPROVAL_PENDING');
    const canExecute =
      canOperate &&
      !isNoIntervention &&
      (actionItem.status === 'ACTION_APPROVED' || actionItem.status === 'EXECUTION_PENDING');
    const canRecordOutcome =
      canOperate &&
      !isNoIntervention &&
      (actionItem.status === 'ACTION_APPROVED' ||
        actionItem.status === 'EXECUTED' ||
        actionItem.status === 'OUTCOME_PENDING');

    return (
      <div
        key={actionItem.itemId}
        data-testid={`nbie-action-card-${actionItem.role}`}
        className={`rounded-[18px] p-4 border space-y-3 ${
          actionItem.role === 'PRIMARY'
            ? 'bg-[#F8F9FE] border-[#BFC7F4]'
            : 'bg-white border-[#E3E6FA]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-display font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#545C9E]">
              {actionItem.role} #{actionItem.rankOrder}
            </span>
            <span className="font-display text-[14.5px] font-extrabold text-[#465478]">
              {actionItem.type.replace(/_/g, ' ')}
            </span>
            <Pill value={actionItem.priority} styleMap={PRIORITY_BADGE} />
          </div>
          <Pill value={actionItem.status} styleMap={STATUS_BADGE} />
        </div>

        <p className="text-[13px] text-[#4E5B7C] leading-relaxed">{actionItem.explanation}</p>

        <div className="flex flex-wrap gap-3 text-[11.5px] text-[#6E7896]">
          <span>
            <strong>Channel:</strong> {actionItem.proposedChannel}
          </span>
          <span>
            <strong>Action Approval Required:</strong> {actionItem.approvalRequired ? 'Yes' : 'No'}
          </span>
          <span>
            <strong>Rules:</strong> {(actionItem.triggeredRuleIds || []).join(', ') || '—'}
          </span>
        </div>

        {(actionItem.reasonCodes || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actionItem.reasonCodes.map((rc) => (
              <span
                key={rc}
                className="px-2 py-0.5 rounded-md bg-white border border-[#DFE1F5] text-[11px] font-mono text-[#545C9E]"
              >
                {rc}
              </span>
            ))}
          </div>
        )}

        {(actionItem.requiredEvidence || []).length > 0 && (
          <div className="text-[11.5px] text-[#5C6888]">
            <strong>Required Evidence:</strong> {actionItem.requiredEvidence.join(', ')}
          </div>
        )}

        {(canApproveOrReject || canExecute || canRecordOutcome) && (
          <div className="pt-2 border-t border-[#E3E6FA] flex flex-wrap items-center gap-2">
            {canApproveOrReject && (
              <>
                <Button
                  variant="primary"
                  size="xs"
                  loading={actionBusy}
                  data-testid={`approve-action-btn-${actionItem.rankOrder}`}
                  onClick={() => handleApproveAction(actionItem.itemId)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve action
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  loading={actionBusy}
                  data-testid={`reject-action-btn-${actionItem.rankOrder}`}
                  onClick={() => handleRejectAction(actionItem.itemId)}
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject action
                </Button>
              </>
            )}
            {canExecute && (
              <Button
                variant="primary"
                size="xs"
                loading={actionBusy}
                data-testid={`execute-action-btn-${actionItem.rankOrder}`}
                onClick={() => handleExecuteAction(actionItem.itemId)}
              >
                <Play className="w-3.5 h-3.5" /> Execute intervention
              </Button>
            )}
            {canRecordOutcome && (
              <Button
                variant="outline"
                size="xs"
                disabled={actionBusy}
                data-testid={`record-outcome-btn-${actionItem.rankOrder}`}
                onClick={() => setOutcomeModalItem(actionItem)}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Record outcome
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const rec = detail?.recommendation;
  const snap = rec?.evidenceSnapshot || {};
  const unknownWarnings = Array.isArray(snap.unknownDataWarnings) ? snap.unknownDataWarnings : [];
  const staleWarnings = Array.isArray(snap.staleDataWarnings) ? snap.staleDataWarnings : [];
  const conflicts = Array.isArray(snap.conflictingEvidenceIndicators)
    ? snap.conflictingEvidenceIndicators
    : [];
  const droppedCandidates = Array.isArray(snap.droppedCandidates) ? snap.droppedCandidates : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pre-Dispatch Decision Support · Recommendations Only"
        title="Next-Best"
        accentWord="Interventions"
        subtitle="Deterministic, explainable pre-dispatch actions to resolve COD, address, and verification uncertainty without making final order decisions."
        icon={Compass}
        iconTone="peri"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadQueueAndOverview}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
            </Button>
            {canConfigure && (
              <Button variant="outline" size="sm" onClick={handleOpenPolicyModal}>
                <Settings2 className="w-3.5 h-3.5" /> Intervention Policy
              </Button>
            )}
            {canOperate && (
              <Button
                variant="primary"
                size="sm"
                data-testid="nbie-open-evaluate-modal"
                onClick={handleOpenEvaluateModal}
              >
                <FileSearch className="w-3.5 h-3.5" /> Evaluate Order
              </Button>
            )}
          </div>
        }
      />

      {/* Explicit Authority Boundary Banner */}
      <div
        data-testid="nbie-authority-banner"
        className="rounded-[20px] bg-[#F4F5FC] border border-[#D5DAF7] p-4 flex items-start gap-3"
      >
        <Info className="w-5 h-5 text-[#545C9E] flex-shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-[#465478] leading-relaxed">
          <strong className="font-display font-bold text-[#354163]">
            Recommendation-Only Authority Boundary:
          </strong>{' '}
          NBIE recommends pre-dispatch uncertainty-resolution actions only. Approving or rejecting an
          item authorizes or skips that intervention action—it <strong>never</strong> approves,
          declines, cancels, holds, or releases an order. Execution runs strictly in{' '}
          <span className="font-mono font-semibold">SANDBOX / DRY_RUN</span> mode.
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Recommendations"
          value={overview ? String(overview.activeRecommendations) : '—'}
          delta={overview?.activeRulesetVersion || 'NBIE_RULESET_V1'}
          subtitle="Current merchant-scoped NBIE records"
          icon={Layers}
          accent="peri"
        />
        <KpiCard
          title="Awaiting Action Approval"
          value={overview ? String(overview.awaitingActionApproval) : '—'}
          delta="Operator Gate"
          subtitle="Requires explicit action authorization"
          icon={UserCheck}
          accent="amber"
        />
        <KpiCard
          title="Awaiting Execution / Outcome"
          value={overview ? String(overview.awaitingExecutionOrOutcome) : '—'}
          delta="Sandbox Only"
          subtitle="Approved or awaiting verified response"
          icon={Clock}
          accent="cyan"
        />
        <KpiCard
          title="High-Priority Active"
          value={overview ? String(overview.highPriorityActive) : '—'}
          delta="Pre-Dispatch"
          subtitle="High urgency uncertainty items"
          icon={ShieldAlert}
          accent="coral"
        />
      </div>

      {/* Main Queue Workspace */}
      <div className="rescale-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={BUCKET_TABS}
            value={bucket}
            onChange={(next) => {
              setBucket(next);
              setPage(0);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8891AA] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Order # or customer..."
                className={`${inputClass} pl-9 h-9 w-52 text-[12.5px]`}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by intervention type"
              className={`${inputClass} h-9 w-48 text-[12.5px]`}
            >
              <option value="">All Intervention Types</option>
              {INTERVENTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by priority"
              className={`${inputClass} h-9 w-36 text-[12.5px]`}
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] p-4 flex items-center justify-between gap-3 text-[13px] text-[#D13B56]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button variant="outline" size="xs" onClick={loadQueueAndOverview}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-14 text-center text-[13.5px] text-[#6E7896] font-display">
            Loading NBIE intervention recommendations...
          </div>
        ) : (queuePage.items || []).length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No NBIE recommendations in this view"
            description="Select an order in your workspace to run a deterministic pre-dispatch NBIE evaluation, or adjust your filters."
            action={
              canOperate ? (
                <Button variant="primary" size="sm" onClick={handleOpenEvaluateModal}>
                  Evaluate Workspace Order
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E9F8] text-[11px] font-display font-bold uppercase tracking-wider text-[#7D87A3]">
                  <th className="py-3 px-3">Order</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">RTO Snapshot</th>
                  <th className="py-3 px-3">Primary Recommendation</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Action Status</th>
                  <th className="py-3 px-3">Evaluated</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0FA] text-[13px]">
                {queuePage.items.map((row) => (
                  <tr
                    key={row.recommendationId}
                    onClick={() => openDetail(row.recommendationId)}
                    className="hover:bg-[#F7F8FD] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3">
                      <div className="font-display font-extrabold text-[#465478]">
                        {row.orderNumber}
                      </div>
                      <div className="text-[11.5px] text-[#7D87A3]">
                        {formatINR(row.orderValue)} · {row.paymentMethod} · Order:{' '}
                        <span className="font-mono">{row.currentOrderStatus}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-[#465478]">{row.customerName}</div>
                      <div className="text-[11.5px] font-mono text-[#7D87A3]">
                        {row.maskedPhone}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      {row.rtoBand ? (
                        <div className="flex items-center gap-1.5">
                          <Pill value={row.rtoBand} styleMap={RISK_BADGE} />
                          <span className="text-[12px] font-mono font-bold text-[#465478]">
                            {row.rtoScore}
                          </span>
                        </div>
                      ) : (
                        <Pill value={row.evaluationStatus} />
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-display font-bold text-[#545C9E]">
                        {row.primaryType
                          ? row.primaryType.replace(/_/g, ' ')
                          : row.evaluationStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <Pill value={row.primaryPriority} styleMap={PRIORITY_BADGE} />
                    </td>
                    <td className="py-3.5 px-3">
                      <Pill value={row.status} styleMap={STATUS_BADGE} />
                    </td>
                    <td className="py-3.5 px-3 text-[12px] text-[#6E7896]">
                      {formatDateTime(row.evaluatedAt)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(row.recommendationId);
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {queuePage.totalPages > 1 && (
          <div className="pt-3 border-t border-[#EEF0FA] flex items-center justify-between text-[12.5px] text-[#6E7896]">
            <span>
              Page {queuePage.page + 1} of {queuePage.totalPages} ({queuePage.totalElements} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={!queuePage.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Detail Drawer */}
      <Drawer
        open={Boolean(selectedRecId)}
        onClose={() => {
          setSelectedRecId(null);
          setDetail(null);
        }}
        title={
          rec
            ? `NBIE Recommendation · ${rec.orderId}`
            : 'NBIE Recommendation Detail'
        }
        subtitle="Explainable pre-dispatch intervention inspector (does not make final order decisions)"
      >
        {detailLoading || !rec ? (
          <div className="py-12 text-center text-[13px] text-[#6E7896]">
            Loading recommendation details...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top Order & Safe Customer Context */}
            <div className="rounded-[18px] bg-[#F8F9FE] border border-[#DFE1F5] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-display text-[16px] font-extrabold text-[#465478]">
                    {rec.orderId}
                  </span>
                  <span className="ml-2 text-[12px] text-[#6E7896]">
                    Order Lifecycle: <strong className="font-mono">{rec.currentOrderStatus}</strong> (separate from NBIE)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Pill value={rec.evaluationStatus} />
                  <Pill value={rec.status} styleMap={STATUS_BADGE} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[12px]">
                <div>
                  <div className="text-[#8891AA]">Customer</div>
                  <div className="font-bold text-[#465478]">{rec.customerName}</div>
                  <div className="font-mono text-[11px] text-[#6E7896]">{rec.maskedPhone}</div>
                </div>
                <div>
                  <div className="text-[#8891AA]">Order Value</div>
                  <div className="font-bold text-[#465478]">
                    {formatINR(rec.orderValue)} ({rec.paymentMethod})
                  </div>
                </div>
                <div>
                  <div className="text-[#8891AA]">Evidence Completeness</div>
                  <div className="font-bold text-[#465478]">{rec.evidenceCompleteness}</div>
                </div>
                <div>
                  <div className="text-[#8891AA]">Ruleset Version</div>
                  <div className="font-mono font-bold text-[#545C9E]">{rec.rulesetVersion}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E3E6FA] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6E7896]">
                <span>
                  Evaluated: {formatDateTime(rec.evaluatedAt)} · Expires:{' '}
                  {formatDateTime(rec.expiresAt)}
                </span>
                {canOperate && (
                  <Button
                    variant="outline"
                    size="xs"
                    loading={actionBusy}
                    onClick={handleRefreshRecommendation}
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh evaluation
                  </Button>
                )}
              </div>
            </div>

            {/* Authority Reminder */}
            <div className="rounded-[14px] bg-[#EEF2FF] border border-[#D5DAF7] px-3.5 py-2.5 text-[12px] text-[#465478]">
              {rec.authorityNotice}
            </div>

            {/* Conflicting / Stale / Unknown Data Warnings */}
            {(conflicts.length > 0 || staleWarnings.length > 0 || unknownWarnings.length > 0) && (
              <div className="rounded-[16px] bg-[#FFF7ED] border border-[#FDE6C9] p-3.5 space-y-1.5 text-[12px] text-[#9A3412]">
                <div className="font-display font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Evidence Quality, Freshness &amp; Missing-Data Signals
                </div>
                {conflicts.length > 0 && (
                  <div>
                    <strong>Conflicting Evidence:</strong> {conflicts.join(', ')}
                  </div>
                )}
                {staleWarnings.length > 0 && (
                  <div>
                    <strong>Freshness Warnings:</strong> {staleWarnings.join(', ')}
                  </div>
                )}
                {unknownWarnings.length > 0 && (
                  <div>
                    <strong>Unknown / Unverified Signals (Kept Null/Neutral):</strong>{' '}
                    {unknownWarnings.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Existing 4-Pillar RTO Snapshot */}
            <div className="rounded-[18px] bg-white border border-[#E3E6FA] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-[13.5px] font-bold text-[#465478]">
                  Reused Four-Pillar RTO Risk Snapshot
                </span>
                {rec.riskSnapshot ? (
                  <div className="flex items-center gap-2">
                    <Pill value={rec.riskSnapshot.band} styleMap={RISK_BADGE} />
                    <span className="font-mono font-extrabold text-[14px] text-[#465478]">
                      Score: {rec.riskSnapshot.score}/100
                    </span>
                  </div>
                ) : (
                  <span className="text-[12px] font-semibold text-[#B45309]">
                    Assessment Unavailable / Not Applicable
                  </span>
                )}
              </div>

              {rec.riskSnapshot && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px] text-[#5C6888]">
                    <div className="p-2 rounded-xl bg-[#F8F9FE]">
                      Behavioural: <strong>{rec.riskSnapshot.behaviouralPoints ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F8F9FE]">
                      Order: <strong>{rec.riskSnapshot.orderPoints ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F8F9FE]">
                      Calling Signal: <strong>{rec.riskSnapshot.callingOutcomePoints ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F8F9FE]">
                      Historical Conf.:{' '}
                      <strong>{rec.riskSnapshot.historicalConfirmationPoints ?? 0}</strong>
                    </div>
                  </div>
                  {(rec.riskSnapshot.reasonCodes || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rec.riskSnapshot.reasonCodes.map((code) => (
                        <span
                          key={code}
                          className="px-2 py-0.5 rounded-md bg-[#F4F5FC] border border-[#DFE1F5] text-[11px] font-mono text-[#545C9E]"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Customer Consent Provenance Control */}
            <div className="rounded-[18px] bg-white border border-[#E3E6FA] p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-[13px] font-bold text-[#465478]">
                    Customer Communication Consent Gate
                  </div>
                  <div className="text-[11.5px] text-[#6E7896]">
                    Unknown consent is never treated as permission to contact.
                  </div>
                </div>
                {consentInfo && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
                    Effective: {consentInfo.effectiveConsentStatus}
                    {consentInfo.dncOptedOut ? ' (DNC Active)' : ''}
                  </span>
                )}
              </div>

              {canOperate && !consentInfo?.dncOptedOut && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={consentStatusDraft}
                    onChange={(e) => setConsentStatusDraft(e.target.value)}
                    aria-label="Customer consent status"
                    className={`${inputClass} h-8 w-44 text-[12px]`}
                  >
                    <option value="GRANTED">GRANTED (Verified)</option>
                    <option value="DENIED">DENIED</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                  <Button
                    variant="outline"
                    size="xs"
                    loading={consentSaving}
                    onClick={handleSaveCustomerConsent}
                  >
                    Save Consent Provenance
                  </Button>
                </div>
              )}
            </div>

            {/* Operator Note for Action Approval / Rejection / Execution */}
            {canOperate && (
              <Field label="Optional Action Note (applies to intervention action only)">
                <input
                  type="text"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Reason for approving, rejecting, or executing this intervention action..."
                  className={`${inputClass} h-9 text-[12.5px]`}
                />
              </Field>
            )}

            {/* Primary & Secondary Recommended Actions */}
            <div className="space-y-3">
              <h4 className="font-display text-[13.5px] font-extrabold text-[#465478]">
                Ranked Recommended Interventions
              </h4>
              {rec.primaryRecommendation ? (
                renderActionCard(rec.primaryRecommendation)
              ) : (
                <div className="rounded-[16px] bg-[#F8F9FE] border border-[#E3E6FA] p-4 text-[12.5px] text-[#5C6888]">
                  No pre-dispatch interventions generated ({rec.evaluationStatus.replace(/_/g, ' ')}).
                </div>
              )}

              {(rec.secondaryRecommendations || []).map((sec) => renderActionCard(sec))}
            </div>

            {/* Feasibility Drops */}
            {droppedCandidates.length > 0 && (
              <div className="rounded-[16px] bg-[#F8F9FE] border border-[#E3E6FA] p-3.5 space-y-1.5 text-[12px]">
                <div className="font-display font-bold text-[#465478]">
                  Candidates Filtered by Consent / Policy / Caps
                </div>
                {droppedCandidates.map((d, idx) => (
                  <div key={`${d.type}-${idx}`} className="text-[#6E7896] font-mono text-[11.5px]">
                    {d.type} → suppressed ({d.dropCode})
                  </div>
                ))}
              </div>
            )}

            {/* History & Evidence Tabs */}
            <div className="space-y-3 pt-2 border-t border-[#EEF0FA]">
              <Tabs
                items={[
                  { id: 'evidence', label: 'Evidence Snapshot' },
                  { id: 'approvals', label: `Approvals (${(detail.approvals || []).length})` },
                  { id: 'executions', label: `Executions (${(detail.executions || []).length})` },
                  { id: 'outcomes', label: `Outcomes (${(detail.outcomes || []).length})` },
                  { id: 'audit', label: `Audit (${(detail.auditTrail || []).length})` },
                ]}
                value={historyTab}
                onChange={setHistoryTab}
              />

              {historyTab === 'evidence' && (
                <div className="rounded-[16px] bg-[#F8F9FE] border border-[#E3E6FA] p-3.5 text-[12px] space-y-1.5 text-[#465478]">
                  <div>
                    <strong>Cold-Start Buyer:</strong> {String(Boolean(snap.coldStartCustomer))} ·{' '}
                    <strong>Prior Orders:</strong> {snap.priorOrderCount ?? 0} ·{' '}
                    <strong>Verified Deliveries:</strong> {snap.verifiedSuccessfulDeliveryCount ?? 0}
                  </div>
                  <div>
                    <strong>Verified RTO Count:</strong>{' '}
                    {snap.verifiedRtoCount == null ? 'UNKNOWN (null)' : snap.verifiedRtoCount} ·{' '}
                    <strong>Prior COD Success Rate:</strong>{' '}
                    {snap.priorCodSuccessRate == null
                      ? 'UNKNOWN (null)'
                      : `${snap.priorCodSuccessRate}%`}
                  </div>
                  <div>
                    <strong>Address ({snap.addressFormulaVersion || 'V1'}):</strong>{' '}
                    {snap.addressCompleteness || '—'} · <strong>PIN:</strong>{' '}
                    {snap.pinValidityState || '—'} · <strong>Landmark:</strong>{' '}
                    {snap.landmarkPresence || '—'}
                  </div>
                  <div>
                    <strong>COD Confirmation:</strong> {snap.codConfirmationStatus || '—'} ·{' '}
                    <strong>Last Call Outcome:</strong> {snap.lastCallingOutcome || 'NONE'} (Attempts:{' '}
                    {snap.callingAttemptCount ?? 0})
                  </div>
                  <div>
                    <strong>Consent:</strong> {snap.consentStatus || 'UNKNOWN'} ({snap.consentSource || '—'}) ·{' '}
                    <strong>Order Contacts:</strong> {snap.orderContactCount ?? 0}
                  </div>
                </div>
              )}

              {historyTab === 'approvals' && (
                <div className="space-y-2 text-[12px]">
                  {(detail.approvals || []).length === 0 ? (
                    <div className="text-[#8891AA]">No action approvals or rejections recorded yet.</div>
                  ) : (
                    detail.approvals.map((a) => (
                      <div
                        key={a.approvalId}
                        className="rounded-xl bg-[#F8F9FE] border border-[#E3E6FA] p-3 flex justify-between gap-2"
                      >
                        <div>
                          <strong className="text-[#465478]">{a.decision}</strong> ({a.actorRole})
                          {a.note && <div className="text-[#6E7896] mt-0.5">{a.note}</div>}
                        </div>
                        <span className="text-[#8891AA]">{formatDateTime(a.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {historyTab === 'executions' && (
                <div className="space-y-2 text-[12px]">
                  {(detail.executions || []).length === 0 ? (
                    <div className="text-[#8891AA]">No sandbox executions logged yet.</div>
                  ) : (
                    detail.executions.map((ex) => (
                      <div
                        key={ex.executionId}
                        className="rounded-xl bg-[#F8F9FE] border border-[#E3E6FA] p-3 space-y-1"
                      >
                        <div className="flex justify-between">
                          <strong className="text-[#465478]">
                            {ex.adapterCode} · {ex.providerMode} ({ex.executionStatus})
                          </strong>
                          <span className="text-[#8891AA]">{formatDateTime(ex.executedAt)}</span>
                        </div>
                        <div className="font-mono text-[11px] text-[#6E7896]">
                          Channel: {ex.channel} · Ref: {ex.externalReferenceId || '—'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {historyTab === 'outcomes' && (
                <div className="space-y-2 text-[12px]">
                  {(detail.outcomes || []).length === 0 ? (
                    <div className="text-[#8891AA]">No outcomes recorded yet.</div>
                  ) : (
                    detail.outcomes.map((o) => (
                      <div
                        key={o.outcomeId}
                        className="rounded-xl bg-[#F8F9FE] border border-[#E3E6FA] p-3 flex justify-between gap-2"
                      >
                        <div>
                          <strong className="text-[#465478]">{o.outcomeType}</strong> ·{' '}
                          <span>
                            {o.verifiedResponse ? 'Verified Response' : 'Inconclusive / Unverified'}
                          </span>
                          <div className="text-[11px] text-[#6E7896]">Source: {o.outcomeSource}</div>
                        </div>
                        <span className="text-[#8891AA]">{formatDateTime(o.recordedAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {historyTab === 'audit' && (
                <div className="space-y-2 text-[12px]">
                  {(detail.auditTrail || []).map((ev) => (
                    <div
                      key={ev.eventId}
                      className="rounded-xl bg-[#F8F9FE] border border-[#E3E6FA] p-3 space-y-1"
                    >
                      <div className="flex justify-between">
                        <strong className="text-[#465478]">{ev.eventType}</strong>
                        <span className="text-[#8891AA]">{formatDateTime(ev.createdAt)}</span>
                      </div>
                      <div className="text-[#5C6888]">{ev.summary}</div>
                      <div className="font-mono text-[10.5px] text-[#8891AA]">
                        Actor: {ev.actorLabel} · Ruleset: {ev.rulesetVersion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Evaluate Workspace Order Modal */}
      <Modal
        open={evalModalOpen}
        onClose={() => setEvalModalOpen(false)}
        title="Evaluate Order in NBIE"
        subtitle="Assembles trusted order, customer, address, consent, and 4-pillar RTO signals on the server."
      >
        <form onSubmit={handleEvaluateOrder} className="space-y-4">
          {ordersLoading ? (
            <div className="py-6 text-center text-[13px] text-[#6E7896]">
              Loading merchant orders...
            </div>
          ) : workspaceOrders.length === 0 ? (
            <div className="text-[13px] text-[#6E7896]">
              No orders found in this merchant workspace yet. Create an order in Order Management first.
            </div>
          ) : (
            <Field label="Select Merchant Order">
              <select
                value={selectedOrderToEval}
                onChange={(e) => setSelectedOrderToEval(e.target.value)}
                className={inputClass}
              >
                {workspaceOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customerName} ({formatINR(o.totalAmount)} · {o.paymentMethod} ·{' '}
                    {o.orderStatus})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEvalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={evaluating}
              disabled={!selectedOrderToEval}
            >
              Evaluate Intervention
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Outcome Modal */}
      <Modal
        open={Boolean(outcomeModalItem)}
        onClose={() => setOutcomeModalItem(null)}
        title="Record Intervention Outcome"
        subtitle="Records minimized outcome provenance without changing order status or inferring fraud from silence."
      >
        <form onSubmit={handleRecordOutcomeSubmit} className="space-y-4">
          <Field label="Outcome Classification">
            <select
              value={outcomeForm.outcomeType}
              onChange={(e) =>
                setOutcomeForm((f) => ({ ...f, outcomeType: e.target.value }))
              }
              className={inputClass}
            >
              {OUTCOME_TYPES.map((ot) => (
                <option key={ot.value} value={ot.value}>
                  {ot.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Resolved Evidence Fields (comma-separated, no raw PII)">
            <input
              type="text"
              value={outcomeForm.resolvedFieldsCsv}
              onChange={(e) =>
                setOutcomeForm((f) => ({ ...f, resolvedFieldsCsv: e.target.value }))
              }
              placeholder="e.g., landmark, cod_intent_confirmation"
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] text-[#465478]">
            <input
              type="checkbox"
              checked={outcomeForm.triggerReEvaluation}
              onChange={(e) =>
                setOutcomeForm((f) => ({ ...f, triggerReEvaluation: e.target.checked }))
              }
            />
            <span>Refresh NBIE recommendation after recording outcome</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOutcomeModalItem(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={actionBusy}>
              Record outcome
            </Button>
          </div>
        </form>
      </Modal>

      {/* Merchant Policy Modal */}
      <Modal
        open={policyModalOpen && Boolean(policyForm)}
        onClose={() => setPolicyModalOpen(false)}
        title="Merchant NBIE Policy"
        subtitle="Configure permitted intervention actions, voluntary partial advance rules, and contact caps."
      >
        {policyForm && (
          <form onSubmit={handleSavePolicy} className="space-y-3.5 text-[13px]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.enabled}
                onChange={(e) => setPolicyForm({ ...policyForm, enabled: e.target.checked })}
              />
              <span>Enable NBIE pre-dispatch recommendations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.codConfirmationEnabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, codConfirmationEnabled: e.target.checked })
                }
              />
              <span>Allow COD Confirmation recommendations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.addressClarificationEnabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, addressClarificationEnabled: e.target.checked })
                }
              />
              <span>Allow Address Clarification recommendations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.humanReviewEnabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, humanReviewEnabled: e.target.checked })
                }
              />
              <span>Allow Human Review routing</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.partialAdvanceEnabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, partialAdvanceEnabled: e.target.checked })
                }
              />
              <span>Enable Voluntary Partial Advance option</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policyForm.partialAdvancePaymentCapable}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, partialAdvancePaymentCapable: e.target.checked })
                }
              />
              <span>Merchant payment link capability verified (NBIE never collects payment)</span>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Partial Advance Min Order (INR)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={policyForm.partialAdvanceMinOrderValue}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, partialAdvanceMinOrderValue: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Max Contacts Per Order">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={policyForm.maxContactsPerOrder}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, maxContactsPerOrder: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPolicyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={policySaving}>
                Save Policy
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
