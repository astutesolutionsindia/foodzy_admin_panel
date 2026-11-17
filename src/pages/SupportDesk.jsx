import { useState, useEffect, useCallback, useContext } from 'react';
import { LifeBuoy, AlertTriangle, CheckCircle2, Plus, Send, RefreshCw } from 'lucide-react';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';

export default function SupportDesk() {
  const { user } = useContext(AuthContext);
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    reporter_name: '',
    reporter_phone: '',
    order_id: '',
    category: 'Order / Delivery Issue',
    priority: 'HIGH',
    subject: '',
    description: ''
  });

  const fetchIssues = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/support/issues');
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch support issues:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    const socket = initSocket();
    if (socket) {
      socket.on('supportIssueCreated', fetchIssues);
      socket.on('supportIssueUpdated', fetchIssues);
      return () => {
        socket.off('supportIssueCreated', fetchIssues);
        socket.off('supportIssueUpdated', fetchIssues);
      };
    }
  }, [fetchIssues]);

  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    try {
      await api.post('/support/issues', {
        ...form,
        reporter_name: form.reporter_name || user?.full_name || 'Tech Support Agent',
        reporter_phone: form.reporter_phone || user?.phone_number || '',
        reporter_role: user?.role_type || 'TECH_SUPPORT'
      });
      setForm({
        reporter_name: '',
        reporter_phone: '',
        order_id: '',
        category: 'Order / Delivery Issue',
        priority: 'HIGH',
        subject: '',
        description: ''
      });
      fetchIssues();
      alert('✅ Issue escalated to Super-Admin for resolution!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit issue');
    }
  };

  const handleResolve = async (issue) => {
    const note = window.prompt('Enter resolution note for this issue:', issue.resolution_note || 'Resolved by Super Admin');
    if (note === null) return;
    try {
      await api.put(`/support/issues/${issue.id}`, {
        status: 'RESOLVED',
        resolution_note: note
      });
      fetchIssues();
    } catch {
      alert('Failed to mark issue as resolved');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-emerald-600" />
            Issue Escalation & Super-Admin Resolution Desk
          </h2>
          <p className="text-gray-500 text-sm">
            Highlight customer or employee issues and escalate directly to Super-Admin for resolution
          </p>
        </div>
        <button
          onClick={fetchIssues}
          className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Sync Issues
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit / Highlight New Issue to Super Admin */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Escalate Issue to Super-Admin
          </h3>
          <form onSubmit={handleSubmitIssue} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Customer / Caller Name</label>
              <input
                type="text"
                value={form.reporter_name}
                onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                placeholder="Customer or Employee Name"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={form.reporter_phone}
                  onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
                  placeholder="+91..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Order ID (Optional)</label>
                <input
                  type="number"
                  value={form.order_id}
                  onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                  placeholder="e.g. 104"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white outline-none"
                >
                  <option value="Order / Delivery Issue">Order / Delivery</option>
                  <option value="Restaurant / Menu Issue">Restaurant / Menu</option>
                  <option value="Rider Dispatch Issue">Rider Dispatch</option>
                  <option value="App Technical Bug">Technical / App Bug</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white outline-none font-bold"
                >
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="NORMAL">NORMAL</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Issue Subject *</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Detailed Issue Description *</label>
              <textarea
                rows="3"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe full details for Super-Admin resolution..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" /> Send to Super-Admin
            </button>
          </form>
        </div>

        {/* Escalated Issues Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800">
            Escalated Issues Queue ({issues.length})
          </div>
          <div className="divide-y divide-gray-100 max-h-[620px] overflow-y-auto">
            {issues.map((iss) => (
              <div key={iss.id} className="p-4 hover:bg-gray-50/60 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black mr-2 ${
                      iss.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {iss.priority}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 mr-2">[{iss.category}]</span>
                    {iss.order_id && (
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                        Order #{iss.order_id}
                      </span>
                    )}
                    <h4 className="font-bold text-gray-800 mt-1">{iss.subject}</h4>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    iss.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {iss.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-line">{iss.description}</p>
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>
                    Reported by: <strong className="text-gray-700">{iss.reporter_name}</strong> ({iss.reporter_phone || iss.reporter_role})
                  </span>
                  {iss.status !== 'RESOLVED' && user?.role_type === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => handleResolve(iss)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve Issue
                    </button>
                  )}
                </div>
                {iss.resolution_note && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <strong>Resolution ({iss.resolved_by || 'Super Admin'}):</strong> {iss.resolution_note}
                  </div>
                )}
              </div>
            ))}
            {issues.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm">
                No open issues in the queue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
