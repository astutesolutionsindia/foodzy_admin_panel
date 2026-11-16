import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';
import {
  Activity, ShoppingBag, AlertTriangle, DollarSign,
  Wallet, Bike, CreditCard, RefreshCw, Layers, UtensilsCrossed
} from 'lucide-react';
import api from '../config/api';

const DEFAULT_METRICS = {
  operational: {
    activeOrdersCount: 0,
    stuckOrdersCount: 0,
    pendingRestaurantKyc: 0,
    pendingRiderKyc: 0,
    totalCustomers: 0,
    totalRestaurants: 0,
    totalRiders: 0
  },
  financials: {
    grossMerchandiseValue: 0,
    pendingPayoutTotal: 0,
    pendingRestaurantPayout: 0,
    pendingRiderPayout: 0,
    totalPlatformFees: 0,
    monthRestPlatformFee: 0,
    totalFoodPlatformFee: 0,
    totalDeliveryPlatformFee: 0,
    totalGst: 0,
    monthFoodGst: 0,
    monthDeliveryGst: 0,
    monthPlatformFeeGst: 0
  },
  recentOrders: []
};

const isSameDayIST = (dateStr) => {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d) === fmt.format(now);
};

const formatOrderItems = (rawItems) => {
  if (!rawItems) return 'Standard Meal';
  let parsed = rawItems;
  if (typeof rawItems === 'string') {
    try { parsed = JSON.parse(rawItems); } catch { return rawItems; }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return 'Standard Meal';
  return parsed
    .map((it) => `${it.quantity || it.qty || 1}x ${it.name || it.title || 'Item'}`)
    .join(', ');
};

export default function CommandCenter() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(() => {
    try {
      const cached = localStorage.getItem('adminOverviewCache');
      return cached ? JSON.parse(cached) : DEFAULT_METRICS;
    } catch {
      return DEFAULT_METRICS;
    }
  });

  const [liveOrders, setLiveOrders] = useState(() => {
    try {
      const cached = localStorage.getItem('adminOverviewCache');
      const parsed = cached ? JSON.parse(cached) : null;
      return (parsed?.recentOrders || []).filter((o) => isSameDayIST(o.created_at));
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await api.get('/admin/overview');
      if (res.data) {
        setMetrics(res.data);
        const todayOnly = (res.data.recentOrders || []).filter((o) => isSameDayIST(o.created_at));
        setLiveOrders(todayOnly);
        localStorage.setItem('adminOverviewCache', JSON.stringify(res.data));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard overview:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();

    const socket = initSocket();
    const handleNewOrder = (order) => {
      if (isSameDayIST(order?.created_at)) {
        setLiveOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      }
      fetchOverview();
    };
    const handleOrderChange = () => {
      fetchOverview();
    };

    if (socket) {
      socket.on('newIncomingOrder', handleNewOrder);
      socket.on('orderStatusChanged', handleOrderChange);
      socket.on('kycQueueUpdated', handleOrderChange);
    }

    return () => {
      if (socket) {
        socket.off('newIncomingOrder', handleNewOrder);
        socket.off('orderStatusChanged', handleOrderChange);
        socket.off('kycQueueUpdated', handleOrderChange);
      }
    };
  }, [fetchOverview]);

  const op = metrics.operational || DEFAULT_METRICS.operational;
  const fin = metrics.financials || DEFAULT_METRICS.financials;
  const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const MetricCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 active:scale-[0.99]' : ''
      }`}
    >
      <div className={`p-4 rounded-xl mr-4 shrink-0 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value ?? 0}</p>
        {subtitle && <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Super Admin Command Center</h2>
          <p className="text-gray-500">Real-time platform telemetry, monthly financial pulse & today's live order stream</p>
        </div>
        <div className="flex items-center gap-3">
          {isSyncing && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
              Syncing live telemetry...
            </span>
          )}
          <button
            onClick={fetchOverview}
            title="Refresh Telemetry"
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Orders"
          value={op.activeOrdersCount}
          subtitle="In-flight right now"
          icon={Activity}
          colorClass="bg-blue-50 text-blue-600"
          onClick={() => navigate('/orders')}
        />
        <MetricCard
          title="Stuck Orders (>10m)"
          value={op.stuckOrdersCount}
          subtitle="Unassigned > 10 mins"
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-600"
          onClick={() => navigate('/orders?stuck=true')}
        />
        <MetricCard
          title="Pending KYC (Rest.)"
          value={op.pendingRestaurantKyc}
          subtitle="Awaiting verification"
          icon={ShoppingBag}
          colorClass="bg-orange-50 text-orange-600"
          onClick={() => navigate('/kyc')}
        />
        <MetricCard
          title="Pending KYC (Riders)"
          value={op.pendingRiderKyc}
          subtitle="Awaiting verification"
          icon={Bike}
          colorClass="bg-yellow-50 text-yellow-600"
          onClick={() => navigate('/kyc')}
        />
      </div>

      {user && user.role_type !== 'FIELD_ADMIN' && (
        <>
          <div className="flex items-center justify-between mt-8">
            <h3 className="text-lg font-bold text-gray-800">Financial Pulse ({currentMonthName})</h3>
            <button
              onClick={() => navigate('/finance-archive')}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer"
            >
              View Older Months in Financial Archive →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Gross Merchandise"
              value={`₹${fin.grossMerchandiseValue ?? 0}`}
              subtitle={`Gross Business (${currentMonthName})`}
              icon={DollarSign}
              colorClass="bg-green-50 text-green-600"
              onClick={() => navigate('/finance')}
            />
            <MetricCard
              title="Pending Payout"
              value={`₹${fin.pendingPayoutTotal ?? fin.totalCommission ?? 0}`}
              subtitle={`Rest: ₹${fin.pendingRestaurantPayout ?? 0} • Rider: ₹${fin.pendingRiderPayout ?? 0}`}
              icon={Wallet}
              colorClass="bg-emerald-50 text-emerald-600"
              onClick={() => navigate('/finance')}
            />
            <MetricCard
              title="Platform Fee"
              value={`₹${fin.totalPlatformFees ?? 0}`}
              subtitle={`Food: ₹${fin.totalFoodPlatformFee ?? 0} • Rest: ₹${fin.monthRestPlatformFee ?? 0} • Rider: ₹${fin.totalDeliveryPlatformFee ?? 0}`}
              icon={Layers}
              colorClass="bg-indigo-50 text-indigo-600"
              onClick={() => navigate('/finance')}
            />
            <MetricCard
              title="GST Collected"
              value={`₹${fin.totalGst ?? 0}`}
              subtitle={`Food: ₹${fin.monthFoodGst ?? 0} • Deliv: ₹${fin.monthDeliveryGst ?? 0} • Fee GST: ₹${fin.monthPlatformFeeGst ?? 0}`}
              icon={DollarSign}
              colorClass="bg-purple-50 text-purple-600"
              onClick={() => navigate('/finance')}
            />
          </div>
        </>
      )}

      <div className="flex items-center justify-between mt-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Live Order Stream (Today's Orders)</h3>
          <p className="text-xs text-gray-500">Showing orders placed today ({new Date().toLocaleDateString('en-IN')})</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
          {liveOrders.length} Orders Today
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Order ID</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Ordered Items</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liveOrders.map((o) => {
                const isRazorpay =
                  o.payment_method === 'RAZORPAY' ||
                  o.payment_method === 'ONLINE' ||
                  Boolean(o.razorpay_payment_id);
                return (
                  <tr
                    key={o.id}
                    onClick={() => navigate('/orders')}
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-semibold text-gray-800">#FZ-{o.id}</td>
                    <td className="p-4 text-gray-700 font-medium">{o.customer_name || 'Customer'}</td>
                    <td className="p-4 text-gray-600">{o.restaurant_name || 'Foodzy Kitchen'}</td>
                    <td className="p-4 text-gray-700 max-w-xs truncate" title={formatOrderItems(o.items)}>
                      <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                        <UtensilsCrossed className="w-3 h-3 text-brand shrink-0" />
                        <span className="truncate max-w-[220px]">{formatOrderItems(o.items)}</span>
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-800">₹{o.total_amount}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          isRazorpay
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        {isRazorpay ? 'RAZORPAY PAID' : o.payment_method || 'COD'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          o.status === 'COMPLETED' || o.status === 'DELIVERED'
                            ? 'bg-green-100 text-green-700'
                            : o.status === 'CANCELLED' || o.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Just now'}
                    </td>
                  </tr>
                );
              })}
              {liveOrders.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-400">
                    No orders placed today yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
