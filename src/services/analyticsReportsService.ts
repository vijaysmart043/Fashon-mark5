import { Product } from '../data/mockData';
import {
  CouponRecord,
  OrderRecord,
  RefundRecord,
  ReturnRequestRecord,
  ShipmentRecord,
} from '../types/shippingReturns';
import { ProductVariantDoc } from './storeConfigService';

export type DateFilterPreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'custom'
  | 'all_time';

export interface DateRangeFilter {
  preset: DateFilterPreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export function resolveTimestampMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function getFilterWindowBounds(
  filter: DateRangeFilter,
  now = new Date()
): { startMs: number | null; endMs: number | null } {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (filter.preset === 'all_time') {
    return { startMs: null, endMs: null };
  }
  if (filter.preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (filter.preset === 'last_7_days') {
    const start = new Date(now.getTime() - 6 * 86400000);
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (filter.preset === 'last_30_days') {
    const start = new Date(now.getTime() - 29 * 86400000);
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (filter.preset === 'last_90_days') {
    const start = new Date(now.getTime() - 89 * 86400000);
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (filter.preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: endOfToday.getTime() };
  }
  if (filter.preset === 'custom') {
    const startMs = filter.startDate ? new Date(`${filter.startDate}T00:00:00`).getTime() : null;
    const endMs = filter.endDate ? new Date(`${filter.endDate}T23:59:59.999`).getTime() : null;
    return {
      startMs: startMs && !Number.isNaN(startMs) ? startMs : null,
      endMs: endMs && !Number.isNaN(endMs) ? endMs : null,
    };
  }
  return { startMs: null, endMs: null };
}

export function isWithinFilterBounds(ts: any, bounds: { startMs: number | null; endMs: number | null }): boolean {
  if (bounds.startMs === null && bounds.endMs === null) return true;
  const ms = resolveTimestampMillis(ts);
  if (ms === null) return true;
  if (bounds.startMs !== null && ms < bounds.startMs) return false;
  if (bounds.endMs !== null && ms > bounds.endMs) return false;
  return true;
}

export interface AnalyticsSummary {
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  grossOrderValue: number;
  collectedSimulatedRevenue: number;
  confirmedCodOrderValue: number;
  pendingCodValue: number;
  completedSimulatedRefundsValue: number;
  netSimulatedRevenue: number;
  averageOrderValue: number;
  totalRegisteredCustomers: number;
  activeCustomersInPeriod: number;
  lowStockVariantsCount: number;
  pendingShipmentsCount: number;
  pendingReturnsCount: number;
  pendingRefundsCount: number;
  totalGstCollected: number;
  totalDiscountDeductions: number;
  dailySalesSeries: Array<{ label: string; value: number; orders: number }>;
  monthlySalesSeries: Array<{ label: string; value: number; orders: number }>;
  ordersByStatusSeries: Array<{ label: string; value: number }>;
  revenueByCategorySeries: Array<{ label: string; value: number }>;
  bestSellingProductsSeries: Array<{ label: string; units: number; revenue: number }>;
  paymentMethodSeries: Array<{ label: string; count: number; value: number }>;
  returnCancellationTrendSeries: Array<{ label: string; returns: number; cancellations: number }>;
}

export function computeBusinessAnalytics(params: {
  orders: OrderRecord[];
  payments: any[];
  returns: ReturnRequestRecord[];
  refunds: RefundRecord[];
  shipments: ShipmentRecord[];
  customers: any[];
  variants: ProductVariantDoc[];
  lowStockThreshold: number;
  dateFilter: DateRangeFilter;
  now?: Date;
}): AnalyticsSummary {
  const bounds = getFilterWindowBounds(params.dateFilter, params.now);

  const filteredOrders = params.orders.filter((o) => isWithinFilterBounds(o.createdAt, bounds));
  const filteredReturns = params.returns.filter((r) => isWithinFilterBounds(r.createdAt, bounds));
  const filteredRefunds = params.refunds.filter((rf) => isWithinFilterBounds(rf.createdAt, bounds));
  const filteredShipments = params.shipments.filter((s) => isWithinFilterBounds(s.createdAt, bounds));

  // Exclude failed payments & cancelled orders from gross/revenue figures
  const nonFailedOrders = filteredOrders.filter((o) => o.paymentStatus !== 'Failed');
  const activeOrders = nonFailedOrders.filter((o) => o.status !== 'Cancelled');

  const totalOrders = filteredOrders.length;
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'Cancelled').length;
  const returnedOrders = filteredOrders.filter((o) =>
    ['Return Requested', 'Return Approved', 'Refund Initiated', 'Refunded', 'Returned to Sender'].includes(
      o.status
    )
  ).length;
  const confirmedOrders = activeOrders.length;

  const grossOrderValue = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalGstCollected = activeOrders.reduce((s, o) => s + Number(o.gstAmount || 0), 0);
  const totalDiscountDeductions = activeOrders.reduce((s, o) => s + Number(o.discountAmount || 0), 0);

  // Collected simulated online revenue excludes Failed and Pending COD
  const collectedSimulatedRevenue = activeOrders
    .filter((o) => o.paymentMethod.toLowerCase() !== 'cod' && o.paymentStatus !== 'Pending COD')
    .reduce((s, o) => s + Number(o.total || 0), 0);

  // COD split clearly into Confirmed COD value vs Pending COD
  const codActiveOrders = activeOrders.filter((o) => o.paymentMethod.toLowerCase() === 'cod');
  const confirmedCodOrderValue = codActiveOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingCodValue = codActiveOrders
    .filter((o) => o.paymentStatus === 'Pending COD')
    .reduce((s, o) => s + Number(o.total || 0), 0);

  const completedSimulatedRefundsValue = filteredRefunds
    .filter((r) => r.status === 'Completed')
    .reduce((s, r) => s + Number(r.refundAmount || 0), 0);

  // Net Revenue = Collected Simulated Revenue - Completed Simulated Refunds (non-negative floor for clean display or exact diff)
  const netSimulatedRevenue = collectedSimulatedRevenue - completedSimulatedRefundsValue;

  const averageOrderValue =
    confirmedOrders > 0 ? Math.round(grossOrderValue / confirmedOrders) : 0;

  const activeCustomerUids = new Set(activeOrders.map((o) => o.userId).filter(Boolean));
  const lowStockVariantsCount = params.variants.filter(
    (v) => Number(v.stock || 0) <= params.lowStockThreshold
  ).length;
  const pendingShipmentsCount = filteredShipments.filter(
    (s) => !['Delivered', 'Returned to Sender', 'Shipment Cancelled'].includes(s.status)
  ).length;
  const pendingReturnsCount = filteredReturns.filter((r) =>
    ['Requested', 'Under Review', 'Approved', 'Pickup Pending', 'Item Received', 'Inspection Pending'].includes(
      r.status
    )
  ).length;
  const pendingRefundsCount = filteredRefunds.filter((r) =>
    ['Requested', 'Approved', 'Processing'].includes(r.status)
  ).length;

  // Chart 1: Daily sales
  const dailyMap = new Map<string, { value: number; orders: number }>();
  for (const o of activeOrders) {
    const ms = resolveTimestampMillis(o.createdAt);
    const label = ms ? new Date(ms).toISOString().slice(0, 10) : 'Recent';
    const cur = dailyMap.get(label) || { value: 0, orders: 0 };
    cur.value += Number(o.total || 0);
    cur.orders += 1;
    dailyMap.set(label, cur);
  }
  const dailySalesSeries = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([label, d]) => ({ label, value: d.value, orders: d.orders }));

  // Chart 2: Monthly sales
  const monthlyMap = new Map<string, { value: number; orders: number }>();
  for (const o of activeOrders) {
    const ms = resolveTimestampMillis(o.createdAt);
    const label = ms ? new Date(ms).toISOString().slice(0, 7) : 'Current';
    const cur = monthlyMap.get(label) || { value: 0, orders: 0 };
    cur.value += Number(o.total || 0);
    cur.orders += 1;
    monthlyMap.set(label, cur);
  }
  const monthlySalesSeries = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, d]) => ({ label, value: d.value, orders: d.orders }));

  // Chart 3: Orders by status
  const statusMap = new Map<string, number>();
  for (const o of filteredOrders) {
    statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
  }
  const ordersByStatusSeries = Array.from(statusMap.entries()).map(([label, value]) => ({
    label,
    value,
  }));

  // Chart 4: Revenue by category
  const categoryMap = new Map<string, number>();
  for (const o of activeOrders) {
    for (const item of o.items || []) {
      const cat = item.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(item.unitPrice || 0) * Number(item.quantity || 0));
    }
  }
  const revenueByCategorySeries = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  // Chart 5: Best-selling products
  const prodMap = new Map<string, { units: number; revenue: number }>();
  for (const o of activeOrders) {
    for (const item of o.items || []) {
      const name = item.name || item.productId;
      const cur = prodMap.get(name) || { units: 0, revenue: 0 };
      cur.units += Number(item.quantity || 0);
      cur.revenue += Number(item.unitPrice || 0) * Number(item.quantity || 0);
      prodMap.set(name, cur);
    }
  }
  const bestSellingProductsSeries = Array.from(prodMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)
    .map(([label, d]) => ({ label, units: d.units, revenue: d.revenue }));

  // Chart 6: Payment method distribution
  const pmMap = new Map<string, { count: number; value: number }>();
  for (const o of nonFailedOrders) {
    const m = o.paymentMethod.toUpperCase();
    const cur = pmMap.get(m) || { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(o.total || 0);
    pmMap.set(m, cur);
  }
  const paymentMethodSeries = Array.from(pmMap.entries()).map(([label, d]) => ({
    label,
    count: d.count,
    value: d.value,
  }));

  // Chart 7: Return and cancellation trend
  const trendMap = new Map<string, { returns: number; cancellations: number }>();
  for (const o of filteredOrders) {
    if (o.status === 'Cancelled') {
      const ms = resolveTimestampMillis(o.createdAt);
      const label = ms ? new Date(ms).toISOString().slice(0, 10) : 'Recent';
      const cur = trendMap.get(label) || { returns: 0, cancellations: 0 };
      cur.cancellations += 1;
      trendMap.set(label, cur);
    }
  }
  for (const r of filteredReturns) {
    const ms = resolveTimestampMillis(r.createdAt);
    const label = ms ? new Date(ms).toISOString().slice(0, 10) : 'Recent';
    const cur = trendMap.get(label) || { returns: 0, cancellations: 0 };
    cur.returns += 1;
    trendMap.set(label, cur);
  }
  const returnCancellationTrendSeries = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([label, d]) => ({ label, returns: d.returns, cancellations: d.cancellations }));

  return {
    totalOrders,
    confirmedOrders,
    cancelledOrders,
    returnedOrders,
    grossOrderValue,
    collectedSimulatedRevenue,
    confirmedCodOrderValue,
    pendingCodValue,
    completedSimulatedRefundsValue,
    netSimulatedRevenue,
    averageOrderValue,
    totalRegisteredCustomers: params.customers.length,
    activeCustomersInPeriod: activeCustomerUids.size,
    lowStockVariantsCount,
    pendingShipmentsCount,
    pendingReturnsCount,
    pendingRefundsCount,
    totalGstCollected,
    totalDiscountDeductions,
    dailySalesSeries,
    monthlySalesSeries,
    ordersByStatusSeries,
    revenueByCategorySeries,
    bestSellingProductsSeries,
    paymentMethodSeries,
    returnCancellationTrendSeries,
  };
}

// ---------- 14 BUSINESS REPORTS & CSV FORMULA SANITIZATION ----------

export const REPORT_DEFINITIONS = [
  { id: 'sales', label: '1. Sales Report (Demo/Simulated)', group: 'Revenue' },
  { id: 'orders', label: '2. Order Report', group: 'Orders' },
  { id: 'product_performance', label: '3. Product Performance Report', group: 'Catalogue' },
  { id: 'category_performance', label: '4. Category Performance Report', group: 'Catalogue' },
  { id: 'inventory', label: '5. Inventory Report', group: 'Inventory' },
  { id: 'low_stock', label: '6. Low Stock Report', group: 'Inventory' },
  { id: 'customers', label: '7. Customer Report (PII-Minimized)', group: 'Customers' },
  { id: 'payments', label: '8. Payment Report (Simulated)', group: 'Finance' },
  { id: 'cod', label: '9. COD Report', group: 'Finance' },
  { id: 'returns', label: '10. Return Report', group: 'Fulfilment' },
  { id: 'refunds', label: '11. Refund Report (Simulated)', group: 'Finance' },
  { id: 'coupons', label: '12. Coupon Usage Report', group: 'Marketing' },
  { id: 'shipments', label: '13. Shipment Report', group: 'Fulfilment' },
  { id: 'gst_summary', label: '14. GST Summary Report', group: 'Tax' },
] as const;

export type ReportType = (typeof REPORT_DEFINITIONS)[number]['id'];

export function sanitizeCsvCell(raw: unknown): string {
  const s = raw === null || raw === undefined ? '' : String(raw);
  // Neutralize spreadsheet formula injection characters (=, +, -, @, tab, CR)
  const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export interface GeneratedReportTable {
  reportType: ReportType;
  title: string;
  disclaimer: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  csvContent: string;
}

export function maskEmailForReport(email: string): string {
  if (!email || !email.includes('@')) return 'N/A';
  const [local, domain] = email.split('@');
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

function fmtDateIso(ts: any): string {
  const ms = resolveTimestampMillis(ts);
  return ms ? new Date(ms).toISOString().slice(0, 10) : 'N/A';
}

export function generateBusinessReport(params: {
  reportType: ReportType;
  orders: OrderRecord[];
  payments: any[];
  returns: ReturnRequestRecord[];
  refunds: RefundRecord[];
  shipments: ShipmentRecord[];
  customers: any[];
  products: Product[];
  variants: ProductVariantDoc[];
  coupons: CouponRecord[];
  lowStockThreshold: number;
  dateFilter: DateRangeFilter;
}): GeneratedReportTable {
  const bounds = getFilterWindowBounds(params.dateFilter);
  const fOrders = params.orders.filter((o) => isWithinFilterBounds(o.createdAt, bounds));
  const fPayments = params.payments.filter((p) => isWithinFilterBounds(p.createdAt, bounds));
  const fReturns = params.returns.filter((r) => isWithinFilterBounds(r.createdAt, bounds));
  const fRefunds = params.refunds.filter((rf) => isWithinFilterBounds(rf.createdAt, bounds));
  const fShipments = params.shipments.filter((s) => isWithinFilterBounds(s.createdAt, bounds));

  let title = '';
  let disclaimer = 'Generated live from SDA Collections Firestore records.';
  let headers: string[] = [];
  let rows: Array<Array<string | number>> = [];

  switch (params.reportType) {
    case 'sales': {
      title = 'Sales Report (Simulated / Demo Financial Records)';
      disclaimer = 'Simulated payment figures & COD order values are clearly distinguished; no real money transfers.';
      headers = ['Date', 'Order Number', 'Status', 'Payment Method', 'Payment Status', 'Subtotal', 'Discount', 'GST', 'Shipping', 'Total Payable'];
      rows = fOrders
        .filter((o) => o.paymentStatus !== 'Failed')
        .map((o) => [
          fmtDateIso(o.createdAt),
          o.orderNumber,
          o.status,
          o.paymentMethod.toUpperCase(),
          o.paymentStatus,
          o.subtotal ?? o.total,
          o.discountAmount ?? 0,
          o.gstAmount ?? 0,
          o.shippingFee ?? 0,
          o.total,
        ]);
      break;
    }
    case 'orders': {
      title = 'Order Operations Report';
      headers = ['Order Number', 'Customer Name', 'Date', 'Items Count', 'Total (INR)', 'Order Status', 'Payment Status', 'City / PIN'];
      rows = fOrders.map((o) => [
        o.orderNumber,
        o.customerName,
        fmtDateIso(o.createdAt),
        (o.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0),
        o.total,
        o.status,
        o.paymentStatus,
        o.shippingAddress ? `${o.shippingAddress.city} (${o.shippingAddress.pincode})` : 'N/A',
      ]);
      break;
    }
    case 'product_performance': {
      title = 'Product Performance Report';
      headers = ['Product ID', 'Product Name', 'Category', 'Units Sold', 'Gross Item Revenue (INR)', 'Active Status'];
      const stats = new Map<string, { name: string; category: string; units: number; rev: number; active: boolean }>();
      for (const p of params.products) {
        stats.set(p.id, { name: p.name, category: p.category, units: 0, rev: 0, active: p.active });
      }
      for (const o of fOrders.filter((x) => x.status !== 'Cancelled' && x.paymentStatus !== 'Failed')) {
        for (const it of o.items || []) {
          const cur = stats.get(it.productId) || {
            name: it.name,
            category: it.category,
            units: 0,
            rev: 0,
            active: true,
          };
          cur.units += Number(it.quantity || 0);
          cur.rev += Number(it.unitPrice || 0) * Number(it.quantity || 0);
          stats.set(it.productId, cur);
        }
      }
      rows = Array.from(stats.entries()).map(([id, s]) => [
        id,
        s.name,
        s.category,
        s.units,
        s.rev,
        s.active ? 'Active' : 'Inactive',
      ]);
      break;
    }
    case 'category_performance': {
      title = 'Category Performance Report';
      headers = ['Category', 'Orders Count', 'Units Sold', 'Category Revenue (INR)'];
      const catStats = new Map<string, { orderIds: Set<string>; units: number; rev: number }>();
      for (const o of fOrders.filter((x) => x.status !== 'Cancelled' && x.paymentStatus !== 'Failed')) {
        for (const it of o.items || []) {
          const c = it.category || 'Uncategorized';
          const cur = catStats.get(c) || { orderIds: new Set<string>(), units: 0, rev: 0 };
          cur.orderIds.add(o.id);
          cur.units += Number(it.quantity || 0);
          cur.rev += Number(it.unitPrice || 0) * Number(it.quantity || 0);
          catStats.set(c, cur);
        }
      }
      rows = Array.from(catStats.entries()).map(([cat, s]) => [
        cat,
        s.orderIds.size,
        s.units,
        s.rev,
      ]);
      break;
    }
    case 'inventory': {
      title = 'Complete SKU Inventory Report';
      headers = ['SKU', 'Product Name', 'Colour', 'Size', 'Unit Price (INR)', 'Stock On Hand', 'Inventory Value (INR)'];
      rows = params.variants.map((v) => {
        const prod = params.products.find((p) => p.id === v.productId);
        return [
          v.sku,
          prod?.name || v.productId,
          v.colour || 'Standard',
          v.size || 'Standard',
          v.price,
          v.stock,
          v.stock * v.price,
        ];
      });
      break;
    }
    case 'low_stock': {
      title = `Low Stock Alert Report (Threshold <= ${params.lowStockThreshold})`;
      headers = ['SKU', 'Product Name', 'Colour', 'Size', 'Remaining Stock', 'Status'];
      rows = params.variants
        .filter((v) => v.stock <= params.lowStockThreshold)
        .map((v) => {
          const prod = params.products.find((p) => p.id === v.productId);
          return [
            v.sku,
            prod?.name || v.productId,
            v.colour || 'Standard',
            v.size || 'Standard',
            v.stock,
            v.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
          ];
        });
      break;
    }
    case 'customers': {
      title = 'Customer Summary Report (PII-Minimized)';
      disclaimer = 'Customer emails and phone numbers are masked for privacy compliance in CSV exports.';
      headers = ['Customer UID', 'Customer Name', 'Masked Email', 'Role', 'Account Status', 'Orders Placed', 'Total Order Value (INR)'];
      rows = params.customers
        .filter((u) => u.role === 'customer' || !u.role)
        .map((u) => {
          const userOrders = fOrders.filter((o) => o.userId === u.uid && o.status !== 'Cancelled');
          const totalSpend = userOrders.reduce((s, o) => s + Number(o.total || 0), 0);
          return [
            u.uid,
            u.fullName || 'Customer',
            maskEmailForReport(u.email || ''),
            u.role || 'customer',
            u.accountStatus || 'active',
            userOrders.length,
            totalSpend,
          ];
        });
      break;
    }
    case 'payments': {
      title = 'Simulated Payment Transactions Report';
      disclaimer = 'All online payments shown here are simulated demo transactions.';
      headers = ['Payment ID', 'Order ID', 'Date', 'Method', 'Amount (INR)', 'Status', 'Transaction Ref'];
      rows = fPayments.map((p) => [
        p.paymentId,
        p.orderId,
        fmtDateIso(p.createdAt),
        String(p.method || '').toUpperCase(),
        Number(p.amount || 0),
        p.status,
        p.transactionRef,
      ]);
      break;
    }
    case 'cod': {
      title = 'Cash on Delivery (COD) Orders Report';
      headers = ['Order Number', 'Customer', 'Date', 'COD Amount (INR)', 'Order Status', 'Payment Collection Status'];
      rows = fOrders
        .filter((o) => o.paymentMethod.toLowerCase() === 'cod')
        .map((o) => [
          o.orderNumber,
          o.customerName,
          fmtDateIso(o.createdAt),
          o.total,
          o.status,
          o.paymentStatus,
        ]);
      break;
    }
    case 'returns': {
      title = 'Customer Return Requests Report';
      headers = ['Return Number', 'Order Number', 'Customer', 'Date', 'Reason', 'Status', 'Requested Refund (INR)'];
      rows = fReturns.map((r) => [
        r.returnNumber,
        r.orderNumber,
        r.customerName,
        fmtDateIso(r.createdAt),
        r.reason,
        r.status,
        r.requestedRefundAmount,
      ]);
      break;
    }
    case 'refunds': {
      title = 'Simulated Refunds Report';
      disclaimer = 'All refunds recorded here are simulated demo entries; no external bank/gateway payout occurs.';
      headers = ['Refund Number', 'Order Number', 'Customer', 'Date', 'Original Method', 'Refund Amount (INR)', 'Status', 'Simulated Reference'];
      rows = fRefunds.map((rf) => [
        rf.refundNumber,
        rf.orderNumber,
        rf.customerName,
        fmtDateIso(rf.createdAt),
        rf.originalPaymentMethod.toUpperCase(),
        rf.refundAmount,
        rf.status,
        rf.referenceId || '',
      ]);
      break;
    }
    case 'coupons': {
      title = 'Coupon Performance & Usage Report';
      headers = ['Coupon Code', 'Discount %', 'Min Order (INR)', 'Max Cap (INR)', 'Usage Count', 'Usage Limit', 'Status', 'Expires At'];
      rows = params.coupons.map((c) => {
        const matchedOrders = fOrders.filter(
          (o) => (o.couponCode || '').toUpperCase() === c.code.toUpperCase()
        ).length;
        return [
          c.code,
          c.discountPercent,
          c.minOrderAmount || 0,
          c.maxDiscountAmount || 0,
          Math.max(c.usageCount || 0, matchedOrders),
          c.usageLimit || 0,
          c.active ? 'Active' : 'Inactive',
          c.expiresAt || 'No expiry',
        ];
      });
      break;
    }
    case 'shipments': {
      title = 'Shipment & Courier Tracking Report';
      headers = ['Shipment ID', 'Order Number', 'Customer', 'Courier', 'Tracking Number', 'Status', 'Ship Date', 'Est. Delivery', 'Actual Delivery'];
      rows = fShipments.map((s) => [
        s.id,
        s.orderNumber,
        s.customerName,
        s.courierName,
        s.trackingNumber || 'Pending',
        s.status,
        s.shippingDate || '',
        s.estimatedDeliveryDate || '',
        s.actualDeliveryDate || '',
      ]);
      break;
    }
    case 'gst_summary': {
      title = 'GST Summary Report (Demo Tax Breakdown)';
      disclaimer = 'Calculated from persisted order subtotals, discounts, and configured GST slabs.';
      headers = ['Order Number', 'Date', 'Taxable Value (INR)', 'GST Charged (INR)', 'Shipping Fee (INR)', 'Grand Total (INR)', 'Order Status'];
      rows = fOrders
        .filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'Failed')
        .map((o) => {
          const taxable = Math.max(0, Number(o.subtotal || o.total) - Number(o.discountAmount || 0));
          return [
            o.orderNumber,
            fmtDateIso(o.createdAt),
            taxable,
            o.gstAmount ?? 0,
            o.shippingFee ?? 0,
            o.total,
            o.status,
          ];
        });
      break;
    }
  }

  const csvLines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
  ];

  return {
    reportType: params.reportType,
    title,
    disclaimer,
    headers,
    rows,
    csvContent: csvLines.join('\n'),
  };
}
