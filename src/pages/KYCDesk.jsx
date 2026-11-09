import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, FileText, ExternalLink, ShieldCheck, Search } from 'lucide-react';
import api from '../config/api';
import { initSocket } from '../config/socket';

export default function KYCDesk() {
  const [activeTab, setActiveTab] = useState('RESTAURANTS');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, ACTIVE, REJECTED
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState(() => {
    try {
      const cached = localStorage.getItem('adminKycCache');
      return cached ? JSON.parse(cached) : { restaurants: [], riders: [] };
    } catch {
      return { restaurants: [], riders: [] };
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [docModal, setDocModal] = useState({ isOpen: false, url: '', title: '' });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, type: '', id: null, reason: '' });

  const fetchKycQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      // Uses /admin/kyc/pending (since api.js baseURL already ends with /api)
      // Passes both all=true and status=ALL so all statuses are fetched & cached
      const res = await api.get('/admin/kyc/pending?all=true&status=ALL');
      if (res.data) {
        setData({
          restaurants: res.data.restaurants || [],
          riders: res.data.riders || []
        });
        localStorage.setItem(
          'adminKycCache',
          JSON.stringify({
            restaurants: res.data.restaurants || [],
            riders: res.data.riders || []
          })
        );
      }
    } catch (err) {
      console.error('Failed to fetch KYC queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKycQueue();

    const socket = initSocket();
    if (socket) {
      const handleKycUpdate = () => fetchKycQueue();
      socket.on('kycQueueUpdated', handleKycUpdate);
      return () => {
        socket.off('kycQueueUpdated', handleKycUpdate);
      };
    }
  }, [fetchKycQueue]);

  const handleDecision = async (type, id, decision, customReason = '') => {
    try {
      const endpoint =
        type === 'RESTAURANT' ? `/admin/kyc/restaurant/${id}` : `/admin/kyc/rider/${id}`;
      await api.put(endpoint, {
        decision,
        rejectionReason: customReason || 'Documents unclear or invalid'
      });
      setRejectModal({ isOpen: false, type: '', id: null, reason: '' });
      fetchKycQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const renderDocButton = (title, url) => {
    if (!url) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-xs italic mr-2">
          {title}: Not uploaded
        </span>
      );
    }
    return (
      <button
        onClick={() => setDocModal({ isOpen: true, url, title })}
        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors mr-2 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        {title}
        <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
      </button>
    );
  };

  const matchesRestaurantStatus = (rest, filter) => {
    const st = (rest.status || 'PENDING_VERIFICATION').toUpperCase();
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return st === 'PENDING_VERIFICATION' || st === 'PENDING';
    if (filter === 'ACTIVE') return st === 'ACTIVE' || st === 'APPROVED';
    if (filter === 'REJECTED') return st === 'REJECTED' || st === 'SUSPENDED';
    return true;
  };

  const matchesRiderStatus = (r, filter) => {
    const st = (r.approval_status || 'PENDING').toUpperCase();
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return st === 'PENDING' || st === 'NOT_SUBMITTED';
    if (filter === 'ACTIVE') return st === 'ACTIVE' || st === 'APPROVED';
    if (filter === 'REJECTED') return st === 'REJECTED';
    return true;
  };

  const q = searchQuery.toLowerCase();
  const allRestaurants = data.restaurants || [];
  const allRiders = data.riders || [];

  const filteredRestaurants = allRestaurants.filter(
    (rest) =>
      matchesRestaurantStatus(rest, statusFilter) &&
      (String(rest.restaurant_name || rest.full_name || '').toLowerCase().includes(q) ||
        String(rest.phone_number || '').includes(q))
  );

  const filteredRiders = allRiders.filter(
    (r) =>
      matchesRiderStatus(r, statusFilter) &&
      (String(r.full_name || '').toLowerCase().includes(q) ||
        String(r.phone_number || '').includes(q))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">KYC Verification Desk</h2>
          <p className="text-gray-500">
            Review and approve partner FSSAI, License, and vehicle compliance documents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search partner name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>

          {/* Entity Tabs */}
          <div className="flex bg-gray-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('RESTAURANTS')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'RESTAURANTS'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Restaurants ({filteredRestaurants.length})
            </button>
            <button
              onClick={() => setActiveTab('RIDERS')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'RIDERS'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Riders ({filteredRiders.length})
            </button>
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
          Filter Status:
        </span>
        {['ALL', 'PENDING', 'ACTIVE', 'REJECTED'].map((st) => {
          const count =
            activeTab === 'RESTAURANTS'
              ? allRestaurants.filter((item) => matchesRestaurantStatus(item, st)).length
              : allRiders.filter((item) => matchesRiderStatus(item, st)).length;

          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ACTIVE' ? 'APPROVED / ACTIVE' : st} ({count})
            </button>
          );
        })}
        {isLoading && (
          <span className="text-xs text-emerald-600 font-semibold animate-pulse ml-2">
            Syncing KYC records...
          </span>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'RESTAURANTS' && (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 font-medium">Restaurant Info</th>
                <th className="p-4 font-medium">Compliance Documents</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRestaurants.map((rest) => (
                <tr key={rest.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <p className="font-bold text-gray-800">
                      {rest.restaurant_name || rest.full_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rest.phone_number} • {rest.cuisine || 'General'}
                    </p>
                  </td>
                  <td className="p-4 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {renderDocButton('FSSAI Cert', rest.fssai_doc)}
                      {renderDocButton('Registration', rest.registration_doc)}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        rest.status === 'ACTIVE' || rest.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : rest.status === 'PENDING_VERIFICATION' || rest.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {rest.status}
                    </span>
                    {rest.rejection_reason && (
                      <p className="text-[11px] text-red-500 mt-1 max-w-xs">
                        {rest.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {rest.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleDecision('RESTAURANT', rest.id, 'ACTIVE')}
                          className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          title="Approve Restaurant"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </button>
                      )}
                      {rest.status !== 'REJECTED' && (
                        <button
                          onClick={() =>
                            setRejectModal({
                              isOpen: true,
                              type: 'RESTAURANT',
                              id: rest.id,
                              reason: ''
                            })
                          }
                          className="flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          title="Reject KYC"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRestaurants.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">
                    No restaurant KYC records found matching filter "{statusFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'RIDERS' && (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 font-medium">Rider Info</th>
                <th className="p-4 font-medium">Compliance Documents</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRiders.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <p className="font-bold text-gray-800">{r.full_name}</p>
                    <p className="text-xs text-gray-500">{r.phone_number}</p>
                  </td>
                  <td className="p-4 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {renderDocButton('Driving License', r.driving_license_doc)}
                      {renderDocButton('Bike RC', r.bike_registration_doc)}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : r.approval_status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.approval_status}
                    </span>
                    {r.rejection_reason && (
                      <p className="text-[11px] text-red-500 mt-1 max-w-xs">
                        {r.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {r.approval_status !== 'ACTIVE' && r.approval_status !== 'APPROVED' && (
                        <button
                          onClick={() => handleDecision('RIDER', r.id, 'APPROVED')}
                          className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          title="Approve Rider"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </button>
                      )}
                      {r.approval_status !== 'REJECTED' && (
                        <button
                          onClick={() =>
                            setRejectModal({
                              isOpen: true,
                              type: 'RIDER',
                              id: r.id,
                              reason: ''
                            })
                          }
                          className="flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          title="Reject KYC"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRiders.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">
                    No rider KYC records found matching filter "{statusFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Viewer Modal */}
      {docModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg flex items-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mr-2" />
                {docModal.title}
              </h3>
              <div className="flex items-center gap-3">
                {docModal.url.startsWith('http') && (
                  <a
                    href={docModal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center"
                  >
                    Open in new tab <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                )}
                <button
                  onClick={() => setDocModal({ isOpen: false, url: '', title: '' })}
                  className="text-gray-400 hover:text-gray-800 cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 flex justify-center bg-gray-50">
              {docModal.url.includes('application/pdf') || docModal.url.endsWith('.pdf') ? (
                <iframe
                  src={docModal.url}
                  title={docModal.title}
                  className="w-full h-[600px] border-0 rounded-lg shadow-sm"
                />
              ) : (
                <img
                  src={docModal.url}
                  alt="Document Preview"
                  className="max-w-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-gray-800">Specify Rejection Reason</h3>
            <p className="text-xs text-gray-500">
              Provide feedback to the partner so they can re-upload correct compliance documents.
            </p>
            <textarea
              rows="3"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="e.g. FSSAI certificate image is blurry or expired."
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setRejectModal({ isOpen: false, type: '', id: null, reason: '' })}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleDecision(rejectModal.type, rejectModal.id, 'REJECTED', rejectModal.reason)
                }
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold text-sm shadow-md cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}