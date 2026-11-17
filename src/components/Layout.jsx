import { useContext, useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileCheck, Map, Users, Trophy, Star, Sparkles, UtensilsCrossed,
  Image as ImageIcon, BadgeDollarSign, Archive, ShieldAlert, LogOut, Package, BellRing, LifeBuoy
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../config/socket';
import api from '../config/api';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [pendingPriceCount, setPendingPriceCount] = useState(0);
  const [openIssuesCount, setOpenIssuesCount] = useState(0);

  const fetchPendingPricesCount = useCallback(async () => {
    if (!user) return;
    try {
      const [res, issuesRes] = await Promise.all([
        api.get('/admin/menu/pending-prices').catch(() => ({ data: [] })),
        api.get('/support/issues').catch(() => ({ data: [] }))
      ]);
      const issuesList = Array.isArray(issuesRes.data) ? issuesRes.data : [];
      setOpenIssuesCount(issuesList.filter((i) => i.status !== 'RESOLVED').length);
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setPendingPriceCount(list.length);
    } catch {
      // Graceful fallback until backend route is live
    }
  }, [user]);

  useEffect(() => {
    fetchPendingPricesCount();
    const timer = setInterval(fetchPendingPricesCount, 25000);

    const socket = initSocket();
    if (socket) {
      socket.on('menuPriceApprovalRequested', fetchPendingPricesCount);
      socket.on('menuUpdated', fetchPendingPricesCount);
    }

    const handleCustomRefresh = () => fetchPendingPricesCount();
    window.addEventListener('foodzyMenuApprovalUpdated', handleCustomRefresh);

    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('menuPriceApprovalRequested', fetchPendingPricesCount);
        socket.off('menuUpdated', fetchPendingPricesCount);
      }
      window.removeEventListener('foodzyMenuApprovalUpdated', handleCustomRefresh);
    };
  }, [fetchPendingPricesCount]);

  const ALL_NON_FINANCE = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN', 'TECH_SUPPORT'];
  const navItems = [
    { name: 'Command Center', path: '/', icon: LayoutDashboard, roles: ALL_NON_FINANCE },
    { name: 'Top-5 Leaderboard', path: '/leaderboard', icon: Trophy, roles: ALL_NON_FINANCE },
    { name: 'Reviews & Ratings', path: '/reviews', icon: Star, roles: ALL_NON_FINANCE },
    { name: 'Menu & Price Control', path: '/menu-manager', icon: UtensilsCrossed, roles: ALL_NON_FINANCE, badge: pendingPriceCount },
    { name: 'KYC Desk', path: '/kyc', icon: FileCheck, roles: ALL_NON_FINANCE },
    { name: 'Live Orders', path: '/orders', icon: Map, roles: ALL_NON_FINANCE },
    { name: 'Directory & Edit', path: '/directory', icon: Users, roles: ALL_NON_FINANCE },
    { name: 'Packaging Store', path: '/packaging', icon: Package, roles: ALL_NON_FINANCE },
    { name: 'Push Notifications', path: '/push-notifications', icon: BellRing, roles: ALL_NON_FINANCE },
    { name: 'Issue Resolution Desk', path: '/support-desk', icon: LifeBuoy, roles: ALL_NON_FINANCE, badge: openIssuesCount },
    { name: 'Promotions', path: '/promotions', icon: Sparkles, roles: ALL_NON_FINANCE },
    { name: 'App CMS', path: '/cms', icon: ImageIcon, roles: ALL_NON_FINANCE },
    { name: 'Finance Console', path: '/finance', icon: BadgeDollarSign, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'] },
    { name: 'Financial Archive', path: '/finance-archive', icon: Archive, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'] },
    { name: 'Super Admin Team', path: '/team', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
  ];

  return (
    <div className="flex h-screen bg-light">
      <div className="w-64 bg-dark text-white flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <img
            src="/foodzy-logo.png"
            alt="Foodzy Logo"
            className="w-11 h-11 object-contain rounded-xl bg-white/10 p-1 shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none">
              foodzy <span className="text-emerald-400">admin</span>
            </h1>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
              {user?.role_type?.replace('_', ' ') || 'SUPER ADMIN'}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1.5 mt-3 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.roles.includes(user?.role_type)) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-brand text-white font-semibold shadow-lg shadow-brand/25'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center min-w-0">
                  <Icon className="w-4 h-4 mr-3 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] font-black rounded-full bg-red-500 text-white animate-pulse shrink-0">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center w-full px-3.5 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        {children}
      </div>
    </div>
  );
}
