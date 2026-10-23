import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Shield, User as UserIcon, LogOut, ChevronDown, Check, RefreshCw, Compass } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoBadge } from '../demo/DemoBadge';

export const Header: React.FC = () => {
  const { user, logout, switchDemoRole } = useAuth();
  const { info, success, error } = useNotification();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDemoMenuOpen, setIsDemoMenuOpen] = useState(false);

  const isDemoOrg = user?.email?.includes('@volterra.demo') || user?.org_slug === 'volterra-demo';

  const handleDemoSwitch = async (role: string, name: string) => {
    try {
      await switchDemoRole(role);
      setIsDemoMenuOpen(false);
      success(`Switched active session to: ${name}`);
      navigate('/dashboard');
    } catch (err: any) {
      error(`Failed to switch role: ${err.message}`);
    }
  };

  const handleOpenJudgeTour = () => {
    localStorage.setItem('inkloom_demo_open', 'true');
    window.dispatchEvent(new Event('storage'));
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    info('Logged out successfully.');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-6">
      {/* Brand / Logo */}
      <div className="flex items-center space-x-3">
        <Link to="/dashboard" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-base tracking-tight leading-none block">
              Inkloom Guardian
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
              Brand Governance & Risk Intelligence
            </span>
          </div>
        </Link>

        {isDemoOrg && (
          <div className="hidden sm:flex items-center ml-2">
            <DemoBadge label="VOLTERRA DEMO" />
          </div>
        )}
      </div>

      {/* Right Controls: Judge Tour, Role Switcher, Organization Tag, User Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Judge Interactive Tour Trigger */}
        <button
          onClick={handleOpenJudgeTour}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-xs"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>Judge Tour</span>
        </button>

        {/* Role Switcher for Demonstration Verification */}
        <div className="relative">
          <button
            onClick={() => setIsDemoMenuOpen(!isDemoMenuOpen)}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-slate-500" />
            <span className="hidden sm:inline">Role:</span>
            <strong className="text-slate-900 capitalize text-xs">
              {user?.role?.replace('_', ' ')}
            </strong>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isDemoMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                <span className="font-semibold text-slate-800 block">Demonstration Role Switcher</span>
                <span className="text-[11px] text-slate-500">
                  Switch instantly between Volterra governance personas
                </span>
              </div>
              <button
                onClick={() =>
                  handleDemoSwitch('compliance_officer', 'Dr. Elena Vance (Lead Regulatory Compliance)')
                }
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <div>
                  <div className="font-medium text-slate-900">Dr. Elena Vance (Compliance)</div>
                  <div className="text-[10px] text-slate-500">Lead Regulatory Counsel & Signatory</div>
                </div>
                {user?.role === 'compliance_officer' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() =>
                  handleDemoSwitch('brand_manager', 'Marcus Sterling (Global Brand Director)')
                }
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <div>
                  <div className="font-medium text-slate-900">Marcus Sterling (Brand Director)</div>
                  <div className="text-[10px] text-slate-500">Tone Policy & Guideline Steward</div>
                </div>
                {user?.role === 'brand_manager' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() =>
                  handleDemoSwitch('content_creator', 'Chloe Bennett (Lead Technical Copywriter)')
                }
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <div>
                  <div className="font-medium text-slate-900">Chloe Bennett (Copywriter)</div>
                  <div className="text-[10px] text-slate-500">Ad & Campaign Content Creator</div>
                </div>
                {user?.role === 'content_creator' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() =>
                  handleDemoSwitch('admin', 'Alexander Shaw (Chief Executive Administrator)')
                }
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <div>
                  <div className="font-medium text-slate-900">Alexander Shaw (Admin)</div>
                  <div className="text-[10px] text-slate-500">Organization Settings & Policy Sign-off</div>
                </div>
                {user?.role === 'admin' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-slate-100 transition-colors focus:outline-none"
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-xs border border-slate-300">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <span className="text-xs font-medium text-slate-800 hidden md:inline-block max-w-[140px] truncate">
              {user?.full_name?.split(' ')[0]}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-medium text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded font-medium capitalize">
                    {user?.role?.replace('_', ' ')}
                  </span>
                  {isDemoOrg && <DemoBadge variant="outline" label="DEMO" />}
                </div>
              </div>
              <Link
                to="/settings"
                onClick={() => setIsUserMenuOpen(false)}
                className="block px-3 py-2 text-slate-700 hover:bg-slate-50"
              >
                Organization & Policy Settings
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center space-x-1.5 border-t border-slate-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
