import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { ContentSubmission, Campaign } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const ContentSubmissionsListPage: React.FC = () => {
  const { success, error } = useNotification();
  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchSubmissions = async () => {
    try {
      const res = await api.getContentSubmissions({
        status: statusFilter || undefined,
        campaignId: campaignFilter || undefined,
        search: search || undefined,
      });
      setSubmissions(res.submissions);
    } catch (err: any) {
      error(err.message || 'Failed to fetch content submissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    api.getCampaigns().then(res => setCampaigns(res.campaigns)).catch(() => {});
  }, [statusFilter, campaignFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSubmissions();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this submission and associated verification data?')) return;
    try {
      await api.deleteContentSubmission(id);
      success('Submission deleted.');
      fetchSubmissions();
    } catch (err: any) {
      error(err.message || 'Failed to delete submission');
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="critical">Critical Risk</Badge>;
      case 'high':
        return <Badge variant="danger">High Risk</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="success">Low Risk</Badge>;
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
        return <Badge variant="warning">Analyzing...</Badge>;
      case 'analysis_complete':
        return <Badge variant="info">Analysis Complete</Badge>;
      case 'draft':
        return <Badge variant="neutral">Draft</Badge>;
      case 'rejected':
        return <Badge variant="critical">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  const handleSubmitForReview = async (id: string) => {
    try {
      await api.submitContentForReview(id);
      success('Content draft submitted for human review.');
      fetchSubmissions();
    } catch (err: any) {
      error(err.message || 'Failed to submit for review');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Content Submissions Repository
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track communication assets across channels, inspect risk findings, and launch evidence cross-examination.
          </p>
        </div>

        <Link to="/submissions/new">
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            New Submission
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card>
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by title or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Review Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
        </form>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500">Loading submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Submissions Found"
          description="Try adjusting your filters or submit a new content draft."
          actionText="Submit New Content"
          onAction={() => window.location.href = '/submissions/new'}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Title / Channel</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 max-w-sm">
                      <Link
                        to={`/claim-verification?contentId=${sub.id}`}
                        className="font-semibold text-slate-900 hover:underline block truncate"
                      >
                        {sub.title}
                      </Link>
                      <span className="text-[11px] text-slate-500">{sub.channel}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {sub.campaign_name ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                          {sub.campaign_code || sub.campaign_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(sub.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {getRiskBadge(sub.risk_level)}
                        <span className="font-mono text-slate-500">{sub.risk_score}/100</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[120px]">
                      {sub.author_name || 'Marketing'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {['draft', 'analysis_complete', 'needs_revision'].includes(sub.status) && (
                        <button
                          onClick={() => handleSubmitForReview(sub.id)}
                          className="inline-flex items-center text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded px-2.5 py-1 transition-colors"
                        >
                          Submit for Review
                        </button>
                      )}
                      <Link
                        to={`/risk-analysis?contentId=${sub.id}`}
                        className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2.5 py-1 bg-white hover:bg-slate-50"
                      >
                        Risk Report
                      </Link>
                      <Link
                        to={`/claim-verification?contentId=${sub.id}`}
                        className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2.5 py-1 bg-white hover:bg-slate-50"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                        Verify Claims
                      </Link>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
