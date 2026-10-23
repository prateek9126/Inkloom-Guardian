import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Shield, ArrowRight, UserCheck, ShieldCheck, PenTool, Sparkles, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/demo/DemoBadge';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const { login, demoLogin, setAuthSession } = useAuth();
  const { error, success } = useNotification();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const handleLaunchJudgeTour = async () => {
    setDemoLoading('volterra_tour');
    try {
      const res = await api.seedDemo(false);
      setAuthSession(res.auth.token, res.auth.user);
      localStorage.setItem('inkloom_demo_open', 'true');
      localStorage.setItem('inkloom_demo_step', '0');
      success('Logged in as Lead Regulatory Compliance for VOLTERRA demo scenario.');
      navigate('/dashboard');
    } catch (err: any) {
      error(err.message || 'Failed to start demo.');
    } finally {
      setDemoLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      error('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      success('Authenticated successfully.');
      navigate('/dashboard');
    } catch (err: any) {
      error(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async (role: string, name: string) => {
    setDemoLoading(role);
    try {
      await demoLogin(role);
      success(`Authenticated as ${name}`);
      navigate('/dashboard');
    } catch (err: any) {
      error(err.message || 'Demo login failed.');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign in to Inkloom Guardian
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Brand Governance & Risk Intelligence Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-lg sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Enterprise Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full mt-2">
              Sign In with Corporate Credentials
            </Button>
          </form>

          {/* Quick Demonstration Login Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Judge & Demonstration Access
              </span>
              <DemoBadge label="VOLTERRA EV" />
            </div>

            {/* 1-Click Judge Tour Launch Button */}
            <button
              type="button"
              disabled={!!demoLoading}
              onClick={handleLaunchJudgeTour}
              className="w-full mb-3 flex items-center justify-center gap-2 p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Launch 1-Click Interactive Judge Tour</span>
            </button>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={!!demoLoading}
                onClick={() => handleDemo('admin', 'Eleanor Vance (Admin)')}
                className="flex items-center space-x-2 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-slate-700 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Admin</div>
                  <div className="text-[10px] text-slate-500">Eleanor Vance</div>
                </div>
              </button>

              <button
                type="button"
                disabled={!!demoLoading}
                onClick={() => handleDemo('compliance_officer', 'David Sterling (Compliance)')}
                className="flex items-center space-x-2 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-left transition-colors"
              >
                <UserCheck className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Compliance</div>
                  <div className="text-[10px] text-slate-500">David Sterling</div>
                </div>
              </button>

              <button
                type="button"
                disabled={!!demoLoading}
                onClick={() => handleDemo('brand_manager', 'Sarah Jenkins (Brand Manager)')}
                className="flex items-center space-x-2 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-left transition-colors"
              >
                <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Brand Mgr</div>
                  <div className="text-[10px] text-slate-500">Sarah Jenkins</div>
                </div>
              </button>

              <button
                type="button"
                disabled={!!demoLoading}
                onClick={() => handleDemo('content_creator', 'Marcus Hayes (Creator)')}
                className="flex items-center space-x-2 p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-left transition-colors"
              >
                <PenTool className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Writer</div>
                  <div className="text-[10px] text-slate-500">Marcus Hayes</div>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Need a new enterprise tenant?{' '}
              <Link to="/register" className="font-semibold text-slate-900 hover:underline">
                Register Organization
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
