import React, { useState } from 'react';
import {
  Store,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Lock,
  Info,
  CheckCircle2,
  PauseCircle,
} from 'lucide-react';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { Button, ConfirmDialog, PageHeader } from '../components/ui/Primitives';
import { formatDateTime, formatINR } from '../utils/formatters';

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-slate-100 last:border-b-0">
      <div>
        <div className="text-xs font-semibold text-navy-dark">{label}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full flex-shrink-0 transition-colors p-0.5 ${
          checked ? 'bg-navy' : 'bg-slate-300'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const SECTIONS = [
  { id: 'stores', label: 'Connected Stores', icon: Store },
  { id: 'automation', label: 'Automation & Scoring', icon: Sliders },
  { id: 'privacy', label: 'Privacy & Governance', icon: ShieldCheck },
  { id: 'audit', label: 'Workspace Audit Log', icon: Lock },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState('stores');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const stores = useOrdexaStore((s) => s.stores);
  const automationRules = useOrdexaStore((s) => s.automationRules);
  const privacySettings = useOrdexaStore((s) => s.privacySettings);
  const activity = useOrdexaStore((s) => s.activity);
  const toggleStoreConnection = useOrdexaStore((s) => s.toggleStoreConnection);
  const updateAutomationRule = useOrdexaStore((s) => s.updateAutomationRule);
  const updatePrivacySetting = useOrdexaStore((s) => s.updatePrivacySetting);
  const resetDemoData = useOrdexaStore((s) => s.resetDemoData);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Store Connections & Settings"
        subtitle="Manage e-commerce connectors, live risk scoring thresholds, and merchant-scoped privacy governance."
        actions={
          <Button variant="outline" size="sm" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset All Demo Data
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Menu (Shopify Settings Style) */}
        <nav className="lg:col-span-3 bg-white border border-slate-200 rounded-[4px] shadow-card p-1.5 space-y-0.5">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-navy text-gold font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-navy-dark'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Structured Configuration Pane */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-[4px] shadow-card p-5">
          {activeSection === 'stores' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200">
                <h2 className="font-sans text-sm font-bold text-navy-dark">
                  Connected Stores &amp; Intake Channels
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Demo connectors run locally in your browser without requiring live merchant API keys.
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {stores.map((st) => (
                  <div
                    key={st.id}
                    className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-sm font-bold text-navy-dark">{st.name}</span>
                        <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-navy border border-slate-200">
                          {st.platform}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            st.webhookActive || st.integrationMode === 'live-local'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {st.webhookActive || st.integrationMode === 'live-local' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <PauseCircle className="w-3.5 h-3.5" />
                          )}
                          {st.status}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">{st.domain}</div>
                      <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                        Synced Orders: <strong className="text-navy">{st.ordersSynced}</strong> • Last Sync:{' '}
                        {formatDateTime(st.lastSync)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {st.integrationMode === 'live-local' ? (
                        <span className="text-xs text-emerald-700 font-semibold">
                          Local CSV import active
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => toggleStoreConnection(st.id)}
                        >
                          {st.webhookActive ? 'Pause Simulated Sync' : 'Resume Simulated Sync'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'automation' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200">
                <h2 className="font-sans text-sm font-bold text-navy-dark">
                  Automation &amp; Risk Scoring Thresholds
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjusting thresholds immediately re-evaluates all orders in your queue using the rules engine.
                </p>
              </div>

              <div>
                <ToggleRow
                  label="Auto-Approve Low-Attention Orders"
                  description="Verified returning buyers and complete prepaid orders bypass manual review."
                  checked={automationRules.autoApproveLowAttention}
                  onChange={(v) => updateAutomationRule('autoApproveLowAttention', v)}
                />
                <ToggleRow
                  label="Require COD Confirmation Above Threshold"
                  description="Trigger lightweight WhatsApp confirmation on unverified COD orders."
                  checked={automationRules.requireCodConfirmation}
                  onChange={(v) => updateAutomationRule('requireCodConfirmation', v)}
                />
                <ToggleRow
                  label="Flag High-Value COD Orders"
                  description="Elevate COD orders above threshold for partial advance or ops review."
                  checked={automationRules.flagHighValueOrders}
                  onChange={(v) => updateAutomationRule('flagHighValueOrders', v)}
                />
                <ToggleRow
                  label="Enable Optional Partial-Prepaid Incentives"
                  description="Offer a small discount for optional ₹150 UPI advance on high-risk COD."
                  checked={automationRules.enablePartialPrepaid}
                  onChange={(v) => updateAutomationRule('enablePartialPrepaid', v)}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs tabular-nums">
                <div>
                  <div className="flex justify-between font-semibold mb-1.5">
                    <span className="text-navy-dark">COD Confirmation Threshold</span>
                    <span className="font-mono text-gold-hover">
                      {formatINR(automationRules.codConfirmationThreshold)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="3000"
                    step="100"
                    value={automationRules.codConfirmationThreshold}
                    onChange={(e) =>
                      updateAutomationRule('codConfirmationThreshold', Number(e.target.value))
                    }
                    className="w-full accent-[#262B3E]"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1.5">
                    <span className="text-navy-dark">High-Value COD Threshold</span>
                    <span className="font-mono text-gold-hover">
                      {formatINR(automationRules.highValueThreshold)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1500"
                    max="5000"
                    step="250"
                    value={automationRules.highValueThreshold}
                    onChange={(e) =>
                      updateAutomationRule('highValueThreshold', Number(e.target.value))
                    }
                    className="w-full accent-[#262B3E]"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1.5">
                    <span className="text-navy-dark">Response Timeout</span>
                    <span className="font-mono text-gold-hover">
                      {automationRules.responseTimeoutHours} hours
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="24"
                    step="2"
                    value={automationRules.responseTimeoutHours}
                    onChange={(e) =>
                      updateAutomationRule('responseTimeoutHours', Number(e.target.value))
                    }
                    className="w-full accent-[#262B3E]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200">
                <h2 className="font-sans text-sm font-bold text-navy-dark">
                  Privacy &amp; Data Governance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure merchant workspace isolation, consent logging, and retention policies.
                </p>
              </div>

              <div>
                <ToggleRow
                  label="Strict Merchant-Scoped Data Access"
                  description="Customer Intelligence Graph is isolated strictly to your own connected stores."
                  checked={privacySettings.merchantScopedOnly}
                  onChange={(v) => updatePrivacySetting('merchantScopedOnly', v)}
                />
                <ToggleRow
                  label="Consent Tracking for Buyer Outreach"
                  description="Log transactional verification consent timestamps per order."
                  checked={privacySettings.consentTrackingEnabled}
                  onChange={(v) => updatePrivacySetting('consentTrackingEnabled', v)}
                />
                <ToggleRow
                  label="Honour Customer Communication Opt-Outs"
                  description="Suppress automated WhatsApp/SMS prompts for opted-out phone numbers."
                  checked={privacySettings.respectCustomerOptOut}
                  onChange={(v) => updatePrivacySetting('respectCustomerOptOut', v)}
                />
                <ToggleRow
                  label="Require Strong Evidence for Identity Merge"
                  description="Prevent automatic merges based on weak name or PIN similarity alone."
                  checked={privacySettings.requireEvidenceForMerge}
                  onChange={(v) => updatePrivacySetting('requireEvidenceForMerge', v)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <label className="block font-semibold text-navy-dark mb-1">Data Retention Window</label>
                  <select
                    value={privacySettings.dataRetentionDays}
                    onChange={(e) => updatePrivacySetting('dataRetentionDays', Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy bg-white"
                  >
                    <option value={90}>90 Days</option>
                    <option value={180}>180 Days</option>
                    <option value={365}>365 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-navy-dark mb-1">Role Access Control</label>
                  <select
                    value={privacySettings.roleAccessMode}
                    onChange={(e) => updatePrivacySetting('roleAccessMode', e.target.value)}
                    className="w-full h-8 px-2.5 border border-slate-200 rounded-[4px] text-navy bg-white"
                  >
                    <option>Ops Manager + Auditor</option>
                    <option>Admin Only</option>
                    <option>Read-Only Analyst</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[4px] flex items-start gap-2.5 text-[11px] text-slate-600">
                <Info className="w-4 h-4 text-navy flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Governance Note:</strong> These configuration controls define operational
                  privacy defaults within the prototype UI and do not by themselves represent formal
                  legal or statutory compliance certification.
                </span>
              </div>
            </div>
          )}

          {activeSection === 'audit' && (
            <div className="space-y-3">
              <div className="pb-3 border-b border-slate-200">
                <h2 className="font-sans text-sm font-bold text-navy-dark">Workspace Audit Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological record of order interventions, buyer confirmations, and NDR events.
                </p>
              </div>
              <div className="divide-y divide-slate-100 text-xs max-h-[420px] overflow-y-auto">
                {activity.slice(0, 15).map((a) => (
                  <div key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-navy px-1.5 py-0.5 rounded-[3px] mr-2">
                        {a.orderId}
                      </span>
                      <span className="font-semibold text-navy-dark">{a.title}</span>
                      <span className="text-slate-500 ml-2">— {a.detail}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {formatDateTime(a.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={() => resetDemoData()}
        title="Reset All Demo Data?"
        description="This restores all orders, customer profiles, NDR exceptions, and financial analytics to the initial baseline."
        confirmLabel="Reset Demo Data"
      />
    </div>
  );
}
