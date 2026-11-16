import { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileCheck, Map, Users, Trophy, Star, Sparkles,
  Image as ImageIcon, BadgeDollarSign, Archive, ShieldAlert, LogOut
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  const navItems = [
    { name: 'Command Center', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Top-5 Leaderboard', path: '/leaderboard', icon: Trophy, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Reviews & Ratings', path: '/reviews', icon: Star, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'KYC Desk', path: '/kyc', icon: FileCheck, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Live Orders', path: '/orders', icon: Map, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Directory', path: '/directory', icon: Users, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Promotions', path: '/promotions', icon: Sparkles, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'App CMS', path: '/cms', icon: ImageIcon, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
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
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-brand text-white font-semibold shadow-lg shadow-brand/25'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 mr-3 shrink-0" />
                <span className="truncate">{item.name}</span>
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
