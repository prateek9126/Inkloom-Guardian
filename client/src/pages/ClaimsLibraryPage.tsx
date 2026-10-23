import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { ApprovedClaim, ClaimVerificationStatus } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import {
  BookmarkCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Trash2,
  Edit2,
  AlertTriangle,
} from 'lucide-react';

export const ClaimsLibraryPage: React.FC = () => {
  const { success, error } = useNotification();
  const [claims, setClaims] = useState<ApprovedClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<ApprovedClaim | null>(null);
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState<'Performance' | 'Financial' | 'Technical' | 'Sustainability' | 'Security'>('Performance');
  const [verificationStatus, setVerificationStatus] = useState<ClaimVerificationStatus>('verified');
  const [citationReference, setCitationReference] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [expirationDate, setExpirationDate] = useState('2026-12-31');
  const [approvedBy, setApprovedBy] = useState('Lead Regulatory Counsel');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClaims = async () => {
    try {
      const res = await api.getClaims({
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setClaims(res.claims);
    } catch (err: any) {
      error(err.message || 'Failed to fetch approved claims');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [categoryFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingClaim(null);
    setStatement('');
    setCategory('Performance');
    setVerificationStatus('verified');
    setCitationReference('');
    setEvidenceUrl('');
    setExpirationDate('2026-12-31');
    setApprovedBy('Lead Regulatory Counsel');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: ApprovedClaim) => {
    setEditingClaim(c);
    setStatement(c.claim_statement);
    setCategory(c.category);
    setVerificationStatus(c.verification_status);
    setCitationReference(c.citation_reference);
    setEvidenceUrl(c.evidence_url || '');
    setExpirationDate(c.expiration_date);
    setApprovedBy(c.approved_by);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement || !citationReference || !expirationDate) {
      error('Please complete statement, citation reference, and expiration date.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingClaim) {
        await api.updateClaim(editingClaim.id, {
          claim_statement: statement,
          category,
          verification_status: verificationStatus,
          citation_reference: citationReference,
          evidence_url: evidenceUrl,
          expiration_date: expirationDate,
          approved_by: approvedBy,
        });
        success('Approved claim record updated.');
      } else {
        await api.createClaim({
          claim_statement: statement,
          category,
          verification_status: verificationStatus,
          citation_reference: citationReference,
          evidence_url: evidenceUrl,
          expiration_date: expirationDate,
          approved_by: approvedBy,
        });
        success('New verified claim registered into approved library.');
      }
      setIsModalOpen(false);
      fetchClaims();
    } catch (err: any) {
      error(err.message || 'Failed to save claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this approved claim record?')) return;
    try {
      await api.deleteClaim(id);
      success('Claim record deleted.');
      fetchClaims();
    } catch (err: any) {
      error(err.message || 'Failed to delete claim');
    }
  };

  const getStatusBadge = (status: ClaimVerificationStatus) => {
    switch (status) {
      case 'verified':
        return <Badge variant="success">Verified</Badge>;
      case 'pending_evidence':
        return <Badge variant="warning">Pending Evidence</Badge>;
      case 'expired':
        return <Badge variant="danger">Expired</Badge>;
      case 'under_review':
        return <Badge variant="review">Under Review</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Approved Claims & Evidence Library
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified factual marketing claims backed by verified audits, empirical studies, and legal sign-off.
          </p>
        </div>

        <Button size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
          Register Approved Claim
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search claims or citations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchClaims()}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Categories</option>
              <option value="Performance">Performance</option>
              <option value="Security">Security</option>
              <option value="Technical">Technical</option>
              <option value="Sustainability">Sustainability</option>
              <option value="Financial">Financial</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Verification Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending_evidence">Pending Evidence</option>
              <option value="under_review">Under Review</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <Button size="sm" variant="secondary" onClick={fetchClaims}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Claims List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500">Loading approved claims library...</span>
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={BookmarkCheck}
          title="No Approved Claims Found"
          description="Register verified claims with legal citations to enable automated claim matching."
          actionText="Register Claim"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {claim.category}
                  </span>
                  {getStatusBadge(claim.verification_status)}
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-500">
                  <span>Usage: <strong className="font-mono text-slate-800">{claim.usage_count}x</strong></span>
                  <span>Expires: <strong className="font-mono text-slate-800">{claim.expiration_date}</strong></span>
                </div>
              </div>

              <blockquote className="mt-3 p-3 bg-slate-50 border-l-4 border-slate-900 rounded-r text-sm font-medium text-slate-900 leading-relaxed">
                "{claim.claim_statement}"
              </blockquote>

              <div className="mt-3 text-xs text-slate-600 space-y-1">
                <div>
                  <strong className="text-slate-800">Legal Citation:</strong> {claim.citation_reference}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Approved by: <strong className="text-slate-700">{claim.approved_by}</strong></span>
                  <div className="flex items-center space-x-2">
                    {claim.evidence_url && (
                      <a
                        href={claim.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Proof Document
                      </a>
                    )}
                    <button
                      onClick={() => handleOpenEdit(claim)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(claim.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClaim ? 'Edit Approved Claim' : 'Register Approved Marketing Claim'}
        subtitle="Anchor promotional statements to formal audit reports or certifications"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Verbatim Approved Claim Statement *
            </label>
            <textarea
              rows={3}
              required
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="e.g. Inkloom platform reduces enterprise content compliance review cycle times by 42% on average."
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
              >
                <option value="Performance">Performance</option>
                <option value="Security">Security</option>
                <option value="Technical">Technical</option>
                <option value="Sustainability">Sustainability</option>
                <option value="Financial">Financial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Verification Status
              </label>
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as any)}
                className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
              >
                <option value="verified">Verified (Approved)</option>
                <option value="pending_evidence">Pending Evidence</option>
                <option value="under_review">Under Review</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Legal Citation / Substantiation Ref *
            </label>
            <input
              type="text"
              required
              value={citationReference}
              onChange={(e) => setCitationReference(e.target.value)}
              placeholder="e.g. 2025 Enterprise Content Governance Benchmark Study §4.2"
              className="w-full text-xs border border-slate-300 rounded p-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Expiration / Re-cert Date *
              </label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Approved By (Legal / Counsel)
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="David Sterling (Lead Regulatory Counsel)"
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Evidence Document URL (Optional)
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://evidence.example.com/reports/audit-2025.pdf"
              className="w-full text-xs border border-slate-300 rounded p-2"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSubmitting}>
              {editingClaim ? 'Update Claim' : 'Register Claim'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
