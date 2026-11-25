import React, { useState } from 'react';
import {
  MessageSquare,
  PhoneCall,
  Send,
  MapPin,
  CheckCircle2,
  IndianRupee,
  XCircle,
  Smartphone,
} from 'lucide-react';
import { Button, StatusBadge, inputClass } from '../ui/Primitives';
import { useOrdexaStore } from '../../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../../utils/formatters';

const CHANNEL_COSTS = {
  WhatsApp: 0.85,
  SMS: 0.35,
  'Voice IVR': 4.5,
};

export function CommunicationSandbox({ order }) {
  const sendSimulatedMessage = useOrdexaStore((s) => s.sendSimulatedMessage);
  const simulateCustomerReply = useOrdexaStore((s) => s.simulateCustomerReply);

  const [channel, setChannel] = useState('WhatsApp');
  const [draftText, setDraftText] = useState('');
  const [customLandmark, setCustomLandmark] = useState(
    order?.address?.landmark || 'Near Shyam Nagar Metro Pillar 78'
  );

  if (!order) return null;

  const defaultTemplate =
    order.recommendedIntervention === 'Address Clarification'
      ? `Hi ${order.customerName.split(' ')[0]}! Please confirm your ${order.store} order ${order.id} (${formatINR(order.orderValue)}) and reply with a nearby landmark for ${order.address.line1}, ${order.address.city}.`
      : order.recommendedIntervention === 'Optional Partial Advance'
        ? `Hi ${order.customerName.split(' ')[0]}! Pay an optional ₹150 UPI advance on COD order ${order.id} (${formatINR(order.orderValue)}) to unlock ₹50 instant off & priority dispatch.`
        : `Hi ${order.customerName.split(' ')[0]}! Tap Confirm below so we can dispatch your ${order.store} order ${order.id} (${formatINR(order.orderValue)}) today.`;

  const handleSend = (e) => {
    e.preventDefault();
    const messageToSend = draftText.trim() || defaultTemplate;
    sendSimulatedMessage(order.id, channel, messageToSend);
    setDraftText('');
  };

  const messages = order.messages || [];

  return (
    <div className="rescale-card overflow-hidden flex flex-col h-full">
      {/* Top Sandbox Header */}
      <div className="px-6 py-4 bg-[#F9FAFB] border-b border-[#EEF0FA] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-[#EEF0FA] border border-[#DFE1F5] flex items-center justify-center text-[#7584D6]">
            <Smartphone className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[15px] font-bold text-[#465478]">
                Buyer Outreach Sandbox
              </h3>
              <span className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
                Simulated
              </span>
            </div>
            <p className="text-[11.5px] text-[#8891AA]">
              {order.id} · {order.customerName} ({order.address.city})
            </p>
          </div>
        </div>

        <StatusBadge status={order.status} />
      </div>

      {/* Channel Selector Pills */}
      <div className="px-6 py-3 border-b border-[#F1F2F9] flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="inline-flex items-center gap-1 bg-[#F1F2F9] border border-[#E3E6FA] rounded-full p-1">
          {Object.keys(CHANNEL_COSTS).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              className={`px-3 py-1 rounded-full text-[11.5px] font-display font-bold transition-all ${channel === ch
                ? 'bg-white text-[#465478] shadow-rescale-card'
                : 'text-[#7C86A2] hover:text-[#465478]'
                }`}
            >
              {ch} (₹{CHANNEL_COSTS[ch].toFixed(2)})
            </button>
          ))}
        </div>

        <span className="text-[11.5px] text-[#8891AA] font-display font-semibold">
          Est. RTO Exposure: <strong className="text-[#465478]">{formatINR(order.estimatedRtoExposure)}</strong>
        </span>
      </div>

      {/* Simulated Phone Conversation Area */}
      <div className="flex-1 p-5 bg-[#F9FAFB] space-y-3 min-h-[260px] max-h-[340px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#D2D8F2] bg-white/80 p-5 text-center">
            <MessageSquare className="w-6 h-6 text-[#7584D6] mx-auto mb-2" />
            <div className="font-display text-[13.5px] font-bold text-[#465478]">
              No outreach sent yet for {order.id}
            </div>
            <p className="text-[12px] text-[#7C86A2] mt-1 max-w-sm mx-auto">
              Send the suggested {channel} prompt below, then simulate how the buyer responds to watch real-time re-scoring.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMerchant = msg.sender === 'merchant';
            return (
              <div
                key={msg.id}
                className={`flex ${isMerchant ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[18px] px-4 py-3 text-[12.5px] shadow-xs ${isMerchant
                    ? 'bg-rescale-btn text-white rounded-br-xs'
                    : 'bg-white border border-[#DFE1F5] text-[#465478] rounded-bl-xs'
                    }`}
                >
                  <div
                    className={`text-[10px] font-display font-bold uppercase tracking-wider mb-1 ${isMerchant ? 'text-white/85' : 'text-[#7584D6]'
                      }`}
                  >
                    {isMerchant ? `NORTHSTAR · ${msg.channel}` : `${order.customerName} · Buyer`}
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                  <div
                    className={`text-[10px] mt-1.5 ${isMerchant ? 'text-white/75' : 'text-[#9AA3BA]'
                      }`}
                  >
                    {msg.deliveryStatus} · {formatDateTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Merchant Outbound Composer */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-[#EEF0FA] space-y-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={defaultTemplate}
            className={inputClass}
          />
          <Button type="submit" variant="primary" size="md">
            {channel === 'Voice IVR' ? (
              <PhoneCall className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </Button>
        </div>
      </form>

      {/* Buyer Response Simulator Controls */}
      <div className="px-5 py-4 bg-[#F4F5FC] border-t border-[#E3E6FA] space-y-3">
        <div className="text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#545C9E]">
          Simulate Buyer Reply (Updates Order &amp; Customer Graph Live)
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customLandmark}
            onChange={(e) => setCustomLandmark(e.target.value)}
            placeholder="Enter delivery landmark…"
            className={`${inputClass} bg-white`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              simulateCustomerReply(order.id, 'UPDATE_LANDMARK', {
                landmark: customLandmark,
                channel,
              })
            }
          >
            <MapPin className="w-3.5 h-3.5 text-[#7584D6]" /> Supply Landmark
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="success"
            size="xs"
            onClick={() => simulateCustomerReply(order.id, 'CONFIRM', { channel })}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm COD Intent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => simulateCustomerReply(order.id, 'PARTIAL_UPI', { channel })}
          >
            <IndianRupee className="w-3.5 h-3.5 text-[#7584D6]" /> Pay ₹150 Partial UPI
          </Button>
          <Button
            type="button"
            variant="danger"
            size="xs"
            onClick={() => simulateCustomerReply(order.id, 'CANCEL', { channel })}
          >
            <XCircle className="w-3.5 h-3.5" /> Buyer Cancels Pre-Dispatch
          </Button>
        </div>
      </div>
    </div>
  );
}
