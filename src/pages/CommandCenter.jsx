import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';
import { Activity, ShoppingBag, AlertTriangle, DollarSign, Wallet, Bike, CreditCard } from 'lucide-react';
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
    totalCommission: 0,
    totalGst: 0,
    totalPlatformFees: 0
  },
  recentOrders: []
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
      return (parsed?.recentOrders || []).slice(0, 10);
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
        setLiveOrders((res.data.recentOrders || []).slice(0, 10));
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
      setLiveOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)].slice(0, 10));
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

  const op = metrics?.operational || DEFAULT_METRICS.operational;
  const fin = metrics?.financials || DEFAULT_METRICS.financials;

  const MetricCard = ({ title, value, icon: Icon, colorClass, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-brand/30 transition-all' : ''
      }`}
    >
      <div className={`p-4 rounded-xl mr-4 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Super Admin Command Center</h2>
          <p className="text-gray-500">Real-time platform telemetry, Razorpay settlements & dispatch radar</p>
        </div>
        {isSyncing && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
            Syncing live telemetry...
          </span>
        )}
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Orders"
          value={op.activeOrdersCount}
          icon={Activity}
          colorClass="bg-blue-50 text-blue-600"
          onClick={() => navigate('/orders')}
        />
        <MetricCard
          title="Stuck Orders (>10m)"
          value={op.stuckOrdersCount}
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-600"
          onClick={() => navigate('/orders?stuck=true')}
        />
        <MetricCard
          title="Pending KYC (Rest.)"
          value={op.pendingRestaurantKyc}
          icon={ShoppingBag}
          colorClass="bg-orange-50 text-orange-600"
          onClick={() => navigate('/kyc')}
        />
        <MetricCard
          title="Pending KYC (Riders)"
          value={op.pendingRiderKyc}
          icon={Bike}
          colorClass="bg-yellow-50 text-yellow-600"
          onClick={() => navigate('/kyc')}
        />
      </div>

      {/* Financial Metrics */}
      {user && user.role_type !== 'FIELD_ADMIN' && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mt-8">Financial Pulse</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Gross Merchandise Value"
              value={`₹${fin.grossMerchandiseValue ?? 0}`}
              icon={DollarSign}
              colorClass="bg-green-50 text-green-600"
            />
            <MetricCard
              title="Platform Commission"
              value={`₹${fin.totalCommission ?? 0}`}
              icon={Wallet}
              colorClass="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              title="GST Collected"
              value={`₹${fin.totalGst ?? 0}`}
              icon={DollarSign}
              colorClass="bg-purple-50 text-purple-600"
            />
          </div>
        </>
      )}

      {/* Live Order Feed */}
      <h3 className="text-lg font-bold text-gray-800 mt-8">Live Order Stream</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-4 font-medium">Order ID</th>
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
                          : o.status === 'CANCELLED'
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
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </td>
                </tr>
              );
            })}
            {liveOrders.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-400">
                  No recent orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}