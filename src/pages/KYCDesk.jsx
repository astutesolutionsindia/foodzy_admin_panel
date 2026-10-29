import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, FileText, Loader2 } from 'lucide-react';
import api from '../config/api';
import { initSocket, disconnectSocket } from '../config/socket';

export default function KYCDesk() {
  const [data, setData] = useState({ riders: [], restaurants: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RESTAURANTS');
  const [docModal, setDocModal] = useState({ isOpen: false, url: '', title: '' });

  const fetchKYC = async () => {
    try {
      const res = await api.get('/admin/kyc/pending');
      setData(res.data || { riders: [], restaurants: [] });
    } catch (err) {
      console.error('Failed to fetch KYC data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKYC();

    const socket = initSocket();
    socket.on('kycQueueUpdated', () => fetchKYC());

    return () => disconnectSocket();
  }, []);

  const handleDecision = async (type, id, decision) => {
    const reason =
      decision === 'REJECTED' ? prompt('Enter rejection reason (sent to partner):') : null;
    if (decision === 'REJECTED' && !reason) return;

    try {
      if (type === 'RESTAURANT') {
        await api.put(`/admin/kyc/restaurant/${id}`, { decision, rejectionReason: reason });
      } else {
        await api.put(`/admin/kyc/rider/${id}`, { decision, rejectionReason: reason });
      }
      fetchKYC();
    } catch (err) {
      alert('Action failed. Check console.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  const renderDocButton = (label, base64Url) => {
    if (!base64Url) return <span className="text-xs text-gray-400 italic">Not uploaded</span>;
    return (
      <button
        onClick={() => setDocModal({ isOpen: true, url: base64Url, title: label })}
        className="flex items-center text-sm text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-md cursor-pointer"
      >
        <FileText className="w-4 h-4 mr-2" /> View {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">KYC Verification Desk</h2>
        <p className="text-gray-500">
          Review and approve partner PDF & photo compliance documents.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('RESTAURANTS')}
          className={`pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'RESTAURANTS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Restaurants (
          {data.restaurants.filter((r) => r.status === 'PENDING_VERIFICATION').length} Pending)
        </button>
        <button
          onClick={() => setActiveTab('RIDERS')}
          className={`pb-3 px-4 font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'RIDERS'
              ? 'border-b-2 border-brand text-brand'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Riders ({data.riders.filter((r) => r.approval_status === 'PENDING').length} Pending)
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'RESTAURANTS' && (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 font-medium">Partner Info</th>
                <th className="p-4 font-medium">Documents</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.restaurants.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <p className="font-semibold text-gray-800">{r.restaurant_name}</p>
                    <p className="text-sm text-gray-500">{r.phone_number}</p>
                  </td>
                  <td className="p-4 space-y-2">
                    {renderDocButton('FSSAI License', r.fssai_doc)}
                    {renderDocButton('Registration', r.registration_doc)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        r.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : r.status === 'PENDING_VERIFICATION'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 flex space-x-2">
                    {r.status === 'PENDING_VERIFICATION' && (
                      <>
                        <button
                          onClick={() => handleDecision('RESTAURANT', r.id, 'ACTIVE')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDecision('RESTAURANT', r.id, 'REJECTED')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'RIDERS' && (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 font-medium">Rider Info</th>
                <th className="p-4 font-medium">Documents</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.riders.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    <p className="font-semibold text-gray-800">{r.full_name}</p>
                    <p className="text-sm text-gray-500">{r.phone_number}</p>
                  </td>
                  <td className="p-4 space-y-2">
                    {renderDocButton('Driving License', r.driving_license_doc)}
                    {renderDocButton('Bike RC', r.bike_registration_doc)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        r.approval_status === 'ACTIVE' || r.approval_status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : r.approval_status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.approval_status}
                    </span>
                  </td>
                  <td className="p-4 flex space-x-2">
                    {r.approval_status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleDecision('RIDER', r.id, 'APPROVED')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDecision('RIDER', r.id, 'REJECTED')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Document Viewer Modal */}
      {docModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg">{docModal.title}</h3>
              <button
                onClick={() => setDocModal({ isOpen: false, url: '', title: '' })}
                className="text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex justify-center bg-gray-50">
              {docModal.url.includes('application/pdf') ? (
                <iframe src={docModal.url} className="w-full h-[600px] border-0 rounded-lg" />
              ) : (
                <img
                  src={docModal.url}
                  alt="Document"
                  className="max-w-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}