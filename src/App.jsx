import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import CommandCenter from './pages/CommandCenter';
import KYCDesk from './pages/KYCDesk';
import LiveOrders from './pages/LiveOrders';
import Directory from './pages/Directory';
import CMS from './pages/CMS';
import Finance from './pages/Finance';
import Team from './pages/Team';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center text-white">
        <span className="animate-pulse font-bold text-xl">Loading Foodzy Super Admin...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
      <Route path="/kyc" element={<ProtectedRoute><KYCDesk /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><LiveOrders /></ProtectedRoute>} />
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