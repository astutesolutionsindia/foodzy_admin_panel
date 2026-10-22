import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { initSocket, disconnectSocket } from '../config/socket';
import { Activity, ShoppingBag, AlertTriangle, DollarSign, Wallet } from 'lucide-react';
import api from '../config/api';

export default function CommandCenter() {
  const { user } = useContext(AuthContext);
  const [metrics, setMetrics] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await api.get('/admin/overview');
        setMetrics(res.data);
        setLiveOrders(res.data.recentOrders.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch dashboard overview");
      }
    };

    fetchOverview();
    
    // Connect to live webSockets
    const socket = initSocket();
    socket.on('newIncomingOrder', (order) => {
      setLiveOrders((prev) => [order, ...prev].slice(0, 10));
      fetchOverview(); // Refresh counts
    });
    
    socket.on('orderStatusChanged', () => fetchOverview());
    
    // NEW: Listen for KYC uploads and refresh the dashboard counters live
    socket.on('kycQueueUpdated', () => fetchOverview());

    return () => disconnectSocket();
  }, []);

  if (!metrics) return <div className="animate-pulse p-8 font-bold text-gray-500">Loading live metrics...</div>;

  const MetricCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
      <div className={`p-4 rounded-xl mr-4 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Command Center</h2>
        <p className="text-gray-500">Real-time platform overview</p>
      </div>

      {/* Operational Metrics (All Admins) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Active Orders" value={metrics.operational.activeOrdersCount} icon={Activity} colorClass="bg-blue-50 text-blue-600" />
        <MetricCard title="Stuck Orders (>10m)" value={metrics.operational.stuckOrdersCount} icon={AlertTriangle} colorClass="bg-red-50 text-red-600" />
        <MetricCard title="Pending KYC (Rest.)" value={metrics.operational.pendingRestaurantKyc} icon={ShoppingBag} colorClass="bg-orange-50 text-orange-600" />
        <MetricCard title="Total Customers" value={metrics.operational.totalCustomers} icon={Activity} colorClass="bg-gray-50 text-gray-600" />
      </div>

      {/* Financial Metrics (Hidden from FIELD_ADMIN) */}
      {user.role_type !== 'FIELD_ADMIN' && metrics.financials && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mt-8">Financial Pulse (Today)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard title="Gross Merchandise Value" value={`₹${metrics.financials.grossMerchandiseValue}`} icon={DollarSign} colorClass="bg-green-50 text-green-600" />
            <MetricCard title="Platform Commission" value={`₹${metrics.financials.totalCommission}`} icon={Wallet} colorClass="bg-emerald-50 text-emerald-600" />
            <MetricCard title="GST Collected" value={`₹${metrics.financials.totalGst}`} icon={DollarSign} colorClass="bg-purple-50 text-purple-600" />
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
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {liveOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50/50">
                <td className="p-4 font-semibold text-gray-800">#FZ-{o.id}</td>
                <td className="p-4">₹{o.total_amount}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                    o.status === 'COMPLETED' || o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-4 text-gray-500">
                  {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}