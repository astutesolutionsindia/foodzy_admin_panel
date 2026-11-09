import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';
import {
  Settings, Ticket, BookOpen, Wallet, ShieldAlert,
  Plus, Edit, Trash2, XCircle, CheckCircle, CreditCard, RefreshCw
} from 'lucide-react';
import api from '../config/api';

export default function Finance() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('SETTINGS');
  const [isSyncing, setIsSyncing] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [settings, setSettings] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('adminFinanceCache') || '{}');
      return cached.settings || {};
    } catch {
      return {};
    }
  });

  const [coupons, setCoupons] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('adminFinanceCache') || '{}');
      return Array.isArray(cached.coupons) ? cached.coupons : [];
    } catch {
      return [];
    }
  });

  const [ledger, setLedger] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('adminFinanceCache') || '{}');
      return cached.ledger || { restaurantLedger: [], riderLedger: [] };
    } catch {
      return { restaurantLedger: [], riderLedger: [] };
    }
  });

  const [payouts, setPayouts] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('adminFinanceCache') || '{}');
      return Array.isArray(cached.payouts) ? cached.payouts : [];
    } catch {
      return [];
    }
  });

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
    min_order_value: 0,
    max_discount: '',
    expiry_date: '',
    is_active: true
  });

  const fetchFinanceData = useCallback(async () => {
    if (!['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type)) return;
    try {
      setIsSyncing(true);
      const [settingsRes, couponsRes, ledgerRes, payoutsRes] = await Promise.all([
        api.get('/admin/finance/settings'),
        api.get('/admin/coupons'),
        api.get('/admin/finance/ledger'),
        api.get('/admin/finance/payouts').catch(() => ({ data: [] }))
      ]);

      const nextSettings = settingsRes.data || {};
      const nextCoupons = couponsRes.data || [];
      const nextLedger = {
        restaurantLedger: ledgerRes.data?.restaurantLedger || [],
        riderLedger: ledgerRes.data?.riderLedger || []
      };
      const nextPayouts = payoutsRes.data || [];

      setSettings(nextSettings);
      setCoupons(nextCoupons);
      setLedger(nextLedger);
      setPayouts(nextPayouts);

      localStorage.setItem(
        'adminFinanceCache',
        JSON.stringify({
          settings: nextSettings,
          coupons: nextCoupons,
          ledger: nextLedger,
          payouts: nextPayouts
        })
      );
    } catch (err) {
      console.error('Failed to fetch finance data', err);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.role_type]);

  useEffect(() => {
    fetchFinanceData();

    const socket = initSocket();
    const handleRefresh = () => fetchFinanceData();

    if (socket) {
      socket.on('payoutStatusUpdated', handleRefresh);
      socket.on('orderStatusChanged', handleRefresh);
    }

    return () => {
      if (socket) {
        socket.off('payoutStatusUpdated', handleRefresh);
        socket.off('orderStatusChanged', handleRefresh);
      }
    };
  }, [fetchFinanceData]);

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/admin/finance/settings', settings);
      alert('Platform financial & Razorpay gateway settings saved successfully.');
      fetchFinanceData();
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openCouponModal = (coupon = null) => {
    setEditingCouponId(coupon?.id || null);
    if (coupon) {
      setCouponForm({
        ...coupon,
        max_discount: coupon.max_discount ?? '',
        expiry_date: coupon.expiry_date
          ? new Date(coupon.expiry_date).toISOString().split('T')[0]
          : ''
      });
    } else {
      setCouponForm({
        code: '',
        description: '',
        discount_type: 'PERCENTAGE',
        discount_value: '',
        min_order_value: 0,
        max_discount: '',
        expiry_date: '',
        is_active: true
      });
    }
    setIsCouponModalOpen(true);
  };

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...couponForm };
      if (!payload.max_discount) delete payload.max_discount;
      if (!payload.expiry_date) delete payload.expiry_date;

      if (editingCouponId) {
        await api.put(`/admin/coupons/${editingCouponId}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }
      setIsCouponModalOpen(false);
      fetchFinanceData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save coupon.');
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete this promo code?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      fetchFinanceData();
    } catch (err) {
      alert('Failed to delete coupon.');
    }
  };

  const handleSettlePayout = async (id, partnerName, amount) => {
    if (
      !window.confirm(
        `Did you transfer ₹${amount} to ${partnerName}'s account?\n\nClicking OK will mark this ledger debt as PAID.`
      )
    )
      return;
    try {
      await api.put(`/admin/finance/payouts/${id}/settle`);
      fetchFinanceData();
    } catch (err) {
      alert('Failed to settle payout.');
    }
  };

  const handleRejectPayout = async (id) => {
    const reason = window.prompt('Enter reason for rejecting this withdrawal request:');
    if (reason === null) return;
    try {
      await api.put(`/admin/finance/payouts/${id}/reject`, { reason });
      fetchFinanceData();
    } catch (err) {
      alert('Failed to reject payout.');
    }
  };

  if (!['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type)) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 text-gray-500">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Financial Clearance Required</h2>
        <p>Your current role ({user?.role_type}) does not permit access to platform ledgers.</p>
      </div>
    );
  }

  const pendingPayoutsCount = payouts.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">Finance & Razorpay Console</h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Manage platform taxation, 5-line-item checkout fees, Razorpay gateway keys, coupons, and partner payouts.
          </p>
        </div>

        <button
          onClick={fetchFinanceData}
          title="Refresh Financial Data"
          className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
        </button>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'SETTINGS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 mr-2" /> Tax, Commissions & Razorpay
        </button>
        <button
          onClick={() => setActiveTab('COUPONS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'COUPONS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Ticket className="w-4 h-4 mr-2" /> Promo Codes ({coupons.length})
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'LEDGER'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4 mr-2" /> Master Ledger
        </button>
        <button
          onClick={() => setActiveTab('PAYOUTS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'PAYOUTS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet className="w-4 h-4 mr-2" /> Payout Requests
          {pendingPayoutsCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingPayoutsCount}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'SETTINGS' && (
          <form onSubmit={handleSettingsSave} className="p-6 max-w-3xl space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              Global Platform & 5-Line-Item Checkout Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Restaurant Commission (%)
                </label>
                <input
                  type="number"
                  required
                  value={settings.default_commission_pct ?? 20}
                  onChange={(e) =>
                    setSettings({ ...settings, default_commission_pct: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Can be overridden per-restaurant in Directory.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Food GST (% on Original Food Cost)
                </label>
                <input
                  type="number"
                  required
                  value={settings.food_gst_pct ?? 5}
                  onChange={(e) => setSettings({ ...settings, food_gst_pct: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Food Platform Fee (% on Original Food Cost)
                </label>
                <input
                  type="number"
                  required
                  value={settings.food_platform_fee_pct ?? 5}
                  onChange={(e) =>
                    setSettings({ ...settings, food_platform_fee_pct: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Line item #3 on customer checkout bill (Default: 5%).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Platform Fee (% on Rider Payout)
                </label>
                <input
                  type="number"
                  required
                  value={settings.delivery_platform_fee_pct ?? 10}
                  onChange={(e) =>
                    setSettings({ ...settings, delivery_platform_fee_pct: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Added to Rider Payout in Delivery Charges (Default: 10%).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Delivery Fee Fallback (₹)
                </label>
                <input
                  type="number"
                  required
                  value={settings.base_delivery_fee ?? 40}
                  onChange={(e) =>
                    setSettings({ ...settings, base_delivery_fee: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rider Onboarding / Uniform Fee (₹)
                </label>
                <input
                  type="number"
                  required
                  value={settings.uniform_fee_amount ?? 500}
                  onChange={(e) =>
                    setSettings({ ...settings, uniform_fee_amount: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mt-8">
              Dynamic Rider Road-Distance Pay (OSRM)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rider Base Fee (₹)
                </label>
                <input
                  type="number"
                  required
                  value={settings.rider_base_fee ?? 30}
                  onChange={(e) => setSettings({ ...settings, rider_base_fee: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fixed base payout per order (Default: ₹30).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rider Per-Km Fee (₹/km)
                </label>
                <input
                  type="number"
                  required
                  value={settings.rider_per_km_fee ?? 10}
                  onChange={(e) =>
                    setSettings({ ...settings, rider_per_km_fee: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Multiplied by exact J&K OSRM road distance (Default: ₹10/km).
                </p>
              </div>
            </div>

            {/* RAZORPAY GATEWAY SETTINGS */}
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mt-8 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Razorpay Payment Gateway Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razorpay Key ID (Public Key)
                </label>
                <input
                  type="text"
                  value={settings.razorpay_key_id || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, razorpay_key_id: e.target.value })
                  }
                  placeholder="rzp_test_... or rzp_live_..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Synced with Customer, Rider & Restaurant apps for instant checkout.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razorpay Key Secret (Server-Side HMAC)
                </label>
                <input
                  type="password"
                  value={settings.razorpay_key_secret || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, razorpay_key_secret: e.target.value })
                  }
                  placeholder="Enter Razorpay Key Secret (or set in Render ENV)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used by server.js to verify SHA256 payment signatures.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-brand text-white rounded-xl hover:bg-brand/90 disabled:opacity-50 font-semibold cursor-pointer"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Financial & Gateway Settings'}
            </button>
          </form>
        )}

        {/* COUPONS TAB */}
        {activeTab === 'COUPONS' && (
          <div>
            <div className="p-4 border-b border-gray-100 flex justify-end">
              <button
                onClick={() => openCouponModal()}
                className="flex items-center px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Promo Code
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Code</th>
                  <th className="p-4 font-medium">Discount</th>
                  <th className="p-4 font-medium">Conditions</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <span className="font-mono font-bold text-brand bg-brand/10 px-2 py-1 rounded">
                        {c.code}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">{c.description}</div>
                    </td>
                    <td className="p-4 font-medium text-gray-800">
                      {c.discount_type === 'FLAT'
                        ? `₹${c.discount_value} OFF`
                        : `${c.discount_value}% OFF`}
                      {c.max_discount && (
                        <div className="text-xs text-gray-500">Up to ₹{c.max_discount}</div>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-600">
                      <div>Min Order: ₹{c.min_order_value}</div>
                      {c.expiry_date && (
                        <div className="text-red-500">
                          Expires: {new Date(c.expiry_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          c.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openCouponModal(c)}
                        className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(c.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400">
                      No promo codes created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LEDGER TAB */}
        {activeTab === 'LEDGER' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
              Restaurant Settlements
            </h3>
            <div className="overflow-x-auto mb-10 border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4 font-medium">Restaurant</th>
                    <th className="p-4 font-medium">Gross Sales</th>
                    <th className="p-4 font-medium text-red-600">Platform Comm.</th>
                    <th className="p-4 font-medium text-purple-600">GST Holding</th>
                    <th className="p-4 font-medium text-gray-500">Settled So Far</th>
                    <th className="p-4 font-medium text-green-600">Active Payable Debt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.restaurantLedger.map((r) => {
                    const gross = Number(r.gross_sales || 0);
                    const comm = Number(r.platform_commission || 0);
                    const gst = Number(r.gst_collected || 0);
                    const settled = Number(r.total_settled || 0);
                    const payable =
                      r.net_restaurant_payout !== undefined
                        ? Number(r.net_restaurant_payout)
                        : Math.max(0, gross - comm - gst - settled);

                    return (
                      <tr key={r.restaurant_id} className="hover:bg-gray-50/50">
                        <td className="p-4 font-medium text-gray-800">
                          {r.restaurant_name}{' '}
                          <span className="text-xs text-gray-400 font-normal ml-2">
                            ({r.completed_orders || 0} orders)
                          </span>
                        </td>
                        <td className="p-4">₹{gross}</td>
                        <td className="p-4 text-red-600">
                          -₹{comm}{' '}
                          <span className="text-xs">({r.effective_commission_pct || 20}%)</span>
                        </td>
                        <td className="p-4 text-purple-600">-₹{gst}</td>
                        <td className="p-4 text-gray-500">₹{settled}</td>
                        <td className="p-4 font-bold text-green-600">₹{payable}</td>
                      </tr>
                    );
                  })}
                  {ledger.restaurantLedger.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-400">
                        No restaurant ledger entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Rider Payouts</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4 font-medium">Rider Name</th>
                    <th className="p-4 font-medium">Completed Deliveries</th>
                    <th className="p-4 font-medium">Uniform Fee</th>
                    <th className="p-4 font-medium text-gray-500">Settled So Far</th>
                    <th className="p-4 font-medium text-green-600">Active Payable Debt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.riderLedger.map((r) => {
                    const settled = Number(r.total_settled || 0);
                    const due =
                      r.total_payout_due !== undefined
                        ? Number(r.total_payout_due)
                        : Math.max(0, Number(r.gross_earnings || 0) - settled);

                    return (
                      <tr key={r.rider_id} className="hover:bg-gray-50/50">
                        <td className="p-4 font-medium text-gray-800">{r.rider_name}</td>
                        <td className="p-4">{r.completed_deliveries || 0} deliveries</td>
                        <td className="p-4">
                          {r.uniform_fee_paid ? (
                            <span className="text-green-600 text-xs font-bold">PAID</span>
                          ) : (
                            <span className="text-red-500 text-xs font-bold">UNPAID</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500">₹{settled}</td>
                        <td className="p-4 font-bold text-green-600">₹{due}</td>
                      </tr>
                    );
                  })}
                  {ledger.riderLedger.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400">
                        No rider ledger entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYOUT REQUESTS TAB */}
        {activeTab === 'PAYOUTS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Date & Time</th>
                <th className="p-4 font-medium">Partner Info</th>
                <th className="p-4 font-medium">Amount Requested</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="p-4 text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{p.partner_name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.role_type === 'RIDER'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {p.role_type}
                      </span>
                      {p.phone_number}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-gray-800">₹{p.amount}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        p.status === 'PAID'
                          ? 'bg-green-100 text-green-700'
                          : p.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.transaction_note && (
                      <div
                        className={`text-[10px] mt-1 max-w-[180px] truncate ${
                          p.status === 'REJECTED' ? 'text-red-500' : 'text-gray-400'
                        }`}
                        title={p.transaction_note}
                      >
                        {p.transaction_note}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {p.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSettlePayout(p.id, p.partner_name, p.amount)}
                          className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md font-semibold text-xs cursor-pointer transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Paid
                        </button>
                        <button
                          onClick={() => handleRejectPayout(p.id)}
                          className="flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-semibold text-xs cursor-pointer transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    No payout requests currently.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Coupon Modal */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">
                {editingCouponId ? 'Edit' : 'Create'} Promo Code
              </h3>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCouponSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none font-mono uppercase"
                    placeholder="SUMMER50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discount_type: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Discount Value {couponForm.discount_type === 'FLAT' ? '(₹)' : '(%)'}
                </label>
                <input
                  type="number"
                  required
                  value={couponForm.discount_value}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, discount_value: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    value={couponForm.min_order_value}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, min_order_value: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Max Discount (₹)</label>
                  <input
                    type="number"
                    value={couponForm.max_discount}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, max_discount: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                    placeholder="Leave blank for no limit"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Description (Customer Facing)
                </label>
                <input
                  type="text"
                  value={couponForm.description}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  placeholder="Get 50% off on all orders"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={couponForm.expiry_date}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, expiry_date: e.target.value })
                    }
                    className="px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
                <label className="flex items-center space-x-2 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={Boolean(couponForm.is_active)}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, is_active: e.target.checked })
                    }
                    className="w-5 h-5 text-brand rounded focus:ring-brand"
                  />
                  <span className="font-medium text-gray-700">Code is Active</span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer font-medium"
                >
                  Save Promo Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}