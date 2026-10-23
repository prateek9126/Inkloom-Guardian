import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import {
  Campaign,
  ContentSubmission,
  CampaignContradiction,
  CampaignFact,
  CampaignConsistencyScoreBreakdown,
  SeverityLevel,
  ContradictionStatus,
} from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  Crosshair,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  RotateCw,
  Scale,
  ShieldAlert,
  Info,
  Check,
  AlertCircle,
  Eye,
  Calendar,
  DollarSign,
  Cpu,
  Layers,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';

export const CampaignWorkspacePage: React.FC = () => {
  const { success, error } = useNotification();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignAssets, setCampaignAssets] = useState<ContentSubmission[]>([]);
  const [contradictions, setContradictions] = useState<CampaignContradiction[]>([]);
  const [extractedFacts, setExtractedFacts] = useState<CampaignFact[]>([]);
  const [scoreBreakdown, setScoreBreakdown] = useState<CampaignConsistencyScoreBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Workspace View Tabs & Filters
  const [activeTab, setActiveTab] = useState<'contradictions' | 'side_by_side' | 'facts' | 'assets'>('contradictions');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContradictionForSideBySide, setSelectedContradictionForSideBySide] = useState<CampaignContradiction | null>(null);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<CampaignContradiction | null>(null);
  const [reviewAction, setReviewAction] = useState<'resolve' | 'exception' | 'escalate'>('resolve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Create Campaign Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [channels, setChannels] = useState('Landing Page, Social Media, Whitepaper, Email Campaign');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await api.getCampaigns();
      setCampaigns(res.campaigns);
      if (res.campaigns.length > 0 && !selectedCampaign) {
        // Prefer the demo Volterra EV launch campaign if available
        const demoCamp = res.campaigns.find(c => c.code === 'CAMP-VOLT-2026' || c.code === 'CAMP-2026-HW') || res.campaigns[0];
        handleSelectCampaign(demoCamp.id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCampaign = async (id: string) => {
    try {
      setIsLoading(true);
      const [campRes, consistencyRes] = await Promise.all([
        api.getCampaign(id),
        api.getCampaignConsistency(id),
      ]);

      setSelectedCampaign(campRes.campaign);
      setCampaignAssets(campRes.assets);
      setContradictions(consistencyRes.contradictions || []);
      setExtractedFacts(consistencyRes.facts || []);
      setScoreBreakdown(consistencyRes.scoreBreakdown || null);

      if (consistencyRes.contradictions?.length > 0) {
        setSelectedContradictionForSideBySide(consistencyRes.contradictions[0]);
      } else {
        setSelectedContradictionForSideBySide(null);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load campaign consistency intelligence');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleRunConsistencyScan = async () => {
    if (!selectedCampaign) return;
    setIsScanning(true);
    try {
      const res = await api.scanCampaignConsistency(selectedCampaign.id);
      setContradictions(res.contradictions || []);
      setExtractedFacts(res.facts || []);
      setScoreBreakdown(res.scoreBreakdown || null);
      if (res.contradictions?.length > 0) {
        setSelectedContradictionForSideBySide(res.contradictions[0]);
      }
      success('Cross-Campaign Consistency Intelligence Scan completed.');
      // Refresh list to update campaign score badge
      const updatedList = await api.getCampaigns();
      setCampaigns(updatedList.campaigns);
    } catch (err: any) {
      error(err.message || 'Consistency scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const openReviewModal = (contra: CampaignContradiction, action: 'resolve' | 'exception' | 'escalate') => {
    setReviewTarget(contra);
    setReviewAction(action);
    if (action === 'resolve') {
      setReviewNotes(`Accepted approved baseline (${contra.approved_truth_value || 'Official Standard'}). Collateral scheduled for harmonization.`);
    } else if (action === 'exception') {
      setReviewNotes('Authorized marketing exception approved for this distribution channel.');
    } else {
      setReviewNotes('Escalated to Regulatory Counsel and Brand Governance Director for review.');
    }
    setReviewModalOpen(true);
  };

  const submitReviewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;

    if (!reviewNotes.trim()) {
      error('Review justification notes are required for audit trail compliance.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await api.reviewCampaignContradiction(reviewTarget.id, reviewAction, reviewNotes.trim());
      success(`Contradiction marked as ${reviewAction}d successfully.`);
      setReviewModalOpen(false);

      // Re-fetch consistency state to show updated scores and badges
      if (selectedCampaign) {
        const refreshed = await api.getCampaignConsistency(selectedCampaign.id);
        setContradictions(refreshed.contradictions || []);
        setScoreBreakdown(refreshed.scoreBreakdown || null);
        const campList = await api.getCampaigns();
        setCampaigns(campList.campaigns);
      }
    } catch (err: any) {
      error(err.message || 'Failed to submit review action');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !description) {
      error('Name, code, and description are required.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.createCampaign({
        name,
        code,
        description,
        target_channels: channels.split(',').map((s) => s.trim()).filter(Boolean),
      });
      success('Campaign initialized in workspace.');
      setIsCreateModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
      await fetchCampaigns();
      handleSelectCampaign(res.campaign.id);
    } catch (err: any) {
      error(err.message || 'Failed to create campaign');
    } finally {
      setIsCreating(false);
    }
  };

  // Filter contradictions
  const filteredContradictions = contradictions.filter((c) => {
    if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const getSeverityBadgeVariant = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status: ContradictionStatus) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'exception': return 'info';
      case 'escalated': return 'warning';
      default: return 'critical';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cross-Campaign Consistency Intelligence
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Deterministic Grounding
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detect cross-asset contradictions, pricing discrepancies, expired promotional validity, and unauthorized specification variations across campaign rollouts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {selectedCampaign && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRunConsistencyScan}
              isLoading={isScanning}
              icon={<RotateCw className="w-3.5 h-3.5" />}
            >
              Scan Consistency
            </Button>
          )}
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
            New Campaign
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500 flex items-center">
            <RotateCw className="w-4 h-4 mr-2 animate-spin text-slate-400" />
            Analyzing cross-asset campaign consistency...
          </span>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title="No Campaigns Created"
          description="Create a campaign to track multi-channel asset consistency and claim alignment."
          actionText="Create Campaign"
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Campaign Selector Column */}
          <div className="lg:col-span-3 space-y-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Active Campaigns ({campaigns.length})
            </span>
            {campaigns.map((c) => {
              const isSelected = selectedCampaign?.id === c.id;
              const score = c.consistency_score ?? 100;
              const isLowScore = score < 70;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCampaign(c.id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.code}
                      </span>
                      {(c.code.includes('VOLT') || c.name.toLowerCase().includes('volterra')) && (
                        <DemoBadge variant="outline" label="DEMO" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold font-mono px-1.5 py-0.5 rounded ${
                        isSelected
                          ? isLowScore
                            ? 'bg-rose-950 text-rose-300'
                            : 'bg-emerald-950 text-emerald-300'
                          : isLowScore
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {score}% Score
                    </span>
                  </div>
                  <h3 className="font-semibold text-xs leading-snug">{c.name}</h3>
                  <p
                    className={`mt-1 text-[11px] line-clamp-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {c.description}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/20 flex items-center justify-between text-[10px]">
                    <span>{c.content_count || 0} Assets Deployed</span>
                    <span className="capitalize">{c.status}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Campaign Consistency Intelligence Engine Center */}
          <div className="lg:col-span-9 space-y-6">
            {selectedCampaign && (
              <>
                {/* Score & Transparent Deductions Breakdown Card */}
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-base font-bold text-slate-900">{selectedCampaign.name}</h2>
                          <Badge variant={selectedCampaign.status === 'active' ? 'success' : 'neutral'}>
                            {selectedCampaign.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                          {selectedCampaign.description}
                        </p>
                      </div>

                      {/* Transparent Consistency Score Block */}
                      <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 p-3 rounded-lg min-w-[240px]">
                        <div className="text-center pr-3 border-r border-slate-200">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">
                            Consistency
                          </span>
                          <span
                            className={`text-2xl font-black font-mono ${
                              (scoreBreakdown?.overall_score || 0) < 70
                                ? 'text-rose-600'
                                : (scoreBreakdown?.overall_score || 0) < 85
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {scoreBreakdown?.overall_score ?? selectedCampaign.consistency_score}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-rose-700 font-medium">Unresolved Conflicts:</span>
                            <span className="font-mono font-bold text-rose-700">
                              {scoreBreakdown?.unresolved_conflicts_count ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-emerald-700 font-medium">Confirmed / Resolved:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {scoreBreakdown?.confirmed_violations_count ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Unverified / Channel Gaps:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {scoreBreakdown?.unverified_info_count ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Non-Arbitrary Formula Explanation Notice */}
                    {scoreBreakdown && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500 bg-slate-50/60 p-2.5 rounded border border-slate-100">
                        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-700">Transparent Mathematical Formula: </span>
                          <span>{scoreBreakdown.explanation}</span>
                          <span className="block mt-0.5 text-slate-400 italic">
                            Inkloom Guardian uses explicit deterministic deduction rules and never fabricates empirical brand damage claims.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Channel Deployment Checklist */}
                  <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        Multi-Channel Deployment Coverage:
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Target Channels: {selectedCampaign.target_channels?.join(', ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {selectedCampaign.target_channels?.map((ch) => {
                        const isCovered = campaignAssets.some((a) => a.channel.toLowerCase() === ch.toLowerCase());
                        return (
                          <div
                            key={ch}
                            className={`px-2.5 py-1.5 rounded border flex items-center justify-between text-[11px] ${
                              isCovered
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                                : 'bg-amber-50 border-amber-200 text-amber-900 font-medium'
                            }`}
                          >
                            <span>{ch}</span>
                            {isCovered ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Workspace View Tabs */}
                  <div className="flex border-b border-slate-200 bg-white px-5">
                    <button
                      onClick={() => setActiveTab('contradictions')}
                      className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                        activeTab === 'contradictions'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Contradiction Reports ({contradictions.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('side_by_side')}
                      className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                        activeTab === 'side_by_side'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Side-by-Side Comparison</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('facts')}
                      className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                        activeTab === 'facts'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Extracted Facts Library ({extractedFacts.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('assets')}
                      className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                        activeTab === 'assets'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Linked Assets ({campaignAssets.length})</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: CONTRADICTION REPORTS */}
                {activeTab === 'contradictions' && (
                  <div className="space-y-4">
                    {/* Filters Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg text-xs">
                      <div className="flex items-center space-x-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-600">Filters:</span>
                        
                        {/* Severity Filter */}
                        <select
                          value={severityFilter}
                          onChange={(e) => setSeverityFilter(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700"
                        >
                          <option value="all">All Severities</option>
                          <option value="critical">Critical Only</option>
                          <option value="high">High Only</option>
                          <option value="medium">Medium Only</option>
                          <option value="low">Low Only</option>
                        </select>

                        {/* Status Filter */}
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700"
                        >
                          <option value="all">All Statuses</option>
                          <option value="unresolved">Unresolved</option>
                          <option value="resolved">Resolved</option>
                          <option value="exception">Justified Exception</option>
                          <option value="escalated">Escalated</option>
                        </select>
                      </div>

                      <div className="text-slate-500 text-[11px]">
                        Showing {filteredContradictions.length} of {contradictions.length} detected contradictions
                      </div>
                    </div>

                    {filteredContradictions.length === 0 ? (
                      <Card>
                        <EmptyState
                          icon={CheckCircle2}
                          title="No Contradictions Matching Filters"
                          description="All campaign assets satisfy consistency checks under the selected filters."
                        />
                      </Card>
                    ) : (
                      filteredContradictions.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
                        >
                          {/* Issue Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <Badge variant={getSeverityBadgeVariant(c.severity)}>
                                {c.severity.toUpperCase()}
                              </Badge>
                              <Badge variant={getStatusBadgeVariant(c.status)}>
                                {c.status.toUpperCase()}
                              </Badge>
                              <span className="font-bold text-xs text-slate-900">
                                {c.entity_name}
                              </span>
                            </div>

                            <span className="text-[11px] font-mono text-slate-400">
                              Type: {c.conflict_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>

                          {/* Side-by-Side Conflicting Assets Grid */}
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                              Affected Assets & Conflicting Values:
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {c.conflicting_assets.map((assetRef, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded border border-rose-200 bg-rose-50/40 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 truncate">
                                      {assetRef.asset_title}
                                    </span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                      {assetRef.channel}
                                    </span>
                                  </div>
                                  <div className="bg-white p-2 rounded border border-rose-200 font-mono text-rose-900 font-semibold text-[11px]">
                                    "{assetRef.raw_text}"
                                  </div>
                                  {assetRef.location && (
                                    <div className="text-[10px] text-slate-500">
                                      Location: {assetRef.location}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Approved Ground Truth Box */}
                          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-md text-xs space-y-1">
                            <div className="flex items-center space-x-1.5 text-emerald-900 font-semibold text-[11px] uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Approved Primary Source of Truth:</span>
                            </div>
                            <div className="text-slate-800 font-medium">
                              {c.approved_truth_ref}
                            </div>
                            {c.approved_truth_value && (
                              <div className="font-mono text-emerald-800 text-[11px] font-bold">
                                Certified Baseline: "{c.approved_truth_value}"
                              </div>
                            )}
                          </div>

                          {/* Explanation & Suggested Correction */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded border border-slate-200">
                              <span className="font-semibold text-slate-700 block mb-1">
                                Discrepancy Analysis:
                              </span>
                              <p className="text-slate-600 leading-relaxed text-[11px]">
                                {c.explanation}
                              </p>
                            </div>
                            <div className="p-3 bg-sky-50/60 rounded border border-sky-200">
                              <span className="font-semibold text-sky-900 block mb-1">
                                Recommended Action / Fix:
                              </span>
                              <p className="text-slate-700 leading-relaxed text-[11px]">
                                {c.suggested_correction}
                              </p>
                            </div>
                          </div>

                          {/* Resolution Notes / Action Details if reviewed */}
                          {c.resolved_by && (
                            <div className="p-2.5 bg-slate-100 rounded text-[11px] text-slate-600 flex items-center justify-between">
                              <div>
                                <span className="font-semibold">Review Decision: </span>
                                <span className="capitalize">{c.resolution_action?.replace(/_/g, ' ')}</span>
                                {c.resolved_by_name && <span> by {c.resolved_by_name}</span>}
                                {c.resolution_notes && (
                                  <span className="italic block mt-0.5 text-slate-500">
                                    "{c.resolution_notes}"
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : ''}
                              </span>
                            </div>
                          )}

                          {/* Human Review Actions Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => {
                                setSelectedContradictionForSideBySide(c);
                                setActiveTab('side_by_side');
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect in Side-by-Side View</span>
                            </button>

                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openReviewModal(c, 'exception')}
                              >
                                Mark Exception
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openReviewModal(c, 'escalate')}
                              >
                                Escalate
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openReviewModal(c, 'resolve')}
                                icon={<Check className="w-3.5 h-3.5" />}
                              >
                                Accept Correction
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 2: SIDE-BY-SIDE COMPARISON VIEWER */}
                {activeTab === 'side_by_side' && (
                  <div className="space-y-4">
                    {/* Contradiction Selector Pill Bar */}
                    <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                        Select Issue:
                      </span>
                      {contradictions.map((contra) => (
                        <button
                          key={contra.id}
                          onClick={() => setSelectedContradictionForSideBySide(contra)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                            selectedContradictionForSideBySide?.id === contra.id
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {contra.entity_name}
                        </button>
                      ))}
                    </div>

                    {selectedContradictionForSideBySide ? (
                      <div className="space-y-4">
                        {/* Selected Issue Meta Card */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Badge variant={getSeverityBadgeVariant(selectedContradictionForSideBySide.severity)}>
                                {selectedContradictionForSideBySide.severity.toUpperCase()}
                              </Badge>
                              <h3 className="font-bold text-sm text-slate-900">
                                {selectedContradictionForSideBySide.entity_name}
                              </h3>
                            </div>
                            <Badge variant={getStatusBadgeVariant(selectedContradictionForSideBySide.status)}>
                              {selectedContradictionForSideBySide.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600">
                            {selectedContradictionForSideBySide.explanation}
                          </p>
                          <div className="mt-2 text-xs font-mono text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                            Approved Baseline ({selectedContradictionForSideBySide.approved_truth_ref}):{' '}
                            <strong>{selectedContradictionForSideBySide.approved_truth_value}</strong>
                          </div>
                        </div>

                        {/* Side-by-Side Asset Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedContradictionForSideBySide.conflicting_assets.map((assetRef, idx) => {
                            const fullAsset = campaignAssets.find((a) => a.id === assetRef.asset_id);
                            return (
                              <div
                                key={idx}
                                className="bg-white border-2 border-slate-200 rounded-lg flex flex-col h-full shadow-sm"
                              >
                                <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                  <div>
                                    <h4 className="font-bold text-xs text-slate-900">{assetRef.asset_title}</h4>
                                    <span className="text-[11px] text-slate-500">Channel: {assetRef.channel}</span>
                                  </div>
                                  <Badge variant="warning">{assetRef.channel}</Badge>
                                </div>

                                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                                  <div>
                                    <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
                                      Conflicting Claim Detected:
                                    </span>
                                    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-2.5 rounded font-mono text-xs font-bold">
                                      "{assetRef.raw_text}"
                                    </div>
                                    {assetRef.location && (
                                      <div className="mt-1 text-[11px] text-slate-500">
                                        Location: {assetRef.location}
                                      </div>
                                    )}
                                  </div>

                                  {fullAsset && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                                        Excerpt from Content Draft:
                                      </span>
                                      <div className="bg-slate-50 p-2 rounded text-[11px] text-slate-600 font-serif line-clamp-5 leading-relaxed">
                                        {fullAsset.content_body}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="p-3 bg-slate-50/50 border-t border-slate-200 flex justify-between items-center text-[11px]">
                                  <Link
                                    to={`/claim-verification?contentId=${assetRef.asset_id}`}
                                    className="font-semibold text-slate-700 hover:text-slate-900"
                                  >
                                    Inspect Full Asset →
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <Card>
                        <EmptyState
                          icon={Scale}
                          title="No Issue Selected"
                          description="Select a contradiction issue from the list above to view assets side by side."
                        />
                      </Card>
                    )}
                  </div>
                )}

                {/* TAB 3: EXTRACTED FACTS LIBRARY */}
                {activeTab === 'facts' && (
                  <Card
                    title="Extracted Structured Facts Library"
                    subtitle="Deterministic entities parsed from submitted campaign assets"
                  >
                    {extractedFacts.length === 0 ? (
                      <EmptyState
                        icon={Layers}
                        title="No Structured Facts Found"
                        description="Run a consistency scan to extract prices, specifications, warranties, and promotional dates."
                      />
                    ) : (
                      <div className="overflow-x-auto -mx-5 -my-5">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-2.5 px-4">Entity Name</th>
                              <th className="py-2.5 px-4">Fact Type</th>
                              <th className="py-2.5 px-4">Normalized Value</th>
                              <th className="py-2.5 px-4">Raw Text Snippet</th>
                              <th className="py-2.5 px-4">Asset Channel</th>
                              <th className="py-2.5 px-4">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extractedFacts.map((f, i) => (
                              <tr key={f.id || i} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-4 font-semibold text-slate-900">{f.entity_name}</td>
                                <td className="py-2.5 px-4">
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                                    {f.fact_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                                  {f.normalized_value} {f.unit || ''}
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 font-serif max-w-xs truncate">
                                  "{f.raw_text}"
                                </td>
                                <td className="py-2.5 px-4 text-slate-500">{f.channel || 'Asset'}</td>
                                <td className="py-2.5 px-4 font-mono text-emerald-700">
                                  {(f.confidence * 100).toFixed(0)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}

                {/* TAB 4: LINKED ASSETS */}
                {activeTab === 'assets' && (
                  <Card
                    title={`Linked Campaign Assets (${campaignAssets.length})`}
                    subtitle="Assets governed under this campaign"
                    actions={
                      <Link to="/submissions/new">
                        <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}>
                          Submit New Asset
                        </Button>
                      </Link>
                    }
                  >
                    {campaignAssets.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No Assets Assigned"
                        description="No marketing drafts or press releases are assigned to this campaign yet."
                        actionText="Submit Asset"
                        onAction={() => (window.location.href = '/submissions/new')}
                      />
                    ) : (
                      <div className="divide-y divide-slate-100 -mx-5 -my-5">
                        {campaignAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                          >
                            <div>
                              <Link
                                to={`/claim-verification?contentId=${asset.id}`}
                                className="font-semibold text-xs text-slate-900 hover:underline block"
                              >
                                {asset.title}
                              </Link>
                              <span className="text-[11px] text-slate-500">
                                {asset.channel} • By {asset.author_name || 'Marketing Writer'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Badge variant={asset.status === 'approved' ? 'success' : 'warning'}>
                                {asset.status.replace('_', ' ')}
                              </Badge>
                              <Link
                                to={`/claim-verification?contentId=${asset.id}`}
                                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border rounded bg-white shadow-2xs"
                              >
                                Verify Claims
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Human Review Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Review Campaign Contradiction"
        subtitle={`Take governance action on: ${reviewTarget?.entity_name || ''}`}
      >
        {reviewTarget && (
          <form onSubmit={submitReviewDecision} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
              <div className="font-semibold text-slate-800">
                Issue: {reviewTarget.entity_name} ({reviewTarget.conflict_type.replace(/_/g, ' ')})
              </div>
              <div className="text-slate-600 text-[11px]">
                {reviewTarget.explanation}
              </div>
              <div className="font-mono text-emerald-800 font-bold text-[11px] pt-1">
                Approved Baseline: "{reviewTarget.approved_truth_value}"
              </div>
            </div>

            {/* Action Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Review Decision *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction('resolve')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    reviewAction === 'resolve'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Accept Correction
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('exception')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    reviewAction === 'exception'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Mark Exception
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('escalate')}
                  className={`p-2.5 rounded border text-xs font-medium text-center transition-colors ${
                    reviewAction === 'escalate'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Escalate
                </button>
              </div>
            </div>

            {/* Justification Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Justification & Audit Notes *
              </label>
              <textarea
                rows={3}
                required
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Explain the rationale for this decision..."
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" type="button" onClick={() => setReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" isLoading={isSubmittingReview}>
                Confirm Review Action
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Campaign Initiative"
        subtitle="Group multi-channel assets to ensure consistent messaging"
      >
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Cloud Security Launch"
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Campaign Code (Unique ID) *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CAMP-2026-CLOUD"
              className="w-full text-xs border border-slate-300 rounded p-2 font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target Distribution Channels (Comma-separated)
            </label>
            <input
              type="text"
              value={channels}
              onChange={(e) => setChannels(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Objective & Key Messaging Description *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State the core value proposition and mandatory policy constraints for this initiative..."
              className="w-full text-xs border border-slate-300 rounded p-2"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isCreating}>
              Initialize Campaign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
