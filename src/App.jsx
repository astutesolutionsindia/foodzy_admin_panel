import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import CommandCenter from './pages/CommandCenter';
import KYCDesk from './pages/KYCDesk';
import Directory from './pages/Directory';
import CMS from './pages/CMS';
import Finance from './pages/Finance';
import Team from './pages/Team';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center text-brand">
        <span className="animate-pulse font-bold text-xl">Loading Foodzy Admin...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Wrap the protected screen in our permanent Sidebar layout
  return <Layout>{children}</Layout>;
};

// Temporary placeholder for any future unbuilt screens
const ComingSoon = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[70vh] text-gray-400">
    <h2 className="text-2xl font-bold text-gray-700 mb-2">{title}</h2>
    <p>This module is under construction.</p>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
      <Route path="/kyc" element={<ProtectedRoute><KYCDesk /></ProtectedRoute>} />
      
      {/* Update this import if you have a separate LiveOrders.jsx file, otherwise keep ComingSoon */}
      <Route path="/orders" element={<ProtectedRoute><ComingSoon title="Live Orders Control" /></ProtectedRoute>} />
      
      <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
      <Route path="/cms" element={<ProtectedRoute><CMS /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}