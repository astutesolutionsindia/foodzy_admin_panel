import { useState, useEffect, useCallback } from 'react';
import { Trophy, Store, Users, Bike, Star, RefreshCw, Award, TrendingUp } from 'lucide-react';
import api from '../config/api';

export default function Leaderboard() {
  const [period, setPeriod] = useState('ALL_TIME');
  const [isSyncing, setIsSyncing] = useState(true);
  const [data, setData] = useState({
    topRestaurants: [],
    topCustomers: [],
    topRiders: []
  });

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await api.get(`/admin/leaderboard?period=${period}`);
      if (res.data) {
        setData({
          topRestaurants: res.data.topRestaurants || [],
          topCustomers: res.data.topCustomers || [],
          topRiders: res.data.topRiders || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const rankBadge = (idx) => {
    if (idx === 0) return 'bg-amber-400 text-amber-950 shadow-sm';
    if (idx === 1) return 'bg-slate-300 text-slate-900';
    if (idx === 2) return 'bg-amber-700 text-white';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" />
              Foodzy Top-5 Hall of Fame
            </h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Calculating ranks...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Top-5 Restaurants (Orders Prepared On Time), Top-5 Customers (Maximum Orders), and Top-5 Riders (Maximum Deliveries).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex">
            <button
              onClick={() => setPeriod('THIS_MONTH')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'THIS_MONTH' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('ALL_TIME')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                period === 'ALL_TIME' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All-Time
            </button>
          </div>
          <button
            onClick={fetchLeaderboard}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 bg-gradient-to-r from-emerald-900 to-emerald-700 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-300" />
                Top 5 Restaurants
              </h3>
              <p className="text-xs text-emerald-100">Maximum orders received & prepared on time</p>
            </div>
            <Award className="w-8 h-8 text-emerald-300/60" />
          </div>
          <div className="divide-y divide-gray-100 flex-1">
            {data.topRestaurants.map((r, idx) => {
              const rate = r.total_orders_received > 0
                ? Math.round((r.completed_orders / r.total_orders_received) * 100)
                : 100;
              return (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge(idx)}`}>
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{r.phone_number}</span>
                        <span className="inline-flex items-center text-amber-600 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> {r.rating}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-black text-emerald-700">{r.completed_orders} Orders</p>
                    <p className="text-[11px] text-gray-500">₹{Math.round(Number(r.total_revenue || 0))} • {rate}% On-Time</p>
                  </div>
                </div>
              );
            })}
            {data.topRestaurants.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No restaurant records yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 bg-gradient-to-r from-indigo-900 to-indigo-700 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-300" />
                Top 5 Customers
              </h3>
              <p className="text-xs text-indigo-100">Maximum completed food orders</p>
            </div>
            <TrendingUp className="w-8 h-8 text-indigo-300/60" />
          </div>
          <div className="divide-y divide-gray-100 flex-1">
            {data.topCustomers.map((c, idx) => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge(idx)}`}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone_number}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-black text-indigo-700">{c.completed_orders} Orders</p>
                  <p className="text-[11px] text-gray-500">Spent ₹{Math.round(Number(c.total_spent || 0))}</p>
                </div>
              </div>
            ))}
            {data.topCustomers.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No customer orders yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 bg-gradient-to-r from-amber-800 to-amber-600 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Bike className="w-5 h-5 text-amber-200" />
                Top 5 Riders
              </h3>
              <p className="text-xs text-amber-100">Maximum orders delivered successfully</p>
            </div>
            <Trophy className="w-8 h-8 text-amber-200/60" />
          </div>
          <div className="divide-y divide-gray-100 flex-1">
            {data.topRiders.map((rd, idx) => (
              <div key={rd.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge(idx)}`}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 truncate">{rd.name}</p>
                    <p className="text-xs text-gray-500">{rd.phone_number}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-black text-amber-700">{rd.delivered_orders} Delivered</p>
                  <p className="text-[11px] text-gray-500">
                    {Number(rd.total_distance_km || 0).toFixed(1)} km • ₹{Math.round(Number(rd.total_earnings || 0))}
                  </p>
                </div>
              </div>
            ))}
            {data.topRiders.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No rider deliveries yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
