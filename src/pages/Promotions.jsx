import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Crown, Plus, Clock,
  CreditCard, Store, RefreshCw, Search
} from 'lucide-react';
import api from '../config/api';

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [promoFilter, setPromoFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [processingPromo, setProcessingPromo] = useState(null);
  const [processForm, setProcessForm] = useState({
    payment_status: 'PAID',
    priority_rank: 100,
    is_sponsored: true,
    duration_days: 30,
    admin_note: ''
  });

  const [isNewPromoOpen, setIsNewPromoOpen] = useState(false);
  const [newPromoForm, setNewPromoForm] = useState({
    restaurant_id: '',
    plan_name: '30-Day Super Admin Top Spot',
    amount: 1999,
    duration_days: 30,
    requested_rank: 100,
    payment_status: 'PAID',
    payment_method: 'RAZORPAY',
    transaction_ref: '',
    auto_activate: true
  });

  const fetchPromotionsData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const [promoRes, restRes] = await Promise.all([
        api.get('/admin/promotions').catch(() => ({ data: [] })),
        api.get('/admin/restaurants').catch(() => ({ data: [] }))
      ]);
      setPromotions(promoRes.data || []);
      setRestaurants(restRes.data || []);
    } catch (err) {
      console.error('Failed to fetch promotions:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotionsData();
  }, [fetchPromotionsData]);

  const handleCreateManualPromotion = async (e) => {
    e.preventDefault();
    if (!newPromoForm.restaurant_id) return alert('Please select a restaurant');
    try {
      await api.post('/admin/promotions', newPromoForm);
      setIsNewPromoOpen(false);
      fetchPromotionsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to grant promotion.');
    }
  };

  const openProcessPromoModal = (promo) => {
    setProcessingPromo(promo);
    setProcessForm({
      payment_status: 'PAID',
      priority_rank: promo.requested_rank || 100,
      is_sponsored: true,
      duration_days: promo.duration_days || 30,
      admin_note: promo.admin_note || ''
    });
  };

  const handleApprovePromotion = async (e) => {
    e.preventDefault();
    if (!processingPromo) return;
    try {
      await api.put(`/admin/promotions/${processingPromo.id}/process`, {
        decision: 'APPROVED',
        payment_status: processForm.payment_status,
        priority_rank: Number(processForm.priority_rank),
        is_sponsored: Boolean(processForm.is_sponsored),
        duration_days: Number(processForm.duration_days),
        admin_note: processForm.admin_note
      });
      setProcessingPromo(null);
      fetchPromotionsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve promotion.');
    }
  };

  const handleRejectPromotion = async (promo) => {
    const reason = window.prompt(`Enter reason for rejecting ${promo.restaurant_name}'s promotion request:`);
    if (reason === null) return;
    try {
      await api.put(`/admin/promotions/${promo.id}/process`, {
        decision: 'REJECTED',
        payment_status: promo.payment_status,
        admin_note: reason || 'Rejected by Super Admin'
      });
      fetchPromotionsData();
    } catch {
      alert('Failed to reject promotion.');
    }
  };

  const handleRevokePromotion = async (promo) => {
    if (!window.confirm(`End active promotion for ${promo.restaurant_name} and reset their ranking to normal?`)) return;
    try {
      await api.put(`/admin/promotions/${promo.id}/process`, {
        decision: 'EXPIRED',
        priority_rank: 0,
        is_sponsored: false,
        admin_note: 'Ended by Super Admin'
      });
      fetchPromotionsData();
    } catch {
      alert('Failed to end promotion.');
    }
  };

  const handleTogglePaymentStatus = async (promo) => {
    const nextPaymentStatus = promo.payment_status === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.put(`/admin/promotions/${promo.id}/payment`, {
        payment_status: nextPaymentStatus
      });
      fetchPromotionsData();
    } catch {
      alert('Failed to update payment status.');
    }
  };

  const filteredPromotions = promotions.filter((p) => {
    if (promoFilter !== 'ALL' && p.status !== promoFilter) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      String(p.restaurant_name || '').toLowerCase().includes(q) ||
      String(p.plan_name || '').toLowerCase().includes(q)
    );
  });

  const activeBoostCount = promotions.filter((p) => p.status === 'APPROVED').length;
  const pendingBoostCount = promotions.filter((p) => p.status === 'PENDING').length;
  const totalPromoRevenue = promotions
    .filter((p) => p.payment_status === 'PAID')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-amber-500" />
              Super Admin Promotions & Sponsored Ranking
            </h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Approve paid restaurant visibility boosts, grant top-spot rankings, and track ad revenue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPromotionsData}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
          <button
            onClick={() => setIsNewPromoOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl font-semibold text-sm hover:bg-brand/90 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Grant Paid Boost
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Active Sponsored Kitchens</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{activeBoostCount}</p>
            <p className="text-xs text-gray-500 mt-1">Pinned to top of Customer App</p>
          </div>
          <Crown className="w-8 h-8 text-amber-500" />
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Pending Approval Requests</p>
            <p className="text-3xl font-black text-amber-600 mt-1">{pendingBoostCount}</p>
            <p className="text-xs text-gray-500 mt-1">Requested from Restaurant Partner App</p>
          </div>
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Promotion Ad Revenue</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">₹{Math.round(totalPromoRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">From verified paid boosts</p>
          </div>
          <CreditCard className="w-8 h-8 text-indigo-500" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].map((st) => (
            <button
              key={st}
              onClick={() => setPromoFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                promoFilter === st ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search restaurant or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Plan & Duration</th>
                <th className="p-4 font-medium">Amount & Payment</th>
                <th className="p-4 font-medium">Priority Rank</th>
                <th className="p-4 font-medium">Status & Expiry</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPromotions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <div className="font-bold text-gray-800 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-brand" />
                      {p.restaurant_name}
                    </div>
                    <div className="text-xs text-gray-500">{p.phone_number}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{p.plan_name}</div>
                    <div className="text-xs text-gray-500">{p.duration_days} Days Boost</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-gray-800">₹{p.amount}</div>
                    <button
                      onClick={() => handleTogglePaymentStatus(p)}
                      className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        p.payment_status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.payment_status} (Click to toggle)
                    </button>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200">
                      Rank #{p.requested_rank || p.current_priority_rank || 100}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        p.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : p.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.expires_at && (
                      <div className="text-[11px] text-gray-400 mt-1">
                        Expires: {new Date(p.expires_at).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {p.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => openProcessPromoModal(p)}
                          className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Approve & Boost
                        </button>
                        <button
                          onClick={() => handleRejectPromotion(p)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {p.status === 'APPROVED' && (
                      <button
                        onClick={() => handleRevokePromotion(p)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        End Boost
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPromotions.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">
                    No promotion requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {processingPromo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 mb-4">
              Activate Boost: {processingPromo.restaurant_name}
            </h3>
            <form onSubmit={handleApprovePromotion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Priority Rank</label>
                  <input
                    type="number"
                    value={processForm.priority_rank}
                    onChange={(e) => setProcessForm({ ...processForm, priority_rank: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={processForm.duration_days}
                    onChange={(e) => setProcessForm({ ...processForm, duration_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Admin Note</label>
                <input
                  type="text"
                  value={processForm.admin_note}
                  onChange={(e) => setProcessForm({ ...processForm, admin_note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Verified Razorpay payment"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setProcessingPromo(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg cursor-pointer"
                >
                  Confirm & Push to Top
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewPromoOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 mb-4">Grant Sponsored Restaurant Boost</h3>
            <form onSubmit={handleCreateManualPromotion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Restaurant</label>
                <select
                  required
                  value={newPromoForm.restaurant_id}
                  onChange={(e) => setNewPromoForm({ ...newPromoForm, restaurant_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Restaurant --</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (#ID: {r.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newPromoForm.amount}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={newPromoForm.duration_days}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, duration_days: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Priority Rank (Higher = Higher on Home Feed)</label>
                <input
                  type="number"
                  value={newPromoForm.requested_rank}
                  onChange={(e) => setNewPromoForm({ ...newPromoForm, requested_rank: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewPromoOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg cursor-pointer"
                >
                  Activate Boost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
