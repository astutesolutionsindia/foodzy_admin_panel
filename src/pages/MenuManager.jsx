import { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed, Store, Search, Plus, Edit, Trash2, CheckCircle2, XCircle,
  BellRing, Upload, Flame, Sparkles, RefreshCw, Layers, Tag
} from 'lucide-react';
import { initSocket } from '../config/socket';
import api from '../config/api';

export default function MenuManager() {
  const [restaurants, setRestaurants] = useState([]);
  const [restSearch, setRestSearch] = useState('');
  const [selectedRestId, setSelectedRestId] = useState('');

  const [menuItems, setMenuItems] = useState([]);
  const [addons, setAddons] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [dishSearch, setDishSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  const [savingDish, setSavingDish] = useState(false);

  // Dish Create/Edit Modal State
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [dishForm, setDishForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Main Course',
    is_veg: true,
    is_available: true,
    popular: false,
    spice_level: 0,
    image_url: '',
    imageFile: null,
    imagePreview: '',
    linked_addon_ids: []
  });

  // Add-On Manager Modal State
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isRestDetailModalOpen, setIsRestDetailModalOpen] = useState(false);
  const [restDetailForm, setRestDetailForm] = useState({
    name: '', phone_number: '', cuisine: '', delivery_time: '', address: '', lat: '', lng: '', pan_number: '', fssai_number: '', gst_number: '', bank_account_number: '', bank_ifsc: ''
  });

  const openRestDetailEditor = () => {
    const r = restaurants.find((x) => String(x.id) === String(selectedRestId));
    if (!r) return alert('Select a restaurant first');
    setRestDetailForm({
      name: r.name || '',
      phone_number: r.phone_number || '',
      cuisine: r.cuisine || '',
      delivery_time: r.delivery_time || '25-35 mins',
      address: r.address || '',
      lat: r.lat ?? '',
      lng: r.lng ?? '',
      pan_number: r.pan_number || '',
      fssai_number: r.fssai_number || '',
      gst_number: r.gst_number || '',
      bank_account_number: r.bank_account_number || '',
      bank_ifsc: r.bank_ifsc || ''
    });
    setIsRestDetailModalOpen(true);
  };

  const handleSaveRestDetails = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/restaurants/${selectedRestId}/details`, restDetailForm);
      setIsRestDetailModalOpen(false);
      fetchInitialData();
      alert('✅ Restaurant details updated!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update restaurant details');
    }
  };
  const [addonForm, setAddonForm] = useState({
    name: '',
    price: '',
    is_veg: true
  });

  const fetchInitialData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const [restRes, pendingRes] = await Promise.all([
        api.get('/admin/restaurants').catch(() => ({ data: [] })),
        api.get('/admin/menu/pending-prices').catch(() => ({ data: [] }))
      ]);
      const restList = restRes.data || [];
      setRestaurants(restList);
      const pendList = Array.isArray(pendingRes.data)
        ? pendingRes.data
        : pendingRes.data?.items || [];
      setPendingApprovals(pendList);

      if (!selectedRestId && restList.length > 0) {
        setSelectedRestId(String(restList[0].id));
      }
    } catch (err) {
      console.error('Failed to load initial menu manager data:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedRestId]);

  const fetchRestaurantMenu = useCallback(async (restId) => {
    if (!restId) return;
    try {
      setIsSyncing(true);
      const res = await api.get(`/admin/restaurants/${restId}/menu`).catch(async () => {
        // Fallback to public menu endpoint if admin route is still deploying
        return await api.get(`/menu/${restId}`).catch(() => ({ data: [] }));
      });

      const payload = res.data || {};
      const itemsList = Array.isArray(payload) ? payload : (payload.items || payload.menu || []);
      const addonsList = Array.isArray(payload.addons) ? payload.addons : [];

      setMenuItems(itemsList);
      setAddons(addonsList);
    } catch (err) {
      console.error('Failed to fetch restaurant menu:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedRestId) {
      fetchRestaurantMenu(selectedRestId);
    }
  }, [selectedRestId, fetchRestaurantMenu]);

  useEffect(() => {
    const socket = initSocket();
    const handleRefresh = () => {
      fetchInitialData();
      if (selectedRestId) fetchRestaurantMenu(selectedRestId);
    };

    if (socket) {
      socket.on('menuPriceApprovalRequested', handleRefresh);
      socket.on('menuUpdated', handleRefresh);
    }
    return () => {
      if (socket) {
        socket.off('menuPriceApprovalRequested', handleRefresh);
        socket.off('menuUpdated', handleRefresh);
      }
    };
  }, [fetchInitialData, fetchRestaurantMenu, selectedRestId]);

  const handleApprovePrice = async (item) => {
    try {
      await api.put(`/admin/menu/${item.id}/approve-price`, {
        decision: 'APPROVE'
      });
      window.dispatchEvent(new Event('foodzyMenuApprovalUpdated'));
      fetchInitialData();
      if (String(selectedRestId) === String(item.restaurant_id)) {
        fetchRestaurantMenu(selectedRestId);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve price change.');
    }
  };

  const handleRejectPrice = async (item) => {
    const reason = window.prompt(
      `Reject price change for "${item.name}" (₹${item.price} -> ₹${item.pending_price})? Enter note (optional):`,
      'Price increase exceeds platform threshold'
    );
    if (reason === null) return;
    try {
      await api.put(`/admin/menu/${item.id}/approve-price`, {
        decision: 'REJECT',
        reason
      });
      window.dispatchEvent(new Event('foodzyMenuApprovalUpdated'));
      fetchInitialData();
      if (String(selectedRestId) === String(item.restaurant_id)) {
        fetchRestaurantMenu(selectedRestId);
      }
    } catch {
      alert('Failed to reject price change.');
    }
  };

  const openCreateDishModal = () => {
    if (!selectedRestId) return alert('Please select a restaurant first.');
    setEditingDish(null);
    setDishForm({
      name: '',
      description: '',
      price: '',
      category: selectedCategory !== 'ALL' ? selectedCategory : 'Main Course',
      is_veg: true,
      is_available: true,
      popular: false,
      spice_level: 0,
      image_url: '',
      imageFile: null,
      imagePreview: '',
      linked_addon_ids: []
    });
    setIsDishModalOpen(true);
  };

  const openEditDishModal = (dish) => {
    let parsedAddons = [];
    if (Array.isArray(dish.linked_addon_ids)) {
      parsedAddons = dish.linked_addon_ids.map(Number);
    } else if (typeof dish.linked_addon_ids === 'string') {
      try { parsedAddons = JSON.parse(dish.linked_addon_ids).map(Number); } catch { parsedAddons = []; }
    }

    setEditingDish(dish);
    setDishForm({
      name: dish.name || '',
      description: dish.description || '',
      price: dish.price ?? '',
      category: dish.category || 'Main Course',
      is_veg: dish.is_veg !== false,
      is_available: dish.is_available !== false,
      popular: Boolean(dish.popular),
      spice_level: Number(dish.spice_level || 0),
      image_url: dish.image_url || dish.image || '',
      imageFile: null,
      imagePreview: dish.image_url || dish.image || '',
      linked_addon_ids: parsedAddons
    });
    setIsDishModalOpen(true);
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDishForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const toggleAddonLink = (addonId) => {
    const numId = Number(addonId);
    setDishForm((prev) => {
      const exists = prev.linked_addon_ids.includes(numId);
      return {
        ...prev,
        linked_addon_ids: exists
          ? prev.linked_addon_ids.filter((id) => id !== numId)
          : [...prev.linked_addon_ids, numId]
      };
    });
  };

  const handleSaveDish = async (e) => {
    e.preventDefault();
    if (!selectedRestId) return;
    setSavingDish(true);

    try {
      const fd = new FormData();
      fd.append('restaurant_id', selectedRestId);
      fd.append('name', dishForm.name.trim());
      fd.append('description', dishForm.description.trim());
      fd.append('price', String(dishForm.price));
      fd.append('category', dishForm.category.trim() || 'Main Course');
      fd.append('is_veg', String(dishForm.is_veg));
      fd.append('is_available', String(dishForm.is_available));
      fd.append('popular', String(dishForm.popular));
      fd.append('spice_level', String(dishForm.spice_level));
      fd.append('linked_addon_ids', JSON.stringify(dishForm.linked_addon_ids));
      fd.append('admin_direct_approve', 'true');

      if (dishForm.imageFile) {
        fd.append('image', dishForm.imageFile);
      } else if (dishForm.image_url) {
        fd.append('image_url', dishForm.image_url);
      }

      if (editingDish) {
        await api.put(`/admin/menu/${editingDish.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/admin/menu', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setIsDishModalOpen(false);
      window.dispatchEvent(new Event('foodzyMenuApprovalUpdated'));
      fetchRestaurantMenu(selectedRestId);
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save dish.');
    } finally {
      setSavingDish(false);
    }
  };

  const handleDeleteDish = async (dish) => {
    if (!window.confirm(`Delete "${dish.name}" from this restaurant's menu?`)) return;
    try {
      await api.delete(`/admin/menu/${dish.id}`);
      fetchRestaurantMenu(selectedRestId);
      fetchInitialData();
    } catch {
      alert('Failed to delete dish.');
    }
  };

  const handleToggleAvailability = async (dish) => {
    try {
      await api.put(`/admin/menu/${dish.id}`, {
        is_available: !dish.is_available,
        admin_direct_approve: true
      });
      fetchRestaurantMenu(selectedRestId);
    } catch {
      alert('Failed to toggle availability.');
    }
  };

  const handleCreateAddon = async (e) => {
    e.preventDefault();
    if (!selectedRestId || !addonForm.name) return;
    try {
      await api.post(`/admin/restaurants/${selectedRestId}/addons`, {
        name: addonForm.name.trim(),
        price: Number(addonForm.price || 0),
        is_veg: Boolean(addonForm.is_veg)
      });
      setAddonForm({ name: '', price: '', is_veg: true });
      fetchRestaurantMenu(selectedRestId);
    } catch {
      alert('Failed to create add-on.');
    }
  };

  const handleDeleteAddon = async (addonId) => {
    if (!window.confirm('Delete this add-on?')) return;
    try {
      await api.delete(`/admin/addons/${addonId}`);
      fetchRestaurantMenu(selectedRestId);
    } catch {
      alert('Failed to delete add-on.');
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const q = restSearch.toLowerCase();
    if (!q) return true;
    return (
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.phone_number || '').includes(q) ||
      String(r.id).includes(q)
    );
  });

  const currentRestaurant = restaurants.find((r) => String(r.id) === String(selectedRestId));

  const categories = Array.from(
    new Set(['Main Course', 'Starters', 'Biryani & Rice', 'Breads', 'Beverages', 'Desserts', ...menuItems.map((m) => m.category || 'Menu')])
  );

  const visibleMenuItems = menuItems.filter((item) => {
    if (selectedCategory !== 'ALL' && (item.category || 'Menu') !== selectedCategory) return false;
    const q = dishSearch.toLowerCase();
    if (!q) return true;
    return (
      String(item.name || '').toLowerCase().includes(q) ||
      String(item.category || '').toLowerCase().includes(q) ||
      String(item.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <UtensilsCrossed className="w-7 h-7 text-brand" />
              Restaurant Menu Builder & Price Approval Desk
            </h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Setup complete menus & add-ons for Tier-3 restaurant partners and approve partner-requested dish price changes before they go live.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchInitialData();
              if (selectedRestId) fetchRestaurantMenu(selectedRestId);
            }}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddonModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold cursor-pointer"
          >
            <Layers className="w-4 h-4" /> Manage Add-Ons ({addons.length})
          </button>
          <button
            onClick={openRestDetailEditor}
              className="px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-bold text-sm flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Edit className="w-4 h-4" /> Edit Restaurant Details
            </button>
            <button
              onClick={openCreateDishModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white hover:bg-brand/90 rounded-xl text-xs font-bold cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Dish (Instant Live)
          </button>
        </div>
      </div>

      {/* PENDING PRICE APPROVALS ALERT QUEUE */}
      <div className={`rounded-2xl border p-5 transition-all ${
        pendingApprovals.length > 0
          ? 'bg-amber-50/70 border-amber-200 shadow-sm'
          : 'bg-white border-gray-100'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${pendingApprovals.length > 0 ? 'bg-red-500 text-white animate-bounce' : 'bg-gray-100 text-gray-500'}`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                Pending Partner Price-Change Approvals
                <span className={`px-2.5 py-0.5 text-xs font-black rounded-full ${
                  pendingApprovals.length > 0 ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {pendingApprovals.length} Pending
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                When a restaurant changes a dish price in the Partner App, the old price stays locked on the Customer App until you approve it here.
              </p>
            </div>
          </div>
        </div>

        {pendingApprovals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {pendingApprovals.map((item) => {
              const oldPrice = Number(item.price || 0);
              const newPrice = Number(item.pending_price || 0);
              const diff = newPrice - oldPrice;
              const pct = oldPrice > 0 ? Math.round((diff / oldPrice) * 100) : 0;

              return (
                <div key={item.id} className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-bold text-brand flex items-center gap-1">
                        <Store className="w-3.5 h-3.5" /> {item.restaurant_name || `Restaurant #${item.restaurant_id}`}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-semibold">
                        {item.category || 'Menu'}
                      </span>
                    </div>

                    <h4 className="font-bold text-gray-800 text-base mt-1.5">{item.name}</h4>

                    <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Current Live Price</p>
                        <p className="text-base font-bold text-gray-700">₹{oldPrice}</p>
                      </div>
                      <span className="text-gray-400 font-bold">→</span>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-amber-600">Requested Price</p>
                        <p className="text-lg font-black text-amber-700">
                          ₹{newPrice}{' '}
                          <span className={`text-xs font-bold ${diff >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            ({diff >= 0 ? `+${pct}%` : `${pct}%`})
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleApprovePrice(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand/90 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve (₹{newPrice})
                    </button>
                    <button
                      onClick={() => handleRejectPrice(item)}
                      className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-2.5 inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> All restaurant dish prices are approved and synchronized.
          </div>
        )}
      </div>

      {/* SEARCHABLE RESTAURANT SELECTOR BAR */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
              1. Search & Filter Onboarded Restaurants ({restaurants.length} Total)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Type restaurant name, phone, or ID to filter dropdown..."
                value={restSearch}
                onChange={(e) => setRestSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
              2. Select Restaurant to Setup / Edit Menu
            </label>
            <select
              value={selectedRestId}
              onChange={(e) => setSelectedRestId(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-bold border border-gray-300 rounded-xl bg-white text-gray-800 outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">-- Choose Restaurant --</option>
              {filteredRestaurants.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name} (#ID: {r.id} • {r.phone_number || 'No Phone'} • {r.status || 'ACTIVE'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentRestaurant && (
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <Store className="w-4 h-4 text-brand" />
                {currentRestaurant.name}
              </span>
              <span>Cuisine: <strong>{currentRestaurant.cuisine || 'Multi-Cuisine'}</strong></span>
              <span>Total Dishes: <strong>{menuItems.length}</strong></span>
              <span>Custom Add-Ons: <strong>{addons.length}</strong></span>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search dishes in this menu..."
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all ${
            selectedCategory === 'ALL' ? 'bg-dark text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          All Categories ({menuItems.length})
        </button>
        {categories.map((cat) => {
          const count = menuItems.filter((m) => (m.category || 'Menu') === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all ${
                selectedCategory === cat ? 'bg-brand text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleMenuItems.map((dish) => {
          const imgUrl = dish.image_url || dish.image;
          const isVeg = dish.is_veg !== false;
          const hasPendingPrice =
            dish.price_approval_status === 'PENDING' &&
            dish.pending_price !== null &&
            dish.pending_price !== undefined;

          return (
            <div
              key={dish.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                !dish.is_available ? 'opacity-65 border-gray-200' : 'border-gray-100 hover:border-brand/40'
              }`}
            >
              <div>
                <div className="relative h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {imgUrl ? (
                    <img src={imgUrl} alt={dish.name} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-10 h-10 text-gray-300" />
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black shadow-sm ${
                        isVeg ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                      }`}
                    >
                      {isVeg ? '● VEG' : '▲ NON-VEG'}
                    </span>
                    {dish.popular && (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-400 text-amber-950 shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> BESTSELLER
                      </span>
                    )}
                  </div>
                  <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/70 text-white">
                    {dish.category || 'Main Course'}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-gray-800 text-base">{dish.name}</h4>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-brand">₹{dish.price}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">Live Price</p>
                    </div>
                  </div>

                  {dish.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dish.description}</p>
                  )}

                  {hasPendingPrice && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900">
                        Partner Requested: <strong>₹{dish.pending_price}</strong>
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApprovePrice(dish)}
                          className="px-2 py-1 bg-brand text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectPrice(dish)}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold text-[10px] cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 bg-gray-50/50">
                <button
                  onClick={() => handleToggleAvailability(dish)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    dish.is_available !== false
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {dish.is_available !== false ? 'In Stock (Live)' : 'Out of Stock'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditDishModal(dish)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit / Price
                  </button>
                  <button
                    onClick={() => handleDeleteDish(dish)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {visibleMenuItems.length === 0 && (
          <div className="col-span-3 bg-white p-12 rounded-2xl text-center border border-gray-100 text-gray-400">
            No dishes found for this restaurant yet. Click <strong>"Add Dish (Instant Live)"</strong> to onboard their menu.
          </div>
        )}
      </div>

      {/* CREATE / EDIT DISH MODAL */}
      {isDishModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">
                  {editingDish ? `Edit Dish: ${editingDish.name}` : `Add Dish to ${currentRestaurant?.name || 'Restaurant'}`}
                </h3>
                <p className="text-xs text-emerald-600 font-semibold">
                  Super Admin Mode: Price goes live immediately on Customer App
                </p>
              </div>
              <button onClick={() => setIsDishModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              {/* Dish Photo Upload to Cloudflare R2 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Dish Photo (Auto-Uploads to Cloudflare R2)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-brand rounded-xl p-4 text-center cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <span className="text-xs font-semibold text-gray-600">Click to select Dish Photo</span>
                    <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                  </label>
                  {dishForm.imagePreview && (
                    <img
                      src={dishForm.imagePreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Dish Name *</label>
                  <input
                    type="text"
                    required
                    value={dishForm.name}
                    onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
                    placeholder="e.g. Chicken Wazwan Biryani"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Live Customer Price (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={dishForm.price}
                    onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })}
                    placeholder="e.g. 240"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    list="foodzy-cat-suggestions"
                    value={dishForm.category}
                    onChange={(e) => setDishForm({ ...dishForm, category: e.target.value })}
                    placeholder="e.g. Main Course, Starters"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none"
                  />
                  <datalist id="foodzy-cat-suggestions">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Spice Level</label>
                  <select
                    value={dishForm.spice_level}
                    onChange={(e) => setDishForm({ ...dishForm, spice_level: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm bg-white outline-none"
                  >
                    <option value={0}>0 — Mild / Standard</option>
                    <option value={1}>1 — Medium Spicy</option>
                    <option value={2}>2 — Hot & Spicy</option>
                    <option value={3}>3 — Extra Fiery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={dishForm.description}
                  onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })}
                  placeholder="Portion size, ingredients, or preparation style..."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none"
                />
              </div>

              {/* Veg / Non-Veg + Bestseller + Availability */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDishForm({ ...dishForm, is_veg: !dishForm.is_veg })}
                  className={`py-2 px-3 rounded-xl text-xs font-black border cursor-pointer ${
                    dishForm.is_veg
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                  }`}
                >
                  {dishForm.is_veg ? '● PURE VEG' : '▲ NON-VEG'}
                </button>

                <button
                  type="button"
                  onClick={() => setDishForm({ ...dishForm, popular: !dishForm.popular })}
                  className={`py-2 px-3 rounded-xl text-xs font-black border cursor-pointer ${
                    dishForm.popular
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  {dishForm.popular ? '★ BESTSELLER' : '☆ Normal Item'}
                </button>

                <button
                  type="button"
                  onClick={() => setDishForm({ ...dishForm, is_available: !dishForm.is_available })}
                  className={`py-2 px-3 rounded-xl text-xs font-black border cursor-pointer ${
                    dishForm.is_available
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-500'
                  }`}
                >
                  {dishForm.is_available ? '✓ In Stock' : '✕ Hidden'}
                </button>
              </div>

              {/* Linked Add-Ons Checkboxes */}
              {addons.length > 0 && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand" /> Attach Optional Add-Ons to This Dish
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {addons.map((ad) => {
                      const checked = dishForm.linked_addon_ids.includes(Number(ad.id));
                      return (
                        <button
                          key={ad.id}
                          type="button"
                          onClick={() => toggleAddonLink(ad.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                            checked
                              ? 'bg-brand text-white border-brand'
                              : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          {checked ? '✓ ' : '+ '} {ad.name} (+₹{ad.price})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDish}
                  className="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand/90 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {savingDish ? 'Uploading & Saving...' : editingDish ? 'Save & Publish Live' : 'Add Dish to Live Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD-ONS MANAGER MODAL */}
      {isAddonModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                Add-Ons Manager ({currentRestaurant?.name || 'Restaurant'})
              </h3>
              <button onClick={() => setIsAddonModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAddon} className="flex gap-2 mb-4">
              <input
                type="text"
                required
                placeholder="Add-on name (e.g. Extra Cheese)"
                value={addonForm.name}
                onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none"
              />
              <input
                type="number"
                required
                placeholder="₹ Price"
                value={addonForm.price}
                onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })}
                className="w-24 px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {addons.map((ad) => (
                <div key={ad.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-gray-800">{ad.name}</span>
                    <span className="ml-2 text-xs font-bold text-brand">+₹{ad.price}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAddon(ad.id)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {addons.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No custom add-ons created for this restaurant yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {isRestDetailModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">Update Restaurant Details & Location</h3>
              <button onClick={() => setIsRestDetailModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveRestDetails} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Restaurant Name</label>
                  <input type="text" required value={restDetailForm.name} onChange={(e) => setRestDetailForm({ ...restDetailForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Phone Number</label>
                  <input type="text" value={restDetailForm.phone_number} onChange={(e) => setRestDetailForm({ ...restDetailForm, phone_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Cuisine</label>
                  <input type="text" value={restDetailForm.cuisine} onChange={(e) => setRestDetailForm({ ...restDetailForm, cuisine: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Delivery Time</label>
                  <input type="text" value={restDetailForm.delivery_time} onChange={(e) => setRestDetailForm({ ...restDetailForm, delivery_time: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Latitude (Unfreeze)</label>
                  <input type="number" step="any" value={restDetailForm.lat} onChange={(e) => setRestDetailForm({ ...restDetailForm, lat: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Longitude (Unfreeze)</label>
                  <input type="number" step="any" value={restDetailForm.lng} onChange={(e) => setRestDetailForm({ ...restDetailForm, lng: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">PAN No.</label>
                  <input type="text" value={restDetailForm.pan_number} onChange={(e) => setRestDetailForm({ ...restDetailForm, pan_number: e.target.value })} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">FSSAI No.</label>
                  <input type="text" value={restDetailForm.fssai_number} onChange={(e) => setRestDetailForm({ ...restDetailForm, fssai_number: e.target.value })} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">GST No.</label>
                  <input type="text" value={restDetailForm.gst_number} onChange={(e) => setRestDetailForm({ ...restDetailForm, gst_number: e.target.value })} className="w-full px-2.5 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Bank Account No.</label>
                  <input type="text" value={restDetailForm.bank_account_number} onChange={(e) => setRestDetailForm({ ...restDetailForm, bank_account_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Bank IFSC</label>
                  <input type="text" value={restDetailForm.bank_ifsc} onChange={(e) => setRestDetailForm({ ...restDetailForm, bank_ifsc: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-xs" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsRestDetailModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg cursor-pointer">Save Restaurant Details</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}