import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  PhoneMissed,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  MessageSquare,
  Clock,
  ArrowUpRight,
  Settings2,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  IconTile,
  Drawer,
  Modal,
  Field,
  inputClass,
  EmptyState,
} from '../components/ui/Primitives';
import {
  fetchCallingOverview,
  fetchCallingSessions,
  fetchCallingSessionDetail,
  retryCallingSession,
  stopCallingSession,
  escalateCallingSession,
  simulateCallingOutcome,
  syncEligibleCodOrders,
  fetchCallingConfiguration,
  updateCallingConfiguration,
} from '../services/api/callingApi';
import { useAuthStore, hasMinimumRole } from '../store/useAuthStore';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

const STATUS_STYLE = {
  QUEUED: 'bg-[#EEF2FF] text-[#545C9E] border-[#DFE1F5]',
  DISPATCHING: 'bg-[#EEFBFF] text-[#0E7490] border-[#CCF2FE]',
  IN_PROGRESS: 'bg-[#EEFBFF] text-[#0E7490] border-[#CCF2FE]',
  RETRY_SCHEDULED: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  COMPLETED: 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]',
  ESCALATED: 'bg-[#F6F5FF] text-[#6D28D9] border-[#E6E5FD]',
  STOPPED: 'bg-[#F1F2F9] text-[#5C6888] border-[#DFE1F5]',
  FAILED: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
};

const OUTCOME_STYLE = {
  CONFIRMED: 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]',
  REJECTED: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
  CANCELLATION_REQUESTED: 'bg-[#FFF5F0] text-[#CC3F14] border-[#FFE4D8]',
  NO_ANSWER: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  BUSY: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  UNCERTAIN: 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]',
  INVALID_NUMBER: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
  HUMAN_ESCALATION: 'bg-[#F6F5FF] text-[#6D28D9] border-[#E6E5FD]',
  CALL_FAILED: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
};

const RISK_STYLE = {
  LOW: 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]',
  MEDIUM: 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]',
  HIGH: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
};

function BadgePill({ text, map = {}, fallback = 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]' }) {
  if (!text) return <span className="text-[12px] text-[#8891AA]">—</span>;
  const cls = map[text] || fallback;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold border ${cls}`}>
      {String(text).replace(/_/g, ' ')}
    </span>
  );
}

export function CallingIntelligencePage() {
  const currentRole = useAuthStore((s) => s.currentRole);
  const addToast = useOrdexaStore((s) => s.addToast);
  const canOperate = hasMinimumRole(currentRole, 'OPERATOR');
  const canConfigure = hasMinimumRole(currentRole, 'ADMIN');

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [queuePage, setQueuePage] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  // Selected session detail drawer
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('transcript');
  const [actionBusy, setActionBusy] = useState(false);
  const [stopOptOut, setStopOptOut] = useState(false);

  // Configuration modal
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    setErrorMsg('');
    setOverviewLoading(true);
    setQueueLoading(true);
    try {
      const [ov, q] = await Promise.all([
        fetchCallingOverview(),
        fetchCallingSessions({
          search,
          status: statusFilter || undefined,
          outcome: outcomeFilter || undefined,
          riskBand: riskFilter || undefined,
          fromDate: fromDate ? new Date(`${fromDate}T00:00:00Z`).toISOString() : undefined,
          toDate: toDate ? new Date(`${toDate}T23:59:59Z`).toISOString() : undefined,
          page,
          size: 15,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
      ]);
      setOverview(ov);
      setQueuePage(q);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load Calling Intelligence data');
    } finally {
      setOverviewLoading(false);
      setQueueLoading(false);
    }
  }, [search, statusFilter, outcomeFilter, riskFilter, fromDate, toDate, page]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const openSessionDetail = useCallback(async (sessionId) => {
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    try {
      const detail = await fetchCallingSessionDetail(sessionId);
      setSessionDetail(detail);
    } catch (err) {
      addToast({
        title: 'Unable to load call details',
        message: err?.message || 'Request failed',
        tone: 'danger',
      });
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  const handleSyncEligible = async () => {
    setActionBusy(true);
    try {
      const res = await syncEligibleCodOrders(true);
      addToast({
        title: 'COD Queue Synchronized',
        message: `Enrolled ${res.newlyEnrolledCount} unverified COD order(s) (${res.alreadyEnrolledCount} already in queue).`,
        tone: 'success',
      });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Sync failed', message: err?.message || 'Error', tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRetry = async (sessionId) => {
    setActionBusy(true);
    try {
      const updated = await retryCallingSession(sessionId, {});
      setSessionDetail(updated);
      addToast({ title: 'Call Initiated', message: 'Outbound COD verification attempt started.', tone: 'success' });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Retry blocked', message: err?.message || 'Error', tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleStopCalls = async (sessionId) => {
    setActionBusy(true);
    try {
      const updated = await stopCallingSession(sessionId, {
        reason: stopOptOut ? 'Customer DNC opt-out recorded by operator' : 'Stopped manually by merchant operator',
        optOutCustomer: stopOptOut,
      });
      setSessionDetail(updated);
      addToast({ title: 'Future Calls Stopped', message: 'Automated retries disabled for this order.', tone: 'info' });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Stop action failed', message: err?.message || 'Error', tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleEscalate = async (sessionId) => {
    setActionBusy(true);
    try {
      const updated = await escalateCallingSession(sessionId, {
        reason: 'Escalated to human operations specialist from Calling Intelligence console',
      });
      setSessionDetail(updated);
      addToast({ title: 'Escalated to Human', message: 'Routed to support specialist queue.', tone: 'info' });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Escalation failed', message: err?.message || 'Error', tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSimulateOutcome = async (sessionId, outcome) => {
    setActionBusy(true);
    try {
      const updated = await simulateCallingOutcome(sessionId, { outcome });
      setSessionDetail(updated);
      addToast({
        title: `Simulated: ${outcome.replace(/_/g, ' ')}`,
        message: 'Order status, Customer 360 events, and 4-pillar RTO risk updated.',
        tone: 'success',
      });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Simulation failed', message: err?.message || 'Error', tone: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  const openConfigModal = async () => {
    try {
      const cfg = await fetchCallingConfiguration();
      setConfigForm({
        ...cfg,
        supportedLanguagesText: (cfg.supportedLanguages || []).join(','),
      });
      setConfigOpen(true);
    } catch (err) {
      addToast({ title: 'Failed to load settings', message: err?.message || 'Error', tone: 'danger' });
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!configForm) return;
    setConfigSaving(true);
    try {
      await updateCallingConfiguration({
        enabled: Boolean(configForm.enabled),
        provider: configForm.provider,
        defaultLanguage: configForm.defaultLanguage,
        supportedLanguages: configForm.supportedLanguagesText || 'hi-IN,en-IN',
        maxAttempts: Number(configForm.maxAttempts),
        retryBackoffMinutes1: Number(configForm.retryBackoffMinutes1),
        retryBackoffMinutes2: Number(configForm.retryBackoffMinutes2),
        callTimeoutSeconds: Number(configForm.callTimeoutSeconds),
        dndStartHourIst: Number(configForm.dndStartHourIst),
        dndEndHourIst: Number(configForm.dndEndHourIst),
        autoConfirmOrderOnYes: Boolean(configForm.autoConfirmOrderOnYes),
        autoCancelOrderOnRequest: Boolean(configForm.autoCancelOrderOnRequest),
      });
      setConfigOpen(false);
      addToast({ title: 'Configuration Saved', message: 'Merchant calling policy updated.', tone: 'success' });
      await loadWorkspaceData();
    } catch (err) {
      addToast({ title: 'Save failed', message: err?.message || 'Validation error', tone: 'danger' });
    } finally {
      setConfigSaving(false);
    }
  };

  const kpiCards = [
    {
      label: 'COD Orders Requiring Verification',
      value: overview?.totalCodOrdersRequiringVerification ?? '—',
      sub: `${overview?.callsQueuedOrScheduled ?? 0} currently queued / scheduled`,
      icon: PhoneCall,
      tone: 'peri',
      color: 'text-[#465478]',
    },
    {
      label: 'Calls Initiated',
      value: overview?.callsInitiated ?? '—',
      sub: 'Total outbound dial attempts',
      icon: PhoneForwarded,
      tone: 'cyan',
      color: 'text-[#0E7490]',
    },
    {
      label: 'Calls Completed',
      value: overview?.callsCompleted ?? '—',
      sub: `${overview?.escalatedCalls ?? 0} escalated to human`,
      icon: UserCheck,
      tone: 'indigo',
      color: 'text-[#545C9E]',
    },
    {
      label: 'Confirmed Orders',
      value: overview?.confirmedOrders ?? '—',
      sub: 'Verified COD intent & address',
      icon: CheckCircle2,
      tone: 'emerald',
      color: 'text-[#17825B]',
    },
    {
      label: 'Rejected Orders',
      value: overview?.rejectedOrders ?? '—',
      sub: 'Buyer denied placing order',
      icon: XCircle,
      tone: 'rose',
      color: 'text-[#D13B56]',
    },
    {
      label: 'Unanswered Calls',
      value: overview?.unansweredCalls ?? '—',
      sub: 'No answer / busy (neutral signal)',
      icon: PhoneMissed,
      tone: 'amber',
      color: 'text-[#B45309]',
    },
    {
      label: 'Cancellation Requests',
      value: overview?.cancellationRequests ?? '—',
      sub: 'Pre-dispatch buyer cancellations',
      icon: PhoneOff,
      tone: 'coral',
      color: 'text-[#CC3F14]',
    },
    {
      label: 'Failed / Invalid Calls',
      value: overview?.failedCalls ?? '—',
      sub: 'Invalid numbers or trunk errors',
      icon: AlertTriangle,
      tone: 'rose',
      color: 'text-[#D13B56]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Voice Verification · Hindi & English"
        title="Calling Intelligence"
        description="Automated outbound voice verification for every eligible Cash-on-Delivery order—independent of RTO risk score—with structured outcomes, transcripts, and 4-pillar risk feedback."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {canOperate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncEligible}
                loading={actionBusy}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync Eligible COD Orders
              </Button>
            )}
            {canConfigure && (
              <Button variant="secondary" size="sm" onClick={openConfigModal}>
                <Settings2 className="w-3.5 h-3.5" /> Calling Policy
              </Button>
            )}
          </div>
        }
      />

      {/* Universal COD Invariant & TRAI Compliance Strip */}
      <div className="rescale-card px-5 py-3.5 border border-[#DFE1F5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <IconTile icon={ShieldCheck} tone="emerald" size="sm" />
          <div className="text-[13px] text-[#465478]">
            <strong className="font-display font-extrabold">Universal COD Verification Active:</strong>{' '}
            Every eligible COD order (Low, Medium, and High RTO risk) enters the calling workflow automatically.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-display font-bold">
          <span className="px-3 py-1 rounded-full bg-[#F4F5FC] text-[#545C9E] border border-[#DFE1F5]">
            Provider: {overview?.activeProvider || 'SANDBOX'}
          </span>
          <span
            className={`px-3 py-1 rounded-full border ${
              overview?.inDndWindowNow
                ? 'bg-[#FFF7ED] text-[#B45309] border-[#FDE6C9]'
                : 'bg-[#EEFCF6] text-[#17825B] border-[#CCF4E3]'
            }`}
          >
            {overview?.inDndWindowNow
              ? 'TRAI DND Window Active (Deferring to 09:05 IST)'
              : 'TRAI Calling Window Open (09:05–21:00 IST)'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-[18px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-center justify-between gap-3 text-[13px] text-[#D13B56]">
          <span>{errorMsg}</span>
          <Button variant="outline" size="xs" onClick={loadWorkspaceData}>
            Retry
          </Button>
        </div>
      )}

      {/* 8 Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="rescale-card rescale-card-hover min-h-[112px] px-4 py-3.5 flex items-center gap-3.5 border border-[#E3E6FA]"
          >
            <IconTile icon={kpi.icon} tone={kpi.tone} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] font-display font-extrabold uppercase tracking-[0.06em] text-[#5C6888] truncate">
                  {kpi.label}
                </span>
                <span className={`font-display text-[24px] font-black num leading-none shrink-0 ${kpi.color}`}>
                  {overviewLoading ? '…' : kpi.value}
                </span>
              </div>
              <div className="text-[12px] text-[#6E7896] truncate mt-1.5">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Calling Queue */}
      <div className="rescale-card p-5 border border-[#E3E6FA] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-[#465478]">
              COD Verification Calling Queue
            </h2>
            <p className="text-[12.5px] text-[#7C86A2]">
              Click any call session to inspect conversation transcripts, attempts, timeline, and 4-pillar RTO risk signals.
            </p>
          </div>
          <Button variant="ghost" size="xs" onClick={loadWorkspaceData}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-[#8891AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search order ID, buyer name, or phone…"
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setPage(0);
            }}
            className={inputClass}
            aria-label="Filter by outcome"
          >
            <option value="">All Outcomes</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLATION_REQUESTED">Cancellation Requested</option>
            <option value="NO_ANSWER">No Answer</option>
            <option value="BUSY">Busy</option>
            <option value="UNCERTAIN">Uncertain</option>
            <option value="HUMAN_ESCALATION">Human Escalation</option>
            <option value="INVALID_NUMBER">Invalid Number</option>
            <option value="CALL_FAILED">Call Failed</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className={inputClass}
            aria-label="Filter by status"
          >
            <option value="">All Queue Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RETRY_SCHEDULED">Retry Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="ESCALATED">Escalated</option>
            <option value="STOPPED">Stopped</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setPage(0);
            }}
            className={inputClass}
            aria-label="Filter by RTO risk level"
          >
            <option value="">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className={inputClass}
            title="Filter from date"
          />
        </div>

        {queueLoading ? (
          <div className="py-12 text-center text-[13.5px] text-[#7C86A2]">
            Loading COD calling queue…
          </div>
        ) : !queuePage?.items?.length ? (
          <EmptyState
            icon={PhoneCall}
            title="No COD call sessions match your current filters"
            description="Every newly created Cash-on-Delivery order automatically appears here. You can also click 'Sync Eligible COD Orders' to enroll existing CREATED COD orders."
            action={
              canOperate && (
                <Button variant="primary" size="sm" onClick={handleSyncEligible}>
                  <Sparkles className="w-4 h-4" /> Sync Eligible COD Orders
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E9F8] text-[11px] font-display font-extrabold uppercase tracking-wider text-[#7C86A2]">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Order Value</th>
                  <th className="py-3 px-3">RTO Risk</th>
                  <th className="py-3 px-3">Calling Status</th>
                  <th className="py-3 px-3">Outcome</th>
                  <th className="py-3 px-3">Attempts</th>
                  <th className="py-3 px-3">Last Call</th>
                  <th className="py-3 px-3">Next Attempt</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF0FA] text-[13px]">
                {queuePage.items.map((row) => (
                  <tr
                    key={row.sessionId}
                    onClick={() => openSessionDetail(row.sessionId)}
                    className="hover:bg-[#F7F8FE] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-[#465478]">
                      <div>{row.orderNumber}</div>
                      <div className="text-[11px] font-sans font-normal text-[#8891AA]">
                        {row.orderStatus}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-[#465478]">{row.customerName}</div>
                      <div className="text-[11.5px] font-mono text-[#7C86A2]">{row.maskedPhone}</div>
                    </td>
                    <td className="py-3.5 px-3 font-display font-bold text-[#465478] num">
                      {formatINR(row.orderAmount, true)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[12px] text-[#465478] num">
                          {row.rtoRiskScore}
                        </span>
                        <BadgePill text={row.rtoRiskBand} map={RISK_STYLE} />
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <BadgePill text={row.status} map={STATUS_STYLE} />
                    </td>
                    <td className="py-3.5 px-3">
                      <BadgePill text={row.outcome} map={OUTCOME_STYLE} />
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[12.5px] text-[#545C9E]">
                      {row.attemptCount} / {row.maxAttempts}
                    </td>
                    <td className="py-3.5 px-3 text-[12px] text-[#6E7896]">
                      {row.lastAttemptAt ? formatDateTime(row.lastAttemptAt) : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-[12px] text-[#6E7896]">
                      {row.nextAttemptAt ? formatDateTime(row.nextAttemptAt) : '—'}
                    </td>
                    <td
                      className="py-3.5 px-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openSessionDetail(row.sessionId)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {queuePage && queuePage.totalPages > 1 && (
          <div className="pt-3 border-t border-[#EEF0FA] flex items-center justify-between text-[12.5px] text-[#6E7896]">
            <span>
              Page {queuePage.page + 1} of {queuePage.totalPages} ({queuePage.totalElements} COD sessions)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
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

      {/* Call Session Detail Drawer */}
      <Drawer
        open={Boolean(selectedSessionId)}
        onClose={() => {
          setSelectedSessionId(null);
          setSessionDetail(null);
        }}
        title={
          sessionDetail
            ? `Call Verification · ${sessionDetail.session.orderNumber}`
            : 'Call Session Details'
        }
        subtitle={
          sessionDetail
            ? `${sessionDetail.session.customerName} (${sessionDetail.session.maskedPhone}) · Language: ${sessionDetail.session.language}`
            : 'Loading session…'
        }
      >
        {detailLoading || !sessionDetail ? (
          <div className="py-12 text-center text-[13.5px] text-[#7C86A2]">
            Loading call session intelligence…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top Status & Quick Links */}
            <div className="rounded-[18px] bg-[#F9FAFB] border border-[#DFE1F5] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <BadgePill text={sessionDetail.session.status} map={STATUS_STYLE} />
                  {sessionDetail.session.outcome && (
                    <BadgePill text={sessionDetail.session.outcome} map={OUTCOME_STYLE} />
                  )}
                  {sessionDetail.customerOptedOut && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF0F2] text-[#D13B56] border border-[#FECDD6]">
                      DNC Opt-Out Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/app/orders">
                    <Button variant="outline" size="xs">
                      View Order <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Link to="/app/graph">
                    <Button variant="ghost" size="xs">
                      Customer 360
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[12.5px]">
                <div className="rounded-xl bg-white border border-[#E6E9F8] p-2.5">
                  <div className="text-[10.5px] uppercase font-bold text-[#8891AA]">Order Amount</div>
                  <div className="font-display font-extrabold text-[#465478] mt-0.5 num">
                    {formatINR(sessionDetail.session.orderAmount, true)} (COD)
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-[#E6E9F8] p-2.5">
                  <div className="text-[10.5px] uppercase font-bold text-[#8891AA]">Order Status</div>
                  <div className="font-display font-extrabold text-[#545C9E] mt-0.5">
                    {sessionDetail.session.orderStatus}
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-[#E6E9F8] p-2.5">
                  <div className="text-[10.5px] uppercase font-bold text-[#8891AA]">Attempts</div>
                  <div className="font-mono font-bold text-[#465478] mt-0.5">
                    {sessionDetail.session.attemptCount} / {sessionDetail.session.maxAttempts}
                  </div>
                </div>
              </div>

              <div className="text-[12px] text-[#5C6888]">
                <strong>Shipping Address:</strong> {sessionDetail.shippingAddress}
              </div>
              {sessionDetail.orderItems?.length > 0 && (
                <div className="text-[12px] text-[#5C6888]">
                  <strong>Items:</strong>{' '}
                  {sessionDetail.orderItems
                    .map((i) => `${i.productName} ×${i.quantity} (${i.sku})`)
                    .join(', ')}
                </div>
              )}
            </div>

            {/* AI Conversation Summary, Customer Intent & Recommended Next Action */}
            <div className="rounded-[18px] bg-white border border-[#DFE1F5] p-4 space-y-2.5">
              <div className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#545C9E]">
                AI Verification Summary & Next Action
              </div>
              <div className="text-[13px] text-[#465478] leading-relaxed">
                {sessionDetail.aiSummary ||
                  'Call has not yet concluded with a conversational summary. Initiate or await scheduled verification call.'}
              </div>
              {sessionDetail.customerIntent && (
                <div className="text-[12.5px] text-[#5C6888]">
                  <strong>Detected Customer Intent:</strong> {sessionDetail.customerIntent}
                </div>
              )}
              <div className="rounded-xl bg-[#F4F5FC] border border-[#DFE1F5] px-3.5 py-2.5 text-[12.5px] text-[#465478]">
                <strong>Recommended Action:</strong>{' '}
                {sessionDetail.rtoAssessment?.recommendedAction || sessionDetail.session.recommendedAction}
              </div>
            </div>

            {/* 4-Pillar RTO Intelligence Assessment */}
            {sessionDetail.rtoAssessment && (
              <div className="rounded-[18px] bg-white border border-[#DFE1F5] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#545C9E]">
                    4-Pillar RTO Risk Intelligence
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] font-extrabold text-[#465478]">
                      Score: {sessionDetail.rtoAssessment.totalRiskScore}/100
                    </span>
                    <BadgePill text={sessionDetail.rtoAssessment.riskBand} map={RISK_STYLE} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E6E9F8] p-2.5">
                    <div className="text-[#8891AA] font-bold">Behavioural</div>
                    <div className="font-mono font-bold text-[#465478] mt-0.5">
                      {sessionDetail.rtoAssessment.behaviouralRiskPoints >= 0 ? '+' : ''}
                      {sessionDetail.rtoAssessment.behaviouralRiskPoints}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E6E9F8] p-2.5">
                    <div className="text-[#8891AA] font-bold">Order Risk</div>
                    <div className="font-mono font-bold text-[#465478] mt-0.5">
                      {sessionDetail.rtoAssessment.orderRiskPoints >= 0 ? '+' : ''}
                      {sessionDetail.rtoAssessment.orderRiskPoints}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E6E9F8] p-2.5">
                    <div className="text-[#8891AA] font-bold">Call Outcome</div>
                    <div className="font-mono font-bold text-[#545C9E] mt-0.5">
                      {sessionDetail.rtoAssessment.callingOutcomePoints >= 0 ? '+' : ''}
                      {sessionDetail.rtoAssessment.callingOutcomePoints}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E6E9F8] p-2.5">
                    <div className="text-[#8891AA] font-bold">Call History</div>
                    <div className="font-mono font-bold text-[#465478] mt-0.5">
                      {sessionDetail.rtoAssessment.historicalConfirmationPoints >= 0 ? '+' : ''}
                      {sessionDetail.rtoAssessment.historicalConfirmationPoints}
                    </div>
                  </div>
                </div>

                {sessionDetail.rtoAssessment.reasons?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {sessionDetail.rtoAssessment.reasons.map((r) => (
                      <div
                        key={r.code}
                        className="flex items-start justify-between gap-2 text-[12px] bg-[#F9FAFB] rounded-lg px-3 py-2 border border-[#EEF0FA]"
                      >
                        <div>
                          <span className="font-semibold text-[#465478]">{r.label}</span>{' '}
                          <span className="text-[10.5px] uppercase text-[#8891AA]">({r.pillar})</span>
                          <div className="text-[11.5px] text-[#6E7896]">{r.explanation}</div>
                        </div>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            r.scoreDelta < 0
                              ? 'text-[#17825B]'
                              : r.scoreDelta > 0
                              ? 'text-[#D13B56]'
                              : 'text-[#6E7896]'
                          }`}
                        >
                          {r.scoreDelta > 0 ? `+${r.scoreDelta}` : r.scoreDelta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Operator Controls */}
            {canOperate && (
              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#DFE1F5] p-4 space-y-3">
                <div className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#545C9E]">
                  Merchant Call Controls
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="xs"
                    disabled={actionBusy || sessionDetail.session.doNotCallFurther}
                    onClick={() => handleRetry(sessionDetail.session.sessionId)}
                  >
                    <Play className="w-3.5 h-3.5" /> Retry / Initiate Call
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={actionBusy}
                    onClick={() => handleEscalate(sessionDetail.session.sessionId)}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Escalate to Human
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={actionBusy || sessionDetail.session.doNotCallFurther}
                    onClick={() => handleStopCalls(sessionDetail.session.sessionId)}
                  >
                    <Square className="w-3.5 h-3.5" /> Stop Future Calls
                  </Button>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] text-[#6E7896] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stopOptOut}
                    onChange={(e) => setStopOptOut(e.target.checked)}
                    className="rounded border-[#C5CAEC]"
                  />
                  Also add customer phone to workspace Do-Not-Call (opt-out) when stopping calls
                </label>

                {overview?.activeProvider === 'SANDBOX' && (
                  <div className="pt-3 border-t border-[#E6E9F8] space-y-2">
                    <div className="text-[11px] font-display font-bold uppercase text-[#0E7490]">
                      Sandbox Outcome Simulator (Development / Testing Only — Zero PSTN Calls)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'CONFIRMED', label: 'Simulate Confirmed' },
                        { id: 'REJECTED', label: 'Simulate Rejected' },
                        { id: 'NO_ANSWER', label: 'Simulate No Answer' },
                        { id: 'CANCELLATION_REQUESTED', label: 'Simulate Cancellation' },
                        { id: 'HUMAN_ESCALATION', label: 'Simulate Escalation' },
                      ].map((sim) => (
                        <Button
                          key={sim.id}
                          variant="outline"
                          size="xs"
                          disabled={actionBusy}
                          onClick={() =>
                            handleSimulateOutcome(sessionDetail.session.sessionId, sim.id)
                          }
                        >
                          {sim.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs: Transcript | Call Attempts | Timeline */}
            <div className="space-y-3">
              <div className="inline-flex rounded-full bg-[#F1F2F9] p-1 border border-[#DFE1F5]">
                {[
                  { id: 'transcript', label: `Transcript (${sessionDetail.transcript?.length || 0})` },
                  { id: 'attempts', label: `Attempts (${sessionDetail.attempts?.length || 0})` },
                  { id: 'timeline', label: `Timeline (${sessionDetail.timeline?.length || 0})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-display font-bold transition-colors ${
                      detailTab === t.id
                        ? 'bg-white text-[#465478] shadow-sm'
                        : 'text-[#6E7896] hover:text-[#465478]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailTab === 'transcript' && (
                <div className="space-y-2.5">
                  {!sessionDetail.transcript?.length ? (
                    <div className="rounded-2xl bg-[#F9FAFB] border border-[#EEF0FA] p-6 text-center text-[13px] text-[#7C86A2]">
                      No conversation utterances recorded yet for this session.
                    </div>
                  ) : (
                    sessionDetail.transcript.map((turn) => (
                      <div
                        key={turn.transcriptId}
                        className={`rounded-2xl p-3.5 border text-[13px] ${
                          turn.speakerRole === 'AGENT'
                            ? 'bg-[#F4F5FC] border-[#DFE1F5] text-[#465478]'
                            : turn.speakerRole === 'CUSTOMER'
                            ? 'bg-white border-[#CCF4E3] text-[#1E293B]'
                            : 'bg-[#F9FAFB] border-[#EEF0FA] text-[#6E7896]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#7C86A2] mb-1">
                          <span>
                            {turn.speakerRole === 'AGENT'
                              ? 'NORTHSTAR Voice Agent (Priya)'
                              : turn.speakerRole === 'CUSTOMER'
                              ? sessionDetail.session.customerName
                              : turn.speakerRole}
                          </span>
                          <span>
                            {turn.language || ''}
                            {turn.confidence != null ? ` · STT ${Math.round(turn.confidence * 100)}%` : ''}
                          </span>
                        </div>
                        <div className="leading-relaxed">{turn.utteranceText}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === 'attempts' && (
                <div className="space-y-2.5">
                  {!sessionDetail.attempts?.length ? (
                    <div className="rounded-2xl bg-[#F9FAFB] border border-[#EEF0FA] p-6 text-center text-[13px] text-[#7C86A2]">
                      No dial attempts initiated yet.
                    </div>
                  ) : (
                    sessionDetail.attempts.map((att) => (
                      <div
                        key={att.attemptId}
                        className="rounded-2xl bg-white border border-[#DFE1F5] p-3.5 text-[12.5px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-extrabold text-[#465478]">
                            Attempt #{att.attemptNumber} · {att.provider}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <BadgePill text={att.status} map={STATUS_STYLE} />
                            {att.outcome && <BadgePill text={att.outcome} map={OUTCOME_STYLE} />}
                          </div>
                        </div>
                        <div className="text-[#6E7896] flex flex-wrap gap-x-4 gap-y-1">
                          <span>Language: {att.language}</span>
                          <span>
                            Duration: {att.durationSeconds != null ? `${att.durationSeconds}s` : '—'}
                          </span>
                          <span>Started: {formatDateTime(att.startedAt)}</span>
                        </div>
                        {att.roomName && (
                          <div className="font-mono text-[11px] text-[#8891AA]">
                            Room: {att.roomName}
                          </div>
                        )}
                        {att.failureReason && (
                          <div className="text-[12px] text-[#D13B56]">Reason: {att.failureReason}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === 'timeline' && (
                <div className="space-y-2">
                  {sessionDetail.timeline?.map((ev) => (
                    <div
                      key={ev.eventId}
                      className="rounded-xl bg-[#F9FAFB] border border-[#EEF0FA] px-3.5 py-2.5 text-[12.5px]"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#7C86A2]">
                        <span className="font-mono font-bold text-[#545C9E]">{ev.eventType}</span>
                        <span>{formatDateTime(ev.createdAt)}</span>
                      </div>
                      <div className="text-[#465478] mt-0.5">{ev.details}</div>
                      <div className="text-[11px] text-[#8891AA] mt-0.5">Actor: {ev.actor}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Merchant Calling Policy Configuration Modal */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Merchant AI Calling Policy"
        subtitle="Configure voice provider, retry intervals, TRAI calling hours, and order automation."
      >
        {configForm && (
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Voice Provider">
                <select
                  value={configForm.provider}
                  onChange={(e) => setConfigForm({ ...configForm, provider: e.target.value })}
                  className={inputClass}
                >
                  <option value="SANDBOX">SANDBOX (Safe Simulator)</option>
                  <option value="VOICE_SERVICE">VOICE_SERVICE (LiveKit + Sarvam AI)</option>
                </select>
              </Field>
              <Field label="Default Language">
                <select
                  value={configForm.defaultLanguage}
                  onChange={(e) => setConfigForm({ ...configForm, defaultLanguage: e.target.value })}
                  className={inputClass}
                >
                  <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
                  <option value="en-IN">Indian English (en-IN)</option>
                </select>
              </Field>
              <Field label="Max Call Attempts">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={configForm.maxAttempts}
                  onChange={(e) => setConfigForm({ ...configForm, maxAttempts: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Call Ring/Session Timeout (sec)">
                <input
                  type="number"
                  min={15}
                  max={600}
                  value={configForm.callTimeoutSeconds}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, callTimeoutSeconds: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Retry #1 Backoff (minutes)">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={configForm.retryBackoffMinutes1}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, retryBackoffMinutes1: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Retry #2 Backoff (minutes)">
                <input
                  type="number"
                  min={1}
                  max={2880}
                  value={configForm.retryBackoffMinutes2}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, retryBackoffMinutes2: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="space-y-2 pt-1 text-[13px] text-[#465478]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.enabled}
                  onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                />
                <span>Enable automatic COD calling queue enrollment for all new COD orders</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.autoConfirmOrderOnYes}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, autoConfirmOrderOnYes: e.target.checked })
                  }
                />
                <span>Automatically transition CREATED → CONFIRMED when buyer confirms on call</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.autoCancelOrderOnRequest}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, autoCancelOrderOnRequest: e.target.checked })
                  }
                />
                <span>Automatically transition CREATED → CANCELLED when buyer requests cancellation</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#EEF0FA]">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfigOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={configSaving}>
                Save Policy
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
