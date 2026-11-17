import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle2, Clock, Truck, RefreshCw, Search } from 'lucide-react';
import api from '../config/api';

const DEFAULT_PACKAGING_CATALOG = [
  { id: 'PACK_KRAFT_50', name: 'Tamper-Proof Kraft Bags (Pack of 50)', desc: 'Heavy-duty tear-resistant bags with Foodzy branding', price: 249 },
  { id: 'PACK_CONTAINERS_50', name: 'Leak-Proof Meal Containers (Pack of 50)', desc: 'Microwave-safe 500ml & 750ml curry/biryani tubs', price: 299 },
  { id: 'PACK_TAPES_5', name: 'Foodzy Security Seal Tapes (5 Rolls)', desc: 'Tamper-evident safety seal strips for rider handover', price: 149 },
  { id: 'PACK_ALL_IN_ONE', name: 'Complete All-in-One Packaging Kit', desc: '100x Bags + 100x Containers + 5x Security Tapes', price: 899 }
];

export default function PackagingStore() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/packaging-orders');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load packaging orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateStatus = async (id, delivery_status) => {
    try {
      await api.put(`/admin/packaging-orders/${id}`, { delivery_status });
      fetchOrders();
    } catch {
      alert('Failed to update packaging order status');
    }
  };

  const filtered = orders.filter((o) =>
    String(o.restaurant_name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(o.pack_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Restaurant Packaging Store & Fulfillment
          </h2>
          <p className="text-gray-500 text-sm">
            Manage Foodzy branded packaging SKUs and fulfill incoming orders from Restaurant Partners
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </button>
      </div>

      {/* Active Packaging Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {DEFAULT_PACKAGING_CATALOG.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 mb-2">
                LIVE IN RESTAURANT APP
              </span>
              <h3 className="font-bold text-gray-800 text-sm">{item.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-lg font-black text-emerald-700">₹{item.price} / pack</span>
              <span className="text-xs text-gray-400 font-semibold">In Stock</span>
            </div>
          </div>
        ))}
      </div>

      {/* Incoming Restaurant Packaging Orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800">
            Restaurant Packaging Orders ({filtered.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search restaurant or pack..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Order ID</th>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Packaging Items</th>
                <th className="p-4 font-medium">Qty</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Fulfillment Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="p-4 font-mono font-bold text-gray-700">#PKG-{o.id}</td>
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{o.restaurant_name}</div>
                    <div className="text-xs text-gray-500">{o.phone_number || ''}</div>
                  </td>
                  <td className="p-4 font-medium text-gray-800">{o.pack_name}</td>
                  <td className="p-4 font-bold">{o.quantity}</td>
                  <td className="p-4 font-bold text-emerald-700">₹{o.amount}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      {o.payment_status || 'PAID'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      o.delivery_status === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : o.delivery_status === 'DISPATCHED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {o.delivery_status || 'PROCESSING'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateStatus(o.id, 'DISPATCHED')}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" /> Dispatch
                      </button>
                      <button
                        onClick={() => updateStatus(o.id, 'DELIVERED')}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-400">
                    No packaging orders placed yet. Orders placed from the Restaurant App appear here automatically.
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
