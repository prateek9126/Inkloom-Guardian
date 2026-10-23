import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Layers,
  BookmarkCheck,
  ShieldAlert,
  Crosshair,
  AlertTriangle,
  UserCheck,
  History,
  Settings,
  FileCode,
  Sparkles,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Content Submissions', to: '/submissions', icon: FileText },
    { label: 'Claim Verification', to: '/claim-verification', icon: CheckCircle2, badge: 'Core' },
    { label: 'Evidence Sources', to: '/evidence-sources', icon: Layers },
    { label: 'Approved Claims', to: '/claims', icon: BookmarkCheck },
    { label: 'Brand Guidelines', to: '/guidelines', icon: ShieldAlert },
    { label: 'Policy Learning', to: '/policy-learning', icon: Sparkles, badge: 'Adaptive' },
    { label: 'Campaign Workspace', to: '/campaigns', icon: Crosshair },
    { label: 'Risk Analysis', to: '/risk-reports', icon: AlertTriangle },
    { label: 'Human Review Center', to: '/reviews', icon: UserCheck },
    { label: 'Audit History', to: '/audit', icon: History },
    { label: 'Settings & Team', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 select-none">
      <div className="py-4 px-3 overflow-y-auto">
        <div className="px-3 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Governance Platform
          </span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <div className="flex items-center space-x-2.5">
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase rounded">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="px-2 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span className="font-medium text-slate-700">Governance Engine</span>
          </span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
            v2.4 Enterprise
          </span>
        </div>
        <div className="px-2 pt-1 flex items-center space-x-3 text-[10px] text-slate-400">
          <NavLink to="/privacy" className="hover:text-slate-600">Privacy Policy</NavLink>
          <span>•</span>
          <NavLink to="/terms" className="hover:text-slate-600">Terms of Service</NavLink>
        </div>
      </div>
    </aside>
  );
};
