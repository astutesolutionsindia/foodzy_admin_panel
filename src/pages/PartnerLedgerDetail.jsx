import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Printer, FileSpreadsheet, Landmark, Store, Bike, RefreshCw
} from 'lucide-react';
import api from '../config/api';

const fmt = (n) => Number(n || 0).toFixed(2);

export default function PartnerLedgerDetail() {
  const { role, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/admin/finance/partner-statement/${role}/${id}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load financial statement');
    } finally {
      setLoading(false);
    }
  }, [role, id]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleExportExcel = () => {
    if (!data) return;
    const isRest = data.role === 'RESTAURANT';
    const p = data.partner || {};
    const s = data.summary || {};

    const lines = [
      ['FOODZY DETAILED PARTNER FINANCIAL LEDGER'],
      ['Partner Name', p.partner_name || ''],
      ['Role', data.role],
      ['Phone', p.phone_number || ''],
      ['Bank Account Number', p.bank_account_number ? `'${p.bank_account_number}` : 'Not Provided'],
      ['Bank IFSC', p.bank_ifsc || 'Not Provided'],
      ...(isRest
        ? [
            ['PAN Number', p.pan_number || 'N/A'],
            ['FSSAI Number', p.fssai_number || 'N/A'],
            ['GST Number', p.gst_number || 'N/A']
          ]
        : [
            ['Current COD Balance', fmt(s.current_cod_balance)],
            ['COD Float Limit', fmt(s.cod_float_limit)]
          ]),
      [],
      ['SUMMARY (EXACT PAISE)'],
      ['Completed Orders', s.completed_orders || 0],
      [isRest ? 'Gross Food Sales (INR)' : 'Gross Delivery Charges (INR)', fmt(isRest ? s.gross_sales : s.gross_delivery_charges)],
      ['Platform Fee Deducted (INR)', fmt(s.platform_fee)],
      ['18% GST on Platform Fee (INR)', fmt(s.fee_gst)],
      ['TDS Deducted (INR)', fmt(s.tds_amount)],
      ['Lifetime Net Payout (INR)', fmt(s.lifetime_net_payout)],
      ['Already Settled (INR)', fmt(s.total_settled)],
      ['Net Pending Due (INR)', fmt(s.net_pending_due)],
      [],
      ['ITEMIZED ORDER LEDGER'],
      isRest
        ? ['Order ID', 'Date', 'Customer', 'Payment Mode', 'Gross Food (INR)', 'Platform Fee', '18% Fee GST', 'TDS', 'Net Earning']
        : ['Order ID', 'Date', 'Restaurant', 'Distance (km)', 'COD Collected', 'Gross Charge', 'Platform Fee', '18% Fee GST', 'TDS', 'Net Earning'],
      ...(data.orders || []).map((o) =>
        isRest
          ? [`#FZ-${o.order_id}`, new Date(o.date).toLocaleString('en-IN'), o.customer_name, o.payment_method, fmt(o.gross_amount), fmt(o.platform_fee), fmt(o.fee_gst), fmt(o.tds_amount), fmt(o.net_earning)]
          : [`#FZ-${o.order_id}`, new Date(o.date).toLocaleString('en-IN'), o.restaurant_name, o.distance_km, fmt(o.cod_collected), fmt(o.gross_amount), fmt(o.platform_fee), fmt(o.fee_gst), fmt(o.tds_amount), fmt(o.net_earning)]
      ),
      [],
      ['PAYOUT SETTLEMENT HISTORY'],
      ['Payout ID', 'Date', 'Amount (INR)', 'Status', 'UTR / Note'],
      ...(data.payouts || []).map((pr) => [
        `#PAY-${pr.id}`,
        pr.created_at ? new Date(pr.created_at).toLocaleString('en-IN') : '',
        fmt(pr.amount),
        pr.status,
        pr.transaction_note || ''
      ])
    ];

    const csv = lines
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Foodzy_${data.role}_${id}_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-500 font-semibold">Loading full partner financial statement...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3">
        <p className="text-red-600 font-bold">{error || 'Statement not found'}</p>
        <button onClick={() => navigate('/finance')} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold cursor-pointer">
          Back to Finance Console
        </button>
      </div>
    );
  }

  const isRest = data.role === 'RESTAURANT';
  const p = data.partner || {};
  const s = data.summary || {};

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when Printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => navigate('/finance')}
          className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-700 flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Master Ledger
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatement}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export to Excel (.csv)
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Statement
          </button>
        </div>
      </div>

      {/* Partner Header + Bank Settlement Details Card (#2 & #6) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 mb-2">
              {isRest ? <Store className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
              {data.role} FINANCIAL STATEMENT
            </span>
            <h2 className="text-2xl font-black text-gray-900">{p.partner_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              ID #{p.id} • {p.phone_number} {p.email ? `• ${p.email}` : ''}
            </p>
            {isRest && (
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-700">
                <span className="px-2.5 py-1 bg-gray-100 rounded-lg"><strong>PAN:</strong> {p.pan_number || 'Not Uploaded'}</span>
                <span className="px-2.5 py-1 bg-gray-100 rounded-lg"><strong>FSSAI:</strong> {p.fssai_number || 'Not Uploaded'}</span>
                <span className="px-2.5 py-1 bg-gray-100 rounded-lg"><strong>GST:</strong> {p.gst_number || 'Unregistered / N/A'}</span>
              </div>
            )}
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 min-w-[280px]">
            <div className="flex items-center gap-2 text-emerald-900 font-black text-xs uppercase mb-2">
              <Landmark className="w-4 h-4" /> Payout Bank Account Details
            </div>
            <div className="space-y-1 text-xs text-emerald-950">
              <div className="flex justify-between gap-4">
                <span className="text-emerald-700">Account No:</span>
                <strong className="font-mono text-sm">{p.bank_account_number || 'Not Submitted'}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-emerald-700">IFSC Code:</span>
                <strong className="font-mono">{p.bank_ifsc || 'Not Submitted'}</strong>
              </div>
              {p.bank_account_name && (
                <div className="flex justify-between gap-4">
                  <span className="text-emerald-700">Beneficiary:</span>
                  <strong>{p.bank_account_name}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Exact Paise Financial Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-6 pt-5 border-t border-gray-100 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-gray-400">Orders Done</p>
            <p className="text-lg font-black text-gray-900">{s.completed_orders || 0}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-gray-400">{isRest ? 'Gross Food Sales' : 'Gross Delivery'}</p>
            <p className="text-lg font-black text-gray-900">₹{fmt(isRest ? s.gross_sales : s.gross_delivery_charges)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl">
            <p className="text-red-500">Platform Fee</p>
            <p className="text-lg font-black text-red-700">-₹{fmt(s.platform_fee)}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl">
            <p className="text-purple-600">18% Fee GST + TDS</p>
            <p className="text-lg font-black text-purple-800">-₹{fmt(Number(s.fee_gst || 0) + Number(s.tds_amount || 0))}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <p className="text-blue-600">Already Settled</p>
            <p className="text-lg font-black text-blue-800">₹{fmt(s.total_settled)}</p>
          </div>
          <div className="p-3 bg-emerald-100 rounded-xl">
            <p className="text-emerald-800 font-bold">Net Pending Due</p>
            <p className="text-lg font-black text-emerald-900">₹{fmt(s.net_pending_due)}</p>
          </div>
        </div>
      </div>

      {/* Itemized Order-by-Order Statement Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 font-bold text-gray-800 text-sm">
          Itemized Completed Order Ledger ({(data.orders || []).length} Entries)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">{isRest ? 'Customer' : 'Restaurant'}</th>
                <th className="p-3">{isRest ? 'Payment Mode' : 'Distance / COD'}</th>
                <th className="p-3 text-right">Gross (₹)</th>
                <th className="p-3 text-right">Platform Fee</th>
                <th className="p-3 text-right">18% Fee GST</th>
                <th className="p-3 text-right">TDS</th>
                <th className="p-3 text-right font-bold">Net Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data.orders || []).map((o) => (
                <tr key={o.order_id} className="hover:bg-gray-50/50">
                  <td className="p-3 font-mono font-bold">#FZ-{o.order_id}</td>
                  <td className="p-3 text-gray-600">{o.date ? new Date(o.date).toLocaleString('en-IN') : ''}</td>
                  <td className="p-3 font-semibold text-gray-800">{isRest ? o.customer_name : o.restaurant_name}</td>
                  <td className="p-3 text-gray-600">
                    {isRest ? o.payment_method : `${o.distance_km} km${o.cod_collected > 0 ? ` • COD ₹${fmt(o.cod_collected)}` : ''}`}
                  </td>
                  <td className="p-3 text-right font-mono">₹{fmt(o.gross_amount)}</td>
                  <td className="p-3 text-right font-mono text-red-600">-₹{fmt(o.platform_fee)}</td>
                  <td className="p-3 text-right font-mono text-purple-600">-₹{fmt(o.fee_gst)}</td>
                  <td className="p-3 text-right font-mono text-purple-600">-₹{fmt(o.tds_amount)}</td>
                  <td className="p-3 text-right font-mono font-black text-emerald-700">₹{fmt(o.net_earning)}</td>
                </tr>
              ))}
              {(data.orders || []).length === 0 && (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-400">No completed orders recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Settlement History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 font-bold text-gray-800 text-sm">
          Payout & Bank Transfer History ({(data.payouts || []).length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">Payout ID</th>
                <th className="p-3">Requested At</th>
                <th className="p-3">Amount (₹)</th>
                <th className="p-3">Status</th>
                <th className="p-3">UTR / Transfer Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data.payouts || []).map((pr) => (
                <tr key={pr.id}>
                  <td className="p-3 font-mono font-bold">#PAY-{pr.id}</td>
                  <td className="p-3 text-gray-600">{pr.created_at ? new Date(pr.created_at).toLocaleString('en-IN') : ''}</td>
                  <td className="p-3 font-mono font-black">₹{fmt(pr.amount)}</td>
                  <td className="p-3 font-bold">{pr.status}</td>
                  <td className="p-3 text-gray-600">{pr.transaction_note || '—'}</td>
                </tr>
              ))}
              {(data.payouts || []).length === 0 && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-400">No payout settlements recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rider COD Cash Ledger (If Rider) */}
      {!isRest && (data.codLedger || []).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="p-4 border-b border-amber-100 bg-amber-50/50 font-bold text-amber-900 text-sm">
            COD Cash Collection & Deposit Audit Trail
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3">Entry #</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Amount (₹)</th>
                  <th className="p-3">Note</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.codLedger.map((cl) => (
                  <tr key={cl.entry_id}>
                    <td className="p-3 font-mono">#{cl.entry_id}</td>
                    <td className={`p-3 font-black ${cl.entry_type === 'DEPOSITED' ? 'text-emerald-700' : 'text-amber-700'}`}>{cl.entry_type}</td>
                    <td className="p-3 font-mono">{cl.order_id ? `#FZ-${cl.order_id}` : '—'}</td>
                    <td className="p-3 font-mono font-bold">₹{fmt(cl.amount)}</td>
                    <td className="p-3">{cl.note || ''}</td>
                    <td className="p-3 text-gray-500">{cl.created_at ? new Date(cl.created_at).toLocaleString('en-IN') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
