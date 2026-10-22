import { useState, useEffect, useContext } from 'react';
import { Search, Store, Bike, Users, Star, ShieldBan, CheckCircle, Percent, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { initSocket, disconnectSocket } from '../config/socket';
import api from '../config/api';

export default function Directory() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState({ restaurants: [], riders: [], customers: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RESTAURANTS');
  const [searchQuery, setSearchQuery] = useState('');

  const canManageFinance = ['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(user?.role_type);

  const fetchDirectory = async () => {
    try {
      const [restRes, riderRes, custRes] = await Promise.all([
        api.get('/admin/restaurants'),
        api.get('/admin/riders'),
        api.get('/admin/customers')
      ]);
      setData({
        restaurants: restRes.data,
        riders: riderRes.data,
        customers: custRes.data
      });
    } catch (err) {
      console.error("Failed to fetch directory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();

    const socket = initSocket();
    socket.on('kycQueueUpdated', () => fetchDirectory());
    socket.on('orderStatusChanged', () => fetchDirectory());

    return () => disconnectSocket();
  }, []);

  const handleRestaurantUpdate = async (id, updates) => {
    try {
      await api.put(`/admin/restaurants/${id}/ranking`, updates);
      fetchDirectory();
    } catch (err) {
      alert("Failed to update restaurant");
    }
  };

  const promptRankUpdate = (id, currentRank) => {
    const newRank = prompt("Enter new Priority Rank (higher number = higher placement):", currentRank ?? 0);
    if (newRank !== null && newRank.trim() !== '' && !isNaN(newRank)) {
      handleRestaurantUpdate(id, { priority_rank: Number(newRank) });
    }
  };

  const promptCommissionUpdate = async (id, currentCommission) => {
    const input = prompt(
      "Enter custom commission % for this restaurant (Leave blank to use global platform default):",
      currentCommission !== null && currentCommission !== undefined ? currentCommission : ''
    );
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed !== '' && isNaN(trimmed)) {
      alert("Please enter a valid number.");
      return;
    }

    try {
      await api.put(`/admin/finance/restaurants/${id}/commission`, {
        custom_commission_pct: trimmed === '' ? null : Number(trimmed)
      });
      fetchDirectory();
    } catch (err) {
      alert("Failed to update custom commission");
    }
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="w-10 h-10 animate-spin text-brand" /></div>;

  const filterData = (list, searchFields) => {
    if (!searchQuery) return list;
    const lowerQuery = searchQuery.toLowerCase();
    return list.filter(item => 
      searchFields.some(field => String(item[field] || '').toLowerCase().includes(lowerQuery))
    );
  };

  const filteredRestaurants = filterData(data.restaurants, ['name', 'owner_name', 'phone_number', 'cuisine']);
  const filteredRiders = filterData(data.riders, ['full_name', 'phone_number']);
  const filteredCustomers = filterData(data.customers, ['full_name', 'phone_number', 'email']);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Partner Directory</h2>
          <p className="text-gray-500">Manage and rank all platform users.</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        {[
          { id: 'RESTAURANTS', label: 'Restaurants', icon: Store, count: data.restaurants.length },
          { id: 'RIDERS', label: 'Delivery Riders', icon: Bike, count: data.riders.length },
          { id: 'CUSTOMERS', label: 'Customers', icon: Users, count: data.customers.length }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
              activeTab === tab.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* RESTAURANTS TAB */}
        {activeTab === 'RESTAURANTS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Restaurant</th>
                <th className="p-4 font-medium">Performance</th>
                <th className="p-4 font-medium">Visibility & Ranking</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRestaurants.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.phone_number}</div>
                    <div className="text-xs text-gray-400 mt-1">{r.cuisine || 'Multi-Cuisine'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-800 font-medium">{r.completed_orders || 0} Orders</div>
                    <div className="text-xs text-gray-500">{r.menu_count || 0} Menu Items</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => promptRankUpdate(r.id, r.priority_rank)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-semibold cursor-pointer transition-colors"
                        title="Click to edit rank"
                      >
                        Rank: {r.priority_rank}
                      </button>
                      <button
                        onClick={() => handleRestaurantUpdate(r.id, { is_sponsored: !r.is_sponsored })}
                        className={`flex items-center px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          r.is_sponsored ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Star className={`w-3 h-3 mr-1 ${r.is_sponsored ? 'fill-current' : ''}`} />
                        {r.is_sponsored ? 'Sponsored' : 'Boost'}
                      </button>
                      {canManageFinance && (
                        <button
                          onClick={() => promptCommissionUpdate(r.id, r.custom_commission_pct)}
                          className="flex items-center px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold cursor-pointer transition-colors"
                          title="Set custom commission %"
                        >
                          <Percent className="w-3 h-3 mr-1" />
                          {r.custom_commission_pct !== null && r.custom_commission_pct !== undefined
                            ? `${r.custom_commission_pct}% Comm.`
                            : 'Default Comm.'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        r.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                        r.status === 'SUSPENDED' || r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.status}
                      </span>
                      {r.status === 'ACTIVE' ? (
                        <button onClick={() => handleRestaurantUpdate(r.id, { status: 'SUSPENDED' })} className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer" title="Suspend Restaurant">
                          <ShieldBan className="w-5 h-5" />
                        </button>
                      ) : (
                        <button onClick={() => handleRestaurantUpdate(r.id, { status: 'ACTIVE' })} className="text-green-500 hover:bg-green-50 p-1 rounded cursor-pointer" title="Activate Restaurant">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRestaurants.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">No restaurants found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* RIDERS TAB */}
        {activeTab === 'RIDERS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Rider Info</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Performance</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRiders.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="p-4 font-semibold text-gray-800">
                    {r.full_name}
                    <div className="text-xs text-gray-500 mt-1 font-normal">
                      Uniform Fee: {r.fee_paid ? <span className="text-green-600 font-medium">Paid</span> : <span className="text-red-500">Unpaid</span>}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{r.phone_number}</td>
                  <td className="p-4">
                    <div className="font-medium">{r.completed_deliveries || 0} Deliveries</div>
                    <div className="text-xs text-gray-500">Est. Earnings: ₹{r.total_earnings || 0}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : r.approval_status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : r.approval_status === 'NOT_SUBMITTED'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {r.approval_status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRiders.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">No riders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === 'CUSTOMERS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Customer Info</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Lifetime Orders</th>
                <th className="p-4 font-medium">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <span className="font-semibold text-gray-800 flex items-center gap-2">
                      {c.full_name}
                      {Number(c.total_spent) > 5000 && <Star className="w-3 h-3 text-yellow-500 fill-current" title="VIP Customer" />}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{c.phone_number}</td>
                  <td className="p-4 font-medium">{c.total_orders || 0}</td>
                  <td className="p-4 text-green-600 font-semibold">₹{c.total_spent || 0}</td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}