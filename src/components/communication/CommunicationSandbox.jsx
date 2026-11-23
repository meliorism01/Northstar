import React, { useState } from 'react';
import {
  MessageSquare,
  Smartphone,
  PhoneCall,
  Send,
  CheckCheck,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Info,
} from 'lucide-react';
import { useOrdexaStore } from '../../store/useOrdexaStore';
import { Button } from '../ui/Primitives';
import { formatDateTime, formatINR } from '../../utils/formatters';

export function CommunicationSandbox({ order }) {
  const sendSimulatedMessage = useOrdexaStore((s) => s.sendSimulatedMessage);
  const simulateCustomerReply = useOrdexaStore((s) => s.simulateCustomerReply);
  const responseTimeoutHours = useOrdexaStore((s) => s.automationRules.responseTimeoutHours);

  const [channel, setChannel] = useState('WhatsApp');
  const [customMessage, setCustomMessage] = useState('');
  const [showLandmarkInput, setShowLandmarkInput] = useState(false);
  const [landmarkText, setLandmarkText] = useState('Near Shyam Nagar Metro Pillar 78');
  const [customerTyping, setCustomerTyping] = useState(false);

  if (!order) return null;

  const messages = order.messages || [];

  const triggerSimulatedReply = (replyType, payload = {}) => {
    setCustomerTyping(true);
    setTimeout(() => {
      simulateCustomerReply(order.id, replyType, { ...payload, channel });
      setCustomerTyping(false);
    }, 380);
  };

  const handleSendMerchantMsg = (e) => {
    e.preventDefault();
    const defaultText =
      channel === 'Voice IVR'
        ? `[Automated IVR Call] Namaste ${order.customerName.split(' ')[0]}, press 1 to confirm your ${order.store} COD order of ${formatINR(order.orderValue)}, or press 2 to update address.`
        : `Hello ${order.customerName.split(' ')[0]}! Please confirm your ${order.store} order ${order.id} of ${formatINR(order.orderValue)}. Share a delivery landmark if missing.`;
    sendSimulatedMessage(order.id, channel, customMessage.trim() || defaultText);
    setCustomMessage('');
  };

  const handleLandmarkSubmit = (e) => {
    e.preventDefault();
    if (!landmarkText.trim()) return;
    setShowLandmarkInput(false);
    triggerSimulatedReply('UPDATE_LANDMARK', { landmark: landmarkText.trim() });
  };

  const formatTimeOnly = (iso) => {
    if (!iso) return 'Just now';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-navy text-white flex flex-wrap items-center justify-between gap-3 border-b border-gold/30">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-gold font-semibold">
            Customer Communication Sandbox
          </div>
          <h3 className="font-sans text-sm font-bold text-white mt-0.5">
            Merchant Outreach ↔ Buyer Device Simulation ({order.id})
          </h3>
        </div>
        <div className="inline-flex bg-navy-deep p-0.5 rounded-[4px] border border-white/10">
          {['WhatsApp', 'SMS', 'Voice IVR'].map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-[3px] transition-colors ${
                channel === ch
                  ? 'bg-gold text-navy-dark'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Notice */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
        <Info className="w-3.5 h-3.5 flex-shrink-0 text-navy" />
        <span>
          <strong>Sandbox Environment:</strong> Simulated {channel} thread—no real external WhatsApp,
          SMS, or telephony messages are sent until production provider credentials are linked.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* LEFT: Merchant Panel */}
        <div className="lg:col-span-6 p-4 flex flex-col justify-between space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-sans text-xs font-bold text-navy-dark flex items-center gap-1.5">
                {channel === 'Voice IVR' ? (
                  <PhoneCall className="w-3.5 h-3.5 text-gold-hover" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-gold-hover" />
                )}
                Merchant Communication Log
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                <Clock className="w-3 h-3 text-gold-hover" /> Timeout: {responseTimeoutHours}h
              </span>
            </div>

            {/* Live Sync Status Strip */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-[4px] border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500">Address</div>
                <div
                  className={`font-semibold mt-0.5 ${
                    order.address.landmark ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {order.address.landmark ? 'Complete' : 'No Landmark'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-[4px] border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500">Buyer Intent</div>
                <div
                  className={`font-semibold mt-0.5 ${
                    order.customerConfirmed ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {order.customerConfirmed ? 'Confirmed' : 'Pending'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-[4px] border border-slate-200">
                <div className="text-[10px] uppercase text-slate-500">Events</div>
                <div className="font-mono font-bold text-navy-dark mt-0.5 tabular-nums">
                  {messages.length}
                </div>
              </div>
            </div>

            {/* Merchant Log */}
            <div className="border border-slate-200 rounded-[4px] bg-slate-50 p-3 h-56 overflow-y-auto space-y-2 text-xs">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                  <p className="font-medium text-navy">No outreach dispatched for {order.id} yet.</p>
                  <p className="text-[11px] mt-1">
                    Click &ldquo;Approve&rdquo; above or send a simulated {channel} message below.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-[4px] border ${
                      m.sender === 'merchant'
                        ? 'bg-white border-slate-200 border-l-2 border-l-navy'
                        : 'bg-emerald-50/70 border-emerald-200 border-l-2 border-l-emerald-600'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold uppercase text-navy-dark">
                        {m.sender === 'merchant' ? `ORDEXA (${m.channel})` : order.customerName}
                      </span>
                      <span className="text-slate-500 font-mono">{m.deliveryStatus}</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{m.text}</p>
                    <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(m.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleSendMerchantMsg} className="flex gap-2">
            <input
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={`Custom ${channel} message (or leave blank for template)...`}
              className="flex-1 h-8 px-3 text-xs border border-slate-200 rounded-[4px] text-navy focus:outline-none focus:border-navy"
            />
            <Button type="submit" variant="secondary" size="sm">
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
          </form>
        </div>

        {/* RIGHT: Realistic Smartphone Buyer Panel */}
        <div className="lg:col-span-6 p-4 bg-slate-100/80 flex flex-col items-center justify-center">
          <div className="w-full max-w-[360px] bg-white rounded-[14px] border-2 border-navy-dark shadow-elevated overflow-hidden">
            {/* Authentic Phone Header */}
            <div className="px-3.5 py-2.5 bg-[#075E54] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  {order.store.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold leading-none flex items-center gap-1">
                    {order.store}
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  </div>
                  <div className="text-[10px] text-emerald-100 mt-0.5">
                    {customerTyping ? 'typing...' : `${channel} • Buyer: ${order.customerName}`}
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono bg-black/20 px-1.5 py-0.5 rounded">
                SIM
              </span>
            </div>

            {/* Chat Canvas */}
            <div
              className="p-3 h-56 overflow-y-auto space-y-2 text-xs"
              style={{
                backgroundColor: '#EFEAE2',
                backgroundImage: 'radial-gradient(#D7CFC4 0.75px, transparent 0.75px)',
                backgroundSize: '12px 12px',
              }}
            >
              {messages.length === 0 ? (
                <div className="bg-white p-2.5 rounded-[6px] rounded-tl-none shadow-xs border border-slate-200/70 text-slate-800 max-w-[92%]">
                  <div className="text-[10px] font-semibold text-emerald-800 mb-0.5">
                    {order.store} (Preview)
                  </div>
                  Hello {order.customerName.split(' ')[0]}! Please confirm your ORDEXA store order{' '}
                  <strong>{order.id}</strong> of <strong>{formatINR(order.orderValue)}</strong>.
                  Please confirm your order or provide your missing delivery landmark.
                  <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400 mt-1">
                    Preview <CheckCheck className="w-3 h-3 text-sky-500" />
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[88%] p-2.5 rounded-[6px] shadow-xs text-slate-800 ${
                      m.sender === 'merchant'
                        ? 'bg-white rounded-tl-none mr-auto'
                        : 'bg-[#D9FDD3] rounded-tr-none ml-auto'
                    }`}
                  >
                    <p className="leading-snug">{m.text}</p>
                    <div className="flex justify-end items-center gap-1 text-[9px] text-slate-500 mt-1 tabular-nums">
                      <span>{formatTimeOnly(m.timestamp)}</span>
                      <CheckCheck className="w-3 h-3 text-sky-500" />
                    </div>
                  </div>
                ))
              )}

              {customerTyping && (
                <div className="bg-[#D9FDD3] ml-auto px-3 py-1.5 rounded-[6px] w-fit text-[11px] text-slate-600 italic">
                  Customer replying...
                </div>
              )}
            </div>

            {/* Interactive Customer Tap Controls */}
            <div className="bg-white p-3 border-t border-slate-200 space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 text-center">
                Simulate Customer Response
              </div>

              {showLandmarkInput ? (
                <form onSubmit={handleLandmarkSubmit} className="space-y-2">
                  <input
                    value={landmarkText}
                    onChange={(e) => setLandmarkText(e.target.value)}
                    placeholder="Enter nearby landmark..."
                    className="w-full h-8 px-2.5 text-xs border border-gold rounded-[4px] text-navy focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 h-8 rounded-[4px] bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                    >
                      Send Landmark &amp; Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLandmarkInput(false)}
                      className="px-3 h-8 rounded-[4px] bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    disabled={customerTyping}
                    onClick={() => triggerSimulatedReply('CONFIRM')}
                    className="flex items-center justify-center gap-1.5 h-8 px-2 rounded-[4px] bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Order
                  </button>
                  <button
                    disabled={customerTyping}
                    onClick={() => setShowLandmarkInput(true)}
                    className="flex items-center justify-center gap-1.5 h-8 px-2 rounded-[4px] bg-navy text-gold text-[11px] font-semibold hover:bg-navy-dark transition-colors disabled:opacity-50"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Update Address
                  </button>
                  {order.paymentMode === 'COD' && order.orderValue >= 2500 && (
                    <button
                      disabled={customerTyping}
                      onClick={() => triggerSimulatedReply('PARTIAL_UPI')}
                      className="col-span-2 flex items-center justify-center gap-1.5 h-8 px-2 rounded-[4px] bg-gold text-navy-dark text-[11px] font-bold hover:bg-gold-hover transition-colors disabled:opacity-50"
                    >
                      <IndianRupee className="w-3.5 h-3.5" /> Pay ₹150 Partial UPI Advance
                    </button>
                  )}
                  <button
                    disabled={customerTyping}
                    onClick={() => triggerSimulatedReply('CANCEL')}
                    className="col-span-2 flex items-center justify-center gap-1.5 h-7 px-2 rounded-[4px] bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Smartphone className="w-3 h-3" /> Interactive buyer handset simulator
          </div>
        </div>
      </div>
    </div>
  );
}
