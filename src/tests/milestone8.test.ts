import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeAuthoritativeQuote, createApiApp, sanitizeAuditSnapshot } from '../../server';
import {
  computeBusinessAnalytics,
  generateBusinessReport,
  maskEmailForReport,
  REPORT_DEFINITIONS,
  sanitizeCsvCell,
} from '../services/analyticsReportsService';
import {
  calculateOrderPricing,
  DEFAULT_COUPONS,
  DEFAULT_STORE_CONFIG,
  validateCouponAgainstSubtotal,
  validateInventoryDelta,
  validateStaffRoleChangeSafety,
} from '../services/storeConfigService';
import { PRODUCTS } from '../data/mockData';
import {
  AdminMemberRecord,
  OrderRecord,
  RefundRecord,
  ReturnRequestRecord,
  ShipmentRecord,
} from '../types/shippingReturns';

const sampleStaff: AdminMemberRecord[] = [
  {
    uid: 'uid-super-1',
    email: 'vsmart996@gmail.com',
    fullName: 'Primary Super Admin',
    role: 'super_admin',
    active: true,
  },
  {
    uid: 'uid-ord-1',
    email: 'orders@sdacollections.com',
    fullName: 'Orders Lead',
    role: 'order_manager',
    active: true,
  },
];

const sampleOrders: OrderRecord[] = [
  {
    id: 'SDA-200001',
    userId: 'cust-1',
    customerName: 'Ananya Rao',
    customerEmail: 'ananya@example.com',
    orderNumber: 'SDA-200001',
    items: [
      {
        productId: 'prod-1',
        name: 'Kemp Temple Gold Necklace',
        category: 'Gold Jewellery',
        variantSku: 'JWL-GLD-001-22K',
        quantity: 1,
        unitPrice: 45000,
        basePrice: 50000,
        discount: 10,
      },
    ],
    subtotal: 45000,
    discountAmount: 0,
    gstAmount: 1350,
    shippingFee: 0,
    total: 46350,
    status: 'Delivered',
    paymentMethod: 'upi',
    paymentStatus: 'Successful',
    createdAt: new Date(),
  },
  {
    id: 'SDA-200002',
    userId: 'cust-2',
    customerName: 'Deepika Sharma',
    customerEmail: 'deepika@example.com',
    orderNumber: 'SDA-200002',
    items: [
      {
        productId: 'prod-7',
        name: 'Kanchipuram Bridal Saree',
        category: 'Kanchipuram Sarees',
        variantSku: 'SAR-KAN-007-CRM',
        quantity: 1,
        unitPrice: 28800,
        basePrice: 32000,
        discount: 10,
      },
    ],
    subtotal: 28800,
    discountAmount: 0,
    gstAmount: 1440,
    shippingFee: 0,
    total: 30240,
    status: 'Confirmed & Packed',
    paymentMethod: 'cod',
    paymentStatus: 'Pending COD',
    createdAt: new Date(),
  },
  {
    id: 'SDA-200003',
    userId: 'cust-3',
    customerName: 'Cancelled Order Customer',
    customerEmail: 'cancel@example.com',
    orderNumber: 'SDA-200003',
    items: [],
    subtotal: 15000,
    discountAmount: 0,
    gstAmount: 450,
    shippingFee: 0,
    total: 15450,
    status: 'Cancelled',
    paymentMethod: 'upi',
    paymentStatus: 'Refunded',
    createdAt: new Date(),
  },
  {
    id: 'SDA-200004',
    userId: 'cust-4',
    customerName: 'Failed Payment Customer',
    customerEmail: 'failed@example.com',
    orderNumber: 'SDA-200004',
    items: [],
    subtotal: 12000,
    discountAmount: 0,
    gstAmount: 360,
    shippingFee: 0,
    total: 12360,
    status: 'Confirmed & Packed',
    paymentMethod: 'card',
    paymentStatus: 'Failed',
    createdAt: new Date(),
  },
];

const sampleRefunds: RefundRecord[] = [
  {
    id: 'REF-1',
    refundNumber: 'REF-1001',
    orderId: 'SDA-200001',
    orderNumber: 'SDA-200001',
    userId: 'cust-1',
    customerName: 'Ananya Rao',
    originalPaymentMethod: 'upi',
    eligiblePaidAmount: 46350,
    refundAmount: 6350,
    isSimulated: true,
    status: 'Completed',
    createdAt: new Date(),
  },
];

const sampleReturns: ReturnRequestRecord[] = [
  {
    id: 'RET-1',
    returnNumber: 'RET-1001',
    orderId: 'SDA-200001',
    orderNumber: 'SDA-200001',
    userId: 'cust-1',
    customerName: 'Ananya Rao',
    items: [],
    requestedRefundAmount: 6350,
    reason: 'Size mismatch',
    status: 'Requested',
    createdAt: new Date(),
  },
];

const sampleShipments: ShipmentRecord[] = [
  {
    id: 'SHP-1',
    orderId: 'SDA-200002',
    orderNumber: 'SDA-200002',
    userId: 'cust-2',
    customerName: 'Deepika Sharma',
    courierName: 'Blue Dart Express Air',
    trackingNumber: 'BD998877',
    status: 'In Transit',
    createdAt: new Date(),
  },
];

describe('Milestone 8 — Server Pricing Quote, GST, Shipping & Coupon Integrity', () => {
  it('computes identical pricing quote across server and client calculators', () => {
    const prodJewel = PRODUCTS.find((p) => p.type === 'jewellery')!;
    const prodSaree = PRODUCTS.find((p) => p.type === 'saree')!;
    const coupon = { ...DEFAULT_COUPONS[0] }; // SDA15: 15%, max 15000

    const clientQuote = calculateOrderPricing({
      items: [
        { product: prodJewel, quantity: 1 },
        { product: prodSaree, quantity: 1 },
      ],
      storeConfig: { ...DEFAULT_STORE_CONFIG },
      appliedCoupon: coupon,
    });

    const serverQuote = computeAuthoritativeQuote({
      items: [
        {
          productId: prodJewel.id,
          basePrice: prodJewel.basePrice,
          discount: prodJewel.discount,
          quantity: 1,
          type: prodJewel.type,
        },
        {
          productId: prodSaree.id,
          basePrice: prodSaree.basePrice,
          discount: prodSaree.discount,
          quantity: 1,
          type: prodSaree.type,
        },
      ],
      couponDiscountPercent: coupon.discountPercent,
      couponMinOrderAmount: coupon.minOrderAmount,
      couponMaxDiscountAmount: coupon.maxDiscountAmount,
      couponActive: coupon.active,
      couponExpiresAt: coupon.expiresAt,
      jewelleryGstPercent: DEFAULT_STORE_CONFIG.jewelleryGstPercent,
      sareeGstPercent: DEFAULT_STORE_CONFIG.sareeGstPercent,
      freeShippingThreshold: DEFAULT_STORE_CONFIG.freeShippingThreshold,
      flatShippingFee: DEFAULT_STORE_CONFIG.flatShippingFee,
    });

    expect(serverQuote.subtotal).toBe(clientQuote.subtotal);
    expect(serverQuote.discountAmount).toBe(clientQuote.discountAmount);
    expect(serverQuote.shippingFee).toBe(clientQuote.shippingFee);
    expect(serverQuote.gstAmount).toBe(clientQuote.gstAmount);
    expect(serverQuote.total).toBe(clientQuote.total);
  });

  it('rejects negative/invalid prices, quantities, and expired coupons', () => {
    expect(() =>
      computeAuthoritativeQuote({
        items: [{ productId: 'x', basePrice: -500, discount: 0, quantity: 1 }],
      })
    ).toThrow(/Invalid item price/);

    expect(() =>
      computeAuthoritativeQuote({
        items: [{ productId: 'x', basePrice: 1000, discount: 0, quantity: 0 }],
      })
    ).toThrow(/Invalid item quantity/);

    const expiredResult = validateCouponAgainstSubtotal({
      codeInput: 'OLD10',
      coupons: [
        {
          code: 'OLD10',
          discountPercent: 10,
          minOrderAmount: 500,
          maxDiscountAmount: 1000,
          usageCount: 0,
          usageLimit: 10,
          expiresAt: '2020-01-01',
          active: true,
        },
      ],
      subtotal: 5000,
    });
    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.reason).toContain('expired');
  });
});

describe('Milestone 8 — Staff RBAC Safety & Inventory Non-Negative Guards', () => {
  it('blocks removing, demoting, or deactivating the last active Super Admin', () => {
    const demoteRes = validateStaffRoleChangeSafety({
      staffList: sampleStaff,
      targetUid: 'uid-super-1',
      nextRole: 'order_manager',
      nextActive: true,
      actorUid: 'uid-super-1',
    });
    expect(demoteRes.allowed).toBe(false);
    expect(demoteRes.reason).toContain('last active Super Admin');

    const deactivateRes = validateStaffRoleChangeSafety({
      staffList: sampleStaff,
      targetUid: 'uid-super-1',
      nextRole: 'super_admin',
      nextActive: false,
      actorUid: 'uid-super-1',
    });
    expect(deactivateRes.allowed).toBe(false);

    const revokeRes = validateStaffRoleChangeSafety({
      staffList: sampleStaff,
      targetUid: 'uid-super-1',
      nextRole: 'super_admin',
      nextActive: true,
      actorUid: 'uid-super-1',
      isRevoke: true,
    });
    expect(revokeRes.allowed).toBe(false);
  });

  it('allows updating non-last Super Admin or secondary staff', () => {
    const twoSupers: AdminMemberRecord[] = [
      ...sampleStaff,
      {
        uid: 'uid-super-2',
        email: 'second@sdacollections.com',
        role: 'super_admin',
        active: true,
      },
    ];
    const okRes = validateStaffRoleChangeSafety({
      staffList: twoSupers,
      targetUid: 'uid-super-2',
      nextRole: 'product_manager',
      nextActive: true,
      actorUid: 'uid-super-1',
    });
    expect(okRes.allowed).toBe(true);
  });

  it('blocks negative stock deltas on inventory adjustment', () => {
    expect(validateInventoryDelta(10, -4)).toBe(6);
    expect(validateInventoryDelta(5, -5)).toBe(0);
    expect(() => validateInventoryDelta(3, -4)).toThrow(/cannot be negative/);
  });
});

describe('Milestone 8 — Audit Sanitization, Analytics Accounting & 14 CSV Reports', () => {
  it('redacts passwords, tokens, CVVs, card numbers, and UPI PINs from audit snapshots', () => {
    const sanitized = sanitizeAuditSnapshot({
      email: 'admin@sdacollections.com',
      password: 'secret-password',
      apiKey: 'AIza-secret',
      nested: {
        cardNumber: '4111-xxxx',
        cvv: '999',
        upiPin: '1234',
        note: 'Safe note',
      },
    }) as Record<string, any>;

    expect(sanitized.email).toBe('admin@sdacollections.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.nested.cardNumber).toBe('[REDACTED]');
    expect(sanitized.nested.cvv).toBe('[REDACTED]');
    expect(sanitized.nested.upiPin).toBe('[REDACTED]');
    expect(sanitized.nested.note).toBe('Safe note');
  });

  it('separates Pending COD from Collected Simulated Revenue and excludes Cancelled/Failed orders', () => {
    const analytics = computeBusinessAnalytics({
      orders: sampleOrders,
      payments: [],
      returns: sampleReturns,
      refunds: sampleRefunds,
      shipments: sampleShipments,
      customers: [{ uid: 'cust-1' }, { uid: 'cust-2' }],
      variants: [
        { sku: 'A', productId: 'p1', colour: 'Gold', size: 'S', price: 100, stock: 2 },
        { sku: 'B', productId: 'p1', colour: 'Red', size: 'M', price: 100, stock: 20 },
      ],
      lowStockThreshold: 5,
      dateFilter: { preset: 'all_time' },
    });

    // Orders: SDA-200001 (46350 UPI Successful), SDA-200002 (30240 COD Pending),
    // SDA-200003 (Cancelled -> excluded), SDA-200004 (Failed -> excluded)
    expect(analytics.totalOrders).toBe(4);
    expect(analytics.confirmedOrders).toBe(2);
    expect(analytics.cancelledOrders).toBe(1);
    expect(analytics.grossOrderValue).toBe(46350 + 30240);
    expect(analytics.collectedSimulatedRevenue).toBe(46350);
    expect(analytics.confirmedCodOrderValue).toBe(30240);
    expect(analytics.pendingCodValue).toBe(30240);
    expect(analytics.completedSimulatedRefundsValue).toBe(6350);
    expect(analytics.netSimulatedRevenue).toBe(46350 - 6350);
    expect(analytics.lowStockVariantsCount).toBe(1);
  });

  it('neutralizes CSV formula injection and masks customer emails in reports', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(sanitizeCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(sanitizeCsvCell('@evil')).toBe('"\'@evil"');
    expect(maskEmailForReport('ananya@example.com')).toBe('an***@example.com');
  });

  it('generates all 14 business reports cleanly without throwing', () => {
    expect(REPORT_DEFINITIONS).toHaveLength(14);
    for (const def of REPORT_DEFINITIONS) {
      const generated = generateBusinessReport({
        reportType: def.id,
        orders: sampleOrders,
        payments: [],
        returns: sampleReturns,
        refunds: sampleRefunds,
        shipments: sampleShipments,
        customers: [
          { uid: 'cust-1', fullName: '=HYPERLINK("bad")', email: 'ananya@example.com', mobile: '9848012345' },
        ],
        products: PRODUCTS,
        variants: PRODUCTS.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id }))),
        coupons: [...DEFAULT_COUPONS],
        lowStockThreshold: 5,
        dateFilter: { preset: 'all_time' },
      });
      expect(generated.headers.length).toBeGreaterThan(2);
      expect(generated.csvContent).toContain(generated.headers[0]);
      if (def.id === 'customers') {
        expect(generated.csvContent).toContain('an***@example.com');
        expect(generated.csvContent).toContain("'=HYPERLINK");
      }
    }
  });
});

describe('Milestone 8 — Express Security Endpoints & Rate Limiting', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = createApiApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('exposes /api/health and honest in_app_only /api/notifications/providers', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);
    expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');

    const provRes = await fetch(`${baseUrl}/api/notifications/providers`);
    expect(provRes.status).toBe(200);
    const provJson = await provRes.json();
    expect(provJson.mode).toBe('in_app_only');
    expect(provJson.emailConfigured).toBe(false);
    expect(provJson.smsConfigured).toBe(false);
  });

  it('rejects unauthenticated access on protected verification, report export, and audit endpoints', async () => {
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify`, { method: 'POST' });
    expect(verifyRes.status).toBe(401);

    const exportRes = await fetch(`${baseUrl}/api/reports/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType: 'sales' }),
    });
    expect(exportRes.status).toBe(401);

    const auditRes = await fetch(`${baseUrl}/api/audit/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(auditRes.status).toBe(401);
  });

  it('computes and validates checkout quotes via POST /api/checkout/quote', async () => {
    const res = await fetch(`${baseUrl}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'p1', basePrice: 10000, discount: 10, quantity: 1, type: 'jewellery' }],
        jewelleryGstPercent: 3,
        freeShippingThreshold: 2000,
        flatShippingFee: 150,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.subtotal).toBe(9000);
    expect(data.shippingFee).toBe(0);
    expect(data.gstAmount).toBe(270);
    expect(data.total).toBe(9270);

    const badRes = await fetch(`${baseUrl}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    expect(badRes.status).toBe(400);
  });

  it('enforces rate limiting with HTTP 429 after exceeding endpoint burst threshold', async () => {
    let saw429 = false;
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${baseUrl}/api/notifications/dispatch-external`, {
        method: 'POST',
      });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});
