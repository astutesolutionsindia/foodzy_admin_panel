import { fmtMoney } from '../utils/formatMoney';
import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';
import {
  Settings, Ticket, BookOpen, Wallet, ShieldAlert, Store, Bike,
  Plus, Edit, Trash2, XCircle, CheckCircle, RefreshCw, Search, Layers, Percent
} from 'lucide-react';
import api from '../config/api';

export default function Finance() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('SETTINGS');
  const [ledgerRoleSwitch, setLedgerRoleSwitch] = useState('RESTAURANT');
  const [payoutRoleSwitch, setPayoutRoleSwitch] = useState('RESTAURANT');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState(null);
  const [feeModalRest, setFeeModalRest] = useState(null);
  const [feeModalValue, setFeeModalValue] = useState('');
  const [savingFeeOverride, setSavingFeeOverride] = useState(false);

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
      alert('Platform fees, Rider finance, and G.S.T. settings saved successfully!');
      fetchFinanceData();
    } catch {
      alert('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateCustomCommission = (restId, currentVal, restName = 'Restaurant') => {
    setFeeModalRest({ id: restId, name: restName });
    setFeeModalValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
  };

  const submitCustomCommissionModal = async (e) => {
    e.preventDefault();
    if (!feeModalRest) return;
    try {
      setSavingFeeOverride(true);
      const trimmed = String(feeModalValue).trim();
      await api.put(`/admin/finance/restaurants/${feeModalRest.id}/commission`, {
        custom_commission_pct: trimmed === '' ? null : Number(trimmed)
      });
      setFeeModalRest(null);
      await fetchFinanceData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update restaurant fee %.');
    } finally {
      setSavingFeeOverride(false);
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
    } catch {
      alert('Failed to delete coupon.');
    }
  };

  const handleSettlePayout = async (id, partnerName, amount) => {
    const note = window.prompt(
      `Settling ₹${amount} for ${partnerName}. Enter UTR / Bank Transfer Ref (optional):`,
      'Settled via Bank/UPI Transfer'
    );
    if (note === null) return;
    try {
      await api.put(`/admin/finance/payouts/${id}/settle`, { transaction_note: note });
      fetchFinanceData();
    } catch {
      alert('Failed to settle payout.');
    }
  };

  const handleRejectPayout = async (id) => {
    const reason = window.prompt('Enter reason for rejecting this withdrawal request:');
    if (reason === null) return;
    try {
      await api.put(`/admin/finance/payouts/${id}/reject`, { reason });
      fetchFinanceData();
    } catch {
      alert('Failed to reject payout.');
    }
  };

  if (!['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type)) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 text-gray-500">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Finance Clearance Required</h2>
        <p>You do not have permission to access the Financial Console.</p>
      </div>
    );
  }

  const pendingPayoutCount = payouts.filter((p) => p.status === 'PENDING').length;

  const filteredRestaurantsLedger = (ledger.restaurantLedger || []).filter((r) =>
    String(r.restaurant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.phone_number || '').includes(searchQuery)
  );

  const filteredRidersLedger = (ledger.riderLedger || []).filter((r) =>
    String(r.rider_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.phone_number || '').includes(searchQuery)
  );

  const roleFilteredPayouts = payouts.filter((p) => {
    if (p.role_type !== payoutRoleSwitch) return false;
    if (payoutStatusFilter !== 'ALL' && p.status !== payoutStatusFilter) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      String(p.partner_name || '').toLowerCase().includes(q) ||
      String(p.phone_number || '').includes(q) ||
      String(p.transaction_note || '').toLowerCase().includes(q)
    );
  });

  const partnerPayoutGroups = Object.values(
    payouts
      .filter((p) => p.role_type === payoutRoleSwitch)
      .reduce((acc, p) => {
        const key = p.user_id;
        if (!acc[key]) {
          acc[key] = {
            user_id: p.user_id,
            partner_name: p.partner_name,
            phone_number: p.phone_number,
            pending_amount: 0,
            paid_amount: 0,
            rejected_amount: 0,
            requests: []
          };
        }
        if (p.status === 'PENDING') acc[key].pending_amount += Number(p.amount || 0);
        if (p.status === 'PAID') acc[key].paid_amount += Number(p.amount || 0);
        if (p.status === 'REJECTED') acc[key].rejected_amount += Number(p.amount || 0);
        acc[key].requests.push(p);
        return acc;
      }, {})
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">Finance Console</h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Manage platform fees, rider pay, G.S.T. slabs, promo coupons, partner ledgers, and payouts.
          </p>
        </div>

        <button
          onClick={fetchFinanceData}
          className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'SETTINGS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 mr-2" /> Tax & Commissions
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
          {pendingPayoutCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full">
              {pendingPayoutCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSettingsSave} className="space-y-6 max-w-5xl">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">1. Global Platform Fee Setting</h3>
                <p className="text-xs text-gray-500">Configure platform commission & customer/delivery fee percentages</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Restaurant Platform Fee (% on Restaurant Payout)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.default_commission_pct ?? 5}
                  onChange={(e) => setSettings({ ...settings, default_commission_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Can be overridden per-restaurant in Master Ledger.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Delivery Platform Fee (% on Rider Payout)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.delivery_platform_fee_pct ?? 10}
                  onChange={(e) => setSettings({ ...settings, delivery_platform_fee_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Platform margin on delivery charges.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Food Platform Fee (% on Original Food Cost)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.food_platform_fee_pct ?? 5}
                  onChange={(e) => setSettings({ ...settings, food_platform_fee_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Applied on customer checkout food subtotal.</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">2. Rider Finance</h3>
                <p className="text-xs text-gray-500">Onboarding fee, base delivery fee (&le; 5 km), and per-km rate (&gt; 5 km)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Rider Onboarding / Uniform Fee (₹)
                </label>
                <input
                  type="number"
                  value={settings.uniform_fee_amount ?? 2000}
                  onChange={(e) => setSettings({ ...settings, uniform_fee_amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">One-time registration & gear fee.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Delivery Base Fee (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  value={settings.rider_base_fee ?? 30}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      rider_base_fee: e.target.value,
                      base_delivery_fee: e.target.value
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Fixed base fee covering the first 5 km.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Delivery Per-Km Fee (₹/km)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.rider_per_km_fee ?? 5}
                  onChange={(e) => setSettings({ ...settings, rider_per_km_fee: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Added per km beyond 5 km (OSRM road distance).</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">3. G.S.T. Section</h3>
                <p className="text-xs text-gray-500">Tax percentages collected across food, delivery, and platform fees</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Food GST (% on Original Food Cost)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.food_gst_pct ?? 5}
                  onChange={(e) => setSettings({ ...settings, food_gst_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Standard 5% restaurant food GST.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Delivery GST (% on Delivery Partner Fee)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.delivery_gst_pct ?? 18}
                  onChange={(e) => setSettings({ ...settings, delivery_gst_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">GST rate applied on delivery partner fee.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Platform Fee GST (% on Platform Fee Cost)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.platform_fee_gst_pct ?? 18}
                  onChange={(e) => setSettings({ ...settings, platform_fee_gst_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">GST rate applied on total platform fees.</p>
              </div>
            </div>
          </div>

          {/* Section 4: Dynamic T.D.S. (Tax Deducted at Source) Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">4. T.D.S. Section (Dynamic Income Tax Withholding)</h3>
                <p className="text-xs text-gray-500">
                  Configure Tax Deducted at Source (%) under Section 194-O. Update anytime government TDS rates change.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Restaurant TDS (% on Original Food Cost — Sec 194-O)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.restaurant_tds_pct ?? 1}
                  onChange={(e) => setSettings({ ...settings, restaurant_tds_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Deducted from Restaurant Payout (e.g. 1% on ₹500 food cost = ₹5.00 TDS). Set to 0% if exempt.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Rider TDS (% on Delivery Partner Fee)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.rider_tds_pct ?? 0}
                  onChange={(e) => setSettings({ ...settings, rider_tds_pct: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Deducted from Rider Payout (Default: 0% for gig riders; adjustable if TDS law changes).
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {savingSettings ? 'Saving Configuration...' : 'Save All Financial Settings'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'COUPONS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">Customer Checkout Promo Codes</h3>
            <button
              onClick={() => openCouponModal()}
              className="flex items-center px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Promo Code
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-emerald-50 text-brand font-black font-mono text-sm rounded-lg border border-emerald-200">
                      {c.code}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 mt-3">
                    {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} FLAT OFF`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{c.description}</p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Min Order: ₹{c.min_order_value || 0} {c.max_discount ? `• Max Cap: ₹${c.max_discount}` : ''}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => openCouponModal(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {coupons.length === 0 && (
              <div className="col-span-3 bg-white p-8 rounded-2xl text-center text-gray-400 border border-gray-100">
                No active promo codes created yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'LEDGER' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
              <button
                onClick={() => setLedgerRoleSwitch('RESTAURANT')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  ledgerRoleSwitch === 'RESTAURANT' ? 'bg-brand text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Store className="w-4 h-4" />
                Restaurant Ledgers ({filteredRestaurantsLedger.length})
              </button>
              <button
                onClick={() => setLedgerRoleSwitch('RIDER')}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  ledgerRoleSwitch === 'RIDER' ? 'bg-brand text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Bike className="w-4 h-4" />
                Rider Ledgers ({filteredRidersLedger.length})
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search partner name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {ledgerRoleSwitch === 'RESTAURANT' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRestaurantsLedger.map((r) => (
                <div key={r.restaurant_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between hover:border-brand/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-brand shrink-0" />
                          {r.restaurant_name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{r.phone_number}</p>
                        <p className="text-[11px] font-mono text-emerald-700 mt-1">
                          Bank: {r.bank_account_number ? `${r.bank_account_number} (${r.bank_ifsc || 'IFSC'})` : 'Not Submitted'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUpdateCustomCommission(r.restaurant_id, r.effective_commission_pct, r.restaurant_name)}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold hover:bg-indigo-100 cursor-pointer"
                        title="Click to override Restaurant Platform Fee %"
                      >
                        Fee: {r.effective_commission_pct}% ✎
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <p className="text-gray-400">Completed Orders</p>
                        <p className="font-bold text-gray-800 text-sm">{r.completed_orders}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Gross Food Sales</p>
                        <p className="font-bold text-gray-800 text-sm">₹{Number(r.gross_sales || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Platform Fee Deducted</p>
                        <p className="font-semibold text-red-600">-₹{Number(r.platform_commission || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">18% Fee GST + TDS</p>
                        <p className="font-semibold text-purple-600">-₹{(Number(r.commission_gst || 0) + Number(r.tds_amount || 0)).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-400">Already Settled: ₹{Number(r.total_settled || 0).toFixed(2)}</p>
                      <p className="text-sm font-black text-emerald-700 mt-0.5">
                        Net Pending Due: ₹{Number(r.net_restaurant_payout || 0).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/finance/ledger/RESTAURANT/${r.restaurant_id}`)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Full Card Details
                    </button>
                  </div>
                </div>
              ))}
              {filteredRestaurantsLedger.length === 0 && (
                <div className="col-span-3 bg-white p-10 rounded-2xl text-center text-gray-400 border border-gray-100">
                  No restaurants in ledger yet.
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRidersLedger.map((rd) => (
                <div key={rd.rider_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between hover:border-brand/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-amber-600 shrink-0" />
                          {rd.rider_name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{rd.phone_number}</p>
                        <p className="text-[11px] font-mono text-emerald-700 mt-1">
                          Bank: {rd.bank_account_number ? `${rd.bank_account_number} (${rd.bank_ifsc || 'IFSC'})` : 'Not Submitted'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rd.uniform_fee_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                        {rd.uniform_fee_paid ? 'Onboarding Paid' : 'Onboarding Due'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <p className="text-gray-400">Deliveries Done</p>
                        <p className="font-bold text-gray-800 text-sm">{rd.completed_deliveries}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Distance</p>
                        <p className="font-bold text-gray-800 text-sm">{Number(rd.total_distance_km || 0).toFixed(1)} km</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Lifetime Earnings</p>
                        <p className="font-semibold text-emerald-700">₹{Number(rd.lifetime_earnings || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total Settled</p>
                        <p className="font-semibold text-blue-600">₹{Number(rd.total_settled || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-400">Unsettled Wallet Balance</p>
                      <p className="text-sm font-black text-emerald-700">
                        Pending Payout: ₹{Number(rd.total_payout_due || 0).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/finance/ledger/RIDER/${rd.rider_id}`)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Full Card Details
                    </button>
                  </div>
                </div>
              ))}
              {filteredRidersLedger.length === 0 && (
                <div className="col-span-3 bg-white p-10 rounded-2xl text-center text-gray-400 border border-gray-100">
                  No riders in ledger yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'PAYOUTS' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
                <button
                  onClick={() => setPayoutRoleSwitch('RESTAURANT')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    payoutRoleSwitch === 'RESTAURANT' ? 'bg-brand text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Restaurant Payouts
                </button>
                <button
                  onClick={() => setPayoutRoleSwitch('RIDER')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    payoutRoleSwitch === 'RIDER' ? 'bg-brand text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  Rider Payouts
                </button>
              </div>

              <div className="flex gap-1.5">
                {['ALL', 'PENDING', 'PAID', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setPayoutStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      payoutStatusFilter === st ? 'bg-dark text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {st === 'PAID' ? 'SETTLED HISTORY' : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search partner or UTR note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {partnerPayoutGroups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {partnerPayoutGroups.map((pg) => (
                <div key={pg.user_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800">{pg.partner_name}</h4>
                    <span className="text-xs text-gray-400">{pg.requests.length} Requests</span>
                  </div>
                  <p className="text-xs text-gray-500">{pg.phone_number}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900">
                      <p className="text-[10px] uppercase font-bold text-amber-600">Pending Request</p>
                      <p className="text-base font-black mt-0.5">₹{fmtMoney(pg.pending_amount)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900">
                      <p className="text-[10px] uppercase font-bold text-emerald-600">Past Settled</p>
                      <p className="text-base font-black mt-0.5">₹{fmtMoney(pg.paid_amount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4 font-medium">Request ID & Date</th>
                    <th className="p-4 font-medium">Partner</th>
                    <th className="p-4 font-medium">Requested Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Bank / Settlement Note</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roleFilteredPayouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <div className="font-bold text-gray-800">#PO-{p.id}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(p.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-gray-800">{p.partner_name}</div>
                        <div className="text-xs text-gray-500">{p.phone_number}</div>
                      </td>
                      <td className="p-4 font-black text-gray-900 text-base">₹{fmtMoney(p.amount)}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            p.status === 'PAID'
                              ? 'bg-green-100 text-green-700'
                              : p.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status === 'PAID' ? 'SETTLED (PAID)' : p.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-600 max-w-xs truncate">
                        {p.transaction_note || 'Awaiting bank settlement'}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {p.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => handleSettlePayout(p.id, p.partner_name, p.amount)}
                              className="inline-flex items-center px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Settle Funds
                            </button>
                            <button
                              onClick={() => handleRejectPayout(p.id)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Updated {p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN') : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {roleFilteredPayouts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-400">
                        No {payoutRoleSwitch.toLowerCase()} payout requests found in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedPartnerDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                {selectedPartnerDetail.data.restaurant_name || selectedPartnerDetail.data.rider_name} — Financial Statement
              </h3>
              <button onClick={() => setSelectedPartnerDetail(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
              {selectedPartnerDetail.role === 'RESTAURANT' ? (
                <>
                  <div className="flex justify-between"><span>Completed Orders:</span><strong>{selectedPartnerDetail.data.completed_orders}</strong></div>
                  <div className="flex justify-between"><span>Gross Food Sales:</span><strong>₹{fmtMoney(selectedPartnerDetail.data.gross_sales)}</strong></div>
                  <div className="flex justify-between text-red-600"><span>Platform Fee ({selectedPartnerDetail.data.effective_commission_pct}%):</span><strong>-₹{fmtMoney(selectedPartnerDetail.data.platform_commission)}</strong></div>
                  <div className="flex justify-between text-purple-600"><span>Food GST Deducted:</span><strong>-₹{fmtMoney(selectedPartnerDetail.data.gst_collected)}</strong></div>
                  <div className="flex justify-between border-t pt-2"><span>Lifetime Net Earnings:</span><strong>₹{fmtMoney(selectedPartnerDetail.data.lifetime_net_payout)}</strong></div>
                  <div className="flex justify-between text-blue-600"><span>Total Settled (Paid Out):</span><strong>₹{fmtMoney(selectedPartnerDetail.data.total_settled)}</strong></div>
                  <div className="flex justify-between border-t pt-2 text-base font-black text-emerald-700"><span>Net Pending Payout:</span><span>₹{fmtMoney(selectedPartnerDetail.data.net_restaurant_payout)}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>Completed Deliveries:</span><strong>{selectedPartnerDetail.data.completed_deliveries}</strong></div>
                  <div className="flex justify-between"><span>Total OSRM Distance:</span><strong>{Number(selectedPartnerDetail.data.total_distance_km || 0).toFixed(1)} km</strong></div>
                  <div className="flex justify-between"><span>Lifetime Rider Earnings:</span><strong>₹{fmtMoney(selectedPartnerDetail.data.lifetime_earnings)}</strong></div>
                  <div className="flex justify-between text-blue-600"><span>Total Settled (Paid Out):</span><strong>₹{fmtMoney(selectedPartnerDetail.data.total_settled)}</strong></div>
                  <div className="flex justify-between border-t pt-2 text-base font-black text-emerald-700"><span>Net Pending Payout:</span><span>₹{fmtMoney(selectedPartnerDetail.data.total_payout_due)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCouponModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 mb-4">
              {editingCouponId ? 'Edit Promo Code' : 'Create Promo Code'}
            </h3>
            <form onSubmit={handleCouponSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase font-mono"
                  placeholder="WELCOME50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Discount Type</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsCouponModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg cursor-pointer">
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {feeModalRest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                Override Platform Fee % — {feeModalRest.name}
              </h3>
              <button
                type="button"
                onClick={() => setFeeModalRest(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={submitCustomCommissionModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Custom Restaurant Platform Fee (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  autoFocus
                  value={feeModalValue}
                  onChange={(e) => setFeeModalValue(e.target.value)}
                  placeholder="Leave blank to use global default"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Leave empty and save to revert to the global default commission percentage.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeeModalRest(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFeeOverride}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold cursor-pointer"
                >
                  {savingFeeOverride ? 'Saving...' : 'Update Fee %'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}