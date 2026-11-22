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


  const handlePrintStatement = () => {
    if (!data) return;
    const isRestMode = data.role === 'RESTAURANT';
    const partner = data.partner || {};
    const summary = data.summary || {};
    const orders = data.orders || [];
    const payouts = data.payouts || [];
    const codLedger = data.codLedger || [];

    const esc = (v) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '—');
    const generatedAt = new Date().toLocaleString('en-IN');

    const kycHtml = isRestMode
      ? `<div class="kyc-row">
           <span class="pill"><strong>PAN:</strong> ${esc(partner.pan_number || 'Not Uploaded')}</span>
           <span class="pill"><strong>FSSAI:</strong> ${esc(partner.fssai_number || 'Not Uploaded')}</span>
           <span class="pill"><strong>GST:</strong> ${esc(partner.gst_number || 'Unregistered / N/A')}</span>
         </div>`
      : `<div class="kyc-row">
           <span class="pill"><strong>COD Balance:</strong> ₹${fmt(summary.current_cod_balance)}</span>
           <span class="pill"><strong>COD Float Limit:</strong> ₹${fmt(summary.cod_float_limit || 3000)}</span>
         </div>`;

    const orderRowsHtml = orders.length
      ? orders
          .map(
            (o) => `<tr>
              <td class="mono bold">#FZ-${esc(o.order_id)}</td>
              <td>${esc(fmtDate(o.date))}</td>
              <td class="bold">${esc(isRestMode ? o.customer_name : o.restaurant_name)}</td>
              <td>${esc(
                isRestMode
                  ? o.payment_method
                  : `${o.distance_km} km${o.cod_collected > 0 ? ` • COD ₹${fmt(o.cod_collected)}` : ''}`
              )}</td>
              <td class="num mono">₹${fmt(o.gross_amount)}</td>
              <td class="num mono red">-₹${fmt(o.platform_fee)}</td>
              <td class="num mono purple">-₹${fmt(o.fee_gst)}</td>
              <td class="num mono purple">-₹${fmt(o.tds_amount)}</td>
              <td class="num mono green bold">₹${fmt(o.net_earning)}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="9" class="empty">No completed orders recorded yet.</td></tr>';

    const payoutRowsHtml = payouts.length
      ? payouts
          .map(
            (pr) => `<tr>
              <td class="mono bold">#PAY-${esc(pr.id)}</td>
              <td>${esc(fmtDate(pr.created_at))}</td>
              <td class="num mono bold">₹${fmt(pr.amount)}</td>
              <td class="bold">${esc(pr.status)}</td>
              <td>${esc(pr.transaction_note || '—')}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="empty">No payout settlements recorded yet.</td></tr>';

    const codSectionHtml =
      !isRestMode && codLedger.length > 0
        ? `<div class="section">
             <div class="section-title amber">COD Cash Collection &amp; Deposit Audit Trail (${codLedger.length})</div>
             <table>
               <thead>
                 <tr>
                   <th>Entry #</th>
                   <th>Type</th>
                   <th>Order</th>
                   <th class="num">Amount (₹)</th>
                   <th>Note</th>
                   <th>Timestamp</th>
                 </tr>
               </thead>
               <tbody>
                 ${codLedger
                   .map(
                     (cl) => `<tr>
                       <td class="mono">#${esc(cl.entry_id)}</td>
                       <td class="bold ${cl.entry_type === 'DEPOSITED' ? 'green' : 'amber-txt'}">${esc(cl.entry_type)}</td>
                       <td class="mono">${cl.order_id ? '#FZ-' + esc(cl.order_id) : '—'}</td>
                       <td class="num mono bold">₹${fmt(cl.amount)}</td>
                       <td>${esc(cl.note || '—')}</td>
                       <td>${esc(fmtDate(cl.created_at))}</td>
                     </tr>`
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Foodzy_${esc(data.role)}_${esc(partner.id)}_Statement</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; background: #fff; }
  .brand-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #006039; padding-bottom: 10px; margin-bottom: 14px; }
  .brand-title { font-size: 18px; font-weight: 900; color: #006039; letter-spacing: -0.3px; }
  .brand-sub { font-size: 10px; color: #6b7280; font-weight: 600; }
  .meta-right { text-align: right; font-size: 10px; color: #4b5563; }
  .header-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; margin-bottom: 14px; background: #fff; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
  .role-badge { display: inline-block; background: #ecfdf5; color: #065f46; font-weight: 800; font-size: 10px; padding: 3px 9px; border-radius: 999px; margin-bottom: 6px; letter-spacing: 0.4px; }
  .partner-name { font-size: 20px; font-weight: 900; margin: 0 0 3px 0; color: #111827; }
  .partner-contact { color: #4b5563; font-size: 11px; margin: 0; }
  .kyc-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pill { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 3px 8px; border-radius: 6px; font-size: 10px; }
  .bank-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; min-width: 230px; }
  .bank-title { font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.4px; }
  .bank-line { display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; margin-bottom: 3px; }
  .bank-line span { color: #047857; }
  .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
  .kpi { border-radius: 8px; padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; }
  .kpi.red-bg { background: #fef2f2; border-color: #fecaca; }
  .kpi.purple-bg { background: #faf5ff; border-color: #e9d5ff; }
  .kpi.blue-bg { background: #eff6ff; border-color: #bfdbfe; }
  .kpi.green-bg { background: #d1fae5; border-color: #6ee7b7; }
  .kpi-label { font-size: 9px; color: #6b7280; margin-bottom: 3px; font-weight: 700; }
  .kpi-val { font-size: 13px; font-weight: 900; color: #111827; font-family: 'Consolas', monospace; }
  .section { border: 1px solid #d1d5db; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }
  .section-title { background: #f3f4f6; padding: 8px 12px; font-weight: 800; font-size: 11.5px; color: #1f2937; border-bottom: 1px solid #e5e7eb; }
  .section-title.amber { background: #fffbeb; color: #92400e; border-bottom-color: #fde68a; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th { background: #f9fafb; color: #4b5563; font-weight: 800; text-align: left; padding: 7px 8px; border-bottom: 1px solid #d1d5db; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .mono { font-family: 'Consolas', 'Courier New', monospace; }
  .bold { font-weight: 700; }
  .red { color: #dc2626; }
  .purple { color: #7e22ce; }
  .green { color: #047857; }
  .amber-txt { color: #b45309; }
  .empty { text-align: center; color: #9ca3af; padding: 14px; }
  .footer { text-align: center; font-size: 9.5px; color: #6b7280; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #d1d5db; }
</style>
</head>
<body>
  <div class="brand-bar">
    <div>
      <div class="brand-title">FOODZY FINANCIAL LEDGER STATEMENT</div>
      <div class="brand-sub">Official Partner Payout &amp; Order Reconciliation Record</div>
    </div>
    <div class="meta-right">
      <div><strong>Generated:</strong> ${esc(generatedAt)}</div>
      <div><strong>Support:</strong> +919419417800</div>
    </div>
  </div>

  <div class="header-card">
    <div class="header-top">
      <div>
        <div class="role-badge">${esc(data.role)} FINANCIAL STATEMENT</div>
        <h1 class="partner-name">${esc(partner.partner_name)}</h1>
        <p class="partner-contact">ID #${esc(partner.id)} • ${esc(partner.phone_number)}${partner.email ? ' • ' + esc(partner.email) : ''}</p>
        ${kycHtml}
      </div>
      <div class="bank-box">
        <div class="bank-title">Payout Bank Account Details</div>
        <div class="bank-line"><span>Account No:</span><strong class="mono">${esc(partner.bank_account_number || 'Not Submitted')}</strong></div>
        <div class="bank-line"><span>IFSC Code:</span><strong class="mono">${esc(partner.bank_ifsc || 'Not Submitted')}</strong></div>
        ${partner.bank_account_name ? `<div class="bank-line"><span>Beneficiary:</span><strong>${esc(partner.bank_account_name)}</strong></div>` : ''}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Orders Done</div><div class="kpi-val">${esc(summary.completed_orders || 0)}</div></div>
      <div class="kpi"><div class="kpi-label">${isRestMode ? 'Gross Food Sales' : 'Gross Delivery'}</div><div class="kpi-val">₹${fmt(isRestMode ? summary.gross_sales : summary.gross_delivery_charges)}</div></div>
      <div class="kpi red-bg"><div class="kpi-label red">Platform Fee</div><div class="kpi-val red">-₹${fmt(summary.platform_fee)}</div></div>
      <div class="kpi purple-bg"><div class="kpi-label purple">18% Fee GST + TDS</div><div class="kpi-val purple">-₹${fmt(Number(summary.fee_gst || 0) + Number(summary.tds_amount || 0))}</div></div>
      <div class="kpi blue-bg"><div class="kpi-label" style="color:#1d4ed8;">Already Settled</div><div class="kpi-val" style="color:#1e40af;">₹${fmt(summary.total_settled)}</div></div>
      <div class="kpi green-bg"><div class="kpi-label green">Net Pending Due</div><div class="kpi-val green">₹${fmt(summary.net_pending_due)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itemized Completed Order Ledger (${orders.length} Entries)</div>
    <table>
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Date &amp; Time</th>
          <th>${isRestMode ? 'Customer' : 'Restaurant'}</th>
          <th>${isRestMode ? 'Payment Mode' : 'Distance / COD'}</th>
          <th class="num">Gross (₹)</th>
          <th class="num">Platform Fee</th>
          <th class="num">18% Fee GST</th>
          <th class="num">TDS</th>
          <th class="num">Net Earning</th>
        </tr>
      </thead>
      <tbody>${orderRowsHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Payout &amp; Bank Transfer History (${payouts.length})</div>
    <table>
      <thead>
        <tr>
          <th>Payout ID</th>
          <th>Requested At</th>
          <th class="num">Amount (₹)</th>
          <th>Status</th>
          <th>UTR / Transfer Reference</th>
        </tr>
      </thead>
      <tbody>${payoutRowsHtml}</tbody>
    </table>
  </div>

  ${codSectionHtml}

  <div class="footer">System-generated statement from Foodzy Super Admin Finance Console • All figures calculated in exact paise and displayed in INR.</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1500);
      }
    }, 300);
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
            onClick={handlePrintStatement}
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
