import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { triggerTransactionalEmail } from './emailClientService';
import {
  AuditLogRecord,
  CourierProvider,
  OrderItemSnapshot,
  OrderRecord,
  RefundRecord,
  RefundStatus,
  ReturnItemPayload,
  ReturnPolicyConfig,
  ReturnRequestRecord,
  ReturnStatus,
  ShipmentEventRecord,
  ShipmentRecord,
  ShipmentStatus,
  VALID_REFUND_TRANSITIONS,
  VALID_RETURN_TRANSITIONS,
  VALID_SHIPMENT_TRANSITIONS,
} from '../types/shippingReturns';

export const DEFAULT_COURIERS: Omit<CourierProvider, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'courier-bluedart',
    name: 'Blue Dart Express Air',
    trackingUrlTemplate: 'https://www.bluedart.com/tracking?trackId={trackingNumber}',
    defaultEstimatedDays: 3,
    active: true,
    notes: 'Insured high-value jewellery & silk air express',
  },
  {
    id: 'courier-delhivery',
    name: 'Delhivery Insured Parcel',
    trackingUrlTemplate: 'https://www.delhivery.com/track/package/{trackingNumber}',
    defaultEstimatedDays: 4,
    active: true,
    notes: 'Pan-India saree & designer wear courier',
  },
  {
    id: 'courier-dtdc',
    name: 'DTDC Heritage Priority',
    trackingUrlTemplate: 'https://www.dtdc.in/tracking.asp?strCnno={trackingNumber}',
    defaultEstimatedDays: 5,
    active: true,
    notes: 'Regional hub courier partner',
  },
];

export const DEFAULT_RETURN_POLICY: Omit<ReturnPolicyConfig, 'updatedAt'> = {
  id: 'return_policy',
  returnsEnabled: true,
  returnWindowDays: 7,
  inspectionRequired: true,
  eligibleCategories: [
    'Gold Jewellery',
    'Bridal Jewellery',
    'Silver Jewellery',
    'Kanchipuram Sarees',
    'Gadwal Sarees',
    'Designer Dresses',
  ],
  nonReturnableProductIds: ['prod-6'],
  nonReturnableReasonsNote:
    'Custom-stitched lehengas and altered bridal wear are non-returnable in this demonstration policy. Store admins must review and confirm final merchant policy rules.',
  returnReasons: [
    'Damaged or tampered parcel on arrival',
    'Wrong item or variant delivered',
    'Size or fit mismatch',
    'Quality or finish did not match expectation',
    'Missing accessory / blouse piece',
  ],
  returnInstructions:
    'Demo Policy Notice: Keep original BIS hallmark tags, Silk Mark tag, and packaging intact. All returns are subject to physical quality inspection before simulated refund approval. Store administrators must review and approve legal terms before production launch.',
};

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function validateShipmentTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  if (from === to) return true;
  return VALID_SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateReturnTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  if (from === to) return true;
  return VALID_RETURN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateRefundTransition(from: RefundStatus, to: RefundStatus): boolean {
  if (from === to) return true;
  return VALID_REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}

export function mapShipmentStatusToOrderStatus(status: ShipmentStatus): string {
  switch (status) {
    case 'Shipment Created':
    case 'Ready for Pickup':
      return 'Confirmed & Packed';
    case 'Picked Up':
    case 'In Transit':
    case 'Reached Destination Hub':
      return 'Shipped';
    case 'Out for Delivery':
      return 'Out for Delivery';
    case 'Delivered':
      return 'Delivered';
    case 'Delivery Attempt Failed':
      return 'Delivery Failed';
    case 'Returned to Sender':
      return 'Returned to Sender';
    case 'Shipment Cancelled':
      return 'Cancelled';
    default:
      return 'Processing';
  }
}

export interface ReturnEligibilityInput {
  order: OrderRecord;
  policy: ReturnPolicyConfig;
  existingReturns: ReturnRequestRecord[];
  selectedItems: Array<{ variantSku: string; productId: string; quantity: number }>;
  now?: Date;
}

export interface ReturnEligibilityResult {
  eligible: boolean;
  reason?: string;
  itemsToReturn: ReturnItemPayload[];
  requestedRefundAmount: number;
}

export function checkReturnEligibility(input: ReturnEligibilityInput): ReturnEligibilityResult {
  const { order, policy, existingReturns, selectedItems, now = new Date() } = input;

  if (!policy.returnsEnabled) {
    return {
      eligible: false,
      reason: 'Returns are currently disabled in the store return policy settings.',
      itemsToReturn: [],
      requestedRefundAmount: 0,
    };
  }

  if (!['Delivered', 'Return Requested'].includes(order.status)) {
    return {
      eligible: false,
      reason: `Returns can only be requested for delivered orders (current order status: ${order.status}).`,
      itemsToReturn: [],
      requestedRefundAmount: 0,
    };
  }

  if (order.deliveredAt) {
    const deliveredDate = new Date(order.deliveredAt);
    if (!Number.isNaN(deliveredDate.getTime())) {
      const diffMs = now.getTime() - deliveredDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > policy.returnWindowDays) {
        return {
          eligible: false,
          reason: `The ${policy.returnWindowDays}-day return window expired on ${new Date(
            deliveredDate.getTime() + policy.returnWindowDays * 86400000
          ).toLocaleDateString()}.`,
          itemsToReturn: [],
          requestedRefundAmount: 0,
        };
      }
    }
  }

  if (!selectedItems || selectedItems.length === 0) {
    return {
      eligible: false,
      reason: 'Please select at least one item to return.',
      itemsToReturn: [],
      requestedRefundAmount: 0,
    };
  }

  const activeOrCompletedReturns = existingReturns.filter(
    (r) => r.orderId === order.id && !['Rejected', 'Closed'].includes(r.status)
  );

  const returnedQtyByKey: Record<string, number> = {};
  for (const ret of activeOrCompletedReturns) {
    for (const item of ret.items) {
      const key = `${item.productId}::${item.variantSku}`;
      returnedQtyByKey[key] = (returnedQtyByKey[key] || 0) + item.quantity;
    }
  }

  const itemsToReturn: ReturnItemPayload[] = [];
  let requestedRefundAmount = 0;

  for (const sel of selectedItems) {
    if (sel.quantity <= 0) continue;

    const orderItem = order.items.find(
      (oi) => oi.productId === sel.productId && (oi.variantSku || 'STD') === (sel.variantSku || 'STD')
    );
    if (!orderItem) {
      return {
        eligible: false,
        reason: `Selected item (${sel.variantSku}) does not exist on order ${order.orderNumber}.`,
        itemsToReturn: [],
        requestedRefundAmount: 0,
      };
    }

    if (policy.nonReturnableProductIds.includes(orderItem.productId)) {
      return {
        eligible: false,
        reason: `"${orderItem.name}" is marked as non-returnable under the current store policy.`,
        itemsToReturn: [],
        requestedRefundAmount: 0,
      };
    }

    if (
      policy.eligibleCategories.length > 0 &&
      !policy.eligibleCategories.includes(orderItem.category)
    ) {
      return {
        eligible: false,
        reason: `Category "${orderItem.category}" is not eligible for returns under the current policy.`,
        itemsToReturn: [],
        requestedRefundAmount: 0,
      };
    }

    const key = `${orderItem.productId}::${orderItem.variantSku || 'STD'}`;
    const alreadyRequested = returnedQtyByKey[key] || 0;
    const remainingQty = orderItem.quantity - alreadyRequested;
    if (remainingQty <= 0) {
      return {
        eligible: false,
        reason: `A return request already exists for "${orderItem.name}". Duplicate returns for the same item are blocked.`,
        itemsToReturn: [],
        requestedRefundAmount: 0,
      };
    }
    if (sel.quantity > remainingQty) {
      return {
        eligible: false,
        reason: `Only ${remainingQty} unit(s) of "${orderItem.name}" remain eligible for return.`,
        itemsToReturn: [],
        requestedRefundAmount: 0,
      };
    }

    const lineTotal = Math.round(orderItem.unitPrice * sel.quantity);
    itemsToReturn.push({
      productId: orderItem.productId,
      productName: orderItem.name,
      category: orderItem.category,
      variantSku: orderItem.variantSku || 'STD',
      quantity: sel.quantity,
      unitPrice: orderItem.unitPrice,
      lineTotal,
    });
    requestedRefundAmount += lineTotal;
  }

  if (itemsToReturn.length === 0) {
    return {
      eligible: false,
      reason: 'Please select a valid quantity to return.',
      itemsToReturn: [],
      requestedRefundAmount: 0,
    };
  }

  const cappedAmount = Math.min(requestedRefundAmount, order.total);

  return {
    eligible: true,
    itemsToReturn,
    requestedRefundAmount: cappedAmount,
  };
}

export function validateSimulatedRefundRequest(params: {
  order: OrderRecord;
  returnRequest?: ReturnRequestRecord | null;
  existingRefunds: RefundRecord[];
  refundAmount: number;
}): { valid: boolean; reason?: string; eligiblePaidAmount: number; isCod: boolean; modeNote: string } {
  const { order, returnRequest, existingRefunds, refundAmount } = params;

  const isCod = order.paymentMethod.toLowerCase() === 'cod';
  const priorRefunded = existingRefunds
    .filter((r) => r.orderId === order.id && r.status !== 'Rejected' && r.status !== 'Failed')
    .reduce((sum, r) => sum + r.refundAmount, 0);

  if (returnRequest) {
    const duplicateForReturn = existingRefunds.find(
      (r) => r.returnId === returnRequest.id && r.status !== 'Rejected' && r.status !== 'Failed'
    );
    if (duplicateForReturn) {
      return {
        valid: false,
        reason: `A simulated refund (${duplicateForReturn.refundNumber}) already exists for return ${returnRequest.returnNumber}.`,
        eligiblePaidAmount: 0,
        isCod,
        modeNote: '',
      };
    }
  }

  const maxOrderPaid = order.total;
  const remainingOrderCap = Math.max(0, maxOrderPaid - priorRefunded);
  const eligiblePaidAmount = returnRequest
    ? Math.min(returnRequest.requestedRefundAmount, remainingOrderCap)
    : remainingOrderCap;

  if (refundAmount <= 0) {
    return {
      valid: false,
      reason: 'Refund amount must be greater than ₹0.',
      eligiblePaidAmount,
      isCod,
      modeNote: '',
    };
  }

  if (refundAmount > eligiblePaidAmount) {
    return {
      valid: false,
      reason: `Refund amount (₹${refundAmount.toLocaleString('en-IN')}) cannot exceed eligible refundable amount (₹${eligiblePaidAmount.toLocaleString('en-IN')}).`,
      eligiblePaidAmount,
      isCod,
      modeNote: '',
    };
  }

  const modeNote = isCod
    ? 'Simulated Cash-on-Delivery / Store Credit Refund Record (No real financial transfer)'
    : `Simulated ${order.paymentMethod.toUpperCase()} Refund Record (Demo mode — no live payment gateway reversal)`;

  return {
    valid: true,
    eligiblePaidAmount,
    isCod,
    modeNote,
  };
}

const SENSITIVE_AUDIT_KEYS = /(password|passcode|token|secret|cvv|cardNumber|upiPin|apiKey|privateKey)/i;

export function sanitizeAuditValues(value: unknown, depth = 0): any {
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeAuditValues(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_AUDIT_KEYS.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeAuditValues(v, depth + 1);
      }
    }
    return out;
  }
  return String(value).slice(0, 200);
}

export async function writeAuditLog(params: {
  entityType: AuditLogRecord['entityType'];
  entityId: string;
  action: string;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
  beforeValues?: Record<string, any> | null;
  afterValues?: Record<string, any> | null;
  correlationId?: string;
  reason?: string;
  details?: string;
}) {
  const id = generateSafeId('LOG');
  const correlationId = (params.correlationId || generateSafeId('COR')).slice(0, 64);
  const payload: AuditLogRecord = {
    id,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action.slice(0, 120),
    actorUid: params.actorUid,
    actorRole: (params.actorRole || '').slice(0, 40),
    actorEmail: (params.actorEmail || '').slice(0, 160),
    beforeValues: params.beforeValues ? sanitizeAuditValues(params.beforeValues) : null,
    afterValues: params.afterValues ? sanitizeAuditValues(params.afterValues) : null,
    correlationId,
    reason: (params.reason || '').slice(0, 300),
    details: (params.details || '').slice(0, 500),
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'auditLogs', id), payload);
}

async function emitInAppNotificationSafe(params: {
  userId: string;
  type:
    | 'order_confirmation'
    | 'payment_result'
    | 'order_status_update'
    | 'shipment_update'
    | 'return_update'
    | 'refund_update'
    | 'account_notification';
  title: string;
  message: string;
  orderNumber?: string;
  createdByUid?: string;
}) {
  try {
    const id = generateSafeId('NTF');
    await setDoc(doc(db, 'notifications', id), {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title.slice(0, 160),
      message: params.message.slice(0, 600),
      orderNumber: (params.orderNumber || '').slice(0, 32),
      read: false,
      createdByUid: params.createdByUid || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Non-blocking notification creation failed:', err);
  }
}

// ---------- ORDERS ----------

export async function createOrderWithPaymentAndInvoice(params: {
  userId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
  shippingAddress: {
    fullName: string;
    mobile: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
  };
}): Promise<OrderRecord> {
  const orderNumber = 'SDA-' + Math.floor(100000 + Math.random() * 900000);
  const orderId = orderNumber;
  const paymentId = generateSafeId('PAY');
  const invoiceNumber = `INV-${orderNumber}`;
  const isCod = params.paymentMethod.toLowerCase() === 'cod';
  const paymentStatus: OrderRecord['paymentStatus'] = isCod ? 'Pending COD' : 'Successful';

  const orderDoc: OrderRecord = {
    id: orderId,
    userId: params.userId,
    customerName: params.customerName.slice(0, 120),
    customerEmail: params.customerEmail.slice(0, 160),
    orderNumber,
    items: params.items.slice(0, 50),
    subtotal: params.subtotal,
    discountAmount: params.discountAmount,
    shippingFee: params.shippingFee,
    gstAmount: params.gstAmount,
    total: params.total,
    status: 'Confirmed & Packed',
    paymentMethod: params.paymentMethod.slice(0, 32),
    paymentStatus,
    shippingAddress: params.shippingAddress,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'orders', orderId), orderDoc);
  batch.set(doc(db, 'payments', paymentId), {
    paymentId,
    orderId,
    userId: params.userId,
    amount: params.total,
    method: params.paymentMethod.slice(0, 32),
    status: paymentStatus,
    transactionRef: isCod ? `COD/RESERVE/${orderNumber}` : `DEMO/${params.paymentMethod.toUpperCase()}/${Date.now()}`,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'invoices', invoiceNumber), {
    invoiceNumber,
    orderId,
    userId: params.userId,
    grandTotal: params.total,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return orderDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
  }
}

export async function fetchCustomerOrders(userId: string): Promise<OrderRecord[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, path), where('userId', '==', userId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as OrderRecord)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAllOrders(): Promise<OrderRecord[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrderRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchPaymentsForAdmin(): Promise<any[]> {
  const path = 'payments';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function markOrderDeliveredByAdmin(
  orderId: string,
  actorUid: string,
  actorEmail?: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const orderSnap = await getDoc(doc(db, 'orders', orderId));
    const prev = orderSnap.exists() ? (orderSnap.data() as OrderRecord) : null;
    const deliveredAt = new Date().toISOString();
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'Delivered',
      deliveredAt,
      updatedAt: serverTimestamp(),
    });
    if (prev) {
      await emitInAppNotificationSafe({
        userId: prev.userId,
        type: 'order_status_update',
        title: `Order ${prev.orderNumber} Delivered`,
        message: `Your order ${prev.orderNumber} has been marked as Delivered.`,
        orderNumber: prev.orderNumber,
        createdByUid: actorUid,
      });
    }
    await writeAuditLog({
      entityType: 'order',
      entityId: orderId,
      action: 'Order marked Delivered',
      actorUid,
      actorEmail,
      beforeValues: prev ? { status: prev.status } : null,
      afterValues: { status: 'Delivered', deliveredAt },
      details: `Order ${orderId} marked Delivered at ${deliveredAt}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateOrderStatusAndRestoreStock(params: {
  order: OrderRecord;
  nextStatus: string;
  actorUid: string;
  actorRole?: string;
  actorEmail?: string;
  reason?: string;
}): Promise<void> {
  const path = `orders/${params.order.id}`;
  try {
    const orderRef = doc(db, 'orders', params.order.id);
    const freshSnap = await getDoc(orderRef);
    const currentOrder = (freshSnap.exists() ? freshSnap.data() : params.order) as OrderRecord;

    const batch = writeBatch(db);
    const updatePayload: Record<string, any> = {
      status: params.nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (params.nextStatus === 'Delivered') {
      updatePayload.deliveredAt = new Date().toISOString();
    }

    let restoredCount = 0;
    if (params.nextStatus === 'Cancelled' && !currentOrder.stockRestored) {
      updatePayload.stockRestored = true;
      for (const item of currentOrder.items || []) {
        if (!item.variantSku) continue;
        const varRef = doc(db, 'productVariants', item.variantSku);
        const varSnap = await getDoc(varRef);
        if (varSnap.exists()) {
          const curStock = Number(varSnap.data().stock || 0);
          batch.update(varRef, {
            stock: curStock + Number(item.quantity || 0),
            updatedAt: serverTimestamp(),
          });
          restoredCount += Number(item.quantity || 0);
        }
      }
    }

    batch.update(orderRef, updatePayload);
    await batch.commit();

    await emitInAppNotificationSafe({
      userId: currentOrder.userId,
      type: 'order_status_update',
      title: `Order ${currentOrder.orderNumber}: ${params.nextStatus}`,
      message: `Your order ${currentOrder.orderNumber} status updated from ${currentOrder.status} to ${params.nextStatus}.`,
      orderNumber: currentOrder.orderNumber,
      createdByUid: params.actorUid,
    });

    await writeAuditLog({
      entityType: 'order',
      entityId: currentOrder.id,
      action: `Order ${currentOrder.orderNumber}: ${currentOrder.status} -> ${params.nextStatus}`,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      beforeValues: { status: currentOrder.status, stockRestored: Boolean(currentOrder.stockRestored) },
      afterValues: {
        status: params.nextStatus,
        stockRestored: params.nextStatus === 'Cancelled' ? true : Boolean(currentOrder.stockRestored),
        restoredUnits: restoredCount,
      },
      reason: params.reason,
      details:
        restoredCount > 0
          ? `Restored ${restoredCount} unit(s) to SKU inventory.`
          : `Status updated to ${params.nextStatus}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ---------- COURIER PROVIDERS ----------

export async function fetchCouriers(): Promise<CourierProvider[]> {
  const path = 'courierProviders';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return DEFAULT_COURIERS.map((c) => ({ ...c }));
    }
    return snap.docs.map((d) => d.data() as CourierProvider);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function seedDefaultCouriersIfEmpty(actorUid: string, actorEmail?: string): Promise<void> {
  const path = 'courierProviders';
  try {
    const snap = await getDocs(collection(db, path));
    if (!snap.empty) return;
    const batch = writeBatch(db);
    for (const c of DEFAULT_COURIERS) {
      batch.set(doc(db, path, c.id), {
        ...c,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await writeAuditLog({
      entityType: 'courier',
      entityId: 'default-couriers',
      action: 'Initialized default courier partners',
      actorUid,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCourierProvider(
  courier: Omit<CourierProvider, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  actorUid: string,
  actorEmail?: string
): Promise<void> {
  const id = isNew ? generateSafeId('COU') : courier.id;
  const path = `courierProviders/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'courierProviders', id), {
        id,
        name: courier.name.trim().slice(0, 80),
        trackingUrlTemplate: (courier.trackingUrlTemplate || '').trim().slice(0, 300),
        defaultEstimatedDays: Math.max(1, Math.min(60, Number(courier.defaultEstimatedDays) || 4)),
        active: courier.active,
        notes: (courier.notes || '').trim().slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'courierProviders', id), {
        name: courier.name.trim().slice(0, 80),
        trackingUrlTemplate: (courier.trackingUrlTemplate || '').trim().slice(0, 300),
        defaultEstimatedDays: Math.max(1, Math.min(60, Number(courier.defaultEstimatedDays) || 4)),
        active: courier.active,
        notes: (courier.notes || '').trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
    }
    await writeAuditLog({
      entityType: 'courier',
      entityId: id,
      action: isNew ? `Added courier ${courier.name}` : `Updated courier ${courier.name}`,
      actorUid,
      actorEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------- SHIPMENTS & TRACKING ----------

export async function fetchAllShipments(): Promise<ShipmentRecord[]> {
  const path = 'shipments';
  try {
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ShipmentRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchCustomerShipments(userId: string): Promise<ShipmentRecord[]> {
  const path = 'shipments';
  try {
    const q = query(collection(db, path), where('userId', '==', userId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as ShipmentRecord)
      .sort((a, b) => {
        const ta = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const tb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return tb - ta;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchShipmentEvents(shipmentId: string): Promise<ShipmentEventRecord[]> {
  const path = `shipments/${shipmentId}/events`;
  try {
    const q = query(collection(db, 'shipments', shipmentId, 'events'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ShipmentEventRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createShipmentForOrder(params: {
  order: OrderRecord;
  courierId?: string;
  courierName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingDate?: string;
  estimatedDeliveryDate?: string;
  deliveryNotes?: string;
  actorUid: string;
  actorName: string;
  actorEmail?: string;
}): Promise<ShipmentRecord> {
  const shipmentId = generateSafeId('SHP');
  const eventId = generateSafeId('EVT');
  const nowDate = params.shippingDate || new Date().toISOString().slice(0, 10);

  const shipmentPayload: ShipmentRecord = {
    id: shipmentId,
    orderId: params.order.id,
    orderNumber: params.order.orderNumber,
    userId: params.order.userId,
    customerName: params.order.customerName,
    courierId: (params.courierId || '').slice(0, 64),
    courierName: params.courierName.trim().slice(0, 80),
    trackingNumber: (params.trackingNumber || '').trim().slice(0, 80),
    trackingUrl: (params.trackingUrl || '').trim().slice(0, 300),
    shippingDate: nowDate.slice(0, 40),
    estimatedDeliveryDate: (params.estimatedDeliveryDate || '').slice(0, 40),
    actualDeliveryDate: '',
    status: 'Shipment Created',
    deliveryNotes: (params.deliveryNotes || '').trim().slice(0, 500),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const eventPayload: ShipmentEventRecord = {
    id: eventId,
    shipmentId,
    userId: params.order.userId,
    status: 'Shipment Created',
    location: 'SDA Collections Dispatch Vault, Hyderabad',
    notes: params.deliveryNotes?.trim() || `Shipment initialized with ${params.courierName}`,
    updatedByUid: params.actorUid,
    updatedByName: params.actorName.slice(0, 120),
    createdAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shipments', shipmentId), shipmentPayload);
    batch.set(doc(db, 'shipments', shipmentId, 'events', eventId), eventPayload);
    batch.update(doc(db, 'orders', params.order.id), {
      shipmentId,
      status: 'Confirmed & Packed',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await writeAuditLog({
      entityType: 'shipment',
      entityId: shipmentId,
      action: `Created shipment for order ${params.order.orderNumber}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      details: `Courier: ${params.courierName}, Tracking: ${params.trackingNumber || 'Not yet assigned'}`,
    });

    if (params.order.customerEmail) {
      void triggerTransactionalEmail({
        templateType: 'shipment_update',
        recipientEmail: params.order.customerEmail,
        recipientName: params.order.customerName,
        userId: params.order.userId,
        idempotencyKey: `shp-${shipmentId}-created`,
        orderNumber: params.order.orderNumber,
        courierName: params.courierName,
        trackingNumber: params.trackingNumber,
        trackingUrl: params.trackingUrl,
        shipmentStatus: 'Shipment Created',
        notes: params.deliveryNotes,
      });
    }

    return shipmentPayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shipments/${shipmentId}`);
  }
}

async function resolveOrderCustomerEmail(orderId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (snap.exists()) {
      return String(snap.data()?.customerEmail || '').trim();
    }
  } catch {
    // ignore lookup errors
  }
  return '';
}

export async function updateShipmentStatusAndDetails(params: {
  shipment: ShipmentRecord;
  nextStatus: ShipmentStatus;
  courierId?: string;
  courierName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryNotes?: string;
  location?: string;
  actorUid: string;
  actorName: string;
  actorEmail?: string;
}): Promise<void> {
  if (!validateShipmentTransition(params.shipment.status, params.nextStatus)) {
    throw new Error(
      `Invalid shipment status transition from "${params.shipment.status}" to "${params.nextStatus}".`
    );
  }

  const eventId = generateSafeId('EVT');
  const resolvedActualDelivery =
    params.nextStatus === 'Delivered'
      ? params.actualDeliveryDate || new Date().toISOString().slice(0, 10)
      : params.actualDeliveryDate || params.shipment.actualDeliveryDate || '';

  const path = `shipments/${params.shipment.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'shipments', params.shipment.id), {
      courierId: (params.courierId ?? params.shipment.courierId ?? '').slice(0, 64),
      courierName: params.courierName.trim().slice(0, 80),
      trackingNumber: (params.trackingNumber ?? params.shipment.trackingNumber ?? '').trim().slice(0, 80),
      trackingUrl: (params.trackingUrl ?? params.shipment.trackingUrl ?? '').trim().slice(0, 300),
      shippingDate: (params.shippingDate ?? params.shipment.shippingDate ?? '').slice(0, 40),
      estimatedDeliveryDate: (params.estimatedDeliveryDate ?? params.shipment.estimatedDeliveryDate ?? '').slice(0, 40),
      actualDeliveryDate: resolvedActualDelivery.slice(0, 40),
      status: params.nextStatus,
      deliveryNotes: (params.deliveryNotes ?? params.shipment.deliveryNotes ?? '').trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'shipments', params.shipment.id, 'events', eventId), {
      id: eventId,
      shipmentId: params.shipment.id,
      userId: params.shipment.userId,
      status: params.nextStatus,
      location: (params.location || 'Transit Hub').trim().slice(0, 120),
      notes: (params.deliveryNotes || `Status updated to ${params.nextStatus}`).trim().slice(0, 400),
      updatedByUid: params.actorUid,
      updatedByName: params.actorName.slice(0, 120),
      createdAt: serverTimestamp(),
    });

    const mappedOrderStatus = mapShipmentStatusToOrderStatus(params.nextStatus);
    const orderUpdate: Record<string, any> = {
      status: mappedOrderStatus,
      updatedAt: serverTimestamp(),
    };
    if (params.nextStatus === 'Delivered') {
      orderUpdate.deliveredAt = new Date().toISOString();
    }
    batch.update(doc(db, 'orders', params.shipment.orderId), orderUpdate);

    await batch.commit();

    await writeAuditLog({
      entityType: 'shipment',
      entityId: params.shipment.id,
      action: `Shipment status updated: ${params.shipment.status} -> ${params.nextStatus}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      beforeValues: {
        status: params.shipment.status,
        courierName: params.shipment.courierName,
        trackingNumber: params.shipment.trackingNumber || '',
      },
      afterValues: {
        status: params.nextStatus,
        courierName: params.courierName,
        trackingNumber: params.trackingNumber ?? params.shipment.trackingNumber ?? '',
      },
      details: params.deliveryNotes || `Courier ${params.courierName}`,
    });

    await emitInAppNotificationSafe({
      userId: params.shipment.userId,
      type: 'shipment_update',
      title: `Shipment Update: ${params.nextStatus}`,
      message: `Order ${params.shipment.orderNumber} via ${params.courierName} is now "${params.nextStatus}".`,
      orderNumber: params.shipment.orderNumber,
      createdByUid: params.actorUid,
    });

    const recipientEmail = await resolveOrderCustomerEmail(params.shipment.orderId);
    if (recipientEmail) {
      void triggerTransactionalEmail({
        templateType: 'shipment_update',
        recipientEmail,
        recipientName: params.shipment.customerName,
        userId: params.shipment.userId,
        idempotencyKey: `shp-${params.shipment.id}-${params.nextStatus.replace(/\s+/g, '_')}`,
        orderNumber: params.shipment.orderNumber,
        courierName: params.courierName,
        trackingNumber: params.trackingNumber ?? params.shipment.trackingNumber,
        trackingUrl: params.trackingUrl ?? params.shipment.trackingUrl,
        shipmentStatus: params.nextStatus,
        notes: params.deliveryNotes,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ---------- RETURN POLICY CONFIGURATION ----------

export async function fetchReturnPolicy(): Promise<ReturnPolicyConfig> {
  const path = 'storeSettings/return_policy';
  try {
    const snap = await getDoc(doc(db, 'storeSettings', 'return_policy'));
    if (snap.exists()) {
      return snap.data() as ReturnPolicyConfig;
    }
    return { ...DEFAULT_RETURN_POLICY };
  } catch (err) {
    console.warn('Return policy fallback to defaults:', err);
    return { ...DEFAULT_RETURN_POLICY };
  }
}

export async function saveReturnPolicy(
  policy: Omit<ReturnPolicyConfig, 'updatedAt'>,
  actorUid: string,
  actorEmail?: string
): Promise<void> {
  const path = 'storeSettings/return_policy';
  try {
    await setDoc(doc(db, 'storeSettings', 'return_policy'), {
      id: 'return_policy',
      returnsEnabled: policy.returnsEnabled,
      returnWindowDays: Math.max(0, Math.min(90, Number(policy.returnWindowDays) || 0)),
      inspectionRequired: policy.inspectionRequired,
      eligibleCategories: policy.eligibleCategories.slice(0, 40),
      nonReturnableProductIds: policy.nonReturnableProductIds.slice(0, 100),
      nonReturnableReasonsNote: policy.nonReturnableReasonsNote.slice(0, 400),
      returnReasons: policy.returnReasons.slice(0, 20),
      returnInstructions: policy.returnInstructions.slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      entityType: 'policy',
      entityId: 'return_policy',
      action: 'Updated return policy configuration',
      actorUid,
      actorEmail,
      details: `Returns ${policy.returnsEnabled ? 'Enabled' : 'Disabled'}, Window: ${policy.returnWindowDays} days`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------- RETURN REQUESTS ----------

export async function fetchCustomerReturns(userId: string): Promise<ReturnRequestRecord[]> {
  const path = 'returnRequests';
  try {
    const q = query(collection(db, path), where('userId', '==', userId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as ReturnRequestRecord)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAllReturns(): Promise<ReturnRequestRecord[]> {
  const path = 'returnRequests';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ReturnRequestRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function submitReturnRequest(params: {
  order: OrderRecord;
  policy: ReturnPolicyConfig;
  existingReturns: ReturnRequestRecord[];
  selectedItems: Array<{ variantSku: string; productId: string; quantity: number }>;
  reason: string;
  description: string;
  imageUrls?: string[];
  actorUid: string;
  actorEmail?: string;
}): Promise<ReturnRequestRecord> {
  const eligibility = checkReturnEligibility({
    order: params.order,
    policy: params.policy,
    existingReturns: params.existingReturns,
    selectedItems: params.selectedItems,
  });

  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || 'This order is not eligible for a return.');
  }

  const returnId = generateSafeId('RET');
  const returnNumber = `RET-${Math.floor(100000 + Math.random() * 900000)}`;
  const cleanImageUrls = (params.imageUrls || [])
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 5);

  const returnDoc: ReturnRequestRecord = {
    id: returnId,
    returnNumber,
    orderId: params.order.id,
    orderNumber: params.order.orderNumber,
    userId: params.order.userId,
    customerName: params.order.customerName,
    items: eligibility.itemsToReturn,
    requestedRefundAmount: eligibility.requestedRefundAmount,
    reason: params.reason.trim().slice(0, 120),
    description: params.description.trim().slice(0, 800),
    imageUrls: cleanImageUrls,
    status: 'Requested',
    inspectionNotes: '',
    adminNotes: '',
    receivedAt: '',
    refundId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'returnRequests', returnId), returnDoc);
    batch.update(doc(db, 'orders', params.order.id), {
      status: 'Return Requested',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await writeAuditLog({
      entityType: 'return',
      entityId: returnId,
      action: `Customer submitted return request ${returnNumber}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      details: `Order ${params.order.orderNumber}, Reason: ${params.reason}, Requested: ₹${eligibility.requestedRefundAmount}`,
    });

    return returnDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `returnRequests/${returnId}`);
  }
}

export async function updateReturnRequestWorkflow(params: {
  returnRequest: ReturnRequestRecord;
  nextStatus: ReturnStatus;
  inspectionNotes?: string;
  adminNotes?: string;
  receivedAt?: string;
  actorUid: string;
  actorEmail?: string;
}): Promise<void> {
  if (!validateReturnTransition(params.returnRequest.status, params.nextStatus)) {
    throw new Error(
      `Invalid return status transition from "${params.returnRequest.status}" to "${params.nextStatus}".`
    );
  }

  const path = `returnRequests/${params.returnRequest.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'returnRequests', params.returnRequest.id), {
      status: params.nextStatus,
      inspectionNotes: (params.inspectionNotes ?? params.returnRequest.inspectionNotes ?? '').trim().slice(0, 500),
      adminNotes: (params.adminNotes ?? params.returnRequest.adminNotes ?? '').trim().slice(0, 500),
      receivedAt:
        params.nextStatus === 'Item Received'
          ? params.receivedAt || new Date().toISOString().slice(0, 10)
          : params.returnRequest.receivedAt || '',
      updatedAt: serverTimestamp(),
    });

    if (params.nextStatus === 'Approved') {
      batch.update(doc(db, 'orders', params.returnRequest.orderId), {
        status: 'Return Approved',
        updatedAt: serverTimestamp(),
      });
    } else if (params.nextStatus === 'Refund Initiated') {
      batch.update(doc(db, 'orders', params.returnRequest.orderId), {
        status: 'Refund Initiated',
        updatedAt: serverTimestamp(),
      });
    } else if (params.nextStatus === 'Refunded') {
      batch.update(doc(db, 'orders', params.returnRequest.orderId), {
        status: 'Refunded',
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await writeAuditLog({
      entityType: 'return',
      entityId: params.returnRequest.id,
      action: `Return ${params.returnRequest.returnNumber}: ${params.returnRequest.status} -> ${params.nextStatus}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      beforeValues: { status: params.returnRequest.status },
      afterValues: { status: params.nextStatus },
      details: params.inspectionNotes || params.adminNotes || '',
    });

    await emitInAppNotificationSafe({
      userId: params.returnRequest.userId,
      type: 'return_update',
      title: `Return ${params.returnRequest.returnNumber}: ${params.nextStatus}`,
      message: `Your return request for order ${params.returnRequest.orderNumber} is now "${params.nextStatus}".`,
      orderNumber: params.returnRequest.orderNumber,
      createdByUid: params.actorUid,
    });

    const recipientEmail = await resolveOrderCustomerEmail(params.returnRequest.orderId);
    if (recipientEmail) {
      void triggerTransactionalEmail({
        templateType: 'return_update',
        recipientEmail,
        recipientName: params.returnRequest.customerName,
        userId: params.returnRequest.userId,
        idempotencyKey: `ret-${params.returnRequest.id}-${params.nextStatus.replace(/\s+/g, '_')}`,
        orderNumber: params.returnRequest.orderNumber,
        returnNumber: params.returnRequest.returnNumber,
        returnStatus: params.nextStatus,
        notes: params.inspectionNotes || params.adminNotes,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ---------- SIMULATED REFUNDS ----------

export async function fetchCustomerRefunds(userId: string): Promise<RefundRecord[]> {
  const path = 'refunds';
  try {
    const q = query(collection(db, path), where('userId', '==', userId), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as RefundRecord)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchAllRefunds(): Promise<RefundRecord[]> {
  const path = 'refunds';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as RefundRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createSimulatedRefund(params: {
  order: OrderRecord;
  returnRequest?: ReturnRequestRecord | null;
  existingRefunds: RefundRecord[];
  refundAmount: number;
  adminNotes?: string;
  actorUid: string;
  actorEmail?: string;
}): Promise<RefundRecord> {
  const check = validateSimulatedRefundRequest({
    order: params.order,
    returnRequest: params.returnRequest,
    existingRefunds: params.existingRefunds,
    refundAmount: params.refundAmount,
  });

  if (!check.valid) {
    throw new Error(check.reason || 'Refund validation failed.');
  }

  const refundId = generateSafeId('REF');
  const refundNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
  const refCode = `SIM-REF-${Date.now().toString().slice(-8)}`;

  const refundDoc: RefundRecord = {
    id: refundId,
    refundNumber,
    orderId: params.order.id,
    orderNumber: params.order.orderNumber,
    returnId: params.returnRequest?.id || '',
    userId: params.order.userId,
    customerName: params.order.customerName,
    originalPaymentMethod: params.order.paymentMethod,
    eligiblePaidAmount: check.eligiblePaidAmount,
    refundAmount: params.refundAmount,
    isSimulated: true,
    refundModeNote: check.modeNote.slice(0, 240),
    status: 'Requested',
    referenceId: refCode,
    adminNotes: (params.adminNotes || '').trim().slice(0, 400),
    processedByUid: params.actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'refunds', refundId), refundDoc);

    if (params.returnRequest) {
      batch.update(doc(db, 'returnRequests', params.returnRequest.id), {
        status: 'Refund Initiated',
        refundId,
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'orders', params.order.id), {
      status: 'Refund Initiated',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await writeAuditLog({
      entityType: 'refund',
      entityId: refundId,
      action: `Created simulated refund ${refundNumber} (₹${params.refundAmount})`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      details: check.modeNote,
    });

    if (params.order.customerEmail) {
      void triggerTransactionalEmail({
        templateType: 'refund_update',
        recipientEmail: params.order.customerEmail,
        recipientName: params.order.customerName,
        userId: params.order.userId,
        idempotencyKey: `ref-${refundId}-Requested`,
        orderNumber: params.order.orderNumber,
        refundNumber,
        refundStatus: 'Requested',
        amount: params.refundAmount,
        referenceId: refCode,
        notes: check.modeNote,
      });
    }

    return refundDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `refunds/${refundId}`);
  }
}

export async function updateSimulatedRefundStatus(params: {
  refund: RefundRecord;
  nextStatus: RefundStatus;
  adminNotes?: string;
  actorUid: string;
  actorEmail?: string;
}): Promise<void> {
  if (!validateRefundTransition(params.refund.status, params.nextStatus)) {
    throw new Error(
      `Invalid refund status transition from "${params.refund.status}" to "${params.nextStatus}".`
    );
  }

  const path = `refunds/${params.refund.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'refunds', params.refund.id), {
      status: params.nextStatus,
      adminNotes: (params.adminNotes ?? params.refund.adminNotes ?? '').trim().slice(0, 400),
      processedByUid: params.actorUid,
      updatedAt: serverTimestamp(),
    });

    if (params.nextStatus === 'Completed') {
      const isFull = params.refund.refundAmount >= params.refund.eligiblePaidAmount;
      batch.update(doc(db, 'orders', params.refund.orderId), {
        status: 'Refunded',
        paymentStatus: isFull ? 'Refunded' : 'Partially Refunded',
        updatedAt: serverTimestamp(),
      });
      if (params.refund.returnId) {
        batch.update(doc(db, 'returnRequests', params.refund.returnId), {
          status: 'Refunded',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    await writeAuditLog({
      entityType: 'refund',
      entityId: params.refund.id,
      action: `Simulated refund ${params.refund.refundNumber}: ${params.refund.status} -> ${params.nextStatus}`,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      beforeValues: { status: params.refund.status, refundAmount: params.refund.refundAmount },
      afterValues: { status: params.nextStatus, refundAmount: params.refund.refundAmount },
      details: params.adminNotes || params.refund.refundModeNote || '',
    });

    await emitInAppNotificationSafe({
      userId: params.refund.userId,
      type: 'refund_update',
      title: `Simulated Refund ${params.refund.refundNumber}: ${params.nextStatus}`,
      message: `Simulated refund of ₹${params.refund.refundAmount.toLocaleString('en-IN')} for order ${params.refund.orderNumber} is ${params.nextStatus}.`,
      orderNumber: params.refund.orderNumber,
      createdByUid: params.actorUid,
    });

    const recipientEmail = await resolveOrderCustomerEmail(params.refund.orderId);
    if (recipientEmail) {
      void triggerTransactionalEmail({
        templateType: 'refund_update',
        recipientEmail,
        recipientName: params.refund.customerName,
        userId: params.refund.userId,
        idempotencyKey: `ref-${params.refund.id}-${params.nextStatus}`,
        orderNumber: params.refund.orderNumber,
        refundNumber: params.refund.refundNumber,
        refundStatus: params.nextStatus,
        amount: params.refund.refundAmount,
        referenceId: params.refund.referenceId,
        notes: params.adminNotes || params.refund.refundModeNote,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ---------- AUDIT LOGS ----------

export async function fetchAuditLogs(maxCount = 200): Promise<AuditLogRecord[]> {
  const path = 'auditLogs';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditLogRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
