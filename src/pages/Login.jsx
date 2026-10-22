import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Phone, KeyRound, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';

export default function Login() {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phoneNumber: phone });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { 
        phoneNumber: phone, 
        code: otp 
      });
      
      const userRole = res.data.user.role_type;
      if (['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'].includes(userRole)) {
        login(res.data.token, res.data.user);
        navigate('/'); // Instantly pushes the user to the Command Center
      } else {
        setError('Access Denied. You do not have Admin privileges.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark text-light p-4">
      <div className="w-full max-w-md bg-white text-dark rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-brand" />
          </div>
          <h2 className="text-2xl font-bold">Foodzy Admin Portal</h2>
          <p className="text-gray-500 text-sm mt-1">Authorized personnel only</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center border border-red-200">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
                  placeholder="+919876543210"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-3 rounded-xl font-semibold hover:bg-brand/90 transition-all flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP sent to {phone}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all tracking-widest text-lg"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-dark text-white py-3 rounded-xl font-semibold hover:bg-dark/90 transition-all flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Secure Login'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-gray-500 text-sm hover:text-dark transition-colors cursor-pointer"
            >
              Use a different phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}