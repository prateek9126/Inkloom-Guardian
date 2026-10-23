import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import {
  ContentSubmission,
  ReviewApproval,
  SubmissionComment,
  ContentVersion,
  User,
  SubmissionStatus,
} from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  ShieldCheck,
  Check,
  X,
  History,
  MessageSquare,
  UserPlus,
  Send,
  Eye,
  GitCompare,
  RotateCw,
  Filter,
} from 'lucide-react';

export const ReviewApprovalPage: React.FC = () => {
  const { success, error } = useNotification();
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Decision Modal
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'needs_revision'>('approved');
  const [notes, setNotes] = useState('');
  const [conditions, setConditions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reviewer Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSubmission, setAssignSubmission] = useState<any | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Comments / Discussion Drawer Modal
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [commentsSubmission, setCommentsSubmission] = useState<any | null>(null);
  const [commentsList, setCommentsList] = useState<SubmissionComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Decision History Modal
  const [viewingHistorySub, setViewingHistorySub] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<ReviewApproval[]>([]);
  const [auditLogList, setAuditLogList] = useState<any[]>([]);

  // Revision Compare Modal
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareSubmission, setCompareSubmission] = useState<any | null>(null);
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, settingsRes] = await Promise.all([
        api.getPendingReviews(),
        api.getSettings(),
      ]);
      setPendingSubmissions(pendingRes.pendingReviews);
      setTeamMembers(settingsRes.team || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch pending reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenDecision = (sub: any, defaultDecision: 'approved' | 'rejected' | 'needs_revision' = 'approved') => {
    setSelectedSubmission(sub);
    setDecision(defaultDecision);
    setNotes('');
    setConditions('');
  };

  const handleOpenAssign = (sub: any) => {
    setAssignSubmission(sub);
    setSelectedReviewerId(sub.assigned_reviewer_id || '');
    setAssignModalOpen(true);
  };

  const handleAssignReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSubmission) return;

    setIsAssigning(true);
    try {
      await api.assignReviewer(assignSubmission.id, selectedReviewerId);
      success('Reviewer assigned successfully.');
      setAssignModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      error(err.message || 'Failed to assign reviewer');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenComments = async (sub: any) => {
    setCommentsSubmission(sub);
    setCommentsModalOpen(true);
    try {
      const res = await api.getComments(sub.id);
      setCommentsList(res.comments);
    } catch (err: any) {
      error(err.message || 'Failed to load comments');
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsSubmission || !newCommentText.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await api.addComment(commentsSubmission.id, newCommentText.trim(), isInternalOnly);
      setCommentsList([...commentsList, res.comment]);
      setNewCommentText('');
      success('Review comment recorded.');
    } catch (err: any) {
      error(err.message || 'Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleOpenHistory = async (sub: any) => {
    setViewingHistorySub(sub);
    try {
      const res = await api.getReviewHistory(sub.id);
      setHistoryList(res.history);
      setAuditLogList(res.auditLogs || []);
    } catch (err: any) {
      error(err.message || 'Failed to load review history');
    }
  };

  const handleOpenCompare = async (sub: any) => {
    setCompareSubmission(sub);
    setCompareModalOpen(true);
    setIsLoadingCompare(true);
    try {
      const currentVer = sub.current_version || 1;
      const oldVer = Math.max(1, currentVer - 1);
      const res = await api.compareRevisions(sub.id, oldVer, currentVer);
      setComparisonData(res.comparison);
    } catch (err: any) {
      error(err.message || 'Could not load revision comparison');
    } finally {
      setIsLoadingCompare(false);
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    if (!notes.trim()) {
      error('Formal review justification notes are required for compliance audit compliance.');
      return;
    }

    if (decision === 'approved' && selectedSubmission.risk_score >= 70 && notes.trim().length < 15) {
      error('Policy Safeguard: Content with Critical Risk (>= 70) requires thorough written compliance justification.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submitReviewDecision({
        content_id: selectedSubmission.id,
        decision,
        feedback_notes: notes.trim(),
        conditions: conditions ? conditions.trim() : undefined,
      });
      success(`Formal review decision [${decision.toUpperCase()}] submitted to audit trail.`);
      setSelectedSubmission(null);
      fetchInitialData();
    } catch (err: any) {
      error(err.message || 'Failed to record decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubmissions = pendingSubmissions.filter((sub) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'ready_for_review') return sub.status === 'ready_for_review' || sub.status === 'pending_review';
    if (statusFilter === 'needs_revision') return sub.status === 'needs_revision' || sub.status === 'revision_requested';
    if (statusFilter === 'analysis_complete') return sub.status === 'analysis_complete';
    return sub.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>;
      case 'needs_revision':
      case 'revision_requested':
        return <Badge variant="danger">Needs Revision</Badge>;
      case 'ready_for_review':
      case 'pending_review':
        return <Badge variant="warning">Ready for Review</Badge>;
      case 'analysis_complete':
        return <Badge variant="info">Analysis Complete</Badge>;
      case 'rejected':
        return <Badge variant="critical">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Human Review & Approval Center
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Staged Approval Gateway
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative gateway for Legal Counsel, Brand Directors, and Regulatory Officers. Never permits ungrounded promotional publishing without explicit human sign-off.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Pending ({pendingSubmissions.length})
          </button>
          <button
            onClick={() => setStatusFilter('ready_for_review')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'ready_for_review' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ready for Review
          </button>
          <button
            onClick={() => setStatusFilter('needs_revision')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'needs_revision' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Needs Revision
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500 flex items-center">
            <RotateCw className="w-4 h-4 mr-2 animate-spin text-slate-400" />
            Loading review queue telemetry...
          </span>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Review Queue Clear"
          description="All submitted communications have received formal approval or are awaiting author revisions."
        />
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => {
            const isHighRisk = (sub.risk_score || 0) >= 70;
            return (
              <div
                key={sub.id}
                className={`p-5 rounded-lg border bg-white shadow-xs transition-all space-y-4 hover:border-slate-300 ${
                  isHighRisk ? 'border-rose-200' : 'border-slate-200'
                }`}
              >
                {/* Header: Channel, Version, Status, Campaign, Risk Score */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                      {sub.channel}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                      v{sub.current_version || 1}
                    </span>
                    {getStatusBadge(sub.status)}
                    {sub.campaign_name && (
                      <span className="text-xs text-slate-500">
                        Campaign: <strong>{sub.campaign_name}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-500">Estimated Risk:</span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${
                          isHighRisk
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : (sub.risk_score || 0) >= 45
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {sub.risk_score || 0}/100 ({sub.risk_category || (isHighRisk ? 'Critical Risk' : 'Moderate')})
                      </span>
                    </div>

                    <span className="text-slate-400">By {sub.author_name || 'Marketing Writer'}</span>
                  </div>
                </div>

                {/* Submission Title & Excerpt */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/claim-verification?contentId=${sub.id}`}
                        className="font-bold text-base text-slate-900 hover:underline block"
                      >
                        {sub.title}
                      </Link>
                      {(sub.title?.includes('[Demo]') || sub.title?.toLowerCase().includes('volterra') || sub.campaign_name?.toLowerCase().includes('volterra')) && (
                        <DemoBadge variant="outline" label="DEMO" />
                      )}
                    </div>

                    {/* Assigned Reviewer Pill */}
                    <button
                      onClick={() => handleOpenAssign(sub)}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-50 border border-slate-200"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Assignee: <strong>{sub.assigned_reviewer_name || 'Unassigned'}</strong>
                      </span>
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed font-sans bg-slate-50/70 p-3 rounded border border-slate-100">
                    {sub.content_body}
                  </p>
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 text-xs">
                    {/* View History */}
                    <button
                      onClick={() => handleOpenHistory(sub)}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                    >
                      <History className="w-3.5 h-3.5" /> Signoff History
                    </button>

                    {/* View Comments */}
                    <button
                      onClick={() => handleOpenComments(sub)}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Discussion
                    </button>

                    {/* Compare with previous revision if > v1 */}
                    {(sub.current_version || 1) > 1 && (
                      <button
                        onClick={() => handleOpenCompare(sub)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 font-medium"
                      >
                        <GitCompare className="w-3.5 h-3.5" /> Compare Revisions
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/risk-analysis?contentId=${sub.id}`}
                      className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2.5 py-1.5 bg-white hover:bg-slate-50"
                    >
                      Inspect Risk Report
                    </Link>

                    <Link
                      to={`/claim-verification?contentId=${sub.id}`}
                      className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2.5 py-1.5 bg-white hover:bg-slate-50"
                    >
                      Inspect Evidence Graph
                    </Link>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenDecision(sub, 'needs_revision')}
                    >
                      Request Revisions
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenDecision(sub, 'approved')}
                      icon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Record Approval Decision
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      <Modal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        title="Record Human Approval Decision"
        subtitle={selectedSubmission ? `${selectedSubmission.title} (v${selectedSubmission.current_version || 1})` : ''}
      >
        {selectedSubmission && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            {/* Warning if critical risk */}
            {selectedSubmission.risk_score >= 70 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-950 space-y-1">
                <div className="font-bold flex items-center gap-1 text-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>High Governance Risk Warning ({selectedSubmission.risk_score}/100)</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This submission contains critical policy violations or ungrounded claims. Policy requires thorough compliance justification to approve for public distribution.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Review Decision *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision('approved')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    decision === 'approved'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Approve for Publication
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('needs_revision')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    decision === 'needs_revision'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Request Revisions
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('rejected')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    decision === 'rejected'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Reject Content
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Formal Feedback & Reviewer Audit Notes *
              </label>
              <textarea
                rows={3}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="State verified primary evidence checked, required revisions, or statutory legal exception justifications..."
                className="w-full text-xs border border-slate-300 rounded p-2.5 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {decision === 'approved' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Approval Conditions / Exclusions (Optional)
                </label>
                <input
                  type="text"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g. Authorized strictly for Q4 digital social campaign; footnote mandatory"
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" type="button" onClick={() => setSelectedSubmission(null)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" isLoading={isSubmitting}>
                Submit Official Decision
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Assign Reviewer Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Content Reviewer"
        subtitle={assignSubmission?.title}
      >
        <form onSubmit={handleAssignReviewer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Designated Reviewer
            </label>
            <select
              value={selectedReviewerId}
              onChange={(e) => setSelectedReviewerId(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2.5 bg-white font-medium"
            >
              <option value="">-- Unassigned --</option>
              {teamMembers
                .filter((m) => ['admin', 'compliance_officer', 'brand_manager'].includes(m.role))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role.replace(/_/g, ' ')})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isAssigning}>
              Save Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Comments & Discussion Modal */}
      <Modal
        isOpen={commentsModalOpen}
        onClose={() => setCommentsModalOpen(false)}
        title="Reviewer Discussion & Notes"
        subtitle={commentsSubmission?.title}
      >
        <div className="space-y-4">
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {commentsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No discussion entries recorded yet.
              </div>
            ) : (
              commentsList.map((c) => (
                <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {c.user_name || 'Reviewer'} ({c.user_role?.replace(/_/g, ' ') || 'Team'})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px]">{c.comment_text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handlePostComment} className="pt-3 border-t border-slate-200 space-y-2">
            <textarea
              rows={2}
              required
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add reviewer notes, questions, or clarification requests..."
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
            <div className="flex justify-between items-center">
              <label className="flex items-center space-x-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={isInternalOnly}
                  onChange={(e) => setIsInternalOnly(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Internal Governance Only</span>
              </label>

              <Button size="sm" type="submit" isLoading={isPostingComment} icon={<Send className="w-3.5 h-3.5" />}>
                Post Note
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Decision History Modal */}
      <Modal
        isOpen={!!viewingHistorySub}
        onClose={() => setViewingHistorySub(null)}
        title="Chronological Decision Audit Trail"
        subtitle={viewingHistorySub?.title}
      >
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {historyList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No historical review sign-offs recorded yet.
            </div>
          ) : (
            historyList.map((h) => (
              <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={h.decision === 'approved' ? 'success' : 'danger'}>
                      {h.decision.toUpperCase()}
                    </Badge>
                    <span className="font-semibold text-slate-800 capitalize">
                      {h.stage?.replace(/_/g, ' ') || 'Review'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-700 italic text-[11px]">"{h.feedback_notes}"</p>
                {h.conditions && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                    Conditions: {h.conditions}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
                  <span>Signatory: {h.reviewer_name || 'Compliance Officer'}</span>
                  <span>Version: v{h.content_version || 1}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Revision Comparison Modal */}
      <Modal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="Risk Reduction Comparison"
        subtitle={compareSubmission?.title}
      >
        <div className="space-y-4">
          {isLoadingCompare ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Calculating revision comparison diff...
            </div>
          ) : comparisonData ? (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">
                    Version {comparisonData.previous_version} vs Version {comparisonData.new_version}
                  </span>
                  <p className="text-slate-600 text-[11px] mt-0.5">{comparisonData.summary}</p>
                </div>
                <span className="text-lg font-mono font-black text-emerald-700">
                  {comparisonData.score_delta > 0 ? `+${comparisonData.score_delta}` : comparisonData.score_delta} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded max-h-48 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Original Text:</span>
                  <p className="whitespace-pre-wrap text-slate-700 text-[11px]">{comparisonData.text_diff.original_text}</p>
                </div>
                <div className="p-3 bg-emerald-50/30 border border-emerald-200 rounded max-h-48 overflow-y-auto">
                  <span className="text-[10px] font-bold text-emerald-800 block mb-1 uppercase">Revised Text:</span>
                  <p className="whitespace-pre-wrap text-emerald-950 text-[11px]">{comparisonData.text_diff.revised_text}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              No multiple versions available for comparison.
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <Button size="sm" variant="secondary" onClick={() => setCompareModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
