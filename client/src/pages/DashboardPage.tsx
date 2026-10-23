import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { ContentSubmission, AuditLog, DashboardMetrics } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookmarkCheck,
  ShieldAlert,
  ArrowRight,
  FileText,
  Activity,
  Layers,
  Sparkles,
  GitBranch,
  UserCheck,
  ShieldCheck,
  Compass,
  RotateCcw,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { setAuthSession } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<ContentSubmission[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoActionLoading, setIsDemoActionLoading] = useState(false);

  const handleLaunchJudgeTour = async () => {
    setIsDemoActionLoading(true);
    try {
      const res = await api.seedDemo(false);
      setAuthSession(res.auth.token, res.auth.user);
      localStorage.setItem('inkloom_demo_open', 'true');
      localStorage.setItem('inkloom_demo_step', '0');
      window.location.reload();
    } catch (err) {
      console.error('Failed to launch judge tour:', err);
    } finally {
      setIsDemoActionLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset the VOLTERRA demo environment back to original baseline state?')) return;
    setIsDemoActionLoading(true);
    try {
      const res = await api.resetDemo();
      setAuthSession(res.auth.token, res.auth.user);
      localStorage.setItem('inkloom_demo_open', 'true');
      localStorage.setItem('inkloom_demo_step', '0');
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset demo:', err);
    } finally {
      setIsDemoActionLoading(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await api.getDashboardStats();
        setMetrics(data.metrics);
        setRecentSubmissions(data.recentSubmissions);
        setRecentActivity(data.recentActivity);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2 text-sm text-slate-500">
          <svg className="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Querying database metrics...</span>
        </div>
      </div>
    );
  }

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="critical">Critical Risk</Badge>;
      case 'high':
        return <Badge variant="danger">High Risk</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="success">Low Risk</Badge>;
      default:
        return <Badge variant="neutral">{level}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'ready_for_review':
      case 'pending_review':
        return <Badge variant="warning">Ready for Review</Badge>;
      case 'needs_revision':
      case 'revision_requested':
        return <Badge variant="danger">Needs Revision</Badge>;
      case 'analysis_pending':
        return <Badge variant="info">Analysis Pending</Badge>;
      case 'analysis_complete':
        return <Badge variant="neutral">Analysis Complete</Badge>;
      case 'draft':
        return <Badge variant="neutral">Draft</Badge>;
      case 'rejected':
        return <Badge variant="critical">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Demonstration Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Governance Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real database metrics for active content assets, verified citations, and pending compliance approvals.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link to="/claim-verification">
            <Button size="sm" variant="secondary" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}>
              Claim Verification Engine
            </Button>
          </Link>
          <Link to="/submissions/new">
            <Button size="sm" icon={<FileText className="w-3.5 h-3.5" />}>
              Submit New Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Interactive Hackathon Judge Tour Hero Card */}
      <div className="bg-slate-900 rounded-xl p-5 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Hackathon Judge Evaluation
              </span>
              <DemoBadge label="VOLTERRA EV SCENARIO" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Interactive 12-Step Brand Governance & Risk Intelligence Tour
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Experience the end-to-end platform using clean-tech EV battery manufacturer <strong>VOLTERRA</strong>. 
              Walk through deliberate cross-asset price contradictions ($5,800 vs $6,200), unverified cycle claims (1,800 vs certified 1,200), 
              deterministic explainable risk scoring (88/100, Critical), and immutable human sign-off workflows in 3-5 minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={handleLaunchJudgeTour}
              disabled={isDemoActionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
              icon={<Compass className="w-4 h-4 text-emerald-200" />}
            >
              Start Interactive Tour
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetDemo}
              disabled={isDemoActionLoading}
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              icon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
            >
              Reset Demo Baseline
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting Review</span>
            <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {metrics?.pendingReviewsCount || 0}
            </span>
            <span className="text-xs text-slate-500">Assets</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requiring legal or brand sign-off</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified Claims</span>
            <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookmarkCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {metrics?.verifiedClaimsCount || 0}
            </span>
            <span className="text-xs text-slate-500">Substantiated</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Backed by certified primary evidence</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unresolved Issues</span>
            <div className="w-7 h-7 rounded bg-red-50 text-red-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {metrics?.unresolvedIssuesCount || 0}
            </span>
            <span className="text-xs text-slate-500">Violations</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Detected policy or claim discrepancies</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Campaigns</span>
            <div className="w-7 h-7 rounded bg-sky-50 text-sky-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {metrics?.activeCampaignsCount || 0}
            </span>
            <span className="text-xs text-slate-500">Initiatives</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Monitored for message consistency</p>
        </div>
      </div>

      {/* Human Approval Lifecycle Stage Summary Bar */}
      {metrics?.lifecycleBreakdown && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <span>Approval Workflow Stages:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link to="/review-approval?status=ready_for_review" className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Ready for Review:</span>
                <span className="font-bold font-mono">{metrics.lifecycleBreakdown.readyForReview}</span>
              </Link>
              <Link to="/review-approval?status=needs_revision" className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 transition-colors">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Needs Revision:</span>
                <span className="font-bold font-mono">{metrics.lifecycleBreakdown.needsRevision}</span>
              </Link>
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Analysis Complete:</span>
                <span className="font-bold font-mono">{metrics.lifecycleBreakdown.analysisComplete}</span>
              </span>
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Approved:</span>
                <span className="font-bold font-mono">{metrics.lifecycleBreakdown.approved}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Row: Recent Content Submissions & Risk Severity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Submissions Table */}
        <div className="lg:col-span-8">
          <Card
            title="Recent Content Submissions"
            subtitle="Live status, revision versions, risk scores, and review state of marketing assets"
            actions={
              <Link to="/submissions" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center space-x-1">
                <span>View All Submissions</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            {recentSubmissions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Submissions Found"
                description="Upload a marketing draft, press release, or document to initiate risk and claim verification."
                actionText="Create First Submission"
                onAction={() => window.location.href = '/submissions/new'}
              />
            ) : (
              <div className="overflow-x-auto -mx-5 -my-5">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Title / Channel</th>
                      <th className="py-3 px-4">Lifecycle Status</th>
                      <th className="py-3 px-4">Risk Level</th>
                      <th className="py-3 px-4">Author / Reviewer</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {recentSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex items-center space-x-1.5 mb-0.5">
                            <Link to={`/risk-analysis?contentId=${sub.id}`} className="font-semibold text-slate-900 hover:underline truncate">
                              {sub.title}
                            </Link>
                            <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-200">
                              <GitBranch className="w-2.5 h-2.5 mr-0.5 text-slate-500" />
                              v{sub.current_version || 1}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">{sub.channel}</span>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(sub.status)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {getRiskBadge(sub.risk_level)}
                            <span className="text-[11px] font-mono text-slate-500">
                              {sub.risk_score}/100
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="truncate max-w-[120px] font-medium text-slate-800">{sub.author_name || 'Marketing'}</div>
                          {sub.reviewer_name && (
                            <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <UserCheck className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[100px]">{sub.reviewer_name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {sub.status === 'ready_for_review' || sub.status === 'pending_review' ? (
                            <Link
                              to="/review-approval"
                              className="inline-flex items-center text-xs font-semibold text-amber-800 hover:text-amber-900 border border-amber-300 rounded px-2 py-1 bg-amber-50 hover:bg-amber-100 transition-colors"
                            >
                              Review & Sign
                            </Link>
                          ) : (
                            <Link
                              to={`/risk-analysis?contentId=${sub.id}`}
                              className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50 transition-colors"
                            >
                              Risk Report
                            </Link>
                          )}
                          <Link
                            to={`/claim-verification?contentId=${sub.id}`}
                            className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50 transition-colors"
                            title="Verify Claims"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Risk Distribution Breakdown */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Risk Severity Distribution" subtitle="Active content risk categorization">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span> Critical Risk
                  </span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {metrics?.riskBreakdown?.critical || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.riskBreakdown?.critical || 0) / (recentSubmissions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span> High Risk
                  </span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {metrics?.riskBreakdown?.high || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-amber-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.riskBreakdown?.high || 0) / (recentSubmissions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium Risk
                  </span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {metrics?.riskBreakdown?.medium || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.riskBreakdown?.medium || 0) / (recentSubmissions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Low / Compliant
                  </span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {metrics?.riskBreakdown?.low || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((metrics?.riskBreakdown?.low || 0) / (recentSubmissions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold block text-slate-800 mb-1">Zero-Fabrication Guarantee:</span>
              Claims are verified only against primary source documents. When evidence is ambiguous or expired, human legal review is mandated.
            </div>
          </Card>

          {/* Quick Links */}
          <div className="bg-slate-900 text-white p-5 rounded-lg shadow-sm">
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Evidence Verification Engine
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Inspect claims extracted across campaigns and cross-reference exact passages in the Evidence Sources Library.
            </p>
            <Link to="/claim-verification">
              <Button size="sm" variant="secondary" className="w-full text-xs">
                Open Claim Inspector
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* System Audit Activity Feed */}
      <Card
        title="Live System Audit Activity"
        subtitle="Chronological trail of guideline adjustments, scan results, and human decisions"
        actions={
          <Link to="/audit" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center space-x-1">
            <span>Audit Trail Log</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        }
      >
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Activity Recorded"
            description="System activity and review decisions will automatically appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {recentActivity.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <div>
                    <span className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500 ml-2">by {log.user_name || 'System Engine'}</span>
                  </div>
                </div>
                <div className="text-slate-400 text-[11px] font-mono">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
