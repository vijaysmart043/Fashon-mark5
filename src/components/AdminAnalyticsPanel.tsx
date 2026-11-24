import React, { useMemo, useState } from 'react';
import {
  AnalyticsSummary,
  computeBusinessAnalytics,
  DateFilterPreset,
  DateRangeFilter,
} from '../services/analyticsReportsService';
import { OrderRecord, RefundRecord, ReturnRequestRecord, ShipmentRecord } from '../types/shippingReturns';
import { ProductVariantDoc } from '../services/storeConfigService';
import { Info, TrendingUp } from 'lucide-react';

interface AdminAnalyticsPanelProps {
  orders: OrderRecord[];
  payments: any[];
  returns: ReturnRequestRecord[];
  refunds: RefundRecord[];
  shipments: ShipmentRecord[];
  customers: any[];
  variants: ProductVariantDoc[];
  lowStockThreshold: number;
}

const PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: 'all_time', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export const AdminAnalyticsPanel: React.FC<AdminAnalyticsPanelProps> = ({
  orders,
  payments,
  returns,
  refunds,
  shipments,
  customers,
  variants,
  lowStockThreshold,
}) => {
  const [preset, setPreset] = useState<DateFilterPreset>('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const dateFilter: DateRangeFilter = { preset, startDate, endDate };

  const stats: AnalyticsSummary = useMemo(
    () =>
      computeBusinessAnalytics({
        orders,
        payments,
        returns,
        refunds,
        shipments,
        customers,
        variants,
        lowStockThreshold,
        dateFilter,
      }),
    [orders, payments, returns, refunds, shipments, customers, variants, lowStockThreshold, preset, startDate, endDate]
  );

  const kpiCards = [
    { label: 'Total Orders', value: stats.totalOrders.toLocaleString('en-IN'), sub: 'All statuses in range' },
    { label: 'Confirmed Orders', value: stats.confirmedOrders.toLocaleString('en-IN'), sub: 'Excl. cancelled & failed' },
    { label: 'Cancelled Orders', value: stats.cancelledOrders.toLocaleString('en-IN'), sub: 'Stock restored on cancel' },
    { label: 'Returned / Return Flow', value: stats.returnedOrders.toLocaleString('en-IN'), sub: 'Return lifecycle orders' },
    { label: 'Gross Order Value', value: `₹${stats.grossOrderValue.toLocaleString('en-IN')}`, sub: 'Simulated + COD orders' },
    { label: 'Collected Sim. Revenue', value: `₹${stats.collectedSimulatedRevenue.toLocaleString('en-IN')}`, sub: 'Demo online payments only' },
    { label: 'Confirmed COD Value', value: `₹${stats.confirmedCodOrderValue.toLocaleString('en-IN')}`, sub: 'Total active COD orders' },
    { label: 'Pending COD Collection', value: `₹${stats.pendingCodValue.toLocaleString('en-IN')}`, sub: 'Awaiting doorstep receipt' },
    { label: 'Completed Sim. Refunds', value: `₹${stats.completedSimulatedRefundsValue.toLocaleString('en-IN')}`, sub: 'Simulated reversals' },
    { label: 'Net Sim. Revenue', value: `₹${stats.netSimulatedRevenue.toLocaleString('en-IN')}`, sub: 'Collected Sim. − Refunds' },
    { label: 'Average Order Value', value: `₹${stats.averageOrderValue.toLocaleString('en-IN')}`, sub: 'Gross / Confirmed Orders' },
    { label: 'Total Customers', value: stats.totalRegisteredCustomers.toLocaleString('en-IN'), sub: `${stats.activeCustomersInPeriod} active in range` },
    { label: 'Low Stock Variants', value: stats.lowStockVariantsCount.toLocaleString('en-IN'), sub: `Threshold <= ${lowStockThreshold} units` },
    { label: 'Pending Shipments', value: stats.pendingShipmentsCount.toLocaleString('en-IN'), sub: 'Awaiting delivery' },
    { label: 'Pending Returns', value: stats.pendingReturnsCount.toLocaleString('en-IN'), sub: 'Review / inspection' },
    { label: 'Pending Sim. Refunds', value: stats.pendingRefundsCount.toLocaleString('en-IN'), sub: 'Requested / processing' },
  ];

  const maxDaily = Math.max(1, ...stats.dailySalesSeries.map((d) => d.value));
  const maxMonthly = Math.max(1, ...stats.monthlySalesSeries.map((d) => d.value));
  const maxCat = Math.max(1, ...stats.revenueByCategorySeries.map((d) => d.value));
  const maxStatus = Math.max(1, ...stats.ordersByStatusSeries.map((d) => d.value));
  const maxProd = Math.max(1, ...stats.bestSellingProductsSeries.map((d) => d.revenue));
  const maxPm = Math.max(1, ...stats.paymentMethodSeries.map((d) => d.value));
  const maxTrend = Math.max(
    1,
    ...stats.returnCancellationTrendSeries.map((d) => Math.max(d.returns, d.cancellations))
  );

  return (
    <div className="space-y-6">
      {/* Date Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p.id
                  ? 'bg-[#120D0B] text-[#F8F1E4]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white"
            />
          </div>
        )}
      </div>

      {/* Simulation & Methodology Disclaimer */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Live Firestore Analytics (Simulated Demo Payments & COD Distinguished)</p>
          <p className="text-[11px] text-amber-900/90">
            All online payments and refunds shown are demo/simulated records with no real monetary settlement.
            Failed payments and cancelled orders are excluded from Gross & Collected Simulated Revenue.
            Pending COD orders are separated from Collected Simulated Revenue. Net Simulated Revenue = Collected Simulated Revenue − Completed Simulated Refunds.
          </p>
        </div>
      </div>

      {/* 16 KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{k.label}</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[#120D0B] mt-1">{k.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 7 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Daily Sales Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">1. Daily Sales Trend</h3>
              <p className="text-[11px] text-gray-500">Gross active order value by day (INR)</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#D4AF62]" />
          </div>
          {stats.dailySalesSeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-10 text-center">No active orders in selected window.</p>
          ) : (
            <div className="space-y-2">
              {stats.dailySalesSeries.map((d) => (
                <div key={d.label} className="flex items-center gap-3 text-xs">
                  <span className="w-24 font-mono text-[11px] text-gray-600 shrink-0">{d.label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#120D0B] rounded transition-all"
                      style={{ width: `${Math.max(4, Math.round((d.value / maxDaily) * 100))}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono tabular-nums font-semibold">
                    ₹{d.value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Monthly Sales Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">2. Monthly Sales Performance</h3>
              <p className="text-[11px] text-gray-500">Monthly active order volume & value</p>
            </div>
          </div>
          {stats.monthlySalesSeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-10 text-center">No monthly sales records yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.monthlySalesSeries.map((d) => (
                <div key={d.label} className="flex items-center gap-3 text-xs">
                  <span className="w-20 font-mono text-[11px] text-gray-600 shrink-0">{d.label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#D4AF62] rounded transition-all"
                      style={{ width: `${Math.max(4, Math.round((d.value / maxMonthly) * 100))}%` }}
                    />
                  </div>
                  <span className="w-28 text-right font-mono tabular-nums font-semibold">
                    ₹{d.value.toLocaleString('en-IN')} ({d.orders})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Orders by Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">3. Orders by Status</h3>
            <p className="text-[11px] text-gray-500">Operational distribution across order stages</p>
          </div>
          {stats.ordersByStatusSeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No orders found.</p>
          ) : (
            <div className="space-y-2">
              {stats.ordersByStatusSeries.map((s) => (
                <div key={s.label} className="flex items-center gap-3 text-xs">
                  <span className="w-36 truncate text-gray-700 font-medium">{s.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#65102F] rounded"
                      style={{ width: `${Math.max(6, Math.round((s.value / maxStatus) * 100))}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono tabular-nums font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Revenue by Category */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">4. Revenue by Category</h3>
            <p className="text-[11px] text-gray-500">Item gross revenue grouped by product category</p>
          </div>
          {stats.revenueByCategorySeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No category revenue recorded.</p>
          ) : (
            <div className="space-y-2">
              {stats.revenueByCategorySeries.map((c) => (
                <div key={c.label} className="flex items-center gap-3 text-xs">
                  <span className="w-36 truncate text-gray-700 font-medium">{c.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded"
                      style={{ width: `${Math.max(6, Math.round((c.value / maxCat) * 100))}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono tabular-nums font-semibold">
                    ₹{c.value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Best-Selling Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">5. Best-Selling Products</h3>
            <p className="text-[11px] text-gray-500">Top products ranked by item revenue & units</p>
          </div>
          {stats.bestSellingProductsSeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No product sales recorded.</p>
          ) : (
            <div className="space-y-2">
              {stats.bestSellingProductsSeries.map((p) => (
                <div key={p.label} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="truncate font-medium text-gray-800 max-w-[260px]">{p.label}</span>
                    <span className="font-mono tabular-nums text-gray-700">
                      {p.units} units · ₹{p.revenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#120D0B] rounded"
                      style={{ width: `${Math.max(5, Math.round((p.revenue / maxProd) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Payment Method Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">6. Payment Method Distribution</h3>
            <p className="text-[11px] text-gray-500">Demo simulated online methods vs COD</p>
          </div>
          {stats.paymentMethodSeries.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No payment data recorded.</p>
          ) : (
            <div className="space-y-2">
              {stats.paymentMethodSeries.map((pm) => (
                <div key={pm.label} className="flex items-center gap-3 text-xs">
                  <span className="w-24 font-mono font-bold text-[#120D0B]">{pm.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-600 rounded"
                      style={{ width: `${Math.max(6, Math.round((pm.value / maxPm) * 100))}%` }}
                    />
                  </div>
                  <span className="w-28 text-right font-mono tabular-nums">
                    {pm.count} · ₹{pm.value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Return and Cancellation Trend + Tax/Discount Footnote */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-cinzel font-bold text-sm text-[#120D0B]">7. Return & Cancellation Trend</h3>
            <p className="text-[11px] text-gray-500">Daily return requests vs cancelled orders</p>
          </div>
          <div className="text-[11px] font-mono text-gray-600">
            GST Charged: ₹{stats.totalGstCollected.toLocaleString('en-IN')} · Coupon Deductions: ₹
            {stats.totalDiscountDeductions.toLocaleString('en-IN')}
          </div>
        </div>
        {stats.returnCancellationTrendSeries.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No return requests or cancellations in this period.</p>
        ) : (
          <div className="space-y-2">
            {stats.returnCancellationTrendSeries.map((t) => (
              <div key={t.label} className="flex items-center gap-3 text-xs">
                <span className="w-24 font-mono text-[11px] text-gray-600">{t.label}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#65102F]"
                        style={{ width: `${t.returns > 0 ? Math.max(10, Math.round((t.returns / maxTrend) * 100)) : 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] w-16">Ret: {t.returns}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-gray-500"
                        style={{
                          width: `${t.cancellations > 0 ? Math.max(10, Math.round((t.cancellations / maxTrend) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[11px] w-16">Can: {t.cancellations}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
