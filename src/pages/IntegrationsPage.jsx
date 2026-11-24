import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlugZap,
  Store,
  Upload,
  Zap,
  MessageSquare,
  Truck,
  Pause,
  Play,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  IconTile,
  SectionTitle,
  Hint,
} from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatDateTime } from '../utils/formatters';

const ECOSYSTEM_CARDS = [
  {
    name: 'Local CSV & Manual Order Intake',
    category: 'Order Ingestion',
    mode: 'LIVE',
    icon: Upload,
    tone: 'emerald',
    description:
      'Upload real .csv files or create manual orders directly in the browser with instant deterministic RTO scoring.',
  },
  {
    name: 'WhatsApp / SMS / IVR Sandbox',
    category: 'Buyer Verification',
    mode: 'SIMULATED',
    icon: MessageSquare,
    tone: 'peri',
    description:
      'Interactive handset simulator modeling landmark replies, 1-tap COD confirmation, and ₹150 partial UPI flows.',
  },
  {
    name: 'Delhivery & Shiprocket NDR Feed',
    category: 'Courier Exceptions',
    mode: 'SIMULATED',
    icon: Truck,
    tone: 'coral',
    description:
      'Simulated Attempt #1/#2 courier exception stream wired directly into the NDR Recovery workspace.',
  },
  {
    name: 'Production OAuth & Meta Cloud BSP',
    category: 'Enterprise Connectors',
    mode: 'PLANNED',
    icon: Clock,
    tone: 'amber',
    description:
      'Planned 1-click Shopify App Store OAuth, signed webhook HMAC verification, and live Gupshup/Meta Cloud templates.',
  },
];

export function IntegrationsPage() {
  const navigate = useNavigate();
  const stores = useOrdexaStore((s) => s.stores);
  const toggleStoreConnection = useOrdexaStore((s) => s.toggleStoreConnection);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);

  const getModePill = (mode) => {
    if (mode === 'LIVE' || mode === 'live-local') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold bg-[#ECFEF6] text-[#17825B] border border-[#C3F3DE]">
          LIVE (LOCAL)
        </span>
      );
    }
    if (mode === 'PLANNED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold bg-[#FFF5ED] text-[#D96030] border border-[#FDE0CA]">
          PLANNED ROADMAP
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
        SIMULATED DEMO
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connectivity · Honest Execution Modes"
        title="Storefront &"
        accentWord="Integrations"
        subtitle="Manage connected merchant channels, test simulated Shopify webhooks, or import live local CSV order batches."
        icon={PlugZap}
        iconTone="peri"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/orders')}>
              <Upload className="w-3.5 h-3.5 text-[#7584D6]" /> Open CSV Importer
            </Button>
            <Button variant="primary" size="sm" onClick={simulateShopifyWebhook}>
              <Zap className="w-3.5 h-3.5" /> Test Webhook Payload
            </Button>
          </>
        }
      />

      <Hint>
        <strong>Transparent Integration Status:</strong> Each connector below explicitly states whether it executes <strong>Live (Local)</strong> in this browser workspace, runs as an interactive <strong>Simulated Demo</strong>, or is on the <strong>Planned Roadmap</strong>.
      </Hint>

      {/* Connected Merchant Channels */}
      <section>
        <SectionTitle
          title="Workspace Storefront Channels"
          subtitle="Toggle webhook listeners or fire a test order into your live queue"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {stores.map((st) => (
            <div
              key={st.id}
              className="rescale-card p-6 flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <IconTile
                    icon={Store}
                    tone={st.integrationMode === 'live-local' ? 'emerald' : 'peri'}
                    size="md"
                  />
                  {getModePill(st.integrationMode)}
                </div>

                <h3 className="font-display text-[17px] font-extrabold text-[#465478]">
                  {st.name}
                </h3>
                <p className="text-[12.5px] text-[#7C86A2] mt-0.5">
                  {st.platform} · <span className="font-mono text-[11.5px]">{st.domain}</span>
                </p>

                <div className="mt-4 rounded-[16px] bg-[#F9FAFB] border border-[#E3E6FA] p-3.5 space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#8891AA]">Connection State</span>
                    <span className="font-display font-bold text-[#465478] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2EB37E]" /> {st.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8891AA]">Orders Synced</span>
                    <span className="font-display font-bold text-[#545C9E] num">
                      {st.ordersSynced}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8891AA]">Last Sync</span>
                    <span className="text-[#6E7896]">{formatDateTime(st.lastSync)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EEF0FA] flex items-center justify-between gap-2">
                {st.integrationMode === 'live-local' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/app/orders')}
                  >
                    <Upload className="w-3.5 h-3.5" /> Import CSV Batch
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStoreConnection(st.id)}
                    >
                      {st.webhookActive ? (
                        <>
                          <Pause className="w-3.5 h-3.5 text-[#FA6E43]" /> Pause Sync
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-[#2EB37E]" /> Resume Sync
                        </>
                      )}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={simulateShopifyWebhook}>
                      Test Ping
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Messaging & Courier Capability Matrix */}
      <section>
        <SectionTitle
          title="Messaging, Carrier & Roadmap Capabilities"
          subtitle="Clear separation between browser-native tools, interactive sandboxes, and planned external APIs"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ECOSYSTEM_CARDS.map((card) => (
            <div key={card.name} className="rescale-card p-6 flex items-start gap-4">
              <IconTile icon={card.icon} tone={card.tone} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                    {card.category}
                  </span>
                  {getModePill(card.mode)}
                </div>
                <h4 className="font-display text-[16px] font-bold text-[#465478]">
                  {card.name}
                </h4>
                <p className="text-[13px] text-[#6E7896] mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
