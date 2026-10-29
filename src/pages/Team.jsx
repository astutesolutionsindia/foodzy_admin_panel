import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert, UserPlus, Trash2, Clock, Loader2, XCircle, ShieldCheck } from 'lucide-react';
import api from '../config/api';

export default function Team() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('MEMBERS');
  const [team, setTeam] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '+91',
    roleType: 'FIELD_ADMIN'
  });

  const fetchData = async () => {
    try {
      const [teamRes, logsRes] = await Promise.all([
        api.get('/admin/team'),
        api.get('/admin/audit-logs')
      ]);
      setTeam(teamRes.data || []);
      setLogs(logsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch Super Admin team data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role_type === 'SUPER_ADMIN') {
      fetchData();
    }
  }, [user]);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/team', formData);
      setIsModalOpen(false);
      setFormData({ fullName: '', phoneNumber: '+91', roleType: 'FIELD_ADMIN' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign admin role.');
    }
  };

  const handleRevoke = async (id, name) => {
    if (
      !window.confirm(
        `WARNING: Are you sure you want to completely revoke admin access for ${name}? They will instantly become a standard customer.`
      )
    )
      return;

    try {
      await api.delete(`/admin/team/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to revoke access.');
    }
  };

  if (user?.role_type !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center mt-32 text-gray-500">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800">Super Admin Access Required</h2>
        <p>You do not have clearance to view this module.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  const roleColors = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
    FINANCE_ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
    FIELD_ADMIN: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Super Admin Security & Team</h2>
          <p className="text-gray-500">
            Manage admin privileges and monitor platform audit logs.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-dark text-white rounded-lg hover:bg-dark/90 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Admin Privileges
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'MEMBERS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          Active Admins ({team.length})
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'LOGS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4 mr-2" />
          Audit Logs
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'MEMBERS' && (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Admin Info</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Clearance Level</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50/50">
                  <td className="p-4 font-semibold text-gray-800">{member.full_name}</td>
                  <td className="p-4 text-gray-600">{member.phone_number}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded border text-xs font-semibold ${
                        roleColors[member.role_type]
                      }`}
                    >
                      {member.role_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    {member.id !== user.id ? (
                      <button
                        onClick={() => handleRevoke(member.id, member.full_name)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer transition-colors"
                        title="Revoke Access"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Current User</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'LOGS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Time</th>
                  <th className="p-4 font-medium">Admin</th>
                  <th className="p-4 font-medium">Action Event</th>
                  <th className="p-4 font-medium">Target ID</th>
                  <th className="p-4 font-medium">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{log.admin_name}</div>
                      <div className="text-xs text-gray-400">
                        {log.admin_role.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-blue-600">{log.action}</td>
                    <td className="p-4 text-gray-600">
                      {log.target_type} #{log.target_id}
                    </td>
                    <td className="p-4">
                      <pre className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 max-w-xs overflow-hidden text-ellipsis">
                        {JSON.stringify(log.details)}
                      </pre>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No recent actions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-gray-800">Assign Admin Access</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number (Login ID)
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clearance Level
                </label>
                <select
                  value={formData.roleType}
                  onChange={(e) => setFormData({ ...formData, roleType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white"
                >
                  <option value="FIELD_ADMIN">Field Admin (Operations Only)</option>
                  <option value="FINANCE_ADMIN">Finance Admin (Ops + Ledger/Coupons)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full Console Access)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dark text-white rounded-lg hover:bg-dark/90 cursor-pointer font-medium"
                >
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}