import React, { useMemo, useState } from 'react';
import {
  DateFilterPreset,
  generateBusinessReport,
  REPORT_DEFINITIONS,
  ReportType,
} from '../services/analyticsReportsService';
import { Product } from '../data/mockData';
import {
  CouponRecord,
  OrderRecord,
  RefundRecord,
  ReturnRequestRecord,
  ShipmentRecord,
} from '../types/shippingReturns';
import { authorizeCsvExportWithServer, ProductVariantDoc } from '../services/storeConfigService';
import { writeAuditLog } from '../services/shippingReturnsService';
import { Download, Search, FileSpreadsheet, ArrowUpDown } from 'lucide-react';

interface AdminReportsPanelProps {
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
  actor: { uid: string; email: string; role: string };
}

export const AdminReportsPanel: React.FC<AdminReportsPanelProps> = ({
  orders,
  payments,
  returns,
  refunds,
  shipments,
  customers,
  products,
  variants,
  coupons,
  lowStockThreshold,
  actor,
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
  const [preset, setPreset] = useState<DateFilterPreset>('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [exportStatus, setExportStatus] = useState('');
  const pageSize = 15;

  const report = useMemo(
    () =>
      generateBusinessReport({
        reportType: selectedReport,
        orders,
        payments,
        returns,
        refunds,
        shipments,
        customers,
        products,
        variants,
        coupons,
        lowStockThreshold,
        dateFilter: { preset, startDate, endDate },
      }),
    [
      selectedReport,
      orders,
      payments,
      returns,
      refunds,
      shipments,
      customers,
      products,
      variants,
      coupons,
      lowStockThreshold,
      preset,
      startDate,
      endDate,
    ]
  );

  const filteredAndSortedRows = useMemo(() => {
    let list = report.rows;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
    }
    if (sortColIdx !== null) {
      list = [...list].sort((a, b) => {
        const va = a[sortColIdx];
        const vb = b[sortColIdx];
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortAsc ? va - vb : vb - va;
        }
        return sortAsc
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    return list;
  }, [report.rows, searchTerm, sortColIdx, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAndSortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleDownloadCsv = async () => {
    setExportStatus('');
    try {
      const authCheck = await authorizeCsvExportWithServer(selectedReport);
      if (!authCheck.authorized) {
        setExportStatus('Export authorization denied.');
        return;
      }

      const blob = new Blob([report.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sda-${selectedReport}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await writeAuditLog({
        entityType: 'storeSettings',
        entityId: selectedReport,
        action: `Exported CSV report: ${report.title}`,
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        correlationId: authCheck.correlationId,
        details: `Exported ${report.rows.length} rows (${preset})`,
      });

      setExportStatus(`CSV downloaded cleanly (${report.rows.length} rows · Ref ${authCheck.correlationId}).`);
    } catch (err: any) {
      setExportStatus(err?.message || 'Unable to export CSV.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Selector Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-cinzel font-bold text-base text-[#120D0B] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#D4AF62]" />
              <span>Business Reports Center (14 Reports)</span>
            </h3>
            <p className="text-[11px] text-gray-500">
              All CSV exports are formula-injection sanitized and PII-minimized.
            </p>
          </div>
          <button
            onClick={() => void handleDownloadCsv()}
            className="px-4 py-2 bg-[#120D0B] text-[#D4AF62] rounded-lg text-xs font-bold hover:bg-[#211713] flex items-center gap-2 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV ({filteredAndSortedRows.length} rows)</span>
          </button>
        </div>

        {exportStatus && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {exportStatus}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {REPORT_DEFINITIONS.map((def) => (
            <button
              key={def.id}
              onClick={() => {
                setSelectedReport(def.id);
                setSortColIdx(null);
                setPage(1);
              }}
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                selectedReport === def.id
                  ? 'bg-[#120D0B] text-[#F8F1E4] border-[#120D0B]'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4AF62]'
              }`}
            >
              <p className="font-semibold truncate">{def.label}</p>
              <p className={`text-[10px] ${selectedReport === def.id ? 'text-[#D4AF62]' : 'text-gray-400'}`}>
                {def.group}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Preview Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="font-cinzel font-bold text-sm text-[#120D0B]">{report.title}</h4>
            <p className="text-[11px] text-gray-500">{report.disclaimer}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as DateFilterPreset);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white"
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>

            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white"
                />
              </>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search report rows..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {report.headers.map((h, idx) => (
                  <th
                    key={h}
                    onClick={() => {
                      if (sortColIdx === idx) setSortAsc(!sortAsc);
                      else {
                        setSortColIdx(idx);
                        setSortAsc(true);
                      }
                    }}
                    className="p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {h}
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={report.headers.length} className="p-8 text-center text-gray-400">
                    No matching report rows for the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`p-3 whitespace-nowrap ${
                          typeof cell === 'number' ? 'font-mono tabular-nums text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {typeof cell === 'number' ? cell.toLocaleString('en-IN') : cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {pageRows.length} of {filteredAndSortedRows.length} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono">
              Page {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
