import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  INITIAL_ACTIVITY,
  INITIAL_AUTOMATION_RULES,
  INITIAL_CUSTOMERS,
  INITIAL_NDR_CASES,
  INITIAL_PRIVACY_SETTINGS,
  INITIAL_STORES,
  buildInitialOrders,
} from '../data/mockData';
import { evaluateOrderRisk } from '../services/scoringEngine';

function nowIso() {
  return new Date().toISOString();
}

function makeInitialState() {
  const customers = structuredClone(INITIAL_CUSTOMERS);
  const automationRules = structuredClone(INITIAL_AUTOMATION_RULES);
  const orders = buildInitialOrders(customers, automationRules);
  return {
    orders,
    customers,
    ndrCases: structuredClone(INITIAL_NDR_CASES),
    activity: structuredClone(INITIAL_ACTIVITY),
    stores: structuredClone(INITIAL_STORES),
    automationRules,
    privacySettings: structuredClone(INITIAL_PRIVACY_SETTINGS),
    messagingExpenses: 142.5,
    selectedOrderId: 'ORD-26410',
    selectedCustomerId: 'CUST-101',
    globalSearch: '',
    notifications: [
      {
        id: 'NOTIF-1',
        title: 'ORD-26410 missing delivery landmark',
        time: '5m ago',
        read: false,
        route: '/app/rescue',
      },
      {
        id: 'NOTIF-2',
        title: 'NDR Attempt #2 at risk of RTO (ORD-26400)',
        time: '24m ago',
        read: false,
        route: '/app/ndr',
      },
      {
        id: 'NOTIF-3',
        title: 'ORD-26402 confirmed via WhatsApp',
        time: '1h ago',
        read: true,
        route: '/app/orders',
      },
    ],
  };
}

export const useOrdexaStore = create(
  persist(
    (set, get) => ({
      ...makeInitialState(),

      // Non-persisted toast notifications
      toasts: [],
      addToast: (message, type = 'info') => {
        const id = `TOAST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          toasts: [...s.toasts.slice(-3), { id, message, type }],
        }));
        setTimeout(() => {
          set((s) => ({
            toasts: s.toasts.filter((t) => t.id !== id),
          }));
        }, 3600);
      },
      dismissToast: (id) =>
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        })),

      setGlobalSearch: (q) => set({ globalSearch: q }),
      setSelectedOrderId: (id) => set({ selectedOrderId: id }),
      setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      pushActivity: (category, orderId, title, detail) =>
        set((state) => ({
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: nowIso(),
              category,
              orderId,
              title,
              detail,
            },
            ...state.activity,
          ].slice(0, 40),
        })),

      rescoreOrder: (order, customer, rules) => {
        const risk = evaluateOrderRisk(order, customer, rules);
        return { ...order, ...risk };
      },

      approveIntervention: (orderId, silent = false) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;
        const ts = nowIso();

        const isDirectApprove = order.recommendedIntervention === 'Approve for Dispatch';
        const nextStatus = isDirectApprove ? 'Ready for Dispatch' : 'Awaiting Customer';
        const costAdded = order.interventionCost || 0;

        const outgoingMsg = !isDirectApprove
          ? {
              id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              sender: 'merchant',
              channel: 'WhatsApp',
              text:
                order.recommendedIntervention === 'Address Clarification'
                  ? `Hello ${order.customerName.split(' ')[0]}! Please confirm your ${order.store} order ${order.id} of ₹${order.orderValue.toLocaleString('en-IN')} and share a nearby delivery landmark for ${order.address.line1}, ${order.address.city}.`
                  : order.recommendedIntervention === 'Optional Partial Advance'
                  ? `Hello ${order.customerName.split(' ')[0]}! For your high-value COD order ${order.id} (₹${order.orderValue.toLocaleString('en-IN')}), pay an optional ₹150 UPI advance now to unlock ₹${state.automationRules.partialPrepaidIncentive} instant discount & priority dispatch.`
                  : `Hello ${order.customerName.split(' ')[0]}! Please tap Confirm below to dispatch your ${order.store} COD order ${order.id} (₹${order.orderValue.toLocaleString('en-IN')}).`,
              timestamp: ts,
              deliveryStatus: 'Delivered (Simulated)',
            }
          : null;

        set((s) => ({
          messagingExpenses: Number((s.messagingExpenses + costAdded).toFixed(2)),
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: nextStatus,
                  messages: outgoingMsg ? [...(o.messages || []), outgoingMsg] : o.messages || [],
                  history: [
                    {
                      timestamp: ts,
                      type: isDirectApprove ? 'Approved for Dispatch' : 'Intervention Dispatched',
                      detail: isDirectApprove
                        ? `Merchant approved ${order.id} directly for courier manifest.`
                        : `Merchant approved "${order.recommendedIntervention}" (Est. cost ₹${costAdded.toFixed(2)}).`,
                    },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: ts,
              category: isDirectApprove ? 'Approved' : 'Address Clarification',
              orderId,
              title: isDirectApprove
                ? `${orderId} approved for dispatch`
                : `${order.recommendedIntervention} sent to ${order.customerName}`,
              detail: isDirectApprove
                ? `Cleared directly for ${order.courier} manifest.`
                : `Simulated outreach initiated. Waiting for customer confirmation.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));

        if (!silent) {
          get().addToast(
            isDirectApprove
              ? `${orderId} approved for dispatch`
              : `${order.recommendedIntervention} sent for ${orderId}`,
            'success'
          );
        }
      },

      overrideIntervention: (orderId, overrideStatus = 'Ready for Dispatch', note = 'Merchant manual override') => {
        const ts = nowIso();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: overrideStatus,
                  history: [
                    { timestamp: ts, type: 'Merchant Override', detail: note },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: 'Approved',
              orderId,
              title: `Manual override applied on ${orderId}`,
              detail: `${note} → Status set to ${overrideStatus}.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        get().addToast(`Override applied on ${orderId} → ${overrideStatus}`, 'info');
      },

      holdOrder: (orderId, reason = 'Held for manual ops review', silent = false) => {
        const ts = nowIso();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'Held for Review',
                  history: [
                    { timestamp: ts, type: 'Held for Review', detail: reason },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: ts,
              category: 'Held',
              orderId,
              title: `${orderId} placed on review hold`,
              detail: reason,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        if (!silent) get().addToast(`${orderId} placed on review hold`, 'warning');
      },

      cancelOrder: (orderId, reason = 'Cancelled prior to dispatch by merchant', silent = false) => {
        const ts = nowIso();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'Cancelled',
                  rescued: false,
                  history: [
                    { timestamp: ts, type: 'Order Cancelled', detail: reason },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: ts,
              category: 'Cancelled',
              orderId,
              title: `${orderId} cancelled before dispatch`,
              detail: `${reason} (Tracked separately from rescued orders).`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        if (!silent) get().addToast(`${orderId} cancelled prior to dispatch`, 'info');
      },

      // Bulk actions for Order Management Queue
      bulkApproveOrders: (orderIds) => {
        const actionable = get().orders.filter(
          (o) => orderIds.includes(o.id) && !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
        );
        actionable.forEach((o) => get().approveIntervention(o.id, true));
        if (actionable.length > 0) {
          get().addToast(`Approved interventions for ${actionable.length} order(s)`, 'success');
        }
      },

      bulkHoldOrders: (orderIds) => {
        const actionable = get().orders.filter(
          (o) => orderIds.includes(o.id) && !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
        );
        actionable.forEach((o) => get().holdOrder(o.id, 'Bulk hold from Order Queue', true));
        if (actionable.length > 0) {
          get().addToast(`Placed ${actionable.length} order(s) on review hold`, 'warning');
        }
      },

      bulkDispatchOrders: (orderIds) => {
        const ready = get().orders.filter(
          (o) => orderIds.includes(o.id) && o.status === 'Ready for Dispatch'
        );
        ready.forEach((o) => get().dispatchOrder(o.id, true));
        if (ready.length > 0) {
          get().addToast(`Manifested ${ready.length} ready order(s) for dispatch`, 'success');
        } else {
          get().addToast('Only orders in "Ready for Dispatch" status can be manifested', 'warning');
        }
      },

      bulkCancelOrders: (orderIds) => {
        const actionable = get().orders.filter(
          (o) => orderIds.includes(o.id) && !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
        );
        actionable.forEach((o) => get().cancelOrder(o.id, 'Bulk cancelled prior to dispatch', true));
        if (actionable.length > 0) {
          get().addToast(`Cancelled ${actionable.length} order(s) prior to dispatch`, 'info');
        }
      },

      sendSimulatedMessage: (orderId, channel, text) => {
        const ts = nowIso();
        const channelCost = channel === 'Voice IVR' ? 4.5 : channel === 'SMS' ? 0.35 : 0.85;
        set((s) => ({
          messagingExpenses: Number((s.messagingExpenses + channelCost).toFixed(2)),
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: o.status === 'Pending Verification' ? 'Awaiting Customer' : o.status,
                  messages: [
                    ...(o.messages || []),
                    {
                      id: `MSG-${Date.now()}`,
                      sender: 'merchant',
                      channel,
                      text,
                      timestamp: ts,
                      deliveryStatus: `Delivered via ${channel} (Simulated)`,
                    },
                  ],
                  history: [
                    {
                      timestamp: ts,
                      type: `${channel} Outreach`,
                      detail: `Sent simulated ${channel} message (₹${channelCost.toFixed(2)}).`,
                    },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
        }));
        get().addToast(`Simulated ${channel} message delivered to ${orderId}`, 'info');
      },

      simulateCustomerReply: (orderId, replyType, payload = {}) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;
        const customer = state.customers.find((c) => c.id === order.customerId);
        const ts = nowIso();

        let customerText = '';
        let updatedAddress = { ...order.address };
        let nextConfirmed = order.customerConfirmed;
        let nextStatus = order.status;
        let nextPaymentMode = order.paymentMode;
        let rescuedFlag = order.rescued;
        let activityTitle = '';
        let activityDetail = '';

        if (replyType === 'UPDATE_LANDMARK') {
          const landmark = (payload.landmark || 'Near Shyam Nagar Metro Pillar 78').trim();
          updatedAddress.landmark = landmark;
          nextConfirmed = true;
          nextStatus = 'Ready for Dispatch';
          rescuedFlag = true;
          customerText = `Confirmed! Please deliver near "${landmark}".`;
          activityTitle = `Customer supplied landmark for ${orderId}`;
          activityDetail = `Landmark "${landmark}" synced to Customer Graph. Order is now READY FOR DISPATCH.`;
        } else if (replyType === 'CONFIRM') {
          nextConfirmed = true;
          nextStatus = updatedAddress.landmark ? 'Ready for Dispatch' : 'Pending Verification';
          rescuedFlag = Boolean(updatedAddress.landmark);
          customerText = 'Yes, I confirm this order and will be available for delivery.';
          activityTitle = `Customer confirmed COD intent on ${orderId}`;
          activityDetail = updatedAddress.landmark
            ? `Order moved to READY FOR DISPATCH.`
            : `Order confirmed, still awaiting delivery landmark.`;
        } else if (replyType === 'PARTIAL_UPI') {
          nextConfirmed = true;
          nextPaymentMode = 'Partial Prepaid';
          nextStatus = 'Ready for Dispatch';
          rescuedFlag = true;
          customerText = 'Paid ₹150 UPI advance (Simulated Ref #UPI88412). Ready for dispatch!';
          activityTitle = `Partial UPI advance received on ${orderId}`;
          activityDetail = `Buyer paid ₹150 token advance. High-value COD risk mitigated.`;
        } else if (replyType === 'CANCEL') {
          nextConfirmed = false;
          nextStatus = 'Cancelled';
          rescuedFlag = false;
          customerText = 'Please cancel this order, I placed it by mistake.';
          activityTitle = `Customer cancelled ${orderId} pre-dispatch`;
          activityDetail = `Forward/reverse freight avoided by pre-dispatch cancellation (not counted as delivered rescue).`;
        }

        const updatedCustomers = state.customers.map((c) => {
          if (c.id !== order.customerId) return c;
          const nextAddresses =
            replyType === 'UPDATE_LANDMARK'
              ? [
                  {
                    id: `ADDR-${Date.now()}`,
                    ...updatedAddress,
                    status: 'Verified',
                    updatedAt: ts,
                  },
                  ...c.addresses.filter((a) => a.line1 !== updatedAddress.line1),
                ]
              : c.addresses;
          const nextAddrHistory =
            replyType === 'UPDATE_LANDMARK'
              ? [
                  {
                    date: ts,
                    change: `Customer updated landmark to "${updatedAddress.landmark}" via Communication Sandbox`,
                  },
                  ...(c.addressHistory || []),
                ]
              : c.addressHistory || [];

          return {
            ...c,
            addresses: nextAddresses,
            addressHistory: nextAddrHistory,
            responsiveness: 'High (Replied in Sandbox)',
          };
        });

        const updatedCustomer = updatedCustomers.find((c) => c.id === order.customerId) || customer;

        const updatedOrders = state.orders.map((o) => {
          if (o.id !== orderId) return o;
          const draft = {
            ...o,
            address: updatedAddress,
            customerConfirmed: nextConfirmed,
            paymentMode: nextPaymentMode,
            status: nextStatus,
            rescued: rescuedFlag,
            messages: [
              ...(o.messages || []),
              {
                id: `MSG-${Date.now()}`,
                sender: 'customer',
                channel: payload.channel || 'WhatsApp',
                text: customerText,
                timestamp: ts,
                deliveryStatus: 'Received',
              },
            ],
            history: [
              {
                timestamp: ts,
                type: 'Customer Response',
                detail: `${customerText} → Order status: ${nextStatus}`,
              },
              ...(o.history || []),
            ],
          };
          const rescored = evaluateOrderRisk(draft, updatedCustomer, state.automationRules);
          return { ...draft, ...rescored };
        });

        set((s) => ({
          customers: updatedCustomers,
          orders: updatedOrders,
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: replyType === 'CANCEL' ? 'Cancelled' : 'Confirmation',
              orderId,
              title: activityTitle,
              detail: activityDetail,
            },
            ...s.activity,
          ].slice(0, 40),
        }));

        get().addToast(
          replyType === 'CANCEL'
            ? `${orderId} cancelled by customer`
            : `${orderId} updated → ${nextStatus}`,
          replyType === 'CANCEL' ? 'warning' : 'success'
        );
      },

      dispatchOrder: (orderId, silent = false) => {
        const ts = nowIso();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'Dispatched',
                  history: [
                    { timestamp: ts, type: 'Dispatched', detail: `Manifested with ${o.courier} for line-haul.` },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: ts,
              category: 'Approved',
              orderId,
              title: `${orderId} dispatched to courier`,
              detail: `AWB generated & handed over for delivery.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        if (!silent) get().addToast(`${orderId} manifested for dispatch`, 'success');
      },

      recordDeliveryOutcome: (orderId, outcome) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;
        const ts = nowIso();

        const updatedCustomers = state.customers.map((c) => {
          if (c.id !== order.customerId) return c;
          return {
            ...c,
            successfulDeliveries: outcome === 'Delivered' ? c.successfulDeliveries + 1 : c.successfulDeliveries,
            previousRtos: outcome === 'RTO' ? c.previousRtos + 1 : c.previousRtos,
            priorNdrCount: outcome === 'NDR Open' ? (c.priorNdrCount || 0) + 1 : c.priorNdrCount || 0,
          };
        });

        let updatedNdr = state.ndrCases;
        if (outcome === 'NDR Open' && !state.ndrCases.some((n) => n.orderId === orderId)) {
          updatedNdr = [
            {
              id: `NDR-${Math.floor(810 + Math.random() * 180)}`,
              orderId: order.id,
              customerId: order.customerId,
              customerName: order.customerName,
              city: order.address.city,
              courier: order.courier,
              ndrReason: 'Customer Unavailable on Attempt #1',
              attemptCount: 1,
              attemptDate: ts,
              customerResponse: 'Pending Response',
              recoveryStatus: 'Pending Customer Response',
              lastAction: 'NDR exception logged from courier feed',
              orderValue: order.orderValue,
              freightExposure: order.estimatedRtoExposure,
            },
            ...state.ndrCases,
          ];
        }

        set((s) => ({
          customers: updatedCustomers,
          ndrCases: updatedNdr,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: outcome,
                  history: [
                    {
                      timestamp: ts,
                      type: `Outcome: ${outcome}`,
                      detail: `Delivery outcome recorded as ${outcome}. Customer Intelligence Graph updated.`,
                    },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: outcome === 'Delivered' ? 'Delivered' : 'NDR Event',
              orderId,
              title: `${orderId} marked as ${outcome}`,
              detail: `Customer history and financial leakage analytics updated.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));

        get().addToast(
          `${orderId} marked as ${outcome}`,
          outcome === 'Delivered' ? 'success' : 'warning'
        );
      },

      performNdrAction: (ndrId, actionLabel) => {
        const ts = nowIso();
        const state = get();
        const target = state.ndrCases.find((n) => n.id === ndrId);
        if (!target) return;

        let nextStatus = target.recoveryStatus;
        if (actionLabel === 'Request Delivery Rescheduling') nextStatus = 'Rescheduled';
        else if (actionLabel === 'Escalate for Manual Review') nextStatus = 'At Risk of RTO';
        else nextStatus = 'Pending Customer Response';

        set((s) => ({
          messagingExpenses: Number((s.messagingExpenses + 0.85).toFixed(2)),
          ndrCases: s.ndrCases.map((n) =>
            n.id === ndrId
              ? {
                  ...n,
                  recoveryStatus: nextStatus,
                  lastAction: `${actionLabel} (${new Date().toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })})`,
                }
              : n
          ),
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: 'NDR Event',
              orderId: target.orderId,
              title: `NDR Action: ${actionLabel}`,
              detail: `${target.orderId} (${target.courier}) — ${nextStatus}`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        get().addToast(`${actionLabel} dispatched for ${target.orderId}`, 'info');
      },

      simulateNdrRecovery: (ndrId, customerReplyText) => {
        const ts = nowIso();
        const state = get();
        const target = state.ndrCases.find((n) => n.id === ndrId);
        if (!target) return;

        set((s) => ({
          ndrCases: s.ndrCases.map((n) =>
            n.id === ndrId
              ? {
                  ...n,
                  customerResponse: customerReplyText,
                  recoveryStatus: 'Recovered',
                  lastAction: 'Re-attempt succeeded after customer confirmation',
                }
              : n
          ),
          orders: s.orders.map((o) =>
            o.id === target.orderId
              ? {
                  ...o,
                  status: 'Delivered',
                  rescued: true,
                  history: [
                    {
                      timestamp: ts,
                      type: 'NDR Recovered',
                      detail: `Recovered via customer input: "${customerReplyText}". Delivered!`,
                    },
                    ...(o.history || []),
                  ],
                }
              : o
          ),
          customers: s.customers.map((c) =>
            c.id === target.customerId
              ? { ...c, successfulDeliveries: c.successfulDeliveries + 1 }
              : c
          ),
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: 'Delivered',
              orderId: target.orderId,
              title: `NDR Recovered: ${target.orderId} delivered`,
              detail: `Avoided ₹${target.freightExposure} reverse logistics loss after buyer reply.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        get().addToast(`${target.orderId} recovered and marked Delivered`, 'success');
      },

      simulateShopifyWebhook: () => {
        const state = get();
        const ts = nowIso();
        const nextNum = 26411 + state.orders.length;
        const orderId = `ORD-${nextNum}`;
        const samples = [
          {
            name: 'Siddharth Rao',
            city: 'Visakhapatnam',
            state: 'Andhra Pradesh',
            pincode: '530017',
            line1: 'MVP Colony Sector 5',
            landmark: '',
            value: 2699,
            sku: 'VG-SERUM-BUNDLE',
            skuName: 'Kumkumadi Night Elixir + Vitamin C Combo',
            courier: 'Delhivery',
          },
          {
            name: 'Ritika Joshi',
            city: 'Dehradun',
            state: 'Uttarakhand',
            pincode: '248001',
            line1: 'Rajpur Road',
            landmark: '',
            value: 1950,
            sku: 'KC-LINEN-SET',
            skuName: 'Organic Handloom Table Runner & Napkins',
            courier: 'Shiprocket',
          },
        ];
        const pick = samples[state.orders.length % samples.length];
        const custId = `CUST-${200 + state.customers.length}`;
        const newCustomer = {
          id: custId,
          name: pick.name,
          phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
          email: `${pick.name.toLowerCase().replace(/\s+/g, '.')}@example.in`,
          city: pick.city,
          state: pick.state,
          pincode: pick.pincode,
          tier: 'Tier-2',
          stores: ['VedaGlow Botanicals'],
          totalOrders: 1,
          successfulDeliveries: 0,
          previousRtos: 0,
          priorNdrCount: 0,
          codOrders: 1,
          prepaidOrders: 0,
          responsiveness: 'Unverified',
          optedOut: false,
          addresses: [
            {
              id: `ADDR-${Date.now()}`,
              line1: pick.line1,
              landmark: pick.landmark,
              city: pick.city,
              state: pick.state,
              pincode: pick.pincode,
              status: pick.landmark ? 'Verified' : 'Incomplete',
              updatedAt: ts,
            },
          ],
          addressHistory: [],
          identityResolution: {
            confidence: 100,
            lastUpdated: ts,
            factors: ['Fresh Shopify Webhook payload (merchant-scoped)'],
            matchedRecords: [
              { id: `REC-VG-${nextNum}`, store: 'VedaGlow Botanicals', channel: 'Shopify', status: 'Primary', confidence: 100 },
            ],
            auditLog: [{ timestamp: ts, actor: 'Shopify Webhook', action: 'Ingested new order record' }],
          },
        };

        const rawOrder = {
          id: orderId,
          store: 'VedaGlow Botanicals',
          date: ts,
          customerId: custId,
          customerName: newCustomer.name,
          phone: newCustomer.phone,
          sku: pick.sku,
          skuName: pick.skuName,
          orderValue: pick.value,
          paymentMode: 'COD',
          courier: pick.courier,
          status: 'Pending Verification',
          customerConfirmed: false,
          rescued: false,
          forwardShippingCost: 74,
          reverseShippingCost: 80,
          address: { line1: pick.line1, landmark: pick.landmark, city: pick.city, state: pick.state, pincode: pick.pincode },
          messages: [],
          history: [
            { timestamp: ts, type: 'Shopify Webhook', detail: `Simulated Shopify webhook ingested ${orderId}.` },
          ],
        };
        const scored = { ...rawOrder, ...evaluateOrderRisk(rawOrder, newCustomer, state.automationRules) };

        set((s) => ({
          customers: [newCustomer, ...s.customers],
          orders: [scored, ...s.orders],
          selectedOrderId: orderId,
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: 'New Order',
              orderId,
              title: `Shopify Webhook: ${orderId} (${newCustomer.name})`,
              detail: `₹${pick.value.toLocaleString('en-IN')} COD order scored as ${scored.attentionLevel} attention.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        get().addToast(`Simulated Shopify order ${orderId} ingested (${scored.attentionLevel})`, 'info');
        return scored;
      },

      addManualOrder: (input) => {
        const state = get();
        const ts = nowIso();
        const orderId = `ORD-${26411 + state.orders.length}`;
        const custId = `CUST-${200 + state.customers.length}`;
        const newCustomer = {
          id: custId,
          name: input.customerName,
          phone: input.phone || '9812345678',
          email: `${input.customerName.toLowerCase().replace(/\s+/g, '.')}@example.in`,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          tier: 'Tier-2',
          stores: [input.store],
          totalOrders: 1,
          successfulDeliveries: 0,
          previousRtos: 0,
          priorNdrCount: 0,
          codOrders: input.paymentMode === 'COD' ? 1 : 0,
          prepaidOrders: input.paymentMode === 'Prepaid' ? 1 : 0,
          responsiveness: 'Unverified',
          optedOut: false,
          addresses: [
            {
              id: `ADDR-${Date.now()}`,
              line1: input.line1,
              landmark: input.landmark || '',
              city: input.city,
              state: input.state,
              pincode: input.pincode,
              status: input.landmark ? 'Verified' : 'Incomplete',
              updatedAt: ts,
            },
          ],
          addressHistory: [],
          identityResolution: {
            confidence: 100,
            lastUpdated: ts,
            factors: ['Manual order entry (merchant-scoped)'],
            matchedRecords: [
              { id: `REC-MAN-${orderId}`, store: input.store, channel: 'Manual', status: 'Primary', confidence: 100 },
            ],
            auditLog: [{ timestamp: ts, actor: 'Merchant Ops', action: 'Manual order created' }],
          },
        };
        const rawOrder = {
          id: orderId,
          store: input.store,
          date: ts,
          customerId: custId,
          customerName: input.customerName,
          phone: newCustomer.phone,
          sku: input.sku || 'CUSTOM-SKU',
          skuName: input.skuName || 'Merchant Catalog Item',
          orderValue: Number(input.orderValue) || 1499,
          paymentMode: input.paymentMode || 'COD',
          courier: input.courier || 'Delhivery',
          status: input.paymentMode === 'Prepaid' ? 'Ready for Dispatch' : 'Pending Verification',
          customerConfirmed: input.paymentMode === 'Prepaid',
          rescued: false,
          forwardShippingCost: 70,
          reverseShippingCost: 76,
          address: {
            line1: input.line1,
            landmark: input.landmark || '',
            city: input.city,
            state: input.state,
            pincode: input.pincode,
          },
          messages: [],
          history: [{ timestamp: ts, type: 'Manual Intake', detail: `Order ${orderId} added manually.` }],
        };
        const scored = { ...rawOrder, ...evaluateOrderRisk(rawOrder, newCustomer, state.automationRules) };

        set((s) => ({
          customers: [newCustomer, ...s.customers],
          orders: [scored, ...s.orders],
          selectedOrderId: orderId,
          activity: [
            {
              id: `ACT-${Date.now()}`,
              timestamp: ts,
              category: 'New Order',
              orderId,
              title: `Manual order ${orderId} created`,
              detail: `${input.customerName} (${input.city}) — ${scored.attentionLevel} attention.`,
            },
            ...s.activity,
          ].slice(0, 40),
        }));
        get().addToast(`Order ${orderId} created (${scored.attentionLevel} attention)`, 'success');
        return scored;
      },

      importCsvOrders: (rows) => {
        const created = [];
        rows.forEach((row) => {
          const o = get().addManualOrder({
            store: row.store || 'ZariPulse WhatsApp & CSV',
            customerName: row.customerName,
            phone: row.phone,
            orderValue: Number(row.orderValue) || 1299,
            paymentMode: row.paymentMode || 'COD',
            line1: row.line1 || 'Main Road',
            landmark: row.landmark || '',
            city: row.city || 'Jaipur',
            state: row.state || 'Rajasthan',
            pincode: row.pincode || '302001',
            courier: row.courier || 'Shiprocket',
            skuName: row.skuName || 'CSV Imported Item',
          });
          created.push(o);
        });
        return created;
      },

      updateIdentityRecord: (customerId, recordId, action, note) => {
        const ts = nowIso();
        set((s) => ({
          customers: s.customers.map((c) => {
            if (c.id !== customerId) return c;
            const nextRecords = c.identityResolution.matchedRecords.map((r) =>
              r.id === recordId
                ? { ...r, status: action === 'separate' ? 'Separated' : 'Merged' }
                : r
            );
            return {
              ...c,
              identityResolution: {
                ...c.identityResolution,
                lastUpdated: ts,
                matchedRecords: nextRecords,
                auditLog: [
                  {
                    timestamp: ts,
                    actor: 'Merchant Admin',
                    action: `${action === 'separate' ? 'Separated' : 'Confirmed merge for'} ${recordId}: ${note}`,
                  },
                  ...(c.identityResolution.auditLog || []),
                ],
              },
            };
          }),
        }));
        get().addToast(
          action === 'separate'
            ? `Separated record ${recordId} into independent identity`
            : `Confirmed merge for ${recordId}`,
          action === 'separate' ? 'warning' : 'success'
        );
      },

      updateAutomationRule: (key, value) => {
        set((s) => {
          const nextRules = { ...s.automationRules, [key]: value };
          const custMap = Object.fromEntries(s.customers.map((c) => [c.id, c]));
          const rescoredOrders = s.orders.map((o) => ({
            ...o,
            ...evaluateOrderRisk(o, custMap[o.customerId], nextRules),
          }));
          return { automationRules: nextRules, orders: rescoredOrders };
        });
        get().addToast('Automation rule updated & queue re-evaluated', 'info');
      },

      updatePrivacySetting: (key, value) => {
        set((s) => ({
          privacySettings: { ...s.privacySettings, [key]: value },
        }));
        get().addToast('Privacy governance setting updated', 'info');
      },

      toggleStoreConnection: (storeId) =>
        set((s) => ({
          stores: s.stores.map((st) =>
            st.id === storeId
              ? {
                  ...st,
                  webhookActive: !st.webhookActive,
                  status: !st.webhookActive ? 'Connected (Simulated)' : 'Paused',
                  lastSync: nowIso(),
                }
              : st
          ),
        })),

      resetDemoData: () => {
        set(() => ({ ...makeInitialState() }));
        get().addToast('Demo workspace reset to initial baseline', 'info');
      },
    }),
    {
      name: 'ordexa-demo-state-v1',
      partialize: (state) => {
        const { toasts, ...persisted } = state;
        return persisted;
      },
    }
  )
);
