import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center text-brand">
        <span className="animate-pulse font-bold text-xl">Loading Foodzy Admin...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Temporary Dashboard Placeholder
const DashboardTemp = () => {
  const { user, logout } = useContext(AuthContext);
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to the Dashboard</h1>
      <p className="mb-4">Logged in as: <strong>{user.role_type}</strong> ({user.phone_number})</p>
      <button onClick={logout} className="px-6 py-2 bg-brand text-white rounded-lg">Logout</button>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardTemp />
          </ProtectedRoute>
        } 
      />
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