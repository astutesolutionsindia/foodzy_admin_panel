import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  Store,
  Bike,
  Users,
  Crown,
  Sparkles,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  TrendingUp,
  Calendar,
  Plus,
  Edit,
  Video,
  Trash2
} from 'lucide-react';
import api from '../config/api';

export default function Directory() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('RESTAURANTS');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [promoFilter, setPromoFilter] = useState('ALL');

  const [restaurants, setRestaurants] = useState([]);
  const [riders, setRiders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [promotions, setPromotions] = useState([]);

  // Restaurant Ranking / Commission Edit Modal
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [restForm, setRestForm] = useState({
    priority_rank: 0,
    is_sponsored: false,
    status: 'ACTIVE',
    custom_commission_pct: ''
  });

  // Restaurant Showcase Videos Modal (Preview & Moderation)
  const [viewingVideosRestaurant, setViewingVideosRestaurant] = useState(null);

  // Promotion Request Processing Modal
  const [processingPromo, setProcessingPromo] = useState(null);
  const [processForm, setProcessForm] = useState({
    payment_status: 'PAID',
    priority_rank: 100,
    is_sponsored: true,
    duration_days: 7,
    admin_note: ''
  });

  // Manual Grant Paid Boost Modal
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

  const fetchDirectoryData = async () => {
    try {
      const [restRes, ridersRes, custRes, promoRes] = await Promise.all([
        api.get('/admin/restaurants'),
        api.get('/admin/riders'),
        api.get('/admin/customers'),
        api.get('/admin/promotions').catch(() => ({ data: [] }))
      ]);
      setRestaurants(restRes.data || []);
      setRiders(ridersRes.data || []);
      setCustomers(custRes.data || []);
      setPromotions(promoRes.data || []);
    } catch (err) {
      console.error('Failed to fetch directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectoryData();
  }, []);

  const parseShowcaseVideos = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // --- Delete a specific showcase video from a restaurant (Moderation) ---
  const handleDeleteRestaurantVideo = async (restaurant, videoIdx) => {
    if (!window.confirm('Remove this showcase video from the Customer App?')) return;
    const currentVideos = parseShowcaseVideos(
      restaurant.showcase_videos || restaurant.showcaseVideos
    );
    const updatedVideos = currentVideos.filter((_, i) => i !== videoIdx);

    try {
      await api.put(`/admin/restaurants/${restaurant.id}/videos`, {
        showcase_videos: updatedVideos
      });
      setViewingVideosRestaurant({
        ...restaurant,
        showcase_videos: updatedVideos
      });
      fetchDirectoryData();
    } catch (err) {
      alert('Failed to remove video clip.');
    }
  };

  // --- Restaurant Ranking & Commission Edit ---
  const openRestaurantModal = (r) => {
    setEditingRestaurant(r);
    setRestForm({
      priority_rank: r.priority_rank || 0,
      is_sponsored: Boolean(r.is_sponsored),
      status: r.status || 'ACTIVE',
      custom_commission_pct:
        r.custom_commission_pct !== null && r.custom_commission_pct !== undefined
          ? r.custom_commission_pct
          : ''
    });
  };

  const handleSaveRestaurant = async (e) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    try {
      await api.put(`/admin/restaurants/${editingRestaurant.id}/ranking`, {
        priority_rank: Number(restForm.priority_rank),
        is_sponsored: Boolean(restForm.is_sponsored),
        status: restForm.status
      });

      if (['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type)) {
        await api.put(`/admin/finance/restaurants/${editingRestaurant.id}/commission`, {
          custom_commission_pct:
            restForm.custom_commission_pct === '' ? null : Number(restForm.custom_commission_pct)
        });
      }

      setEditingRestaurant(null);
      fetchDirectoryData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update restaurant settings.');
    }
  };

  // --- Process Paid Promotion Request ---
  const openProcessPromoModal = (promo) => {
    setProcessingPromo(promo);
    setProcessForm({
      payment_status: 'PAID',
      priority_rank: promo.requested_rank || 100,
      is_sponsored: true,
      duration_days: promo.duration_days || 7,
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
      fetchDirectoryData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to activate promotion request.');
    }
  };

  const handleRejectPromotion = async (promo) => {
    const reason = window.prompt(
      `Enter reason for rejecting ${promo.restaurant_name}'s promotion request:`
    );
    if (reason === null) return;

    try {
      await api.put(`/admin/promotions/${promo.id}/process`, {
        decision: 'REJECTED',
        payment_status: promo.payment_status,
        admin_note: reason || 'Payment verification failed'
      });
      fetchDirectoryData();
    } catch (err) {
      alert('Failed to reject promotion request.');
    }
  };

  const handleRevokePromotion = async (promo) => {
    if (
      !window.confirm(
        `End active promotion for ${promo.restaurant_name} and reset their ranking to normal?`
      )
    )
      return;

    try {
      await api.put(`/admin/promotions/${promo.id}/process`, {
        decision: 'EXPIRED',
        priority_rank: 0,
        is_sponsored: false,
        admin_note: 'Promotion ended by Super Admin'
      });
      fetchDirectoryData();
    } catch (err) {
      alert('Failed to revoke promotion.');
    }
  };

  const handleTogglePaymentStatus = async (promo) => {
    const nextPaymentStatus = promo.payment_status === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.put(`/admin/promotions/${promo.id}/payment`, {
        payment_status: nextPaymentStatus
      });
      fetchDirectoryData();
    } catch (err) {
      alert('Failed to update payment status.');
    }
  };

  const handleCreateManualPromo = async (e) => {
    e.preventDefault();
    if (!newPromoForm.restaurant_id) {
      alert('Please select a restaurant.');
      return;
    }

    try {
      await api.post('/admin/promotions', newPromoForm);
      setIsNewPromoOpen(false);
      setNewPromoForm({
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
      fetchDirectoryData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create promotion boost.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  const q = searchQuery.toLowerCase();

  const filteredRestaurants = restaurants.filter(
    (r) =>
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.owner_name || '').toLowerCase().includes(q) ||
      String(r.phone_number || '').includes(q)
  );

  const filteredRiders = riders.filter(
    (r) =>
      String(r.full_name || '').toLowerCase().includes(q) ||
      String(r.phone_number || '').includes(q)
  );

  const filteredCustomers = customers.filter(
    (c) =>
      String(c.full_name || '').toLowerCase().includes(q) ||
      String(c.phone_number || '').includes(q)
  );

  const filteredPromotions = promotions.filter((p) => {
    const matchesSearch =
      String(p.restaurant_name || '').toLowerCase().includes(q) ||
      String(p.plan_name || '').toLowerCase().includes(q) ||
      String(p.transaction_ref || '').toLowerCase().includes(q) ||
      String(p.razorpay_payment_id || '').toLowerCase().includes(q) ||
      String(p.phone_number || '').includes(q);

    if (promoFilter === 'ALL') return matchesSearch;
    return p.status === promoFilter && matchesSearch;
  });

  const pendingPromoCount = promotions.filter((p) => p.status === 'PENDING').length;
  const activeSponsoredCount = restaurants.filter((r) => r.is_sponsored).length;
  const totalPromoRevenue = promotions
    .filter((p) => p.payment_status === 'PAID' && p.status !== 'REJECTED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Partner & User Directory</h2>
          <p className="text-gray-500">
            Manage restaurants, showcase videos, riders, customers, and Super Admin paid ranking promotions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, phone, Razorpay ID, UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>

          {activeTab === 'PROMOTIONS' && (
            <button
              onClick={() => setIsNewPromoOpen(true)}
              className="flex items-center px-4 py-2 bg-brand text-white rounded-xl hover:bg-brand/90 text-sm font-semibold whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Grant Super Admin Boost
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('RESTAURANTS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'RESTAURANTS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store className="w-4 h-4 mr-2" /> Restaurants ({restaurants.length})
        </button>

        <button
          onClick={() => setActiveTab('PROMOTIONS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'PROMOTIONS'
              ? 'border-b-2 border-amber-500 text-amber-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4 mr-2 text-amber-500" /> Super Admin Promotions
          {pendingPromoCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingPromoCount} New
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('RIDERS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'RIDERS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bike className="w-4 h-4 mr-2" /> Riders ({riders.length})
        </button>

        <button
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'CUSTOMERS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 mr-2" /> Customers ({customers.length})
        </button>
      </div>

      {/* =========================================================
          TAB 1: RESTAURANTS DIRECTORY
      ========================================================= */}
      {activeTab === 'RESTAURANTS' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Restaurant</th>
                  <th className="p-4 font-medium">Contact</th>
                  <th className="p-4 font-medium">Live Status</th>
                  <th className="p-4 font-medium">Ranking & Boost</th>
                  <th className="p-4 font-medium">Showcase Videos</th>
                  <th className="p-4 font-medium">Commission</th>
                  <th className="p-4 font-medium">Orders / Menu</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRestaurants.map((r) => {
                  const videos = parseShowcaseVideos(r.showcase_videos || r.showcaseVideos);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              r.image_url ||
                              'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=200&q=70'
                            }
                            alt={r.name}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                          />
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-1.5">
                              {r.name}
                              {r.is_sponsored && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                                  <Sparkles className="w-3 h-3 mr-1" /> SPONSORED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{r.cuisine || 'Multi-Cuisine'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-700">{r.owner_name}</div>
                        <div className="text-xs text-gray-500">{r.phone_number}</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            r.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : r.status === 'SUSPENDED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {r.status}
                        </span>
                        <div className="text-[11px] mt-1 font-medium">
                          {r.is_online ? (
                            <span className="text-green-600">● Accepting Orders</span>
                          ) : (
                            <span className="text-gray-400">○ Offline</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold text-gray-800">
                          Rank #{r.priority_rank || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.is_sponsored ? 'Top Pinned' : 'Standard Organic'}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setViewingVideosRestaurant(r)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            videos.length > 0
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Video className="w-3.5 h-3.5 mr-1.5" />
                          {videos.length} / 5 Videos
                        </button>
                      </td>
                      <td className="p-4">
                        {r.custom_commission_pct !== null && r.custom_commission_pct !== undefined ? (
                          <span className="font-bold text-brand">
                            {r.custom_commission_pct}% (Custom)
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Global Default</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-gray-600">
                        <div>
                          <strong>{r.completed_orders || 0}</strong> Completed Orders
                        </div>
                        <div>
                          <strong>{r.menu_count || 0}</strong> Dishes Listed
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openRestaurantModal(r)}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" /> Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredRestaurants.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-400">
                      No restaurants matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: SUPER ADMIN PROMOTIONS (RAZORPAY + MANUAL)
      ========================================================= */}
      {activeTab === 'PROMOTIONS' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Pending Upgrade Requests
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{pendingPromoCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Razorpay checkouts auto-activate; manual UTRs appear here
                </p>
              </div>
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Active Sponsored Kitchens
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{activeSponsoredCount}</p>
                <p className="text-xs text-gray-500 mt-1">Pinned to top of Customer App</p>
              </div>
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Super Admin Boost Revenue
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">₹{totalPromoRevenue}</p>
                <p className="text-xs text-gray-500 mt-1">Verified Razorpay & UPI ad boosts</p>
              </div>
              <div className="p-3.5 bg-green-50 text-green-600 rounded-xl">
                <Crown className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center gap-2">
              {['ALL', 'PENDING', 'APPROVED', 'EXPIRED', 'REJECTED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setPromoFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    promoFilter === status
                      ? 'bg-dark text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'APPROVED' ? 'ACTIVE BOOSTS' : status}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              Showing <strong>{filteredPromotions.length}</strong> service requests
            </div>
          </div>

          {/* Promotion Requests Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-4 font-medium">Requested On</th>
                    <th className="p-4 font-medium">Restaurant Partner</th>
                    <th className="p-4 font-medium">Super Admin Plan</th>
                    <th className="p-4 font-medium">Payment & Razorpay / UTR</th>
                    <th className="p-4 font-medium">Rank & Validity</th>
                    <th className="p-4 font-medium">Service Status</th>
                    <th className="p-4 font-medium text-right">Process Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPromotions.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="p-4 text-xs text-gray-500">
                        <div>{new Date(p.created_at).toLocaleDateString()}</div>
                        <div>
                          {new Date(p.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          {p.restaurant_name}
                          {p.current_is_sponsored && (
                            <Sparkles
                              className="w-3.5 h-3.5 text-amber-500"
                              title="Currently Sponsored"
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.phone_number} • Current Rank: #{p.current_priority_rank || 0}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-gray-800">
                          {(p.plan_name || 'Top Ranking Boost').replace('God-Mode', 'Super Admin')}
                        </div>
                        <div className="text-xs text-gray-500">
                          Duration: <strong>{p.duration_days || 7} Days</strong> • Target Rank:{' '}
                          <strong>#{p.requested_rank || 100}</strong>
                        </div>
                        {p.request_note && (
                          <div
                            className="text-[11px] text-gray-400 italic mt-0.5 max-w-[200px] truncate"
                            title={p.request_note}
                          >
                            "{p.request_note}"
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">₹{p.amount || 0}</span>
                          <button
                            onClick={() => handleTogglePaymentStatus(p)}
                            title="Click to toggle payment verification"
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              p.payment_status === 'PAID'
                                ? 'bg-green-100 text-green-700'
                                : p.payment_status === 'VERIFYING'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {p.payment_status || 'PENDING'}
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-gray-400" />
                          <span>{p.payment_method || 'RAZORPAY'}</span>
                          {(p.razorpay_payment_id || p.transaction_ref) && (
                            <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                              Ref: {p.razorpay_payment_id || p.transaction_ref}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-xs">
                        {p.expires_at ? (
                          <div>
                            <div className="font-semibold text-gray-700 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-brand" />
                              Expires: {new Date(p.expires_at).toLocaleDateString()}
                            </div>
                            <div className="text-gray-400">
                              {new Date(p.expires_at) > new Date()
                                ? 'Boost Active'
                                : 'Boost Period Ended'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not activated yet</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.status === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : p.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : p.status === 'EXPIRED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {p.status === 'APPROVED' ? 'LIVE / BOOSTED' : p.status}
                        </span>
                        {p.admin_note && (
                          <div
                            className="text-[11px] text-gray-400 mt-1 max-w-[160px] truncate"
                            title={p.admin_note}
                          >
                            Note: {p.admin_note}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {p.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openProcessPromoModal(p)}
                              className="flex items-center px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg font-semibold text-xs cursor-pointer shadow-2xs"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Process & Activate
                            </button>
                            <button
                              onClick={() => handleRejectPromotion(p)}
                              className="flex items-center px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-semibold text-xs cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </button>
                          </div>
                        )}

                        {p.status === 'APPROVED' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openProcessPromoModal(p)}
                              className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-semibold text-xs cursor-pointer"
                            >
                              Edit Rank
                            </button>
                            <button
                              onClick={() => handleRevokePromotion(p)}
                              className="px-2.5 py-1.5 bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg font-semibold text-xs cursor-pointer"
                            >
                              End Boost
                            </button>
                          </div>
                        )}

                        {(p.status === 'REJECTED' || p.status === 'EXPIRED') && (
                          <button
                            onClick={() => openProcessPromoModal(p)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs cursor-pointer"
                          >
                            Re-Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredPromotions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-10 text-center text-gray-400">
                        No paid promotion requests found in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 3: RIDERS DIRECTORY
      ========================================================= */}
      {activeTab === 'RIDERS' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Rider Name</th>
                  <th className="p-4 font-medium">Phone</th>
                  <th className="p-4 font-medium">KYC Status</th>
                  <th className="p-4 font-medium">Uniform Fee (Razorpay)</th>
                  <th className="p-4 font-medium">Deliveries</th>
                  <th className="p-4 font-medium">Lifetime Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRiders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-bold text-gray-800">{r.full_name}</td>
                    <td className="p-4 text-gray-600">{r.phone_number}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'
                            ? 'bg-green-100 text-green-700'
                            : r.approval_status === 'REJECTED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {r.approval_status}
                      </span>
                    </td>
                    <td className="p-4">
                      {r.fee_paid ? (
                        <span className="text-green-600 font-bold text-xs">PAID</span>
                      ) : (
                        <span className="text-red-500 font-bold text-xs">UNPAID</span>
                      )}
                    </td>
                    <td className="p-4 font-medium">{r.completed_deliveries || 0} orders</td>
                    <td className="p-4 font-bold text-green-600">₹{r.total_earnings || 0}</td>
                  </tr>
                ))}
                {filteredRiders.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      No riders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 4: CUSTOMERS DIRECTORY
      ========================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Customer Name</th>
                  <th className="p-4 font-medium">Phone Number</th>
                  <th className="p-4 font-medium">Total Orders</th>
                  <th className="p-4 font-medium">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-bold text-gray-800">{c.full_name}</td>
                    <td className="p-4 text-gray-600">{c.phone_number}</td>
                    <td className="p-4">{c.total_orders || 0} orders</td>
                    <td className="p-4 font-bold text-green-600">₹{c.total_spent || 0}</td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 0: RESTAURANT SHOWCASE VIDEOS VIEWER & MODERATOR
      ========================================================= */}
      {viewingVideosRestaurant && (
        <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                  <Video className="w-5 h-5 text-brand" />
                  Showcase Videos: {viewingVideosRestaurant.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  These MP4 clips stream directly at the top of the restaurant menu in the Foodzy Customer App.
                </p>
              </div>
              <button
                onClick={() => setViewingVideosRestaurant(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const clips = parseShowcaseVideos(
                viewingVideosRestaurant.showcase_videos ||
                  viewingVideosRestaurant.showcaseVideos
              );
              if (clips.length === 0) {
                return (
                  <div className="p-10 text-center bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-sm">
                    This restaurant has not uploaded any dish showcase videos yet.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {clips.map((clip, idx) => {
                    const src = typeof clip === 'string' ? clip : clip?.dataUri || clip?.url;
                    const label =
                      typeof clip === 'object' && clip?.name
                        ? clip.name
                        : `Dish Showcase #${idx + 1}`;
                    return (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl overflow-hidden bg-black flex flex-col"
                      >
                        <video
                          src={src}
                          controls
                          preload="metadata"
                          className="w-full h-48 object-cover bg-black"
                        />
                        <div className="p-3 bg-white flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800 truncate">
                            {label}
                          </span>
                          <button
                            onClick={() =>
                              handleDeleteRestaurantVideo(viewingVideosRestaurant, idx)
                            }
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer"
                            title="Remove Video"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 1: PROCESS & ACTIVATE PROMOTION REQUEST
      ========================================================= */}
      {processingPromo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Process Super Admin Boost
              </h3>
              <button
                onClick={() => setProcessingPromo(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs space-y-1">
              <div className="font-bold text-amber-900 text-sm">
                {processingPromo.restaurant_name}
              </div>
              <div className="text-amber-800">
                Requested Plan: <strong>{processingPromo.plan_name}</strong> (₹
                {processingPromo.amount})
              </div>
              {(processingPromo.razorpay_payment_id || processingPromo.transaction_ref) && (
                <div className="font-mono text-amber-900">
                  Payment Ref:{' '}
                  <strong>
                    {processingPromo.razorpay_payment_id || processingPromo.transaction_ref}
                  </strong>
                </div>
              )}
            </div>

            <form onSubmit={handleApprovePromotion} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={processForm.payment_status}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, payment_status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                  >
                    <option value="PAID">PAID (Verified)</option>
                    <option value="PENDING">PENDING</option>
                    <option value="VERIFYING">VERIFYING</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Boost Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={processForm.duration_days}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, duration_days: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Assign Priority Rank (Higher = Higher on Home Screen)
                </label>
                <input
                  type="number"
                  required
                  value={processForm.priority_rank}
                  onChange={(e) =>
                    setProcessForm({ ...processForm, priority_rank: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-mono"
                  placeholder="e.g. 100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Tip: Use 100 for Super Admin Top Spot, 75 for Gold, 50 for Spotlight.
                </p>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-3 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  checked={processForm.is_sponsored}
                  onChange={(e) =>
                    setProcessForm({ ...processForm, is_sponsored: e.target.checked })
                  }
                  className="w-4 h-4 text-brand rounded"
                />
                <span className="font-semibold text-gray-700 text-xs">
                  Pin with "SPONSORED" Badge at Top of Customer App
                </span>
              </label>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Super Admin Verification Note
                </label>
                <input
                  type="text"
                  value={processForm.admin_note}
                  onChange={(e) =>
                    setProcessForm({ ...processForm, admin_note: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  placeholder="e.g. Verified via Razorpay / UPI"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProcessingPromo(null)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold cursor-pointer"
                >
                  Approve & Activate Boost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: MANUAL GRANT SUPER ADMIN BOOST
      ========================================================= */}
      {isNewPromoOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl text-gray-800">Grant Super Admin Ranking Boost</h3>
              <button
                onClick={() => setIsNewPromoOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateManualPromo} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Select Restaurant</label>
                <select
                  required
                  value={newPromoForm.restaurant_id}
                  onChange={(e) =>
                    setNewPromoForm({ ...newPromoForm, restaurant_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                >
                  <option value="">-- Choose Restaurant --</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Service Package / Plan
                </label>
                <select
                  value={newPromoForm.plan_name}
                  onChange={(e) => {
                    const plan = e.target.value;
                    if (plan.includes('7-Day')) {
                      setNewPromoForm({
                        ...newPromoForm,
                        plan_name: plan,
                        amount: 699,
                        duration_days: 7,
                        requested_rank: 50
                      });
                    } else if (plan.includes('15-Day')) {
                      setNewPromoForm({
                        ...newPromoForm,
                        plan_name: plan,
                        amount: 1199,
                        duration_days: 15,
                        requested_rank: 75
                      });
                    } else {
                      setNewPromoForm({
                        ...newPromoForm,
                        plan_name: plan,
                        amount: 1999,
                        duration_days: 30,
                        requested_rank: 100
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                >
                  <option value="7-Day Spotlight Boost">7-Day Spotlight Boost (₹699)</option>
                  <option value="15-Day Gold Priority">15-Day Gold Priority (₹1199)</option>
                  <option value="30-Day Super Admin Top Spot">
                    30-Day Super Admin Top Spot (₹1999)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={newPromoForm.amount}
                    onChange={(e) =>
                      setNewPromoForm({ ...newPromoForm, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Days</label>
                  <input
                    type="number"
                    required
                    value={newPromoForm.duration_days}
                    onChange={(e) =>
                      setNewPromoForm({ ...newPromoForm, duration_days: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Rank #</label>
                  <input
                    type="number"
                    required
                    value={newPromoForm.requested_rank}
                    onChange={(e) =>
                      setNewPromoForm({ ...newPromoForm, requested_rank: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={newPromoForm.payment_status}
                    onChange={(e) =>
                      setNewPromoForm({ ...newPromoForm, payment_status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Razorpay / UTR Ref
                  </label>
                  <input
                    type="text"
                    value={newPromoForm.transaction_ref}
                    onChange={(e) =>
                      setNewPromoForm({ ...newPromoForm, transaction_ref: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                    placeholder="e.g. pay_P98x..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewPromoOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 font-semibold cursor-pointer"
                >
                  Log & Activate Boost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: CONFIGURE RESTAURANT RANKING & COMMISSION
      ========================================================= */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">
                Configure: {editingRestaurant.name}
              </h3>
              <button
                onClick={() => setEditingRestaurant(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveRestaurant} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Account Status</label>
                <select
                  value={restForm.status}
                  onChange={(e) => setRestForm({ ...restForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Priority Rank</label>
                <input
                  type="number"
                  value={restForm.priority_rank}
                  onChange={(e) => setRestForm({ ...restForm, priority_rank: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-mono"
                />
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restForm.is_sponsored}
                  onChange={(e) => setRestForm({ ...restForm, is_sponsored: e.target.checked })}
                  className="w-4 h-4 text-brand rounded"
                />
                <span className="font-medium text-gray-700">Mark as Sponsored Partner</span>
              </label>

              {['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type) && (
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Custom Commission % (Leave blank for global default)
                  </label>
                  <input
                    type="number"
                    value={restForm.custom_commission_pct}
                    onChange={(e) =>
                      setRestForm({ ...restForm, custom_commission_pct: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                    placeholder="e.g. 15"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRestaurant(null)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}