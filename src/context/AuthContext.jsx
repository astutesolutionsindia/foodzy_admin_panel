import { createContext, useState, useEffect } from 'react';
import api from '../config/api';
import { disconnectSocket } from '../config/socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('adminUser');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    const hasToken = Boolean(localStorage.getItem('adminToken'));
    const hasCachedUser = Boolean(localStorage.getItem('adminUser'));
    return hasToken && !hasCachedUser;
  });

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        localStorage.removeItem('adminUser');
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/admin/me');
        if (res.data?.admin) {
          setUser(res.data.admin);
          localStorage.setItem('adminUser', JSON.stringify(res.data.admin));
        }
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminOverviewCache');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};