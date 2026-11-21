import { fmtMoney } from '../utils/formatMoney';
import { useState, useEffect, useCallback } from 'react';
import { Archive, Download, Calendar, DollarSign, Layers, Percent, RefreshCw } from 'lucide-react';
import api from '../config/api';

export default function FinancialArchive() {
  const [months, setMonths] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const fetchArchive = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await api.get('/admin/finance/archive');
      const list = res.data?.months || [];
      setMonths(list);
      if (list.length > 0 && !selectedMonth) {
        setSelectedMonth(list[0]);
      }
    } catch (err) {
      console.error('Failed to fetch financial archive:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const exportCsv = () => {
    const headers = [
      'Month',
      'Completed Orders',
      'Cancelled Orders',
      'Gross Merchandise (GMV)',
      'Food Subtotal',
      'Restaurant Platform Fee',
      'Food Platform Fee',
      'Delivery Platform Fee',
      'Total Platform Fees',
      'Food GST',
      'Delivery GST',
      'Platform Fee GST',
      'Total GST Collected',
      'Restaurant Payouts Settled',
      'Rider Payouts Settled'
    ];
    const rows = months.map((m) => [
      m.month_label,
      m.completed_orders,
      m.cancelled_orders,
      m.gmv,
      m.food_subtotal,
      m.rest_platform_fee,
      m.food_platform_fee,
      m.delivery_platform_fee,
      m.total_platform_fee,
      m.food_gst,
      m.delivery_gst,
      m.platform_fee_gst,
      m.total_gst,
      m.rest_paid,
      m.rider_paid
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Foodzy_Financial_Archive_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Archive className="w-7 h-7 text-brand" />
              Financial Archive & Tax Vault
            </h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Loading ledger...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Historical month-by-month record of Gross Merchandise, 3-way Platform Fees, 3-way GST Collected, and Settled Payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchArchive}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand/90 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CA / GST CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map((m) => {
          const isSelected = selectedMonth?.month_key === m.month_key;
          return (
            <div
              key={m.month_key}
              onClick={() => setSelectedMonth(m)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-dark text-white border-dark shadow-lg'
                  : 'bg-white text-gray-800 border-gray-100 hover:border-brand'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {m.month_label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {m.completed_orders} Orders
                </span>
              </div>
              <p className="text-2xl font-black mt-2">₹{fmtMoney(m.gmv)}</p>
              <div className="mt-3 pt-3 border-t border-current/10 flex justify-between text-xs opacity-85">
                <span>Fees: ₹{fmtMoney(m.total_platform_fee)}</span>
                <span>GST: ₹{fmtMoney(m.total_gst)}</span>
              </div>
            </div>
          );
        })}
        {months.length === 0 && (
          <div className="col-span-4 bg-white p-10 rounded-2xl text-center text-gray-400 border border-gray-100">
            No historical monthly order records yet. Once orders are completed, each month's statement is archived here automatically.
          </div>
        )}
      </div>

      {selectedMonth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              {selectedMonth.month_label} — Gross Business
            </h3>
            <div className="space-y-2 text-sm pt-2">
              <div className="flex justify-between"><span>Completed Orders:</span><strong>{selectedMonth.completed_orders}</strong></div>
              <div className="flex justify-between"><span>Cancelled Orders:</span><strong className="text-red-500">{selectedMonth.cancelled_orders}</strong></div>
              <div className="flex justify-between"><span>Original Food Subtotal:</span><strong>₹{fmtMoney(selectedMonth.food_subtotal)}</strong></div>
              <div className="flex justify-between border-t pt-2 text-base font-black text-green-700"><span>Gross Merchandise (GMV):</span><span>₹{fmtMoney(selectedMonth.gmv)}</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              {selectedMonth.month_label} — 3-Way Platform Fees
            </h3>
            <div className="space-y-2 text-sm pt-2">
              <div className="flex justify-between"><span>Restaurant Platform Fee:</span><strong>₹{fmtMoney(selectedMonth.rest_platform_fee)}</strong></div>
              <div className="flex justify-between"><span>Food Platform Fee:</span><strong>₹{fmtMoney(selectedMonth.food_platform_fee)}</strong></div>
              <div className="flex justify-between"><span>Delivery Platform Fee:</span><strong>₹{fmtMoney(selectedMonth.delivery_platform_fee)}</strong></div>
              <div className="flex justify-between border-t pt-2 text-base font-black text-indigo-700"><span>Total Platform Fee Collected:</span><span>₹{fmtMoney(selectedMonth.total_platform_fee)}</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Percent className="w-5 h-5 text-purple-600" />
              {selectedMonth.month_label} — 3-Way G.S.T. Collected
            </h3>
            <div className="space-y-2 text-sm pt-2">
              <div className="flex justify-between"><span>Food GST:</span><strong>₹{fmtMoney(selectedMonth.food_gst)}</strong></div>
              <div className="flex justify-between"><span>Delivery GST:</span><strong>₹{fmtMoney(selectedMonth.delivery_gst)}</strong></div>
              <div className="flex justify-between"><span>Platform Fee GST:</span><strong>₹{fmtMoney(selectedMonth.platform_fee_gst)}</strong></div>
              <div className="flex justify-between border-t pt-2 text-base font-black text-purple-700"><span>Total GST Collected:</span><span>₹{fmtMoney(selectedMonth.total_gst)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
