import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  FileText,
  Truck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CouponRecord, OrderRecord } from '../types/shippingReturns';
import { updateOrderStatusAndRestoreStock } from '../services/shippingReturnsService';
import { deleteCouponDoc, saveCoupon } from '../services/storeConfigService';
import { InvoiceView } from './InvoiceView';
import { PRODUCTS } from '../data/mockData';

export type SalesSection = 'orders' | 'payments' | 'invoices' | 'coupons' | 'customers';

interface AdminSalesPanelsProps {
  section: SalesSection;
  orders: OrderRecord[];
  payments: any[];
  invoices: any[];
  coupons: CouponRecord[];
  customers: any[];
  actor: { uid: string; name: string; email: string; role: string };
  canManageOrders: boolean;
  canManageCoupons: boolean;
  onJumpToShipping: () => void;
  onRefresh: () => Promise<void>;
}

const ORDER_STATUS_OPTIONS = [
  'Confirmed & Packed',
  'Processing',
  'Dispatched',
  'In Transit',
  'Delivered',
  'Return Requested',
  'Returned',
  'Cancelled',
];

export const AdminSalesPanels: React.FC<AdminSalesPanelsProps> = ({
  section,
  orders,
  payments,
  invoices,
  coupons,
  customers,
  actor,
  canManageOrders,
  canManageCoupons,
  onJumpToShipping,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Invoice preview modal
  const [previewOrder, setPreviewOrder] = useState<OrderRecord | null>(null);

  // Order Cancel Confirmation Dialog
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<OrderRecord | null>(null);

  // Coupon Form State
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(10);
  const [couponMinOrder, setCouponMinOrder] = useState(2000);
  const [couponMaxDiscount, setCouponMaxDiscount] = useState(10000);
  const [couponLimit, setCouponLimit] = useState(500);
  const [couponExpiry, setCouponExpiry] = useState('2027-12-31');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponActive, setCouponActive] = useState(true);
  const [confirmDeleteCoupon, setConfirmDeleteCoupon] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.customerEmail || '').toLowerCase().includes(q) ||
          (o.couponCode || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, searchTerm]);

  const handleOrderStatusChange = async (order: OrderRecord, nextStatus: string) => {
    if (nextStatus === 'Cancelled' && order.status !== 'Cancelled') {
      setConfirmCancelOrder(order);
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await updateOrderStatusAndRestoreStock({
        order,
        nextStatus,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(`Order ${order.orderNumber} updated to "${nextStatus}".`);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update order status.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCancelOrder = async () => {
    if (!confirmCancelOrder) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await updateOrderStatusAndRestoreStock({
        order: confirmCancelOrder,
        nextStatus: 'Cancelled',
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: 'Cancelled by staff with inventory restoration guard',
      });
      setFeedback(
        `Order ${confirmCancelOrder.orderNumber} cancelled and reserved inventory restored.`
      );
      setConfirmCancelOrder(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Order cancellation failed.');
    } finally {
      setBusy(false);
    }
  };

  const openCouponEditor = (c?: CouponRecord) => {
    if (c) {
      setEditingCouponCode(c.code);
      setCouponCode(c.code);
      setCouponDiscount(c.discountPercent);
      setCouponMinOrder(c.minOrderAmount);
      setCouponMaxDiscount(c.maxDiscountAmount);
      setCouponLimit(c.usageLimit);
      setCouponExpiry(c.expiresAt || '2027-12-31');
      setCouponDesc(c.description || '');
      setCouponActive(c.active);
    } else {
      setEditingCouponCode(null);
      setCouponCode('');
      setCouponDiscount(10);
      setCouponMinOrder(2000);
      setCouponMaxDiscount(5000);
      setCouponLimit(500);
      setCouponExpiry('2027-12-31');
      setCouponDesc('');
      setCouponActive(true);
    }
    setCouponFormOpen(true);
    setErrorMsg('');
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const existing = coupons.find((c) => c.code === editingCouponCode);
      await saveCoupon({
        coupon: {
          code: couponCode,
          discountPercent: couponDiscount,
          minOrderAmount: couponMinOrder,
          maxDiscountAmount: couponMaxDiscount,
          usageCount: existing?.usageCount || 0,
          usageLimit: couponLimit,
          expiresAt: couponExpiry,
          description: couponDesc,
          active: couponActive,
        },
        isNew: !editingCouponCode,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
      });
      setFeedback(`Coupon "${couponCode.toUpperCase()}" saved.`);
      setCouponFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save coupon.');
    } finally {
      setBusy(false);
    }
  };

  const customerSummaries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        return (
          (c.fullName || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.mobile || '').toLowerCase().includes(q)
        );
      })
      .map((c) => {
        const custOrders = orders.filter((o) => o.userId === c.uid);
        const totalSpend = custOrders
          .filter((o) => o.status !== 'Cancelled' && o.paymentStatus !== 'Failed')
          .reduce((acc, o) => acc + Number(o.total || 0), 0);
        return {
          ...c,
          orderCount: custOrders.length,
          totalSpend,
        };
      });
  }, [customers, orders, searchTerm]);

  return (
    <div className="space-y-5 text-xs">
      {previewOrder && (
        <InvoiceView
          order={{
            orderNumber: previewOrder.orderNumber,
            createdAt: previewOrder.createdAt?.toDate
              ? previewOrder.createdAt.toDate().toLocaleDateString('en-IN')
              : 'Persisted Order',
            items: previewOrder.items.map((it) => ({
              product:
                PRODUCTS.find((p) => p.id === it.productId) || {
                  name: it.name,
                  basePrice: it.basePrice || it.unitPrice,
                  discount: it.discount || 0,
                },
              quantity: it.quantity,
              variantSku: it.variantSku,
            })),
            total: previewOrder.total,
            paymentMethod: previewOrder.paymentMethod,
            paymentStatus: previewOrder.paymentStatus,
            shippingAddress: previewOrder.shippingAddress,
          }}
          onClose={() => setPreviewOrder(null)}
        />
      )}

      {confirmCancelOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-cinzel font-bold text-base">Confirm Order Cancellation & Stock Restore</h4>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Cancelling order <strong className="font-mono">{confirmCancelOrder.orderNumber}</strong> will mark it Cancelled and idempotently restore item quantities back to SKU inventory (unless already restored).
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmCancelOrder(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-semibold"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancelOrder}
                disabled={busy}
                className="px-4 py-2 bg-rose-700 text-white rounded-lg font-bold"
              >
                {busy ? 'Cancelling...' : 'Confirm Cancel & Restore Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCoupon && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-cinzel font-bold text-base">Delete Coupon</h4>
            </div>
            <p className="text-gray-600">
              Permanently delete coupon code <strong className="font-mono">{confirmDeleteCoupon}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteCoupon(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteCouponDoc(confirmDeleteCoupon, actor.uid, actor.role, actor.email);
                    setFeedback(`Deleted coupon ${confirmDeleteCoupon}.`);
                    setConfirmDeleteCoupon(null);
                    await onRefresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 bg-rose-700 text-white rounded-lg font-bold"
              >
                Delete Coupon
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback('')} className="underline font-bold">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ORDERS */}
      {section === 'orders' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
              Orders Management ({filteredOrders.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order #, customer, coupon..."
                  className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="All">All Statuses</option>
                {ORDER_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-[#65102F]">
                        <p>{o.orderNumber}</p>
                        {o.couponCode && (
                          <span className="text-[10px] text-emerald-700 font-semibold">Coupon: {o.couponCode}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-[#120D0B]">{o.customerName}</p>
                        <p className="text-[10px] text-gray-500">{o.customerEmail || o.userId}</p>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">₹{o.total.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="uppercase font-semibold">{o.paymentMethod}</span>
                        <p className="text-[10px] text-gray-500">{o.paymentStatus}</p>
                      </td>
                      <td className="p-3">
                        {canManageOrders ? (
                          <select
                            disabled={busy}
                            value={o.status}
                            onChange={(e) => void handleOrderStatusChange(o, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded bg-white font-semibold"
                          >
                            {ORDER_STATUS_OPTIONS.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 rounded font-bold">{o.status}</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setPreviewOrder(o)}
                          className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100 inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> Invoice
                        </button>
                        <button
                          onClick={onJumpToShipping}
                          className="px-2.5 py-1 bg-[#120D0B] text-[#D4AF62] rounded font-bold inline-flex items-center gap-1"
                        >
                          <Truck className="w-3 h-3" /> Ship
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENTS */}
      {section === 'payments' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
                Simulated Payments Ledger ({payments.length})
              </h3>
              <p className="text-[11px] text-amber-800">
                DEMO / SIMULATED records — no live payment gateway settlement occurs.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Payment ID</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No payment records persisted yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.paymentId} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold">{p.paymentId}</td>
                      <td className="p-3 font-mono text-[#65102F]">{p.orderId}</td>
                      <td className="p-3 text-right font-mono font-bold">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 uppercase">{p.method}</td>
                      <td className="p-3 font-mono text-gray-500">{p.transactionRef}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INVOICES */}
      {section === 'invoices' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
            Persisted GST Invoices ({invoices.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Invoice Number</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3">Issued At</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No persisted invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const matchedOrder = orders.find((o) => o.id === inv.orderId);
                    return (
                      <tr key={inv.invoiceNumber} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-bold text-[#120D0B]">{inv.invoiceNumber}</td>
                        <td className="p-3 font-mono text-[#65102F]">{inv.orderId}</td>
                        <td className="p-3 text-right font-mono font-bold">
                          ₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-gray-500 font-mono">
                          {inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleString('en-IN') : 'Persisted'}
                        </td>
                        <td className="p-3 text-right">
                          {matchedOrder && (
                            <button
                              onClick={() => setPreviewOrder(matchedOrder)}
                              className="px-3 py-1 bg-[#120D0B] text-[#D4AF62] rounded font-bold inline-flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" /> Preview / Print
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COUPONS */}
      {section === 'coupons' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
                Promotional Coupons ({coupons.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                Enforced identically in Cart, Checkout, and server quote verification.
              </p>
            </div>
            {canManageCoupons && (
              <button
                onClick={() => openCouponEditor()}
                className="px-3.5 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Coupon
              </button>
            )}
          </div>

          {couponFormOpen && (
            <form onSubmit={handleSaveCoupon} className="bg-white border-2 border-[#D4AF62] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-cinzel font-bold text-sm">
                  {editingCouponCode ? `Edit Coupon: ${editingCouponCode}` : 'Create Coupon'}
                </h4>
                <button type="button" onClick={() => setCouponFormOpen(false)} className="text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingCouponCode)}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="FESTIVE15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min Order (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={couponMinOrder}
                    onChange={(e) => setCouponMinOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Max Discount Cap (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={couponMaxDiscount}
                    onChange={(e) => setCouponMaxDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Usage Limit (0 = Unlimited)</label>
                  <input
                    type="number"
                    min={0}
                    value={couponLimit}
                    onChange={(e) => setCouponLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={couponExpiry}
                    onChange={(e) => setCouponExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={couponDesc}
                    onChange={(e) => setCouponDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2 font-semibold pt-5">
                  <input type="checkbox" checked={couponActive} onChange={(e) => setCouponActive(e.target.checked)} />
                  Active Coupon
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCouponFormOpen(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-5 py-2 bg-[#120D0B] text-[#D4AF62] font-bold rounded-lg">
                  {busy ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Min Order</th>
                  <th className="p-3 text-right">Max Cap</th>
                  <th className="p-3 text-right">Used / Limit</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((c) => (
                  <tr key={c.code} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-[#65102F]">{c.code}</td>
                    <td className="p-3 text-right font-mono">{c.discountPercent}%</td>
                    <td className="p-3 text-right font-mono">₹{c.minOrderAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">₹{c.maxDiscountAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-mono">
                      {c.usageCount} / {c.usageLimit || '∞'}
                    </td>
                    <td className="p-3 font-mono text-gray-500">{c.expiresAt || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          c.active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {canManageCoupons && (
                        <>
                          <button
                            onClick={() => openCouponEditor(c)}
                            className="px-2.5 py-1 border border-gray-300 rounded font-semibold hover:bg-gray-100 inline-flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCoupon(c.code)}
                            className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded font-semibold hover:bg-rose-50 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMERS */}
      {section === 'customers' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-cinzel font-bold text-base text-[#120D0B]">
              Registered Customer Directory ({customerSummaries.length})
            </h3>
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customer name, email, phone..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Active Order Value</th>
                  <th className="p-3">Loyalty Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No matching registered customers found.
                    </td>
                  </tr>
                ) : (
                  customerSummaries.map((c) => (
                    <tr key={c.uid} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-[#120D0B]">{c.fullName || 'Customer'}</td>
                      <td className="p-3 text-gray-600">{c.email || '—'}</td>
                      <td className="p-3 font-mono text-gray-600">{c.mobile || '—'}</td>
                      <td className="p-3 text-right font-mono">{c.orderCount}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        ₹{c.totalSpend.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3">{c.loyaltyTier || 'Silver Heritage'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
