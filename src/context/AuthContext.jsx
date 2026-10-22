import { createContext, useState, useEffect } from 'react';
import api from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        try {
          const res = await api.get('/admin/me');
          setUser(res.data.admin);
        } catch (error) {
          console.error('Session expired or unauthorized');
          localStorage.removeItem('adminToken');
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('adminToken', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};