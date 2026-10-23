import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import {
  ContentSubmission,
  ExtractedClaim,
  EvidenceGraphData,
  ClaimClassification,
} from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { EvidenceGraphViewer } from '../components/evidence/EvidenceGraphViewer';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileText,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Edit3,
  Check,
  X,
  ExternalLink,
  Layers,
  ChevronRight,
  Scale,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const ClaimVerificationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentIdParam = searchParams.get('contentId');
  const { success, error, info } = useNotification();

  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [content, setContent] = useState<ContentSubmission | null>(null);
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const [evidenceGraph, setEvidenceGraph] = useState<EvidenceGraphData | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'claims' | 'graph' | 'content'>('claims');

  // Review modal state
  const [reviewingClaim, setReviewingClaim] = useState<ExtractedClaim | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'confirmed' | 'rejected' | 'amended'>('confirmed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [amendedClassification, setAmendedClassification] = useState<ClaimClassification>('Supported');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Correction applying state
  const [correctingClaim, setCorrectingClaim] = useState<ExtractedClaim | null>(null);
  const [customCorrection, setCustomCorrection] = useState('');
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false);

  // Load submissions list for dropdown
  useEffect(() => {
    const loadSubmissions = async () => {
      try {
        const res = await api.getContentSubmissions();
        setSubmissions(res.submissions);
        if (res.submissions.length > 0) {
          const volterraSub = res.submissions.find(
            (s) => s.title.toLowerCase().includes('volterra') || s.title.includes('[Demo]')
          );
          const targetId =
            contentIdParam && res.submissions.some((s) => s.id === contentIdParam)
              ? contentIdParam
              : volterraSub
              ? volterraSub.id
              : res.submissions[0].id;
          setSelectedContentId(targetId);
        }
      } catch (err: any) {
        error(err.message || 'Failed to load content list');
      }
    };
    loadSubmissions();
  }, [contentIdParam]);

  // Load verification data for selected content
  useEffect(() => {
    if (!selectedContentId) return;

    const fetchVerification = async () => {
      setIsLoading(true);
      try {
        const res = await api.getClaimVerification(selectedContentId);
        setContent(res.content);
        setClaims(res.claims);
        setEvidenceGraph(res.evidenceGraph);
        setSummary(res.summary);
      } catch (err: any) {
        error(err.message || 'Failed to fetch claim verification analysis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerification();
  }, [selectedContentId]);

  const handleSelectContent = (id: string) => {
    setSelectedContentId(id);
    setSearchParams({ contentId: id });
  };

  const handleReverify = async () => {
    if (!selectedContentId) return;
    setIsVerifying(true);
    try {
      const res = await api.runClaimVerification(selectedContentId);
      setClaims(res.claims);
      setEvidenceGraph(res.evidenceGraph);
      setSummary(res.summary);
      success('Claim verification re-executed against primary evidence library.');
    } catch (err: any) {
      error(err.message || 'Verification re-run failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenReview = (claim: ExtractedClaim) => {
    setReviewingClaim(claim);
    setReviewDecision('confirmed');
    setReviewNotes(claim.reviewer_notes || '');
    setAmendedClassification(claim.classification);
  };

  const handleSubmitReview = async () => {
    if (!reviewingClaim) return;
    setIsSubmittingReview(true);
    try {
      const res = await api.reviewClaim(
        reviewingClaim.id,
        reviewDecision,
        reviewNotes,
        reviewDecision === 'amended' ? amendedClassification : undefined
      );
      setClaims(prev => prev.map(c => c.id === reviewingClaim.id ? { ...c, ...res.updatedClaim } : c));
      success(`Review decision recorded: ${reviewDecision.toUpperCase()}`);
      setReviewingClaim(null);
    } catch (err: any) {
      error(err.message || 'Failed to save review decision');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenCorrection = (claim: ExtractedClaim) => {
    setCorrectingClaim(claim);
    setCustomCorrection(claim.suggested_correction || '');
  };

  const handleApplyCorrection = async () => {
    if (!correctingClaim) return;
    setIsApplyingCorrection(true);
    try {
      const res = await api.applyClaimCorrection(correctingClaim.id, customCorrection);
      if (content) {
        setContent({ ...content, content_body: res.updatedContentBody });
      }
      setClaims(prev =>
        prev.map(c => c.id === correctingClaim.id ? { ...c, status: 'amended', reviewer_decision: 'correction_applied' } : c)
      );
      success('Suggested correction applied to content body and recorded in immutable audit log.');
      setCorrectingClaim(null);
    } catch (err: any) {
      error(err.message || 'Failed to apply correction');
    } finally {
      setIsApplyingCorrection(false);
    }
  };

  const getClassificationBadge = (classification: ClaimClassification) => {
    switch (classification) {
      case 'Supported':
        return (
          <Badge variant="supported" className="font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Supported
          </Badge>
        );
      case 'Contradicted':
        return (
          <Badge variant="contradicted" className="font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Contradicted
          </Badge>
        );
      case 'Needs Human Review':
        return (
          <Badge variant="review" className="font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Needs Human Review
          </Badge>
        );
      case 'Unverified':
      default:
        return (
          <Badge variant="unverified" className="font-semibold flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Unverified
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Content Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Evidence-Backed Claim Verification Engine
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rigorous cross-examination of promotional and factual claims against primary company documents with zero citation fabrication.
          </p>
        </div>

        {/* Content Picker & Actions */}
        <div className="flex items-center space-x-2.5 flex-wrap">
          <select
            value={selectedContentId}
            onChange={(e) => handleSelectContent(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 font-medium focus:ring-1 focus:ring-slate-900 focus:outline-none max-w-xs truncate"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.channel})
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleReverify}
            isLoading={isVerifying}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Re-Verify Claims
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <svg className="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Retrieving primary evidence passages and checking claims...</span>
          </div>
        </div>
      ) : content ? (
        <>
          {/* Integrity Score & Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Integrity Score</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {summary?.integrityScore || 0}%
                </span>
                <span className="text-xs text-slate-500">substantiated</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full ${
                    (summary?.integrityScore || 0) >= 80
                      ? 'bg-emerald-600'
                      : (summary?.integrityScore || 0) >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${summary?.integrityScore || 0}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/20 rounded-lg shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Supported</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl font-bold text-emerald-950 font-mono mt-2">
                {summary?.supported || 0}
              </span>
              <span className="text-[11px] text-emerald-700">Matched to approved documents</span>
            </div>

            <div className="p-4 bg-white border border-red-200 bg-red-50/20 rounded-lg shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">Contradicted</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-red-950 font-mono mt-2">
                {summary?.contradicted || 0}
              </span>
              <span className="text-[11px] text-red-700">Clashes with approved data</span>
            </div>

            <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-lg shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Needs Review</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-2xl font-bold text-amber-950 font-mono mt-2">
                {summary?.needsReview || 0}
              </span>
              <span className="text-[11px] text-amber-700">Outdated source or partial overlap</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Unverified</span>
                <HelpCircle className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-2xl font-bold text-slate-800 font-mono mt-2">
                {summary?.unverified || 0}
              </span>
              <span className="text-[11px] text-slate-500">No primary evidence found</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 flex space-x-6">
            <button
              onClick={() => setActiveTab('claims')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'claims'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Extracted Claims Analysis ({claims.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'graph'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Traceable Evidence Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'content'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Content Source Text</span>
            </button>
          </div>

          {/* TAB 1: Detailed Claims List */}
          {activeTab === 'claims' && (
            <div className="space-y-4">
              {claims.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No Claims Extracted"
                  description="No numerical, factual, or promotional assertions were detected in this document."
                />
              ) : (
                claims.map((claim) => (
                  <div
                    key={claim.id}
                    className={`p-5 rounded-lg border bg-white shadow-xs transition-all ${
                      claim.classification === 'Contradicted'
                        ? 'border-red-300 ring-1 ring-red-100'
                        : claim.classification === 'Supported'
                        ? 'border-slate-200 hover:border-emerald-300'
                        : claim.classification === 'Needs Human Review'
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        {getClassificationBadge(claim.classification)}
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
                          {claim.claim_type} assertion
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-500">
                          Confidence: <strong className="text-slate-800 font-mono">{Math.round(claim.confidence_score * 100)}%</strong>
                        </span>
                        {claim.status !== 'pending_review' && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium uppercase">
                            Decision: {claim.reviewer_decision || claim.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Claim Text */}
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Asserted Claim:
                      </span>
                      <blockquote className="p-3 bg-slate-50 border-l-4 border-slate-900 rounded-r text-sm text-slate-900 font-medium leading-relaxed">
                        "{claim.claim_text}"
                      </blockquote>
                    </div>

                    {/* Evidence Provenance Box */}
                    {claim.matched_passage ? (
                      <div className="mt-4 p-4 rounded-md border border-slate-200 bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-700">
                          <span className="font-semibold flex items-center gap-1.5 text-slate-900">
                            <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                            Primary Document: {claim.matched_passage.document_title}
                          </span>
                          <span className="text-[11px] font-mono bg-white border px-1.5 py-0.5 rounded text-slate-600">
                            v{claim.matched_passage.document_version} • Page {claim.matched_passage.page_number}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 italic bg-white p-3 border border-slate-200 rounded font-serif leading-relaxed">
                          "{claim.matched_passage.content}"
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Section: {claim.matched_passage.section_header || 'General'}</span>
                          {claim.matched_passage.is_outdated && (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Outdated Document (Needs Re-certification)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>No corresponding evidence record found in the approved company library. Zero citations fabricated.</span>
                      </div>
                    )}

                    {/* Contradiction details if applicable */}
                    {claim.contradiction_details && (
                      <div className="mt-3 p-3 rounded-md border border-red-200 bg-red-50 text-xs text-red-900">
                        <strong className="block font-semibold mb-0.5">Direct Contradiction Finding:</strong>
                        {claim.contradiction_details}
                      </div>
                    )}

                    {/* Explanation and Suggested Fix */}
                    <div className="mt-3 text-xs text-slate-600 space-y-1">
                      <p><strong className="text-slate-800">Rationale:</strong> {claim.confidence_rationale}</p>
                      {claim.suggested_correction && (
                        <p className="text-slate-800">
                          <strong className="text-emerald-700">Recommended Correction:</strong> {claim.suggested_correction}
                        </p>
                      )}
                    </div>

                    {/* Reviewer Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-[11px] text-slate-400">
                        {claim.reviewer_notes ? `Reviewer note: "${claim.reviewer_notes}"` : 'Pending reviewer confirmation'}
                      </div>

                      <div className="flex items-center space-x-2">
                        {claim.suggested_correction && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenCorrection(claim)}
                            icon={<Edit3 className="w-3 h-3 text-emerald-600" />}
                          >
                            Apply Correction
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReview(claim)}
                          icon={<Scale className="w-3 h-3 text-slate-600" />}
                        >
                          Reviewer Assessment
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Interactive Evidence Graph */}
          {activeTab === 'graph' && evidenceGraph && (
            <EvidenceGraphViewer data={evidenceGraph} />
          )}

          {/* TAB 3: Content Source Text */}
          {activeTab === 'content' && (
            <Card title="Raw Content Asset" subtitle={`Target Channel: ${content.channel}`}>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800 max-h-[500px] overflow-y-auto">
                {content.content_body}
              </div>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Content Selected"
          description="Select a content submission above to inspect evidence citations."
        />
      )}

      {/* MODAL 1: Reviewer Assessment Dialog */}
      <Modal
        isOpen={!!reviewingClaim}
        onClose={() => setReviewingClaim(null)}
        title="Human Reviewer Assessment"
        subtitle="Confirm, reject, or amend the automated claim verification finding"
      >
        {reviewingClaim && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800">
              <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
                Asserted Claim:
              </span>
              "{reviewingClaim.claim_text}"
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Review Decision
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewDecision('confirmed')}
                  className={`p-2.5 border rounded-md text-xs font-medium text-center transition-all ${
                    reviewDecision === 'confirmed'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Confirm Assessment
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('amended')}
                  className={`p-2.5 border rounded-md text-xs font-medium text-center transition-all ${
                    reviewDecision === 'amended'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Amend Classification
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('rejected')}
                  className={`p-2.5 border rounded-md text-xs font-medium text-center transition-all ${
                    reviewDecision === 'rejected'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Reject Assessment
                </button>
              </div>
            </div>

            {reviewDecision === 'amended' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amended Classification
                </label>
                <select
                  value={amendedClassification}
                  onChange={(e) => setAmendedClassification(e.target.value as ClaimClassification)}
                  className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                >
                  <option value="Supported">Supported (Sufficient Evidence)</option>
                  <option value="Contradicted">Contradicted (Factually Clashes)</option>
                  <option value="Needs Human Review">Needs Human Review (Ambiguous / Outdated)</option>
                  <option value="Unverified">Unverified (Missing Evidence)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Reviewer Notes & Justification (Recorded in Audit Trail)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                placeholder="State legal or compliance rationale for this decision..."
                className="w-full text-xs border border-slate-300 rounded p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={() => setReviewingClaim(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmitReview} isLoading={isSubmittingReview}>
                Save Assessment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Apply Suggested Correction Dialog */}
      <Modal
        isOpen={!!correctingClaim}
        onClose={() => setCorrectingClaim(null)}
        title="Apply Content Correction"
        subtitle="Replace asserted claim with substantiated wording while preserving audit history"
      >
        {correctingClaim && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Original Asserted Text:
              </span>
              <p className="p-3 bg-red-50 border border-red-200 text-xs text-red-900 rounded font-medium line-through">
                "{correctingClaim.claim_text}"
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Substantiated Replacement Text
              </label>
              <textarea
                value={customCorrection}
                onChange={(e) => setCustomCorrection(e.target.value)}
                rows={3}
                className="w-full text-xs border border-slate-300 rounded p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-900"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                This modification will update the content body and record an immutable diff in the audit trail.
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={() => setCorrectingClaim(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyCorrection} isLoading={isApplyingCorrection}>
                Apply to Content
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
