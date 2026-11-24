import { describe, expect, it } from 'vitest';
import {
  checkReturnEligibility,
  DEFAULT_RETURN_POLICY,
  mapShipmentStatusToOrderStatus,
  validateRefundTransition,
  validateReturnTransition,
  validateShipmentTransition,
  validateSimulatedRefundRequest,
} from '../services/shippingReturnsService';
import {
  OrderRecord,
  RefundRecord,
  ReturnPolicyConfig,
  ReturnRequestRecord,
} from '../types/shippingReturns';

const basePolicy: ReturnPolicyConfig = {
  ...DEFAULT_RETURN_POLICY,
};

const sampleOrder = (overrides: Partial<OrderRecord> = {}): OrderRecord => ({
  id: 'SDA-100001',
  userId: 'user-cust-1',
  customerName: 'Sravani Reddy',
  orderNumber: 'SDA-100001',
  items: [
    {
      productId: 'prod-7',
      name: 'Pure Kanchipuram Bridal Pattu Saree',
      category: 'Kanchipuram Sarees',
      variantSku: 'SAR-KAN-007-CRM',
      quantity: 2,
      unitPrice: 28800,
      basePrice: 32000,
      discount: 10,
    },
    {
      productId: 'prod-6',
      name: 'Royal Zardozi Embroidered Velvet Lehenga Set',
      category: 'Designer Dresses',
      variantSku: 'DRS-LEH-006-M',
      quantity: 1,
      unitPrice: 46400,
      basePrice: 58000,
      discount: 20,
    },
  ],
  total: 104000,
  status: 'Delivered',
  paymentMethod: 'upi',
  paymentStatus: 'Successful',
  deliveredAt: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  ...overrides,
});

describe('Milestone 7 — Shipment State Machine & Order Sync', () => {
  it('allows valid shipment progression and blocks invalid jumps', () => {
    expect(validateShipmentTransition('Shipment Created', 'Ready for Pickup')).toBe(true);
    expect(validateShipmentTransition('Ready for Pickup', 'Picked Up')).toBe(true);
    expect(validateShipmentTransition('Picked Up', 'In Transit')).toBe(true);
    expect(validateShipmentTransition('In Transit', 'Reached Destination Hub')).toBe(true);
    expect(validateShipmentTransition('Reached Destination Hub', 'Out for Delivery')).toBe(true);
    expect(validateShipmentTransition('Out for Delivery', 'Delivered')).toBe(true);

    // Failed attempt retry flow
    expect(validateShipmentTransition('Out for Delivery', 'Delivery Attempt Failed')).toBe(true);
    expect(validateShipmentTransition('Delivery Attempt Failed', 'Out for Delivery')).toBe(true);
    expect(validateShipmentTransition('Delivery Attempt Failed', 'Returned to Sender')).toBe(true);

    // Invalid jumps
    expect(validateShipmentTransition('Shipment Created', 'Delivered')).toBe(false);
    expect(validateShipmentTransition('Shipment Cancelled', 'Delivered')).toBe(false);
    expect(validateShipmentTransition('Delivered', 'In Transit')).toBe(false);
    expect(validateShipmentTransition('Returned to Sender', 'Out for Delivery')).toBe(false);
  });

  it('maps shipment status accurately to order status', () => {
    expect(mapShipmentStatusToOrderStatus('Shipment Created')).toBe('Confirmed & Packed');
    expect(mapShipmentStatusToOrderStatus('In Transit')).toBe('Shipped');
    expect(mapShipmentStatusToOrderStatus('Out for Delivery')).toBe('Out for Delivery');
    expect(mapShipmentStatusToOrderStatus('Delivered')).toBe('Delivered');
    expect(mapShipmentStatusToOrderStatus('Delivery Attempt Failed')).toBe('Delivery Failed');
    expect(mapShipmentStatusToOrderStatus('Returned to Sender')).toBe('Returned to Sender');
    expect(mapShipmentStatusToOrderStatus('Shipment Cancelled')).toBe('Cancelled');
  });
});

describe('Milestone 7 — Return Eligibility & Duplicate Prevention', () => {
  it('accepts eligible delivered order within return window', () => {
    const res = checkReturnEligibility({
      order: sampleOrder(),
      policy: basePolicy,
      existingReturns: [],
      selectedItems: [{ productId: 'prod-7', variantSku: 'SAR-KAN-007-CRM', quantity: 1 }],
    });
    expect(res.eligible).toBe(true);
    expect(res.requestedRefundAmount).toBe(28800);
    expect(res.itemsToReturn).toHaveLength(1);
  });

  it('rejects returns when policy disables returns', () => {
    const res = checkReturnEligibility({
      order: sampleOrder(),
      policy: { ...basePolicy, returnsEnabled: false },
      existingReturns: [],
      selectedItems: [{ productId: 'prod-7', variantSku: 'SAR-KAN-007-CRM', quantity: 1 }],
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('disabled');
  });

  it('rejects return on undelivered order', () => {
    const res = checkReturnEligibility({
      order: sampleOrder({ status: 'In Transit' }),
      policy: basePolicy,
      existingReturns: [],
      selectedItems: [{ productId: 'prod-7', variantSku: 'SAR-KAN-007-CRM', quantity: 1 }],
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('delivered orders');
  });

  it('rejects return outside configured return window', () => {
    const oldDelivery = new Date(Date.now() - 12 * 86400000).toISOString();
    const res = checkReturnEligibility({
      order: sampleOrder({ deliveredAt: oldDelivery }),
      policy: basePolicy, // 7 days
      existingReturns: [],
      selectedItems: [{ productId: 'prod-7', variantSku: 'SAR-KAN-007-CRM', quantity: 1 }],
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('expired');
  });

  it('rejects non-returnable product', () => {
    const res = checkReturnEligibility({
      order: sampleOrder(),
      policy: basePolicy, // prod-6 is non-returnable
      existingReturns: [],
      selectedItems: [{ productId: 'prod-6', variantSku: 'DRS-LEH-006-M', quantity: 1 }],
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('non-returnable');
  });

  it('prevents duplicate return requests exceeding ordered quantity', () => {
    const existing: ReturnRequestRecord[] = [
      {
        id: 'RET-1',
        returnNumber: 'RET-100001',
        orderId: 'SDA-100001',
        orderNumber: 'SDA-100001',
        userId: 'user-cust-1',
        customerName: 'Sravani Reddy',
        items: [
          {
            productId: 'prod-7',
            productName: 'Pure Kanchipuram Bridal Pattu Saree',
            category: 'Kanchipuram Sarees',
            variantSku: 'SAR-KAN-007-CRM',
            quantity: 2,
            unitPrice: 28800,
            lineTotal: 57600,
          },
        ],
        requestedRefundAmount: 57600,
        reason: 'Wrong item or variant delivered',
        status: 'Requested',
      },
    ];

    const res = checkReturnEligibility({
      order: sampleOrder(),
      policy: basePolicy,
      existingReturns: existing,
      selectedItems: [{ productId: 'prod-7', variantSku: 'SAR-KAN-007-CRM', quantity: 1 }],
    });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('Duplicate');
  });
});

describe('Milestone 7 — Return & Simulated Refund Workflows', () => {
  it('enforces valid return inspection and refund status transitions', () => {
    expect(validateReturnTransition('Requested', 'Under Review')).toBe(true);
    expect(validateReturnTransition('Under Review', 'Approved')).toBe(true);
    expect(validateReturnTransition('Approved', 'Pickup Pending')).toBe(true);
    expect(validateReturnTransition('Pickup Pending', 'Item Received')).toBe(true);
    expect(validateReturnTransition('Item Received', 'Inspection Pending')).toBe(true);
    expect(validateReturnTransition('Inspection Pending', 'Inspection Passed')).toBe(true);
    expect(validateReturnTransition('Inspection Passed', 'Refund Initiated')).toBe(true);
    expect(validateReturnTransition('Refund Initiated', 'Refunded')).toBe(true);
    expect(validateReturnTransition('Refunded', 'Closed')).toBe(true);

    // Invalid shortcuts
    expect(validateReturnTransition('Requested', 'Refunded')).toBe(false);
    expect(validateReturnTransition('Rejected', 'Approved')).toBe(false);
    expect(validateReturnTransition('Closed', 'Under Review')).toBe(false);
  });

  it('validates simulated refund caps, prevents duplicates, and labels COD clearly', () => {
    const order = sampleOrder({ total: 28800, paymentMethod: 'cod', paymentStatus: 'Pending COD' });
    const ret: ReturnRequestRecord = {
      id: 'RET-2',
      returnNumber: 'RET-100002',
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerName: order.customerName,
      items: [],
      requestedRefundAmount: 28800,
      reason: 'Size or fit mismatch',
      status: 'Inspection Passed',
    };

    // Valid COD refund
    const ok = validateSimulatedRefundRequest({
      order,
      returnRequest: ret,
      existingRefunds: [],
      refundAmount: 28800,
    });
    expect(ok.valid).toBe(true);
    expect(ok.isCod).toBe(true);
    expect(ok.modeNote).toContain('Cash-on-Delivery');
    expect(ok.modeNote).toContain('No real financial transfer');

    // Exceeds paid amount
    const overCap = validateSimulatedRefundRequest({
      order,
      returnRequest: ret,
      existingRefunds: [],
      refundAmount: 35000,
    });
    expect(overCap.valid).toBe(false);
    expect(overCap.reason).toContain('cannot exceed');

    // Duplicate refund blocked
    const priorRefund: RefundRecord = {
      id: 'REF-1',
      refundNumber: 'REF-100001',
      orderId: order.id,
      orderNumber: order.orderNumber,
      returnId: ret.id,
      userId: order.userId,
      customerName: order.customerName,
      originalPaymentMethod: 'cod',
      eligiblePaidAmount: 28800,
      refundAmount: 28800,
      isSimulated: true,
      status: 'Completed',
    };
    const dup = validateSimulatedRefundRequest({
      order,
      returnRequest: ret,
      existingRefunds: [priorRefund],
      refundAmount: 28800,
    });
    expect(dup.valid).toBe(false);
    expect(dup.reason).toContain('already exists');
  });

  it('enforces simulated refund state transitions', () => {
    expect(validateRefundTransition('Requested', 'Approved')).toBe(true);
    expect(validateRefundTransition('Approved', 'Processing')).toBe(true);
    expect(validateRefundTransition('Processing', 'Completed')).toBe(true);
    expect(validateRefundTransition('Completed', 'Rejected')).toBe(false);
    expect(validateRefundTransition('Rejected', 'Completed')).toBe(false);
  });
});
