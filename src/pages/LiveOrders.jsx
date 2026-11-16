import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Activity, MapPin, Search, Edit2, XCircle, Calendar,
  Bike, Store, User, AlertTriangle, CreditCard, KeyRound, RefreshCw, UtensilsCrossed
} from 'lucide-react';
import { initSocket } from '../config/socket';
import api from '../config/api';

const TERMINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'];

const parseOrderItemsList = (rawItems) => {
  if (!rawItems) return [];
  let parsed = rawItems;
  if (typeof rawItems === 'string') {
    try { parsed = JSON.parse(rawItems); } catch { return [{ name: rawItems, quantity: 1 }]; }
  }
  return Array.isArray(parsed) ? parsed : [];
};

const getOrderBucket = (dateStr) => {
  if (!dateStr) return 'TODAY';
  const orderDate = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (orderDate >= startOfToday) return 'TODAY';

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 7);
  if (orderDate >= startOfWeek) return 'THIS_WEEK';

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (orderDate >= startOfMonth) return 'THIS_MONTH';

  return 'OLDER';
};

export default function LiveOrders() {
  const location = useLocation();

  const [orders, setOrders] = useState(() => {
    try {
      const cached = localStorage.getItem('adminLiveOrdersCache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [riders, setRiders] = useState(() => {
    try {
      const cached = localStorage.getItem('adminRidersListCache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState(
    location.search.includes('stuck') ? 'STUCK' : 'ACTIVE'
  );
  const [pastBucket, setPastBucket] = useState('TODAY');
  const [pastStatusFilter, setPastStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ status: '', riderId: '', note: '' });

  const fetchOrders = useCallback(async () => {
    try {
      setIsSyncing(true);
      const [ordersRes, ridersRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/riders')
      ]);
      const orderList = ordersRes.data || [];
      const activeRiders = (ridersRes.data || []).filter(
        (r) => r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'
      );

      setOrders(orderList);
      setRiders(activeRiders);
      localStorage.setItem('adminLiveOrdersCache', JSON.stringify(orderList));
      localStorage.setItem('adminRidersListCache', JSON.stringify(activeRiders));
    } catch (err) {
      console.error('Failed to fetch live orders', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const socket = initSocket();
    const handleRefresh = () => fetchOrders();

    if (socket) {
      socket.on('newIncomingOrder', handleRefresh);
      socket.on('orderStatusChanged', handleRefresh);
    }

    return () => {
      if (socket) {
        socket.off('newIncomingOrder', handleRefresh);
        socket.off('orderStatusChanged', handleRefresh);
      }
    };
  }, [fetchOrders]);

  const openOverrideModal = (order) => {
    setSelectedOrder(order);
    setOverrideForm({
      status: order.status,
      riderId: order.rider_id || '',
      note: ''
    });
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        status: overrideForm.status,
        riderId: overrideForm.riderId === '' ? null : Number(overrideForm.riderId),
        note: overrideForm.note,
        forceSync: true
      };
      await api.put(`/admin/orders/${selectedOrder.id}/override`, payload);
      setSelectedOrder(null);
      fetchOrders();
    } catch {
      alert('Failed to override order. Check console.');
    }
  };

  const isOrderStuck = (o) =>
    ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status) &&
    !o.rider_id &&
    Date.now() - new Date(o.created_at).getTime() > 10 * 60 * 1000;

  const activeCount = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length;
  const stuckCount = orders.filter(isOrderStuck).length;
  const pastOrdersAll = orders.filter((o) => TERMINAL_STATUSES.includes(o.status));
  const pastCount = pastOrdersAll.length;

  const bucketCounts = {
    TODAY: pastOrdersAll.filter((o) => getOrderBucket(o.created_at) === 'TODAY').length,
    THIS_WEEK: pastOrdersAll.filter((o) => getOrderBucket(o.created_at) === 'THIS_WEEK').length,
    THIS_MONTH: pastOrdersAll.filter((o) => getOrderBucket(o.created_at) === 'THIS_MONTH').length,
    OLDER: pastOrdersAll.filter((o) => getOrderBucket(o.created_at) === 'OLDER').length,
    ALL: pastOrdersAll.length
  };

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const itemsText = JSON.stringify(o.items || '').toLowerCase();
    const matchesSearch =
      String(o.id).includes(q) ||
      String(o.customer_name || '').toLowerCase().includes(q) ||
      String(o.restaurant_name || '').toLowerCase().includes(q) ||
      String(o.razorpay_payment_id || '').toLowerCase().includes(q) ||
      itemsText.includes(q);

    if (!matchesSearch) return false;

    if (activeTab === 'ACTIVE') {
      return !TERMINAL_STATUSES.includes(o.status);
    } else if (activeTab === 'STUCK') {
      return isOrderStuck(o);
    } else {
      if (!TERMINAL_STATUSES.includes(o.status)) return false;
      if (pastBucket !== 'ALL' && getOrderBucket(o.created_at) !== pastBucket) return false;
      if (pastStatusFilter === 'DELIVERED' && !['COMPLETED', 'DELIVERED'].includes(o.status)) return false;
      if (pastStatusFilter === 'CANCELLED' && !['CANCELLED', 'REJECTED'].includes(o.status)) return false;
      return true;
    }
  });

  const pastFilteredGmv = filteredOrders
    .filter((o) => ['COMPLETED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const getStatusColor = (status) => {
    if (['COMPLETED', 'DELIVERED'].includes(status)) return 'bg-green-100 text-green-700';
    if (['CANCELLED', 'REJECTED'].includes(status)) return 'bg-red-100 text-red-700';
    if (['ACCEPTED', 'PREPARING', 'READY'].includes(status)) return 'bg-orange-100 text-orange-700';
    if (['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status)) return 'bg-blue-100 text-blue-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">Live Orders Control</h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Monitor dispatch, ordered dishes, Razorpay payment status, delivery PINs, and organized past orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search Order ID, Dish, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>
          <button
            onClick={fetchOrders}
            title="Refresh Orders"
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="w-4 h-4 mr-2" /> Active Deliveries ({activeCount})
        </button>
        <button
          onClick={() => setActiveTab('STUCK')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'STUCK'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 mr-2" /> Stuck Orders ({stuckCount})
        </button>
        <button
          onClick={() => setActiveTab('PAST')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'PAST'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="w-4 h-4 mr-2" /> Past Orders ({pastCount})
        </button>
      </div>

      {activeTab === 'PAST' && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'TODAY', label: "Today's Orders", count: bucketCounts.TODAY },
              { id: 'THIS_WEEK', label: "This Week's Orders", count: bucketCounts.THIS_WEEK },
              { id: 'THIS_MONTH', label: "This Month's Orders", count: bucketCounts.THIS_MONTH },
              { id: 'OLDER', label: 'Older Orders', count: bucketCounts.OLDER },
              { id: 'ALL', label: 'All Past Orders', count: bucketCounts.ALL }
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setPastBucket(b.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  pastBucket === b.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {b.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${pastBucket === b.id ? 'bg-white/20 text-white' : 'bg-white text-gray-700'}`}>
                  {b.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={pastStatusFilter}
              onChange={(e) => setPastStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-gray-50 text-gray-700 outline-none"
            >
              <option value="ALL">All Outcomes (Delivered & Cancelled)</option>
              <option value="DELIVERED">Delivered Only</option>
              <option value="CANCELLED">Cancelled / Rejected Only</option>
            </select>
            <div className="px-3 py-2 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
              Delivered GMV: ₹{Math.round(pastFilteredGmv)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Order & Time</th>
                <th className="p-4 font-medium">Ordered Items</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Rider</th>
                <th className="p-4 font-medium">Financials & Payment</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((o) => {
                const isRazorpay =
                  o.payment_method === 'RAZORPAY' ||
                  o.payment_method === 'ONLINE' ||
                  Boolean(o.razorpay_payment_id);
                const itemList = parseOrderItemsList(o.items);

                return (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-bold text-gray-800">#FZ-{o.id}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(o.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {o.delivery_otp && (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-mono font-bold border border-amber-200">
                          <KeyRound className="w-2.5 h-2.5" /> PIN: {o.delivery_otp}
                        </div>
                      )}
                    </td>
                    <td className="p-4 max-w-xs whitespace-normal">
                      {itemList.length > 0 ? (
                        <div className="space-y-1">
                          {itemList.map((it, idx) => (
                            <div key={idx} className="text-xs text-gray-800 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-brand/10 text-brand font-bold rounded text-[10px]">
                                {it.quantity || it.qty || 1}x
                              </span>
                              <span className="font-medium truncate max-w-[190px]">{it.name || it.title || 'Dish'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <UtensilsCrossed className="w-3 h-3" /> Standard Order
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800 flex items-center">
                        <User className="w-3 h-3 mr-1 text-gray-400" />
                        {o.customer_name}
                      </div>
                      <div className="text-xs text-gray-500">{o.customer_phone}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800 flex items-center">
                        <Store className="w-3 h-3 mr-1 text-gray-400" />
                        {o.restaurant_name}
                      </div>
                      <div className="text-xs text-gray-500">{o.restaurant_phone}</div>
                    </td>
                    <td className="p-4">
                      {o.rider_name ? (
                        <>
                          <div className="font-medium text-gray-800 flex items-center">
                            <Bike className="w-3 h-3 mr-1 text-gray-400" />
                            {o.rider_name}
                          </div>
                          <div className="text-xs text-gray-500">{o.rider_phone}</div>
                        </>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-green-600">₹{o.total_amount}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3 text-indigo-500" />
                        <span className="text-[11px] font-semibold text-gray-600">
                          {isRazorpay ? 'Razorpay Paid' : o.payment_method || 'COD'}
                        </span>
                      </div>
                      {o.razorpay_payment_id && (
                        <div className="text-[10px] font-mono text-gray-400">
                          {o.razorpay_payment_id}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${getStatusColor(
                          o.status
                        )}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openOverrideModal(o)}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Override
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-400">
                    No orders found in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">
                Super Admin Override: #FZ-{selectedOrder.id}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Force Status</label>
                <select
                  value={overrideForm.status}
                  onChange={(e) => setOverrideForm({ ...overrideForm, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="READY">READY</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reassign Rider
                </label>
                <select
                  value={overrideForm.riderId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, riderId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="">-- Remove/Unassign Rider --</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Super Admin Note (For Audit Log)
                </label>
                <input
                  type="text"
                  required
                  value={overrideForm.note}
                  onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  placeholder="e.g. Rider bike broke down, reassigned."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer font-medium"
                >
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
