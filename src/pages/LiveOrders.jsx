import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Activity, MapPin, Search, Edit2, XCircle, Loader2, Bike, Store, User, AlertTriangle } from 'lucide-react';
import { initSocket, disconnectSocket } from '../config/socket';
import api from '../config/api';

export default function LiveOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Auto-select 'STUCK' tab if routed from Command Center
  const [activeTab, setActiveTab] = useState(location.search.includes('stuck') ? 'STUCK' : 'ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ status: '', riderId: '', note: '' });

  const fetchOrders = async () => {
    try {
      const [ordersRes, ridersRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/riders') 
      ]);
      setOrders(ordersRes.data);
      setRiders(ridersRes.data.filter(r => r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'));
    } catch (err) {
      console.error("Failed to fetch live orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const socket = initSocket();
    socket.on('newIncomingOrder', () => fetchOrders());
    socket.on('orderStatusChanged', () => fetchOrders());

    return () => disconnectSocket();
  }, []);

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
        forceSync: true // PHASE 2: Tells backend to rebuild the full relational object to prevent app freeze
      };
      await api.put(`/admin/orders/${selectedOrder.id}/override`, payload);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      alert("Failed to override order. Check console.");
    }
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="w-10 h-10 animate-spin text-brand" /></div>;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      String(o.id).includes(searchQuery) || 
      String(o.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.restaurant_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    if (activeTab === 'ACTIVE') {
      return !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status) && matchesSearch;
    } else if (activeTab === 'STUCK') {
      const isStuck = (o.status === 'PREPARING' || o.status === 'READY') && !o.rider_id && (Date.now() - new Date(o.created_at).getTime() > 10 * 60 * 1000);
      return isStuck && matchesSearch;
    } else {
      return ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status) && matchesSearch;
    }
  });

  const getStatusColor = (status) => {
    if (['COMPLETED', 'DELIVERED'].includes(status)) return 'bg-green-100 text-green-700';
    if (status === 'CANCELLED') return 'bg-red-100 text-red-700';
    if (['PREPARING', 'READY'].includes(status)) return 'bg-orange-100 text-orange-700';
    if (status === 'PICKED_UP') return 'bg-blue-100 text-blue-700';
    return 'bg-yellow-100 text-yellow-700'; // PENDING
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Live Orders Control</h2>
          <p className="text-gray-500">Monitor dispatch and override active deliveries.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search Order ID, Customer, or Restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          />
        </div>
      </div>

      <div className="flex space-x-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'ACTIVE' ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Activity className="w-4 h-4 mr-2" /> Active Deliveries
        </button>
        <button 
          onClick={() => setActiveTab('STUCK')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'STUCK' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <AlertTriangle className="w-4 h-4 mr-2" /> Stuck Orders
        </button>
        <button 
          onClick={() => setActiveTab('PAST')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${activeTab === 'PAST' ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MapPin className="w-4 h-4 mr-2" /> Past Orders
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Order & Time</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Rider</th>
                <th className="p-4 font-medium">Financials</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <div className="font-bold text-gray-800">#FZ-{o.id}</div>
                    <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-800 flex items-center"><User className="w-3 h-3 mr-1 text-gray-400" />{o.customer_name}</div>
                    <div className="text-xs text-gray-500">{o.customer_phone}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-800 flex items-center"><Store className="w-3 h-3 mr-1 text-gray-400" />{o.restaurant_name}</div>
                    <div className="text-xs text-gray-500">{o.restaurant_phone}</div>
                  </td>
                  <td className="p-4">
                    {o.rider_name ? (
                      <>
                        <div className="font-medium text-gray-800 flex items-center"><Bike className="w-3 h-3 mr-1 text-gray-400" />{o.rider_name}</div>
                        <div className="text-xs text-gray-500">{o.rider_phone}</div>
                      </>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-green-600">₹{o.total_amount}</div>
                    {o.discount_amount > 0 && <div className="text-xs text-brand font-medium">Discount: ₹{o.discount_amount}</div>}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${getStatusColor(o.status)}`}>
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
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">No orders found in this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Override Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">Admin Override: #FZ-{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-800 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Force Status</label>
                <select 
                  value={overrideForm.status}
                  onChange={e => setOverrideForm({...overrideForm, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="READY">READY</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reassign Rider</label>
                <select 
                  value={overrideForm.riderId}
                  onChange={e => setOverrideForm({...overrideForm, riderId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  <option value="">-- Remove/Unassign Rider --</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name} ({r.phone_number})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note (For Audit Log)</label>
                <input 
                  type="text"
                  required
                  value={overrideForm.note}
                  onChange={e => setOverrideForm({...overrideForm, note: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"
                  placeholder="e.g. Rider bike broke down, reassigned."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedOrder(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer font-medium">Apply Override</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}