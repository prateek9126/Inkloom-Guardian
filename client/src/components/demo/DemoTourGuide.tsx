import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Compass,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  UserCheck,
  ExternalLink,
  Minimize2,
  Maximize2,
  X,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DemoWalkthroughStep, DemoStatus } from '../../types';

export const DemoTourGuide: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, switchDemoRole, setAuthSession } = useAuth();

  const [steps, setSteps] = useState<DemoWalkthroughStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(() => {
    const saved = localStorage.getItem('inkloom_demo_step');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return localStorage.getItem('inkloom_demo_open') !== 'false';
  });
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Load walkthrough steps and demo status
  useEffect(() => {
    let mounted = true;
    const fetchTourData = async () => {
      try {
        const [stepsRes, statusRes] = await Promise.all([
          api.getDemoWalkthroughSteps(),
          api.getDemoStatus(),
        ]);
        if (mounted) {
          if (stepsRes.steps) setSteps(stepsRes.steps);
          if (statusRes.data) setDemoStatus(statusRes.data);
        }
      } catch (err) {
        console.error('Failed to load demo tour data:', err);
      }
    };
    fetchTourData();
    return () => {
      mounted = false;
    };
  }, []);

  const currentStep = steps[currentStepIdx] || null;

  const handleSetStep = (idx: number) => {
    if (idx >= 0 && idx < steps.length) {
      setCurrentStepIdx(idx);
      localStorage.setItem('inkloom_demo_step', idx.toString());
      const nextStep = steps[idx];
      if (nextStep && location.pathname !== nextStep.route) {
        navigate(nextStep.route);
      }
    }
  };

  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      handleSetStep(currentStepIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      handleSetStep(currentStepIdx - 1);
    }
  };

  const handleRoleSwitch = async (role: string) => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await switchDemoRole(role);
      setFeedbackMsg(`Switched to ${res.user.full_name} (${res.user.role})`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg(`Switch failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (
      !window.confirm(
        'Reset the VOLTERRA demonstration environment back to pristine hackathon baseline?\n\nThis will restore all deliberate contradictions, certified evidence sources, and review records.'
      )
    ) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.resetDemo();
      setAuthSession(res.auth.token, res.auth.user);
      setDemoStatus(res.demoStatus);
      handleSetStep(0);
      setFeedbackMsg('VOLTERRA demo environment restored to initial pristine state.');
      setTimeout(() => setFeedbackMsg(null), 4000);
      window.location.reload();
    } catch (err: any) {
      setFeedbackMsg(`Reset failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTour = async () => {
    setIsLoading(true);
    try {
      const res = await api.seedDemo(false);
      setAuthSession(res.auth.token, res.auth.user);
      setDemoStatus(res.demoStatus);
      handleSetStep(0);
      setIsOpen(true);
      setIsMinimized(false);
      localStorage.setItem('inkloom_demo_open', 'true');
      navigate('/dashboard');
      setFeedbackMsg('Volterra CleanTech EV demo workspace loaded.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      setFeedbackMsg(`Initialization failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem('inkloom_demo_open', next.toString());
  };

  // If user is not yet logged into demo org or closed
  const isVolterraUser = user?.email?.includes('@volterra.demo') || user?.org_slug === 'volterra-demo';

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
            localStorage.setItem('inkloom_demo_open', 'true');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-full shadow-lg border border-slate-700 text-xs font-semibold tracking-wide transition-all transform hover:scale-105"
        >
          <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
          <span>Judge Interactive Tour</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
            {currentStepIdx + 1}/12
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 pointer-events-auto">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200">
          {/* Top Bar / Header */}
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Compass className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs tracking-wide uppercase text-slate-200">
                    Judge Interactive Tour
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    VOLTERRA EV SCENARIO
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {feedbackMsg && (
                <span className="hidden md:inline px-2.5 py-1 rounded bg-slate-800 text-emerald-300 border border-slate-700 text-[11px] animate-fade-in font-mono">
                  {feedbackMsg}
                </span>
              )}

              {/* Persona Switcher Quick Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 text-[11px] hidden sm:inline">Role:</span>
                <select
                  aria-label="Switch Persona"
                  value={user?.role || 'compliance_officer'}
                  onChange={(e) => handleRoleSwitch(e.target.value)}
                  disabled={isLoading}
                  className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
                >
                  <option value="compliance_officer" className="bg-slate-900 text-white">
                    Compliance Officer (Elena)
                  </option>
                  <option value="brand_manager" className="bg-slate-900 text-white">
                    Brand Manager (Marcus)
                  </option>
                  <option value="content_creator" className="bg-slate-900 text-white">
                    Content Creator (Chloe)
                  </option>
                  <option value="admin" className="bg-slate-900 text-white">
                    Admin (Alexander)
                  </option>
                </select>
              </div>

              {/* Reset Demo Button */}
              <button
                onClick={handleResetDemo}
                disabled={isLoading}
                title="Reset VOLTERRA scenario to original baseline"
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Reset Demo</span>
              </button>

              {/* Minimize / Maximize */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand Tour Bar' : 'Minimize Tour Bar'}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Close Tour */}
              <button
                onClick={toggleOpen}
                title="Close Tour Widget"
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Body (collapsible when minimized) */}
          {!isMinimized && currentStep && (
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Step Info */}
                <div className="lg:col-span-8">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-900 text-white">
                      Step {currentStep.step} of {steps.length}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                      {currentStep.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700 uppercase font-mono">
                      Expected Role: {currentStep.role.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                    {currentStep.summary}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-start gap-1.5 p-2 rounded bg-amber-50/80 border border-amber-200/80 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">Deliberate Contradiction:</span>{' '}
                        <span>{currentStep.deliberateIssue}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 p-2 rounded bg-blue-50/80 border border-blue-200/80 text-blue-900">
                      <FileCheck2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">Ground Truth Evidence:</span>{' '}
                        <span>{currentStep.evidenceSource}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Actions & Navigation */}
                <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2 items-stretch lg:items-end justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200">
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <button
                      onClick={() => navigate(currentStep.route)}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      <span>Jump to Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {user?.role !== currentStep.role && (
                      <button
                        onClick={() => handleRoleSwitch(currentStep.role)}
                        disabled={isLoading}
                        title={`Switch role to ${currentStep.role}`}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>Switch Persona</span>
                      </button>
                    )}
                  </div>

                  {/* Step Stepper pagination */}
                  <div className="flex items-center justify-between gap-1 w-full lg:w-auto">
                    <button
                      onClick={handlePrev}
                      disabled={currentStepIdx === 0 || isLoading}
                      className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
                      title="Previous Step"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Quick Step Indicators */}
                    <div className="flex items-center gap-1 overflow-x-auto px-1 py-0.5 max-w-[200px] scrollbar-none">
                      {steps.map((s, idx) => (
                        <button
                          key={s.step}
                          onClick={() => handleSetStep(idx)}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            idx === currentStepIdx
                              ? 'bg-slate-900 ring-2 ring-emerald-500 ring-offset-1 w-4'
                              : idx < currentStepIdx
                              ? 'bg-emerald-500'
                              : 'bg-slate-300 hover:bg-slate-400'
                          }`}
                          title={`Step ${s.step}: ${s.title}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleNext}
                      disabled={currentStepIdx === steps.length - 1 || isLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition"
                      title="Next Step"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed state row */}
          {isMinimized && currentStep && (
            <div className="px-4 py-2 bg-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800">
                  Step {currentStep.step}/12:
                </span>
                <span className="text-slate-700 font-medium truncate max-w-md">
                  {currentStep.title}
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-500 hidden sm:inline">{currentStep.route}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(currentStep.route)}
                  className="text-xs text-slate-700 font-medium hover:underline flex items-center gap-1"
                >
                  <span>Go</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentStepIdx === steps.length - 1}
                  className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] hover:bg-slate-800 disabled:opacity-40"
                >
                  Next Step &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
