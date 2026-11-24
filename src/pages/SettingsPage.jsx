import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Shield,
  Bell,
  RotateCcw,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Tabs,
  ConfirmDialog,
  Hint,
  inputClass,
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR } from '../utils/formatters';

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
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
          checked ? 'bg-[#7584D6]' : 'bg-[#D8DDF0]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
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

  const [activeTab, setActiveTab] = useState('rules');
  const [confirmReset, setConfirmReset] = useState(false);

  const highCount = orders.filter((o) => o.attentionLevel === 'HIGH').length;
  const mediumCount = orders.filter((o) => o.attentionLevel === 'MEDIUM').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance · Rules & Privacy"
        title="Workspace"
        accentWord="Settings"
        subtitle="Tune deterministic RTO scoring thresholds, enforce merchant-scoped buyer privacy, and configure operator alert rules."
        icon={SettingsIcon}
        iconTone="peri"
        actions={
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Workspace Demo
          </Button>
        }
      />

      <Tabs
        items={[
          { id: 'rules', label: 'Scoring & Automation Rules' },
          { id: 'privacy', label: 'Privacy & Data Governance' },
          { id: 'notifications', label: 'Operator Notifications' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

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
        title="Reset Entire ORDEXA Demo Workspace?"
        description="All simulated orders, buyer replies, Customer Graph edits, NDR recoveries, and rule slider changes will revert to the initial baseline."
        confirmLabel="Reset Demo Data"
        variant="danger"
      />
    </div>
  );
}
