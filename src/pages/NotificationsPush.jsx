import { useState } from 'react';
import { BellRing, Send, Sparkles, Flame, Utensils } from 'lucide-react';
import api from '../config/api';

const MOUTHWATERING_TEMPLATES = [
  {
    title: '🔥 Craving Hot Wazwan or Momos Tonight?',
    body: 'Freshly prepared dishes from top kitchens near you are ready for instant delivery! Order now on Foodzy.',
    target: 'CUSTOMERS'
  },
  {
    title: '🍔 Hot & Crispy Burgers Waiting for You!',
    body: 'Treat yourself to mouthwatering burgers, pizzas, and biryani with lightning-fast doorstep delivery.',
    target: 'CUSTOMERS'
  },
  {
    title: '🎉 Weekend Feast Alert on Foodzy!',
    body: 'Unlock exclusive savings on your favorite local restaurants tonight. Tap to explore the menu!',
    target: 'CUSTOMERS'
  },
  {
    title: '⚡ Peak Dinner Rush is Live!',
    body: 'Go online now to maximize your delivery earnings during peak dinner hours.',
    target: 'RIDERS'
  }
];

export default function NotificationsPush() {
  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'CUSTOMERS'
  });
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState([]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      return alert('Please enter both a notification title and message.');
    }
    try {
      setSending(true);
      const res = await api.post('/admin/notifications/broadcast', {
        title: form.title.trim(),
        message: form.body.trim(),
        body: form.body.trim(),
        targetRole: form.target,
        audience: form.target
      });
      setSentHistory((prev) => [
        {
          id: Date.now(),
          ...form,
          sentAt: new Date().toLocaleTimeString(),
          count: res.data?.sentCount || 'All Active'
        },
        ...prev
      ]);
      alert('🎉 Push Notification broadcasted successfully!');
      setForm({ ...form, title: '', body: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send push broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BellRing className="w-6 h-6 text-emerald-600" />
          Push Notification Broadcast Studio
        </h2>
        <p className="text-gray-500 text-sm">
          Send instant, mouthwatering push notifications to remind users to order their favorite dishes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" />
            Compose Push Notification
          </h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Target Audience
              </label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white text-sm font-semibold outline-none"
              >
                <option value="CUSTOMERS">All Customers (Customer App)</option>
                <option value="RIDERS">All Delivery Partners (Rider App)</option>
                <option value="RESTAURANTS">All Restaurant Partners (Restaurant App)</option>
                <option value="ALL">Entire Foodzy Ecosystem (All Apps)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Notification Headline / Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. 🍕 Hot & Cheesy Pizzas Ready for Delivery!"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Mouthwatering Message Body *
              </label>
              <textarea
                rows="4"
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write an irresistible reminder to order..."
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Broadcasting Push Notification...' : 'Send Push Notification Now'}
            </button>
          </form>
        </div>

        {/* 1-Click Templates */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-amber-500" />
            1-Tap Mouthwatering Templates
          </h3>
          <p className="text-xs text-gray-500">
            Click any template below to pre-fill the composer:
          </p>
          <div className="space-y-2.5">
            {MOUTHWATERING_TEMPLATES.map((tpl, i) => (
              <div
                key={i}
                onClick={() => setForm(tpl)}
                className="p-3 rounded-xl border border-gray-100 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-gray-800">{tpl.title}</div>
                <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{tpl.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sentHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">Recent Broadcasts This Session</h3>
          <div className="space-y-2">
            {sentHistory.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-700 mr-2">[{item.target}]</span>
                  <span className="font-bold text-gray-800">{item.title}</span> — {item.body}
                </div>
                <span className="text-gray-400 font-mono">{item.sentAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
