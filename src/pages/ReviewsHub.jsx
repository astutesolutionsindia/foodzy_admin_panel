import { useState, useEffect, useCallback } from 'react';
import {
  Star, MessageSquare, AlertTriangle, Pin, Trash2,
  Search, Store, RefreshCw, ShieldCheck, Sparkles
} from 'lucide-react';
import api from '../config/api';

export default function ReviewsHub() {
  const [reviews, setReviews] = useState([]);
  const [restaurantHealth, setRestaurantHealth] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);

  const [filterType, setFilterType] = useState('ALL');
  const [selectedRestId, setSelectedRestId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeNoteReview, setActiveNoteReview] = useState(null);
  const [noteForm, setNoteForm] = useState({ admin_note: '', owner_reply: '' });

  const fetchReviews = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await api.get('/admin/reviews');
      setReviews(res.data?.reviews || []);
      setRestaurantHealth(res.data?.restaurantHealth || []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleTogglePin = async (review) => {
    try {
      await api.put(`/admin/reviews/${review.id}/moderate`, {
        is_pinned: !review.is_pinned
      });
      fetchReviews();
    } catch {
      alert('Failed to pin/unpin review.');
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm(`Delete this ${review.rating}★ review from ${review.customer_name}? Restaurant average rating will automatically recalculate.`)) return;
    try {
      await api.delete(`/admin/reviews/${review.id}`);
      fetchReviews();
    } catch {
      alert('Failed to delete review.');
    }
  };

  const openNoteModal = (review) => {
    setActiveNoteReview(review);
    setNoteForm({
      admin_note: review.admin_note || '',
      owner_reply: review.owner_reply || ''
    });
  };

  const handleSaveModerationNote = async (e) => {
    e.preventDefault();
    if (!activeNoteReview) return;
    try {
      await api.put(`/admin/reviews/${activeNoteReview.id}/moderate`, noteForm);
      setActiveNoteReview(null);
      fetchReviews();
    } catch {
      alert('Failed to save moderation note.');
    }
  };

  const totalReviews = reviews.length;
  const avgPlatformRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + Number(r.rating || 5), 0) / totalReviews).toFixed(1)
    : '5.0';
  const criticalCount = reviews.filter((r) => Number(r.rating) <= 2).length;
  const pinnedCount = reviews.filter((r) => r.is_pinned).length;

  const filteredReviews = reviews.filter((r) => {
    if (selectedRestId !== 'ALL' && String(r.restaurant_id) !== String(selectedRestId)) return false;
    if (filterType === 'CRITICAL' && Number(r.rating) > 2) return false;
    if (filterType === 'NEUTRAL' && Number(r.rating) !== 3) return false;
    if (filterType === 'POSITIVE' && Number(r.rating) < 4) return false;
    if (filterType === 'PINNED' && !r.is_pinned) return false;
    if (filterType === 'UNREPLIED' && r.owner_reply) return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      String(r.customer_name || '').toLowerCase().includes(q) ||
      String(r.restaurant_name || '').toLowerCase().includes(q) ||
      String(r.comment || '').toLowerCase().includes(q) ||
      String(r.order_id || '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
              Reviews & Reputation Control Center
            </h2>
            {isSyncing && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                Syncing...
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Monitor customer sentiment, pin top testimonials, resolve 1-2★ complaints, and purge fake reviews.
          </p>
        </div>

        <button
          onClick={fetchReviews}
          className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Platform Avg Rating</p>
            <p className="text-3xl font-black text-gray-800 mt-1">{avgPlatformRating} ★</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Across {totalReviews} verified reviews</p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-500 rounded-xl">
            <Star className="w-6 h-6 fill-amber-400" />
          </div>
        </div>

        <div
          onClick={() => setFilterType('CRITICAL')}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-red-200"
        >
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Critical Alerts (1-2 ★)</p>
            <p className="text-3xl font-black text-red-600 mt-1">{criticalCount}</p>
            <p className="text-xs text-gray-500 mt-1">Click to inspect low ratings</p>
          </div>
          <div className="p-3.5 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setFilterType('PINNED')}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-brand"
        >
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Pinned Highlights</p>
            <p className="text-3xl font-black text-brand mt-1">{pinnedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Featured at top of feeds</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-brand rounded-xl">
            <Pin className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setFilterType('ALL')}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer"
        >
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Audited Kitchens</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">{restaurantHealth.length}</p>
            <p className="text-xs text-gray-500 mt-1">Live quality scorecards</p>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {restaurantHealth.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand" /> Restaurant Rating Health Radar (Click a restaurant to filter)
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedRestId('ALL')}
              className={`px-4 py-2.5 rounded-xl border text-left shrink-0 cursor-pointer transition-all ${
                selectedRestId === 'ALL' ? 'bg-dark text-white border-dark' : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              <p className="text-xs font-bold">All Restaurants</p>
              <p className="text-[11px] opacity-80">{totalReviews} Total Reviews</p>
            </button>
            {restaurantHealth.map((rh) => {
              const isLow = Number(rh.avg_rating) < 3.5 && rh.review_count > 0;
              const isSelected = String(selectedRestId) === String(rh.restaurant_id);
              return (
                <button
                  key={rh.restaurant_id}
                  onClick={() => setSelectedRestId(isSelected ? 'ALL' : rh.restaurant_id)}
                  className={`px-4 py-2.5 rounded-xl border text-left shrink-0 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : isLow
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold truncate max-w-[140px]">{rh.restaurant_name}</span>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded bg-black/10">
                      {rh.avg_rating} ★
                    </span>
                  </div>
                  <p className="text-[10px] opacity-75 mt-1">
                    {rh.review_count} reviews ({rh.high_star_count} positive, {rh.low_star_count} critical)
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: 'All Reviews' },
            { id: 'CRITICAL', label: 'Critical (1-2 ★)' },
            { id: 'NEUTRAL', label: 'Neutral (3 ★)' },
            { id: 'POSITIVE', label: 'Positive (4-5 ★)' },
            { id: 'PINNED', label: 'Pinned Highlights' },
            { id: 'UNREPLIED', label: 'Needs Partner Reply' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                filterType === f.id ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search comment, customer, order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReviews.map((rev) => {
          const stars = Number(rev.rating || 5);
          const badgeColor =
            stars >= 4
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : stars === 3
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-red-100 text-red-800 border-red-200';

          return (
            <div
              key={rev.id}
              className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all ${
                rev.is_pinned ? 'border-brand ring-1 ring-brand/20 bg-emerald-50/10' : 'border-gray-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${badgeColor}`}>
                        {'★'.repeat(stars)}{'☆'.repeat(5 - stars)} ({stars}.0)
                      </span>
                      {rev.is_pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand text-white">
                          <Pin className="w-2.5 h-2.5" /> PINNED TOP
                        </span>
                      )}
                      {rev.order_id && (
                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          Order #FZ-{rev.order_id}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-800 mt-2 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-brand" />
                      {rev.restaurant_name}
                    </h4>
                  </div>

                  <span className="text-[11px] text-gray-400">
                    {rev.created_at ? new Date(rev.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-100 italic">
                  "{rev.comment || 'Customer left a star rating without written comment.'}"
                </p>

                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>By: <strong className="text-gray-700">{rev.customer_name || 'Verified Customer'}</strong> {rev.customer_phone ? `(${rev.customer_phone})` : ''}</span>
                  {rev.order_amount && <span className="font-semibold text-gray-700">Bill: ₹{rev.order_amount}</span>}
                </div>

                {rev.owner_reply && (
                  <div className="mt-3 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-blue-600">Restaurant Reply</p>
                    <p className="mt-0.5">{rev.owner_reply}</p>
                  </div>
                )}

                {rev.admin_note && (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-900">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-purple-700">Super Admin Resolution Note</p>
                    <p className="mt-0.5">{rev.admin_note}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePin(rev)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      rev.is_pinned ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {rev.is_pinned ? 'Unpin' : 'Pin Highlight'}
                  </button>
                  <button
                    onClick={() => openNoteModal(rev)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Reply / Admin Note
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteReview(rev)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredReviews.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 text-gray-400">
          No customer reviews match the selected filter.
        </div>
      )}

      {activeNoteReview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg text-gray-800 mb-1">
              Moderate Review #{activeNoteReview.id} ({activeNoteReview.restaurant_name})
            </h3>
            <p className="text-xs text-gray-500 mb-4">Add an official Super Admin resolution note or edit the restaurant reply.</p>
            <form onSubmit={handleSaveModerationNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Super Admin Resolution Note</label>
                <textarea
                  rows="3"
                  value={noteForm.admin_note}
                  onChange={(e) => setNoteForm({ ...noteForm, admin_note: e.target.value })}
                  placeholder="e.g. Verified with customer, issued coupon compensation."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Restaurant Partner Public Reply</label>
                <textarea
                  rows="3"
                  value={noteForm.owner_reply}
                  onChange={(e) => setNoteForm({ ...noteForm, owner_reply: e.target.value })}
                  placeholder="Official response visible on restaurant review feed..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveNoteReview(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand/90 cursor-pointer"
                >
                  Save Moderation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
