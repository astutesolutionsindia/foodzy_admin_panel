import { useState, useEffect, useCallback } from 'react';
import {
  Radio, MapPin, AlertTriangle, Bike, RefreshCw, Plus,
  ArrowRightLeft, Banknote, CheckCircle2, Battery, Clock, XCircle
} from 'lucide-react';
import api from '../config/api';
import { initSocket } from '../config/socket';

export default function ControlTower() {
  const [zoneId, setZoneId] = useState(1);
  const [zones, setZones] = useState([]);
  const [riders, setRiders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [recentCodLedger, setRecentCodLedger] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // One-Click Reassign Modal
  const [reassignOrder, setReassignOrder] = useState(null);
  const [idleCandidates, setIdleCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  // COD Cash Settlement Drawer
  const [codDrawerOpen, setCodDrawerOpen] = useState(false);
  const [depositModalRider, setDepositModalRider] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('End of shift cash deposit');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Create Zone Modal
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    center_lat: '33.1465',
    center_lng: '75.7875',
    default_radius_km: '6',
    surge_fee: '0'
  });

  const fetchTower = useCallback(async (selectedZone = zoneId) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/admin/fleet/tower?zoneId=${selectedZone}`);
      const d = res.data || {};
      setZones(Array.isArray(d.zones) ? d.zones : []);
      setRiders(Array.isArray(d.riders) ? d.riders : []);
      setActiveOrders(Array.isArray(d.activeOrders) ? d.activeOrders : []);
      setExceptions(Array.isArray(d.exceptions) ? d.exceptions : []);
      setRecentCodLedger(Array.isArray(d.recentCodLedger) ? d.recentCodLedger : []);
    } catch (err) {
      console.error('Failed to load Control Tower:', err);
    } finally {
      setIsLoading(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchTower(zoneId);
    const socket = initSocket();
    if (!socket) return;

    const handleDelta = (delta) => {
      if (!delta?.rider_id) return;
      setRiders((prev) =>
        prev.map((r) =>
          Number(r.rider_id) === Number(delta.rider_id)
            ? {
                ...r,
                lat: delta.lat ?? r.lat,
                lng: delta.lng ?? r.lng,
                battery_pct: delta.battery_pct ?? r.battery_pct,
                last_ping_at: delta.last_ping_at ?? r.last_ping_at,
                live_status: delta.status || r.live_status,
                pin_color:
                  delta.status === 'DELIVERING'
                    ? 'BLUE'
                    : delta.status === 'TO_RESTAURANT'
                    ? 'AMBER'
                    : 'GREEN'
              }
            : r
        )
      );
    };

    const handleExceptions = (list) => {
      if (Array.isArray(list)) {
        setExceptions(list.filter((e) => Number(e.zone_id || 1) === Number(zoneId)));
      }
    };

    const handleFleetEvent = () => fetchTower(zoneId);

    socket.on('riderTelemetryDelta', handleDelta);
    socket.on('fleetExceptionsUpdated', handleExceptions);
    socket.on('fleetEvent', handleFleetEvent);
    socket.on('orderStatusChanged', handleFleetEvent);

    return () => {
      socket.off('riderTelemetryDelta', handleDelta);
      socket.off('fleetExceptionsUpdated', handleExceptions);
      socket.off('fleetEvent', handleFleetEvent);
      socket.off('orderStatusChanged', handleFleetEvent);
    };
  }, [zoneId, fetchTower]);

  const openReassignModal = async (orderObj) => {
    setReassignOrder(orderObj);
    setLoadingCandidates(true);
    try {
      const res = await api.get('/admin/fleet/idle-riders', {
        params: {
          zoneId,
          lat: orderObj.rest_lat || 33.1465,
          lng: orderObj.rest_lng || 75.7875,
          codAmount: orderObj.cod_amount || 0
        }
      });
      setIdleCandidates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setIdleCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const confirmReassign = async (newRiderId) => {
    if (!reassignOrder) return;
    try {
      setReassigning(true);
      await api.post('/admin/fleet/reassign', {
        orderId: reassignOrder.order_id || reassignOrder.id,
        newRiderId
      });
      setReassignOrder(null);
      fetchTower(zoneId);
    } catch (err) {
      alert(err.response?.data?.error || 'Reassignment failed');
    } finally {
      setReassigning(false);
    }
  };

  const submitCodDeposit = async (e) => {
    e.preventDefault();
    if (!depositModalRider || !Number(depositAmount)) return;
    try {
      setSubmittingDeposit(true);
      await api.post('/admin/fleet/cod-deposit', {
        riderId: depositModalRider.rider_id,
        amount: Number(depositAmount),
        note: depositNote
      });
      setDepositModalRider(null);
      setDepositAmount('');
      fetchTower(zoneId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record COD deposit');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/fleet/zones', zoneForm);
      setZoneModalOpen(false);
      setZoneForm({ name: '', center_lat: '33.1465', center_lng: '75.7875', default_radius_km: '6', surge_fee: '0' });
      fetchTower(zoneId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create zone');
    }
  };

  const pinBadge = (pinColor, liveStatus) => {
    if (pinColor === 'GREEN') return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">● IDLE</span>;
    if (pinColor === 'AMBER') return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">● TO KITCHEN</span>;
    if (pinColor === 'BLUE') return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800">● DELIVERING</span>;
    if (pinColor === 'FLASHING_RED') return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse">⚠ STALE GPS</span>;
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">{liveStatus}</span>;
  };

  const totalCodHeld = riders.reduce((sum, r) => sum + Number(r.current_cod_balance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header + Zone Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-600" />
            Fleet Control Tower (Redis Live Telemetry)
          </h2>
          <p className="text-sm text-gray-500">
            Zero-lag zone dispatch, 30s SLA exception watcher, one-click rider override & COD float settlement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={zoneId}
            onChange={(e) => setZoneId(Number(e.target.value))}
            className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-800 outline-none"
          >
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                Zone #{z.zone_id}: {z.name} ({z.default_radius_km} km)
              </option>
            ))}
          </select>

          <button
            onClick={() => setZoneModalOpen(true)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Zone
          </button>

          <button
            onClick={() => setCodDrawerOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Banknote className="w-4 h-4" /> COD Cash Drawer (₹{totalCodHeld.toFixed(2)})
          </button>

          <button
            onClick={() => fetchTower(zoneId)}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Telemetry Legend & KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">Idle & Available</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {riders.filter((r) => r.pin_color === 'GREEN').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">Active Deliveries</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{activeOrders.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">SLA Exceptions</p>
          <p className={`text-2xl font-black mt-1 ${exceptions.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {exceptions.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase">Cash Held by Riders</p>
          <p className="text-2xl font-black text-amber-600 mt-1">₹{totalCodHeld.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* B. THE EXCEPTION QUEUE (30s SLA Watcher) */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="p-4 bg-red-50/70 border-b border-red-100 flex items-center justify-between">
            <h3 className="font-bold text-red-800 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Actionable SLA Exception Queue ({exceptions.length})
            </h3>
            <span className="text-[11px] font-bold text-red-600">Auto-scans 30s</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[540px] overflow-y-auto">
            {exceptions.map((ex) => (
              <div key={ex.id} className="p-4 space-y-2 hover:bg-red-50/20">
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    ex.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {ex.type.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="font-bold text-sm text-gray-800">{ex.title}</p>
                <p className="text-xs text-gray-600">{ex.detail}</p>
                <div className="pt-1 flex gap-2">
                  {ex.order_id && (
                    <button
                      onClick={() => openReassignModal(ex)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign Rider
                    </button>
                  )}
                  {ex.type === 'COD_FLOAT_WARNING' && (
                    <button
                      onClick={() => {
                        setDepositModalRider(ex);
                        setDepositAmount(String(ex.current_cod_balance || ''));
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Banknote className="w-3.5 h-3.5" /> Record Deposit
                    </button>
                  )}
                </div>
              </div>
            ))}
            {exceptions.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                All active orders & riders are within healthy SLA bounds.
              </div>
            )}
          </div>
        </div>

        {/* A. LIVE REDIS RIDER TELEMETRY GRID + ACTIVE ORDERS */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Fleet Pins */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Bike className="w-4 h-4 text-emerald-600" />
                Zone Live Fleet Telemetry ({riders.length} Riders)
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="text-emerald-700">● Idle</span>
                <span className="text-amber-700">● To Kitchen</span>
                <span className="text-blue-700">● Delivering</span>
                <span className="text-red-600">● Stale GPS</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="p-3">Rider</th>
                    <th className="p-3">Live State</th>
                    <th className="p-3">GPS Coordinates</th>
                    <th className="p-3">COD Balance / Limit</th>
                    <th className="p-3">Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {riders.map((r) => {
                    const ratio = r.cod_float_limit > 0 ? (r.current_cod_balance / r.cod_float_limit) * 100 : 0;
                    return (
                      <tr key={r.rider_id} className="hover:bg-gray-50/50">
                        <td className="p-3">
                          <div className="font-bold text-gray-800">{r.full_name}</div>
                          <div className="text-[11px] text-gray-500">{r.phone_number}</div>
                        </td>
                        <td className="p-3">
                          {pinBadge(r.pin_color, r.live_status)}
                          {r.active_order_id && (
                            <div className="text-[11px] font-mono text-gray-500 mt-1">
                              Order #FZ-{r.active_order_id}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-600">
                          {r.lat && r.lng ? (
                            <a
                              href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <MapPin className="w-3 h-3" />
                              {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
                            </a>
                          ) : (
                            <span className="text-gray-400">No ping yet</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className={`font-bold ${ratio >= 80 ? 'text-red-600' : 'text-gray-800'}`}>
                            ₹{Number(r.current_cod_balance || 0).toFixed(2)} / ₹{Number(r.cod_float_limit || 3000).toFixed(2)}
                          </div>
                          {Number(r.current_cod_balance || 0) > 0 && (
                            <button
                              onClick={() => {
                                setDepositModalRider(r);
                                setDepositAmount(String(r.current_cod_balance));
                              }}
                              className="text-[10px] font-bold text-amber-700 hover:underline mt-0.5 cursor-pointer"
                            >
                              Record Cash Deposit
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-[11px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {r.last_ping_at ? new Date(r.last_ping_at).toLocaleTimeString() : '—'}
                          </div>
                          {r.battery_pct !== null && (
                            <div className="flex items-center gap-1 text-gray-400">
                              <Battery className="w-3 h-3" /> {r.battery_pct}%
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {riders.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400">No riders assigned to this zone yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Orders in Zone with One-Click Reassign */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 font-bold text-gray-800 text-sm">
              In-Flight Orders in Zone ({activeOrders.length})
            </div>
            <div className="divide-y divide-gray-100">
              {activeOrders.map((o) => (
                <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">
                      #FZ-{o.id} • {o.restaurant_name} → {o.customer_name || 'Customer'}
                    </div>
                    <div className="text-gray-500 mt-0.5">
                      Status: <strong className="text-emerald-700">{o.status}</strong> •
                      Rider: <strong>{o.rider_name || 'Unassigned'}</strong> •
                      Mode: <strong>{o.payment_mode || o.payment_method}</strong>
                      {Number(o.cod_amount || 0) > 0 && (
                        <span className="ml-1 text-amber-700 font-bold">(Cash: ₹{Number(o.cod_amount).toFixed(2)})</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openReassignModal(o)}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign Rider
                  </button>
                </div>
              ))}
              {activeOrders.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-xs">No active orders in this zone right now.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ONE-CLICK REASSIGN MODAL */}
      {reassignOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                Reassign Order #FZ-{reassignOrder.order_id || reassignOrder.id}
              </h3>
              <button onClick={() => setReassignOrder(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Showing live IDLE riders in Zone #{zoneId} sorted by distance to {reassignOrder.restaurant_name}:
            </p>
            {loadingCandidates ? (
              <div className="py-8 text-center text-sm text-gray-400">Querying Redis Geo Index...</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {idleCandidates.map((c) => (
                  <div key={c.rider_id} className="p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-gray-800">{c.full_name}</div>
                      <div className="text-xs text-gray-500">
                        {c.distance_km} km away • COD: ₹{Number(c.current_cod_balance).toFixed(2)}/{Number(c.cod_float_limit).toFixed(0)}
                      </div>
                    </div>
                    <button
                      disabled={reassigning}
                      onClick={() => confirmReassign(c.rider_id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                ))}
                {idleCandidates.length === 0 && (
                  <div className="py-6 text-center text-xs text-red-500 font-semibold">
                    No eligible IDLE riders found in this zone (check online status or COD float caps).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COD CASH SETTLEMENT DRAWER */}
      {codDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-500" /> COD Cash Settlement Drawer
              </h3>
              <button onClick={() => setCodDrawerOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              {riders.map((r) => (
                <div key={r.rider_id} className="p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-gray-800">{r.full_name}</div>
                    <div className="text-xs text-gray-500">{r.phone_number}</div>
                    <div className="text-xs font-bold text-amber-700 mt-1">
                      Cash in Hand: ₹{Number(r.current_cod_balance || 0).toFixed(2)} / Limit ₹{Number(r.cod_float_limit || 3000).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDepositModalRider(r);
                      setDepositAmount(String(r.current_cod_balance || ''));
                    }}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Record Deposit
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-xs uppercase text-gray-500 mb-2">Recent COD Audit Trail</h4>
              <div className="space-y-2 text-xs">
                {recentCodLedger.map((entry) => (
                  <div key={entry.entry_id} className="p-2.5 bg-gray-50 rounded-lg flex justify-between">
                    <div>
                      <span className={`font-black mr-2 ${entry.entry_type === 'DEPOSITED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        [{entry.entry_type}]
                      </span>
                      <strong>{entry.rider_name || `Rider #${entry.rider_id}`}</strong> — {entry.note}
                    </div>
                    <span className="font-mono font-bold">₹{Number(entry.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD DEPOSIT MODAL */}
      {depositModalRider && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="font-bold text-base text-gray-800 mb-3">
              Record COD Deposit — {depositModalRider.full_name || depositModalRider.rider_name}
            </h3>
            <form onSubmit={submitCodDeposit} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cash Deposited (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Receipt / Handover Note</label>
                <input
                  type="text"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDepositModalRider(null)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submittingDeposit} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer">
                  {submittingDeposit ? 'Recording...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ZONE MODAL */}
      {zoneModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 mb-4">Create Delivery Hub Zone</h3>
            <form onSubmit={handleCreateZone} className="space-y-3 text-sm">
              <input
                type="text"
                required
                placeholder="Zone / Town Name (e.g. Doda Hub)"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" placeholder="Center Lat" value={zoneForm.center_lat} onChange={(e) => setZoneForm({ ...zoneForm, center_lat: e.target.value })} className="px-3 py-2 border rounded-xl" />
                <input type="number" step="any" placeholder="Center Lng" value={zoneForm.center_lng} onChange={(e) => setZoneForm({ ...zoneForm, center_lng: e.target.value })} className="px-3 py-2 border rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.5" placeholder="Radius (km)" value={zoneForm.default_radius_km} onChange={(e) => setZoneForm({ ...zoneForm, default_radius_km: e.target.value })} className="px-3 py-2 border rounded-xl" />
                <input type="number" step="0.5" placeholder="Surge Fee (₹)" value={zoneForm.surge_fee} onChange={(e) => setZoneForm({ ...zoneForm, surge_fee: e.target.value })} className="px-3 py-2 border rounded-xl" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setZoneModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl cursor-pointer">Save Zone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
