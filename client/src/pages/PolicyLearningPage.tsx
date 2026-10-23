import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp,
  FileText,
  Trash2,
  Edit3,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Lock,
} from 'lucide-react';

export const PolicyLearningPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useNotification();

  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [frequentRules, setFrequentRules] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recurringIssues, setRecurringIssues] = useState<any[]>([]);
  const [approvedExamples, setApprovedExamples] = useState<any[]>([]);
  const [selectedRuleFilter, setSelectedRuleFilter] = useState<string>('');

  // Modals
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Admin Feedback Inspection Modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRecords, setFeedbackRecords] = useState<any[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgingRecordId, setPurgingRecordId] = useState<string | null>(null);

  const isAdminOrBrandManager = user?.role === 'admin' || user?.role === 'brand_manager';

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sumRes, rulesRes, recsRes, issuesRes, examplesRes] = await Promise.all([
        api.getPolicyLearningSummary(),
        api.getFrequentlyViolatedRules(),
        api.getPolicyRecommendations('pending_review'),
        api.getRecurringQualityIssues(),
        api.getApprovedCorrectionExamples(),
      ]);

      setSummary(sumRes);
      setFrequentRules(rulesRes.rules || []);
      setRecommendations(recsRes.recommendations || []);
      setRecurringIssues(issuesRes.issues || []);
      setApprovedExamples(examplesRes.samples || []);
    } catch (err: any) {
      console.error('Failed to load policy learning data:', err);
      error(err.message || 'Could not retrieve policy learning records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateRecommendations = async () => {
    try {
      setIsGeneratingRecs(true);
      const res = await api.generatePolicyRecommendations();
      success(`Generated ${res.generatedCount} candidate policy update(s) based on reviewer feedback patterns.`);
      loadData();
    } catch (err: any) {
      error(err.message || 'Could not generate policy recommendations.');
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  const handleOpenApprovalModal = (candidate: any) => {
    setSelectedCandidate(candidate);
    setReviewNotes(`Approved by ${user?.full_name}. Codified based on high reviewer consensus.`);
    setApprovalModalOpen(true);
  };

  const handleApproveCandidate = async () => {
    if (!selectedCandidate) return;
    try {
      setIsSubmittingDecision(true);
      const res = await api.approvePolicyRecommendation(selectedCandidate.id, reviewNotes);
      success(res.message);
      setApprovalModalOpen(false);
      setSelectedCandidate(null);
      loadData();
    } catch (err: any) {
      error(err.message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleRejectCandidate = async (candidateId: string) => {
    const notes = window.prompt('Please provide a reason for rejecting this candidate policy update:');
    if (notes === null) return;
    try {
      await api.rejectPolicyRecommendation(candidateId, notes || 'Rejected by authorized reviewer.');
      info('The candidate policy recommendation was declined.');
      loadData();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleOpenFeedbackInspector = async () => {
    setFeedbackModalOpen(true);
    try {
      setIsLoadingFeedback(true);
      const res = await api.getReviewerFeedbackRecords({ limit: 50 });
      setFeedbackRecords(res.records);
      setFeedbackTotal(res.total);
    } catch (err: any) {
      error(err.message);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handlePurgeRecord = async (recordId: string) => {
    if (!purgeReason.trim()) {
      alert('Please state a reason for data retention purging (e.g., GDPR 365-day expiration).');
      return;
    }
    try {
      await api.purgeFeedbackRecord(recordId, purgeReason.trim());
      success('Feedback record scrubbed per enterprise data retention policy.');
      setPurgingRecordId(null);
      setPurgeReason('');
      handleOpenFeedbackInspector();
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleFilterExamplesByRule = async (ruleId: string, ruleTitle: string) => {
    setSelectedRuleFilter(ruleTitle);
    try {
      const res = await api.getApprovedCorrectionExamples({ ruleId });
      setApprovedExamples(res.samples);
    } catch (err: any) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2 text-sm text-slate-500">
          <svg className="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading policy learning records & reviewer analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Policy Learning & Feedback Intelligence
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Human-Governed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated learning from human reviewer decisions. Suggests approved correction examples and recommends
            guideline updates with version tracking.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          {user?.role === 'admin' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<History className="w-3.5 h-3.5 text-slate-600" />}
              onClick={handleOpenFeedbackInspector}
            >
              Inspect Feedback Logs
            </Button>
          )}
          {isAdminOrBrandManager && (
            <Button
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
              isLoading={isGeneratingRecs}
              onClick={handleGenerateRecommendations}
            >
              Evaluate Candidate Updates
            </Button>
          )}
        </div>
      </div>

      {/* Governance & Reliability Rules Notice */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800 mb-1">
          <ShieldCheck className="w-4 h-4 text-slate-700" />
          <span>Core Policy Learning Principles & Guardrails:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-0.5">1. No Automatic Policy Changes</span>
            Official guidelines are never modified autonomously. Every candidate update requires explicit approval from an
            authorized administrator.
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-0.5">2. Preference vs. Factual Evidence</span>
            Past human reviewer approvals reflect corporate stylistic conventions and consensus, but do not certify
            factual truth or replace primary source evidence.
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-0.5">3. Confidentiality & Data Retention</span>
            Customer content flagged as confidential is strictly excluded from generic learning. Records can be inspected,
            corrected, or purged per retention policy.
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reviewer Decisions</span>
            <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summary?.total_feedback_records || 0}
            </span>
            <span className="text-xs text-slate-500">Documented</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Accepted, amended, or exception decisions</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommendation Acceptance</span>
            <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summary?.overall_acceptance_rate || 0}%
            </span>
            <span className="text-xs text-emerald-700 font-medium">Consensus</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Reviewers accepted or refined proposals</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Policy Candidates</span>
            <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {recommendations.length}
            </span>
            <span className="text-xs text-amber-700 font-medium">Awaiting Sign-off</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Candidate updates awaiting admin approval</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recurring Quality Issues</span>
            <div className="w-7 h-7 rounded bg-sky-50 text-sky-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {recurringIssues.length}
            </span>
            <span className="text-xs text-slate-500">Pattern Clusters</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Frequent omissions or wording breaches</p>
        </div>
      </div>

      {/* Candidate Policy Recommendations Awaiting Human Approval */}
      <Card
        title="Candidate Policy Updates Awaiting Authorized Approval"
        subtitle="Transparent proposals derived from recurring human decisions. Official guidelines remain unchanged until signed off."
        actions={
          <span className="text-xs text-slate-500 font-mono">
            {recommendations.length} Pending
          </span>
        }
      >
        {recommendations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-800">All Candidate Recommendations Resolved</p>
            <p className="text-slate-400 mt-1">
              Click "Evaluate Candidate Updates" above to analyze recent reviewer feedback for new guideline patterns.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-900">{rec.title}</span>
                    <Badge variant={rec.recommendation_type === 'add_approved_exception' ? 'info' : 'warning'}>
                      {rec.recommendation_type === 'add_approved_exception'
                        ? 'Add Approved Exception'
                        : 'Update Existing Rule'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-500">
                    <span>
                      Violations: <strong className="text-slate-800 font-mono">{rec.violation_frequency}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Acceptance Rate:{' '}
                      <strong className="text-emerald-700 font-mono">{rec.acceptance_rate}%</strong>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>

                {rec.rationale && (
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900 block mb-0.5">Rationale:</span>
                    {rec.rationale}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Proposed on {new Date(rec.created_at).toLocaleDateString()}
                  </span>
                  {isAdminOrBrandManager ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRejectCandidate(rec.id)}
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        icon={<CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        onClick={() => handleOpenApprovalModal(rec)}
                      >
                        Approve & Version Guideline
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Requires Administrator or Brand Manager role to approve
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Main 2-Column Row: Frequently Violated Rules & Recurring Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Frequently Violated Rules */}
        <div className="lg:col-span-7">
          <Card
            title="Frequently Violated Brand Rules"
            subtitle="Violation counts and reviewer decision breakdown"
          >
            {frequentRules.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Rule Violations Logged"
                description="Reviewer feedback and scan violation trends will automatically populate here."
              />
            ) : (
              <div className="overflow-x-auto -mx-5 -my-5">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Rule Title / Category</th>
                      <th className="py-3 px-4 text-center">Violations</th>
                      <th className="py-3 px-4">Acceptance Rate</th>
                      <th className="py-3 px-4 text-right">Examples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {frequentRules.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 max-w-xs">
                          <span className="font-semibold text-slate-900 block truncate">{r.rule_title}</span>
                          <span className="text-[11px] text-slate-500">{r.category}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {r.violation_count}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="font-mono text-slate-700">{r.acceptance_rate_percent}%</span>
                              <span className="text-slate-400 text-[10px]">
                                {r.accepted_corrections_count} acc / {r.exceptions_count} exc
                              </span>
                            </div>
                            <div className="w-24 bg-slate-100 rounded-full h-1.5">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full"
                                style={{ width: `${r.acceptance_rate_percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleFilterExamplesByRule(r.rule_id, r.rule_title)}
                          >
                            Approved Phrasing
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Recurring Content Quality Problems */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            title="Recurring Quality Problems"
            subtitle="Frequent omission and wording patterns detected across drafts"
          >
            {recurringIssues.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No recurring quality patterns detected.
              </div>
            ) : (
              <div className="space-y-3">
                {recurringIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900">{issue.issue_type}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                        {issue.occurrences_count} occurrences
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{issue.pattern_description}</p>
                    {issue.affected_channels && issue.affected_channels.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400">Channels:</span>
                        {issue.affected_channels.map((ch: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px]">
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Approved Human Correction Examples Library */}
      <Card
        title="Approved Correction Phrasing Library (Derived from Reviewer Consensus)"
        subtitle="Stylistic alternatives and phrasing approved by human signatories during past content reviews"
        actions={
          selectedRuleFilter ? (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">
                Filtered: <strong className="text-slate-800">{selectedRuleFilter}</strong>
              </span>
              <button
                onClick={() => {
                  setSelectedRuleFilter('');
                  api.getApprovedCorrectionExamples().then((r) => setApprovedExamples(r.samples));
                }}
                className="text-slate-400 hover:text-slate-700 text-xs underline"
              >
                Clear
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="mb-3 p-2.5 rounded bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Factual Verification Safeguard:</strong> The examples below represent human reviewer stylistic
            preferences and approved corporate tone. They do <strong>not</strong> substitute for primary factual
            evidence or certify claims without primary documentation.
          </span>
        </div>

        {approvedExamples.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No approved examples found for the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedExamples.map((ex, idx) => (
              <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 truncate max-w-[220px]">
                    {ex.rule_title}
                  </span>
                  <Badge variant="success">Approved Phrasing</Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="p-2 rounded bg-rose-50/50 border border-rose-200 text-rose-900 line-through">
                    "{ex.original_text}"
                  </div>
                  <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 text-emerald-900 font-medium">
                    "{ex.final_correction}"
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">{ex.disclaimer}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Approve Candidate Policy Modal */}
      <Modal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        title="Approve & Version Brand Guideline"
        subtitle={selectedCandidate?.title}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 space-y-1">
            <span className="font-semibold block text-slate-900">Signatory Notice:</span>
            Approving this candidate recommendation will update the official brand guidelines database and increment the
            rule version. An append-only audit log will be created with your signatory credentials.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Signatory Justification Notes:
            </label>
            <textarea
              className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="State reason for codifying this policy candidate..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <Button size="sm" variant="secondary" onClick={() => setApprovalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={isSubmittingDecision}
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={handleApproveCandidate}
            >
              Sign & Apply Versioned Update
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Feedback Records Inspector Modal */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title="Reviewer Feedback Records Inspector"
        subtitle={`Audit and Data Retention Management (${feedbackTotal} Total Records)`}
      >
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          <p className="text-xs text-slate-500">
            Authorized administrators may inspect stored reviewer feedback, correct inappropriate notes, and purge
            expired records in accordance with enterprise data-retention schedules.
          </p>

          {isLoadingFeedback ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading feedback records...</div>
          ) : feedbackRecords.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No feedback records found.</div>
          ) : (
            <div className="space-y-3">
              {feedbackRecords.map((rec) => (
                <div key={rec.id} className="p-3 bg-white border border-slate-200 rounded text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{rec.rule_title}</span>
                    <div className="flex items-center space-x-1.5">
                      {rec.is_confidential && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-100 text-rose-800 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Confidential
                        </span>
                      )}
                      <Badge variant="neutral">{rec.decision_type.replace(/_/g, ' ')}</Badge>
                      <Badge variant={rec.status === 'active' ? 'success' : 'neutral'}>{rec.status}</Badge>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div>
                      <strong>Original:</strong> {rec.original_text}
                    </div>
                    {rec.final_correction && (
                      <div>
                        <strong>Final Correction:</strong> {rec.final_correction}
                      </div>
                    )}
                    {rec.reviewer_notes && (
                      <div className="text-slate-500 italic">
                        <strong>Reviewer Note:</strong> "{rec.reviewer_notes}"
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      Reviewer: {rec.reviewer_name || 'Signatory'} • {new Date(rec.created_at).toLocaleDateString()}
                    </span>
                    {user?.role === 'admin' && rec.status !== 'purged' && (
                      <div className="flex items-center space-x-2">
                        {purgingRecordId === rec.id ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              className="text-[10px] px-1.5 py-0.5 border border-slate-300 rounded"
                              placeholder="Purge reason (e.g. GDPR)..."
                              value={purgeReason}
                              onChange={(e) => setPurgeReason(e.target.value)}
                            />
                            <Button size="sm" variant="danger" onClick={() => handlePurgeRecord(rec.id)}>
                              Confirm Purge
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setPurgingRecordId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setPurgingRecordId(rec.id);
                              setPurgeReason('Enterprise 365-day retention schedule');
                            }}
                            className="text-rose-600 hover:text-rose-800 text-[10px] flex items-center space-x-0.5"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Purge Record</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
