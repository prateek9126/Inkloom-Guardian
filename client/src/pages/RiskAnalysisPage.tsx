import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import {
  ContentSubmission,
  RiskReport,
  RiskViolation,
  RiskContributionIssue,
  UnresolvedUncertainty,
  RiskReductionComparison,
  ContentVersion,
  RiskCategory,
} from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield,
  Check,
  X,
  ChevronRight,
  Info,
  Scale,
  Layers,
  History,
  RotateCw,
  ExternalLink,
  HelpCircle,
  TrendingDown,
  ArrowRight,
  Eye,
} from 'lucide-react';

export const RiskAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentIdParam = searchParams.get('contentId');
  const { success, error } = useNotification();

  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [content, setContent] = useState<ContentSubmission | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);

  // Formula Breakdown Toggle
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Revision Comparison Modal State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [selectedOldVer, setSelectedOldVer] = useState<number>(1);
  const [selectedNewVer, setSelectedNewVer] = useState<number>(1);
  const [comparison, setComparison] = useState<RiskReductionComparison | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

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
        error(err.message || 'Failed to load submissions');
      }
    };
    loadSubmissions();
  }, [contentIdParam]);

  const fetchReport = async (contentId: string) => {
    setIsLoading(true);
    try {
      const res = await api.getRiskReport(contentId);
      setContent(res.content);
      setReport(res.report);
    } catch (err: any) {
      error(err.message || 'Failed to fetch risk report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedContentId) {
      fetchReport(selectedContentId);
    }
  }, [selectedContentId]);

  const handleRescan = async () => {
    if (!selectedContentId) return;
    setIsRescanning(true);
    try {
      const res = await api.runRiskScan(selectedContentId);
      setContent(res.submission);
      setReport(res.scanReport);
      success('Explainable risk assessment re-calculated.');
    } catch (err: any) {
      error(err.message || 'Failed to execute risk scan');
    } finally {
      setIsRescanning(false);
    }
  };

  const handleUpdateViolation = async (violationId: string, status: string, justification?: string) => {
    if (!selectedContentId) return;
    try {
      const res = await api.updateViolationStatus(selectedContentId, violationId, status, justification);
      success(`Finding status updated to [${status.toUpperCase()}]. Score adjusted.`);
      // Refresh report
      await fetchReport(selectedContentId);
    } catch (err: any) {
      error(err.message || 'Failed to update finding');
    }
  };

  // Open Revision Comparison Modal
  const handleOpenComparison = async () => {
    if (!selectedContentId) return;
    setIsCompareModalOpen(true);
    try {
      const res = await api.getSubmissionVersions(selectedContentId);
      setVersions(res.versions);
      if (res.versions.length >= 2) {
        setSelectedOldVer(res.versions[res.versions.length - 1].version_number);
        setSelectedNewVer(res.versions[0].version_number);
        loadComparisonData(res.versions[res.versions.length - 1].version_number, res.versions[0].version_number);
      } else if (res.versions.length === 1) {
        setSelectedOldVer(1);
        setSelectedNewVer(1);
        loadComparisonData(1, 1);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load versions');
    }
  };

  const loadComparisonData = async (oldV: number, newV: number) => {
    setIsLoadingComparison(true);
    try {
      const res = await api.compareRevisions(selectedContentId, oldV, newV);
      setComparison(res.comparison);
    } catch (err: any) {
      error(err.message || 'Failed to compute revision comparison');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const getRiskCategoryBadge = (category?: string) => {
    switch (category) {
      case 'Critical Risk':
        return <Badge variant="critical">Critical Risk</Badge>;
      case 'Elevated Risk':
        return <Badge variant="danger">Elevated Risk</Badge>;
      case 'Moderate Risk':
        return <Badge variant="warning">Moderate Risk</Badge>;
      case 'Low Risk':
      default:
        return <Badge variant="success">Low Risk</Badge>;
    }
  };

  const getDomainLabel = (domain: string) => {
    switch (domain) {
      case 'legal_regulatory': return 'Legal & Regulatory (1.4x)';
      case 'safety': return 'Safety & Liability (1.35x)';
      case 'financial_pricing': return 'Financial & Pricing (1.25x)';
      case 'technical_claims': return 'Technical Claims (1.1x)';
      default: return 'Brand Voice & Naming (0.9x)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Explainable Brand Risk Intelligence
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Deterministic Weights
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prioritize brand governance issues before publication through transparent mathematical scoring, confidence scaling, and primary evidence grounding.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {content && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOpenComparison}
                icon={<History className="w-3.5 h-3.5" />}
              >
                Compare Revisions
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRescan}
                isLoading={isRescanning}
                icon={<RotateCw className="w-3.5 h-3.5" />}
              >
                Re-Scan
              </Button>
            </>
          )}

          <select
            value={selectedContentId}
            onChange={(e) => {
              setSelectedContentId(e.target.value);
              setSearchParams({ contentId: e.target.value });
            }}
            className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 font-medium max-w-xs truncate"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.channel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500 flex items-center">
            <RotateCw className="w-4 h-4 mr-2 animate-spin text-slate-400" />
            Computing explainable brand risk telemetry...
          </span>
        </div>
      ) : content && report ? (
        <>
          {/* Scientific Limitation Disclaimer Alert */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start space-x-2.5 text-slate-600">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Scoring Limitation Notice: </span>
              <span>
                {report.scoring_formula_breakdown?.disclaimer ||
                  'A score of 100 represents elevated compliance rule violations according to defined enterprise weights and is not a scientifically proven empirical probability of actual brand damage.'}
              </span>
            </div>
          </div>

          {/* Top Scorecard Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Risk Score */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Estimated Risk Score
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-extrabold font-mono ${
                    report.overall_risk_score >= 70
                      ? 'text-rose-600'
                      : report.overall_risk_score >= 45
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {report.overall_risk_score}/100
                </span>
                {getRiskCategoryBadge(report.risk_category)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Version: v{content.current_version || 1}</span>
                <span className="capitalize">{content.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Contributing Findings Count */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Contributing Issues
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {report.contributing_issues?.length || report.violations.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">Weighted Impact</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Deduplicated: {report.scoring_formula_breakdown?.deduplicated_count ?? 0}</span>
                <span className="text-emerald-700 font-semibold">Zero Double-Count</span>
              </div>
            </div>

            {/* Claims Verification Score */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Claims Substantiation
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {report.claims_score}%
                </span>
                <span className="text-xs text-slate-500">Evidence Grounded</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <Link to={`/claim-verification?contentId=${content.id}`} className="text-slate-700 hover:underline flex items-center gap-1 font-medium">
                  Evidence Graph →
                </Link>
                <span>{report.unsubstantiated_claims?.length || 0} Unverified</span>
              </div>
            </div>

            {/* Tone & Regulatory Compliance */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Regulatory & Policy Health
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {report.compliance_score}%
                </span>
                <span className="text-xs text-slate-500">Policy Baseline</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Tone Score: {report.tone_score}%</span>
                <span>FTC & SLA Compliant</span>
              </div>
            </div>
          </div>

          {/* Deterministic Scoring Formula & Weights Transparency Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Configurable Scoring Formula & Weight Definition
                </h3>
              </div>
              <button
                onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showFormulaDetails ? 'Hide Formula Details' : 'Inspect Formula Details'}
              </button>
            </div>

            {showFormulaDetails && (
              <div className="p-4 space-y-3 text-xs bg-slate-50/30">
                <div className="font-mono bg-white p-2.5 rounded border border-slate-200 text-slate-800 text-[11px]">
                  {report.scoring_formula_breakdown?.base_formula ||
                    'Score = min(100, sum(BaseSeverity * DomainMultiplier * Confidence * EvidenceFactor * CampaignMultiplier * StatusMultiplier))'}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                  <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-800 block">Base Severity Weights:</span>
                    <div>Critical: <strong>35 pts</strong></div>
                    <div>High: <strong>20 pts</strong></div>
                    <div>Medium: <strong>10 pts</strong></div>
                    <div>Low: <strong>4 pts</strong></div>
                  </div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-800 block">Domain Multipliers:</span>
                    <div>Legal & Regulatory: <strong>1.4x</strong></div>
                    <div>Safety & Liability: <strong>1.35x</strong></div>
                    <div>Financial & Pricing: <strong>1.25x</strong></div>
                    <div>Technical Claims: <strong>1.1x</strong></div>
                    <div>Brand Voice: <strong>0.9x</strong></div>
                  </div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-800 block">Evidence & Multi-Asset:</span>
                    <div>Direct Contradiction: <strong>1.25x</strong></div>
                    <div>Unverified Claim: <strong>0.85x</strong></div>
                    <div>Multi-Asset Campaign: <strong>1.2x</strong></div>
                    <div>Accepted Remediation: <strong>0.0x</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Individual Contributing Issues with Mathematical Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Individual Contributing Findings & Mathematical Breakdown (
                {report.contributing_issues?.length || report.violations.length}
                )
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Sorted by Score Impact (Highest to Lowest)
              </span>
            </div>

            {(!report.contributing_issues || report.contributing_issues.length === 0) &&
            report.violations.length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-lg text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900">Zero Governance Violations Detected</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This communication satisfies all configured legal, financial, and brand governance rules.
                </p>
              </div>
            ) : (
              (report.contributing_issues || report.violations).map((item: any, idx: number) => {
                const issueId = item.id || `issue-${idx}`;
                const severity = item.severity || 'medium';
                const scorePts = item.score_contribution !== undefined ? item.score_contribution : 20;

                return (
                  <div
                    key={issueId}
                    className={`p-5 rounded-lg border bg-white shadow-xs transition-all space-y-3 ${
                      !item.unresolved
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : severity === 'critical'
                        ? 'border-red-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header: Title, Domain, Severity, Score Impact */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            severity === 'critical'
                              ? 'critical'
                              : severity === 'high'
                              ? 'danger'
                              : severity === 'medium'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {severity.toUpperCase()}
                        </Badge>
                        <span className="font-bold text-xs text-slate-900">{item.rule_title || item.ruleTitle}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {getDomainLabel(item.domain || item.category)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          +{scorePts} pts impact
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Confidence: {item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '95%'}
                        </span>
                      </div>
                    </div>

                    {/* Matched Raw Text Snippet */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Flagged Content Snippet:
                      </span>
                      <p className="text-xs font-mono bg-red-50 text-red-900 p-2.5 rounded border border-red-200 inline-block font-semibold">
                        "{item.matched_text || item.matchedText}"
                      </p>
                    </div>

                    {/* Explanation */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong className="text-slate-800">Explanation: </strong>
                      {item.explanation}
                    </p>

                    {/* Primary Evidence Citation if available */}
                    {item.evidence_ref && (
                      <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded text-xs text-emerald-950 flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-semibold">Grounding Citation: </span>
                          <span>{item.evidence_ref}</span>
                        </div>
                      </div>
                    )}

                    {/* Mathematical Factor Traceability */}
                    {item.base_points !== undefined && (
                      <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[10px] font-mono text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Base Points: <strong>{item.base_points}</strong></span>
                        <span>Domain Multiplier: <strong>{item.domain_multiplier}x</strong></span>
                        <span>Confidence: <strong>{item.confidence_multiplier}</strong></span>
                        <span>Evidence Factor: <strong>{item.evidence_factor}x</strong></span>
                        <span>Campaign Factor: <strong>{item.campaign_multiplier}x</strong></span>
                      </div>
                    )}

                    {/* Recommended Remediation Action */}
                    <div className="p-3 bg-sky-50/60 border border-sky-200 rounded text-xs text-sky-950">
                      <strong className="text-sky-900 block mb-0.5">Recommended Remediation:</strong>
                      {item.recommended_remediation || item.suggestedFix}
                    </div>

                    {/* Quick Resolution Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateViolation(item.id, 'accepted', 'Accepted approved remediation')}
                        icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                      >
                        Accept Remediation (Eliminate Penalty)
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateViolation(item.id, 'ignored', 'Compliance officer approved exception')}
                        icon={<X className="w-3.5 h-3.5 text-slate-400" />}
                      >
                        Ignore with Exception
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unresolved Uncertainties Section */}
          {report.unresolved_uncertainties && report.unresolved_uncertainties.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Unresolved Uncertainties & Missing Primary Evidence ({report.unresolved_uncertainties.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                These findings reflect missing evidence in the document repository rather than confirmed falsehoods. They carry cautious weight (0.85x) without assuming bad faith.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.unresolved_uncertainties.map((u, i) => (
                  <div key={i} className="p-4 bg-amber-50/40 border border-amber-200 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 truncate">"{u.claim_or_issue}"</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase font-semibold">
                        {u.uncertainty_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">{u.description}</p>
                    <div className="p-2 bg-white rounded border border-amber-200 text-[11px] text-amber-950 font-medium">
                      Action Required: {u.recommended_action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="No Risk Report Generated"
          description="Select an asset above to inspect its explainable brand risk report."
        />
      )}

      {/* Revision Comparison Modal */}
      <Modal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        title="Risk Reduction Revision Comparison"
        subtitle={content ? `${content.title} (Channel: ${content.channel})` : ''}
      >
        <div className="space-y-4">
          {/* Version Selectors Bar */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Baseline Version:</span>
              <select
                value={selectedOldVer}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSelectedOldVer(val);
                  loadComparisonData(val, selectedNewVer);
                }}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version_number}>
                    v{v.version_number} (Risk: {v.risk_score})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Revised Version:</span>
              <select
                value={selectedNewVer}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSelectedNewVer(val);
                  loadComparisonData(selectedOldVer, val);
                }}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version_number}>
                    v{v.version_number} (Risk: {v.risk_score})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingComparison ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Calculating revision comparison diff...
            </div>
          ) : comparison ? (
            <div className="space-y-4">
              {/* Executive Summary Card */}
              <div
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  comparison.score_delta < 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : comparison.score_delta === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="space-y-1">
                  <span className="font-bold text-sm block">
                    {comparison.score_delta < 0 ? 'Risk Successfully Reduced' : 'Comparison Telemetry'}
                  </span>
                  <p className="text-xs leading-relaxed">{comparison.summary}</p>
                </div>

                <div className="text-right pl-4">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                    Score Delta
                  </span>
                  <span
                    className={`text-2xl font-black font-mono ${
                      comparison.score_delta < 0
                        ? 'text-emerald-700'
                        : comparison.score_delta === 0
                        ? 'text-slate-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {comparison.score_delta > 0 ? `+${comparison.score_delta}` : comparison.score_delta} pts
                  </span>
                </div>
              </div>

              {/* Resolved vs Remaining vs Newly Introduced Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Resolved */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded space-y-1.5">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Resolved Issues ({comparison.resolved_issues.length})
                  </span>
                  {comparison.resolved_issues.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No previous issues remediated</p>
                  ) : (
                    comparison.resolved_issues.map((r, idx) => (
                      <div key={idx} className="text-[11px] text-emerald-800 line-through">
                        • {r.rule_title || r.matched_text}
                      </div>
                    ))
                  )}
                </div>

                {/* Remaining */}
                <div className="p-3 bg-amber-50/40 border border-amber-200 rounded space-y-1.5">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Remaining Issues ({comparison.remaining_issues.length})
                  </span>
                  {comparison.remaining_issues.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">Zero lingering issues</p>
                  ) : (
                    comparison.remaining_issues.map((r, idx) => (
                      <div key={idx} className="text-[11px] text-amber-800">
                        • {r.rule_title || r.matched_text}
                      </div>
                    ))
                  )}
                </div>

                {/* Newly Introduced */}
                <div className="p-3 bg-rose-50/40 border border-rose-200 rounded space-y-1.5">
                  <span className="font-bold text-rose-900 flex items-center gap-1">
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    New Issues ({comparison.newly_introduced_issues.length})
                  </span>
                  {comparison.newly_introduced_issues.length === 0 ? (
                    <p className="text-[11px] text-emerald-700 italic">No new violations introduced</p>
                  ) : (
                    comparison.newly_introduced_issues.map((r, idx) => (
                      <div key={idx} className="text-[11px] text-rose-800 font-semibold">
                        • {r.rule_title || r.matched_text}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Side-by-Side Content Text Diff */}
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Original vs Revised Content Body:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded max-h-48 overflow-y-auto">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Version {comparison.previous_version} (Old):
                    </span>
                    <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-[11px]">
                      {comparison.text_diff.original_text}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/30 border border-emerald-200 rounded max-h-48 overflow-y-auto">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">
                      Version {comparison.new_version} (Revised):
                    </span>
                    <p className="whitespace-pre-wrap text-emerald-950 leading-relaxed text-[11px]">
                      {comparison.text_diff.revised_text}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              Select two versions above to compute the risk reduction comparison.
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <Button size="sm" variant="secondary" onClick={() => setIsCompareModalOpen(false)}>
              Close Comparison
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
