import { useState, useEffect, useCallback, useContext } from 'react';
import { LifeBuoy, AlertTriangle, CheckCircle2, Send, RefreshCw, MessageSquareReply } from 'lucide-react';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';

export default function SupportDesk() {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = user?.role_type === 'SUPER_ADMIN';

  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingReplyId, setSendingReplyId] = useState(null);

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
    if (!form.description.trim()) {
      return alert('Please write the issue details before sending to Super-Admin.');
    }
    try {
      await api.post('/support/issues', {
        ...form,
        subject: form.subject.trim() || `${form.category} (${user?.role_type || 'FIELD_ADMIN'})`,
        reporter_name: form.reporter_name.trim() || user?.full_name || 'Field Admin',
        reporter_phone: form.reporter_phone.trim() || user?.phone_number || '',
        reporter_role: user?.role_type || 'FIELD_ADMIN'
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
      window.dispatchEvent(new Event('foodzySupportIssueUpdated'));
      fetchIssues();
      alert('✅ Issue sent to Super-Admin!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send issue to Super-Admin');
    }
  };

  const handleSuperAdminReply = async (issue, nextStatus = 'RESOLVED') => {
    const replyText = (replyDrafts[issue.id] ?? issue.resolution_note ?? '').trim();
    if (!replyText) {
      return alert('Please write a reply for the admin team first.');
    }
    try {
      setSendingReplyId(issue.id);
      await api.put(`/support/issues/${issue.id}`, {
        status: nextStatus,
        resolution_note: replyText
      });
      window.dispatchEvent(new Event('foodzySupportIssueUpdated'));
      fetchIssues();
    } catch {
      alert('Failed to send reply');
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleUnlockPartnerBank = async (issue) => {
    if (!issue?.reporter_id) return alert('Missing partner ID on this ticket.');
    try {
      setSendingReplyId(issue.id);
      const replyText =
        (replyDrafts[issue.id] || '').trim() ||
        'Bank account editing has been activated in your Restaurant Partner App. Please enter your updated bank details and save.';
      await api.put(`/admin/restaurants/${issue.reporter_id}/bank-edit-unlock`, {
        unlock: true,
        issueId: issue.id,
        resolution_note: replyText
      });
      window.dispatchEvent(new Event('foodzySupportIssueUpdated'));
      fetchIssues();
      alert('Bank update option activated for partner!');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to unlock bank update for partner');
    } finally {
      setSendingReplyId(null);
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
            Field Admins & Tech Support can highlight issues below and send directly to Super-Admin for reply & resolution
          </p>
        </div>
        <button
          onClick={fetchIssues}
          className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Field Admin / Tech Support Issue Composer */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 self-start">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Highlight Issue to Super-Admin
          </h3>
          <form onSubmit={handleSubmitIssue} className="space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Issue Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white outline-none"
                >
                  <option value="Order / Delivery Issue">Order / Delivery</option>
                  <option value="Customer Call / Complaint">Customer Call</option>
                  <option value="Restaurant / Menu Issue">Restaurant / Menu</option>
                  <option value="Rider Dispatch Issue">Rider Dispatch</option>
                  <option value="App Technical Bug">Technical Bug</option>
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Customer / Caller Phone</label>
                <input
                  type="text"
                  value={form.reporter_phone}
                  onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
                  placeholder="Optional (+91...)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Order ID (If Any)</label>
                <input
                  type="number"
                  value={form.order_id}
                  onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                  placeholder="e.g. 105"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Issue Title / Subject *</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Short summary of the problem"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Write Detailed Issue for Super-Admin *
              </label>
              <textarea
                rows="5"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Type the complete issue encountered by our employee or reported by a customer call..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" /> Send to Super-Admin
            </button>
          </form>
        </div>

        {/* Right Column: Super-Admin View & Inline Reply Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-bold text-gray-800">
              Escalated Issues Queue ({issues.length})
            </span>
            <span className="text-xs text-gray-500">
              {isSuperAdmin ? 'Super-Admin Mode: Reply & Resolve below' : 'Live updates from Super-Admin'}
            </span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[680px] overflow-y-auto">
            {issues.map((iss) => (
              <div key={iss.id} className="p-5 hover:bg-gray-50/50 space-y-3">
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
                    <h4 className="font-bold text-gray-800 text-base mt-1">{iss.subject}</h4>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    iss.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {iss.status}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-line">
                  {iss.description}
                </div>

                <div className="text-xs text-gray-400 flex items-center justify-between">
                  <span>
                    Escalated by: <strong className="text-gray-700">{iss.reporter_name}</strong> ({iss.reporter_role || 'ADMIN'})
                    {iss.reporter_phone ? ` • 📞 ${iss.reporter_phone}` : ''}
                  </span>
                  <span>{iss.created_at ? new Date(iss.created_at).toLocaleString() : ''}</span>
                </div>

                {/* Existing Super-Admin Reply Display (Visible to Field Admin, Tech Support & Super Admin) */}
                {iss.resolution_note && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <MessageSquareReply className="w-4 h-4" />
                      Super-Admin Reply ({iss.resolved_by || 'Super Admin'}):
                    </div>
                    <p className="text-sm text-emerald-900 whitespace-pre-line">{iss.resolution_note}</p>
                  </div>
                )}

                {/* Super-Admin Inline Reply Box */}
                {isSuperAdmin && (
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={replyDrafts[iss.id] ?? iss.resolution_note ?? ''}
                      onChange={(e) =>
                        setReplyDrafts({ ...replyDrafts, [iss.id]: e.target.value })
                      }
                      placeholder="Write Super-Admin reply / resolution instructions..."
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-emerald-500 bg-white"
                    />
                    <button
                      type="button"
                      disabled={sendingReplyId === iss.id}
                      onClick={() => handleSuperAdminReply(iss, 'RESOLVED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {sendingReplyId === iss.id ? 'Sending...' : 'Reply & Resolve'}
                    </button>
                    {iss.reporter_role === 'RESTAURANT' &&
                      String(iss.category || iss.subject || '').toLowerCase().includes('bank') &&
                      iss.status !== 'RESOLVED' && (
                        <button
                          type="button"
                          disabled={sendingReplyId === iss.id}
                          onClick={() => handleUnlockPartnerBank(iss)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          Activate Bank Update
                        </button>
                      )}
                  </div>
                )}
              </div>
            ))}

            {issues.length === 0 && (
              <div className="p-12 text-center text-gray-400 text-sm">
                No issues escalated yet. Any issue sent by Field Admin or Tech Support will appear here for Super-Admin.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
