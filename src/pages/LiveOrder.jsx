import { useState, useEffect } from 'react';
import { Search, Edit2 } from 'lucide-react';
import api from '../config/api';

export default function LiveOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOverride = async (orderId, newStatus) => {
    if (!confirm(`Are you sure you want to force change this order to ${newStatus}?`)) return;
    try {
      await api.put(`/admin/orders/${orderId}/override`, { 
        status: newStatus,
        note: `Manual override to ${newStatus} by Admin`
      });
      fetchOrders();
    } catch (err) {
      alert("Override failed");
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Live Order Control</h2>
        <p className="text-gray-500">Monitor and override active platform orders</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-4 font-medium">Order</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Restaurant</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50/50">
                <td className="p-4">
                  <span className="font-semibold block">#FZ-{o.id}</span>
                  <span className="text-xs text-gray-500">₹{o.total_amount}</span>
                </td>
                <td className="p-4">
                  {o.customer_name || 'Unknown'}
                  <br /><span className="text-xs text-gray-500">{o.customer_phone}</span>
                </td>
                <td className="p-4 font-medium text-gray-800">{o.restaurant_name}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold">{o.status}</span>
                  {o.rider_name && <div className="text-xs text-blue-600 mt-1">Rider: {o.rider_name}</div>}
                </td>
                <td className="p-4">
                  {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                    <select 
                      className="bg-white border border-gray-200 text-xs rounded p-1 outline-none cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) handleOverride(o.id, e.target.value);
                        e.target.value = ""; 
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Force Status...</option>
                      <option value="PREPARING">Force Preparing</option>
                      <option value="READY">Force Ready</option>
                      <option value="CANCELLED">Force Cancel</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}