import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Shield,
  Bell,
  RotateCcw,
  Building2,
  Users,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Tabs,
  ConfirmDialog,
  Hint,
  Field,
  inputClass,
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { useAuthStore, hasMinimumRole } from '../store/useAuthStore';
import {
  fetchCurrentMerchantWorkspace,
  fetchWorkspaceMembers,
  updateMerchantBusinessName,
  addWorkspaceMember,
} from '../services/api/workspaceApi';
import { formatINR, formatDateTime } from '../utils/formatters';

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[#EEF0FA] last:border-b-0">
      <div>
        <div className="font-display text-[14px] font-bold text-[#465478]">{title}</div>
        <p className="text-[12.5px] text-[#7C86A2] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${checked ? 'bg-[#7584D6]' : 'bg-[#D8DDF0]'
          }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const orders = useOrdexaStore((s) => s.orders);
  const automationRules = useOrdexaStore((s) => s.automationRules);
  const privacySettings = useOrdexaStore((s) => s.privacySettings);
  const notificationPrefs = useOrdexaStore((s) => s.notificationPrefs);

  const updateAutomationRule = useOrdexaStore((s) => s.updateAutomationRule);
  const updatePrivacySetting = useOrdexaStore((s) => s.updatePrivacySetting);
  const updateNotificationPref = useOrdexaStore((s) => s.updateNotificationPref);
  const resetDemoData = useOrdexaStore((s) => s.resetDemoData);
  const addToast = useOrdexaStore((s) => s.addToast);

  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const currentRole = useAuthStore((s) => s.currentRole);
  const refreshWorkspaces = useAuthStore((s) => s.refreshWorkspaces);

  const [activeTab, setActiveTab] = useState('workspace');
  const [confirmReset, setConfirmReset] = useState(false);

  const [workspaceDetail, setWorkspaceDetail] = useState(null);
  const [members, setMembers] = useState([]);
  const [businessNameInput, setBusinessNameInput] = useState(
    activeWorkspace?.businessName || ''
  );
  const [wsError, setWsError] = useState(null);
  const [wsSuccess, setWsSuccess] = useState(null);
  const [savingName, setSavingName] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    initialPassword: 'StrongPassword123!',
    role: 'VIEWER',
  });
  const [inviting, setInviting] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    try {
      const [detail, memberList] = await Promise.all([
        fetchCurrentMerchantWorkspace(),
        fetchWorkspaceMembers(activeWorkspace.merchantId),
      ]);
      setWorkspaceDetail(detail);
      setBusinessNameInput(detail?.businessName || activeWorkspace.businessName);
      setMembers(memberList || []);
    } catch (err) {
      setWsError(err.message || 'Unable to load workspace details');
    }
  }, [activeWorkspace?.merchantId, activeWorkspace?.businessName]);

  useEffect(() => {
    if (activeTab === 'workspace' && activeWorkspace?.merchantId) {
      loadWorkspaceData();
    }
  }, [activeTab, activeWorkspace?.merchantId, loadWorkspaceData]);

  const handleUpdateBusinessName = async (e) => {
    e.preventDefault();
    if (!activeWorkspace?.merchantId) return;
    setWsError(null);
    setWsSuccess(null);
    setSavingName(true);
    try {
      const updated = await updateMerchantBusinessName(
        activeWorkspace.merchantId,
        businessNameInput.trim()
      );
      setWorkspaceDetail(updated);
      await refreshWorkspaces();
      setWsSuccess(`Updated business name to "${updated.businessName}"`);
      addToast('Workspace name updated in PostgreSQL', 'success');
    } catch (err) {
      setWsError(err.message || 'Failed to update business name');
    } finally {
      setSavingName(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!activeWorkspace?.merchantId) return;
    setWsError(null);
    setWsSuccess(null);
    setInviting(true);
    try {
      const created = await addWorkspaceMember(activeWorkspace.merchantId, inviteForm);
      setMembers((prev) => [...prev, created]);
      setInviteForm({
        fullName: '',
        email: '',
        initialPassword: 'StrongPassword123!',
        role: 'VIEWER',
      });
      setWsSuccess(`Added ${created.email} as ${created.role}`);
      addToast(`Added ${created.fullName} (${created.role}) to workspace`, 'success');
    } catch (err) {
      setWsError(err.message || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const highCount = orders.filter((o) => o.attentionLevel === 'HIGH').length;
  const mediumCount = orders.filter((o) => o.attentionLevel === 'MEDIUM').length;
  const isOwner = hasMinimumRole(currentRole, 'OWNER');
  const isAdminOrOwner = hasMinimumRole(currentRole, 'ADMIN');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance · Multi-Tenant Workspace & Rules"
        title="Workspace"
        accentWord="Settings"
        subtitle="Manage your PostgreSQL-backed merchant workspace, role-based team memberships, and pre-dispatch RTO scoring thresholds."
        icon={SettingsIcon}
        iconTone="peri"
        actions={
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Order Sandbox
          </Button>
        }
      />

      <Tabs
        items={[
          { id: 'workspace', label: 'Workspace & Team (PostgreSQL)' },
          { id: 'rules', label: 'Scoring & Automation Rules' },
          { id: 'privacy', label: 'Privacy & Data Governance' },
          { id: 'notifications', label: 'Operator Notifications' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'workspace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Merchant Profile & RBAC Update */}
          <div className="lg:col-span-6 rescale-card p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#EEF0FA]">
              <Building2 className="w-5 h-5 text-[#7584D6]" />
              <div>
                <h3 className="font-display text-[17px] font-bold text-[#465478]">
                  Active Merchant Workspace (PostgreSQL)
                </h3>
                <p className="text-[12.5px] text-[#8891AA]">
                  Tenant-isolated workspace record and role permissions
                </p>
              </div>
            </div>

            {wsError && (
              <div
                role="alert"
                data-testid="workspace-settings-error"
                className="rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#D13B56] font-display font-semibold"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{wsError}</span>
              </div>
            )}

            {wsSuccess && (
              <div
                data-testid="workspace-settings-success"
                className="rounded-[16px] bg-[#ECFEF6] border border-[#C3F3DE] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#17825B] font-display font-semibold"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{wsSuccess}</span>
              </div>
            )}

            <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4 space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-[#8891AA]">Merchant UUID</span>
                <span className="font-mono font-bold text-[#465478]">
                  {workspaceDetail?.merchantId || activeWorkspace?.merchantId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8891AA]">Business Slug</span>
                <span className="font-mono text-[#545C9E]">
                  {workspaceDetail?.businessSlug || activeWorkspace?.businessSlug}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8891AA]">Your Workspace Role</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
                  {currentRole}
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdateBusinessName} className="space-y-4">
              <Field
                label="Business Display Name"
                hint={
                  isOwner
                    ? 'As OWNER, you can rename this merchant workspace.'
                    : `Only an OWNER can rename the workspace (your current role is ${currentRole}).`
                }
              >
                <input
                  type="text"
                  data-testid="settings-business-name-input"
                  value={businessNameInput}
                  onChange={(e) => setBusinessNameInput(e.target.value)}
                  disabled={!isOwner}
                  className={inputClass}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingName}
                disabled={!isOwner}
                data-testid="settings-save-business-name-btn"
              >
                Save Workspace Name (OWNER Only)
              </Button>
            </form>
          </div>

          {/* Right: Team Memberships & RBAC Invitations */}
          <div className="lg:col-span-6 rescale-card p-6 sm:p-7 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#EEF0FA]">
              <Users className="w-5 h-5 text-[#7584D6]" />
              <div>
                <h3 className="font-display text-[17px] font-bold text-[#465478]">
                  Workspace Team Memberships ({members.length})
                </h3>
                <p className="text-[12.5px] text-[#8891AA]">
                  Role-based access control across OWNER, ADMIN, MANAGER, OPERATOR, and VIEWER
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1" data-testid="workspace-members-list">
              {members.map((m) => (
                <div
                  key={m.membershipId}
                  className="rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-display text-[13.5px] font-bold text-[#465478] truncate">
                      {m.fullName}
                    </div>
                    <div className="text-[11.5px] text-[#8891AA] truncate">
                      {m.email} · Joined {formatDateTime(m.joinedAt)}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold bg-white text-[#545C9E] border border-[#DFE1F5]">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>

            {isAdminOrOwner && (
              <form
                onSubmit={handleInviteMember}
                className="pt-4 border-t border-[#EEF0FA] space-y-3"
              >
                <div className="flex items-center gap-2 font-display text-[13.5px] font-bold text-[#465478]">
                  <UserPlus className="w-4 h-4 text-[#7584D6]" />
                  <span>Add Member to This Workspace</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name" required>
                    <input
                      type="text"
                      data-testid="invite-member-name"
                      value={inviteForm.fullName}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, fullName: e.target.value })
                      }
                      placeholder="Priya Nair"
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="Email Address" required>
                    <input
                      type="email"
                      data-testid="invite-member-email"
                      value={inviteForm.email}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, email: e.target.value })
                      }
                      placeholder="priya@example.com"
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="Role" required>
                    <select
                      data-testid="invite-member-role"
                      value={inviteForm.role}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, role: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </Field>
                  <Field label="Initial Password (if new user)">
                    <input
                      type="text"
                      data-testid="invite-member-password"
                      value={inviteForm.initialPassword}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, initialPassword: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  loading={inviting}
                  data-testid="invite-member-submit-btn"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#7584D6]" /> Grant Workspace Membership
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 rescale-card p-6 sm:p-7 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#EEF0FA]">
              <Sliders className="w-5 h-5 text-[#7584D6]" />
              <div>
                <h3 className="font-display text-[17px] font-bold text-[#465478]">
                  Live Pre-Dispatch Scoring Thresholds
                </h3>
                <p className="text-[12.5px] text-[#8891AA]">
                  Updating any threshold immediately re-evaluates all {orders.length} orders in your queue
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-display text-[13px] font-bold text-[#465478]">
                    COD Confirmation Threshold
                  </span>
                  <span className="font-display text-[13px] font-extrabold text-[#7584D6] num">
                    {formatINR(automationRules.codConfirmationThreshold)}
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={3000}
                  step={100}
                  value={automationRules.codConfirmationThreshold}
                  onChange={(e) =>
                    updateAutomationRule('codConfirmationThreshold', Number(e.target.value))
                  }
                />
                <p className="text-[11.5px] text-[#8891AA] mt-2">
                  Unconfirmed COD orders above this cart value trigger CONFIRMATION_PENDING.
                </p>
              </div>

              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-display text-[13px] font-bold text-[#465478]">
                    High-Value COD Flag
                  </span>
                  <span className="font-display text-[13px] font-extrabold text-[#FA6E43] num">
                    {formatINR(automationRules.highValueThreshold)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1500}
                  max={6000}
                  step={250}
                  value={automationRules.highValueThreshold}
                  onChange={(e) =>
                    updateAutomationRule('highValueThreshold', Number(e.target.value))
                  }
                />
                <p className="text-[11.5px] text-[#8891AA] mt-2">
                  Triggers HIGH_VALUE_ORDER and recommends Partial UPI Advance when enabled.
                </p>
              </div>

              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-display text-[13px] font-bold text-[#465478]">
                    Partial UPI Instant Discount
                  </span>
                  <span className="font-display text-[13px] font-extrabold text-[#17825B] num">
                    {formatINR(automationRules.partialPrepaidIncentive)}
                  </span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={150}
                  step={25}
                  value={automationRules.partialPrepaidIncentive}
                  onChange={(e) =>
                    updateAutomationRule('partialPrepaidIncentive', Number(e.target.value))
                  }
                />
                <p className="text-[11.5px] text-[#8891AA] mt-2">
                  Incentive offered when a risky COD buyer pays ₹150 token UPI advance.
                </p>
              </div>

              <div className="rounded-[18px] bg-[#F9FAFB] border border-[#E3E6FA] p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-display text-[13px] font-bold text-[#465478]">
                    Buyer Reply SLA Window
                  </span>
                  <span className="font-display text-[13px] font-extrabold text-[#465478] num">
                    {automationRules.responseTimeoutHours} hrs
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={24}
                  step={2}
                  value={automationRules.responseTimeoutHours}
                  onChange={(e) =>
                    updateAutomationRule('responseTimeoutHours', Number(e.target.value))
                  }
                />
                <p className="text-[11.5px] text-[#8891AA] mt-2">
                  Wait window before escalating unconfirmed orders to Ops Review.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <ToggleRow
                title="Auto-Approve Low Attention Orders"
                description="Automatically clear verified returning buyers and complete-address prepaid carts for manifest."
                checked={Boolean(automationRules.autoApproveLowAttention)}
                onChange={(v) => updateAutomationRule('autoApproveLowAttention', v)}
              />
              <ToggleRow
                title="Offer Optional Partial UPI Advance on High-Risk COD"
                description="Recommend a ₹150 UPI advance instead of hard-blocking high-exposure COD buyers."
                checked={Boolean(automationRules.enablePartialPrepaid)}
                onChange={(v) => updateAutomationRule('enablePartialPrepaid', v)}
              />
            </div>
          </div>

          <div className="lg:col-span-4 rescale-card p-6 space-y-4">
            <h4 className="font-display text-[15.5px] font-bold text-[#465478]">
              Live Queue Re-Scoring Impact
            </h4>
            <p className="text-[12.5px] text-[#7C86A2]">
              Current distribution of your {orders.length} workspace orders under active thresholds:
            </p>
            <div className="space-y-2.5">
              <div className="rounded-[16px] bg-[#FFF1EC] border border-[#FDD6C8] px-4 py-3 flex justify-between items-center">
                <span className="font-display text-[12.5px] font-bold text-[#E05328]">
                  HIGH Attention
                </span>
                <span className="font-display text-[18px] font-extrabold text-[#E05328] num">
                  {highCount}
                </span>
              </div>
              <div className="rounded-[16px] bg-[#FFF5FA] border border-[#FBCFE8] px-4 py-3 flex justify-between items-center">
                <span className="font-display text-[12.5px] font-bold text-[#C2418B]">
                  MEDIUM Attention
                </span>
                <span className="font-display text-[18px] font-extrabold text-[#C2418B] num">
                  {mediumCount}
                </span>
              </div>
              <div className="rounded-[16px] bg-[#EEF6FF] border border-[#D5E5FE] px-4 py-3 flex justify-between items-center">
                <span className="font-display text-[12.5px] font-bold text-[#4A78D6]">
                  LOW Attention
                </span>
                <span className="font-display text-[18px] font-extrabold text-[#4A78D6] num">
                  {orders.length - highCount - mediumCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="rescale-card p-6 sm:p-8 space-y-5 max-w-4xl">
          <div className="flex items-center gap-3 pb-4 border-b border-[#EEF0FA]">
            <Shield className="w-5 h-5 text-[#7584D6]" />
            <div>
              <h3 className="font-display text-[17px] font-bold text-[#465478]">
                Merchant-Scoped Privacy &amp; Identity Governance
              </h3>
              <p className="text-[12.5px] text-[#8891AA]">
                Controls governing PII masking, Customer Graph merges, and retention
              </p>
            </div>
          </div>

          <Hint>
            ORDEXA isolates all customer records inside your merchant workspace—no cross-merchant phone or address blacklists are shared externally.
          </Hint>

          <ToggleRow
            title="Mask Buyer Phone Numbers by Default"
            description="Masks middle digits (+91 98••• •6723) across Order Queue and Customer Intelligence Graph."
            checked={Boolean(privacySettings.maskPhoneByDefault)}
            onChange={(v) => updatePrivacySetting('maskPhoneByDefault', v)}
          />
          <ToggleRow
            title="Require Confirmation Dialog Before Identity Merge / Separate"
            description="Prompts an explicit governance confirmation whenever an operator separates or merges buyer records."
            checked={Boolean(privacySettings.requireEvidenceForMerge)}
            onChange={(v) => updatePrivacySetting('requireEvidenceForMerge', v)}
          />
          <ToggleRow
            title="Respect Buyer WhatsApp Opt-Out Flags"
            description="Suppresses automated WhatsApp outreach when a buyer profile has opted out."
            checked={Boolean(privacySettings.respectCustomerOptOut)}
            onChange={(v) => updatePrivacySetting('respectCustomerOptOut', v)}
          />

          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-display font-bold text-[#5C6888] mb-1.5">
                PII Data Retention Window (Days)
              </label>
              <select
                value={privacySettings.dataRetentionDays}
                onChange={(e) =>
                  updatePrivacySetting('dataRetentionDays', Number(e.target.value))
                }
                className={inputClass}
              >
                <option value={90}>90 Days</option>
                <option value={180}>180 Days (Recommended)</option>
                <option value={365}>365 Days</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-display font-bold text-[#5C6888] mb-1.5">
                Active Role Governance Policy
              </label>
              <input
                type="text"
                readOnly
                value={privacySettings.roleAccessMode}
                className={`${inputClass} bg-[#F1F2F9]`}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="rescale-card p-6 sm:p-8 space-y-4 max-w-3xl">
          <div className="flex items-center gap-3 pb-4 border-b border-[#EEF0FA]">
            <Bell className="w-5 h-5 text-[#7584D6]" />
            <div>
              <h3 className="font-display text-[17px] font-bold text-[#465478]">
                Operator Notification Preferences
              </h3>
              <p className="text-[12.5px] text-[#8891AA]">
                Choose which operational events trigger workspace header alerts
              </p>
            </div>
          </div>

          <ToggleRow
            title="WhatsApp Buyer Reply Alerts"
            description="Notify immediately when a buyer supplies a missing landmark or confirms COD intent."
            checked={Boolean(notificationPrefs?.whatsappOutreachAlerts)}
            onChange={(v) => updateNotificationPref('whatsappOutreachAlerts', v)}
          />
          <ToggleRow
            title="High-Attention COD Digest"
            description="Alert ops team when incoming COD orders exceed your high-value threshold."
            checked={Boolean(notificationPrefs?.highRiskDigest)}
            onChange={(v) => updateNotificationPref('highRiskDigest', v)}
          />
          <ToggleRow
            title="NDR Attempt #2 Escalation Alert"
            description="Immediate alert when a shipment fails Attempt #2 and faces imminent RTO."
            checked={Boolean(notificationPrefs?.ndrAttemptTwoAlert)}
            onChange={(v) => updateNotificationPref('ndrAttemptTwoAlert', v)}
          />
          <ToggleRow
            title="Weekly Conservative ROI Ledger Summary"
            description="Send weekly verified rescue vs. messaging spend digest."
            checked={Boolean(notificationPrefs?.weeklyRoiSummary)}
            onChange={(v) => updateNotificationPref('weeklyRoiSummary', v)}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetDemoData}
        title="Reset Simulated Order Sandbox?"
        description="All simulated orders, buyer replies, Customer Graph edits, NDR recoveries, and rule slider changes will revert to the initial baseline."
        confirmLabel="Reset Order Sandbox"
        variant="danger"
      />
    </div>
  );
}
