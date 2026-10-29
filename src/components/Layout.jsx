import { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileCheck, Map, Users, 
  Image as ImageIcon, BadgeDollarSign, ShieldAlert, LogOut 
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  const navItems = [
    { name: 'Command Center', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'KYC Desk', path: '/kyc', icon: FileCheck, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Live Orders', path: '/orders', icon: Map, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Directory', path: '/directory', icon: Users, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'App CMS', path: '/cms', icon: ImageIcon, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FIELD_ADMIN'] },
    { name: 'Finance Console', path: '/finance', icon: BadgeDollarSign, roles: ['SUPER_ADMIN', 'FINANCE_ADMIN'] },
    { name: 'Super Admin Team', path: '/team', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
  ];

  return (
    <div className="flex h-screen bg-light">
      {/* Sidebar */}
      <div className="w-64 bg-dark text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-black text-white tracking-tight">
            foodzy <span className="text-emerald-400">admin</span>
          </h1>
          <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
            {user?.role_type?.replace('_', ' ') || 'SUPER ADMIN'}
          </p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.roles.includes(user?.role_type)) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-brand text-white font-semibold shadow-lg shadow-brand/25'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={logout}
            className="flex items-center w-full px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        {children}
      </div>
    </div>
  );
}