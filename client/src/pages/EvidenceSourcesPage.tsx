import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { EvidenceSource, SourcePassage } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  Layers,
  Plus,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Trash2,
  Eye,
  Calendar,
  Upload,
} from 'lucide-react';

export const EvidenceSourcesPage: React.FC = () => {
  const { success, error } = useNotification();
  const [sources, setSources] = useState<EvidenceSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View Passages Modal
  const [selectedSource, setSelectedSource] = useState<EvidenceSource | null>(null);
  const [passages, setPassages] = useState<SourcePassage[]>([]);
  const [isViewingPassages, setIsViewingPassages] = useState(false);

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDocType, setNewDocType] = useState('audit_report');
  const [newVersion, setNewVersion] = useState('1.0');
  const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSources = async () => {
    try {
      const res = await api.getEvidenceSources();
      setSources(res.sources);
    } catch (err: any) {
      error(err.message || 'Failed to fetch evidence sources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleOpenPassages = async (source: EvidenceSource) => {
    setSelectedSource(source);
    setIsViewingPassages(true);
    try {
      const res = await api.getEvidenceSource(source.id);
      setPassages(res.passages);
    } catch (err: any) {
      error(err.message || 'Failed to load source passages');
    }
  };

  const handleToggleOutdated = async (source: EvidenceSource) => {
    try {
      await api.updateEvidenceSource(source.id, { is_outdated: !source.is_outdated });
      success(`Updated document status to ${!source.is_outdated ? 'Outdated/Expired' : 'Active'}`);
      fetchSources();
    } catch (err: any) {
      error(err.message || 'Failed to update document status');
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!window.confirm('Delete this approved evidence source and all associated passage citations?')) return;
    try {
      await api.deleteEvidenceSource(id);
      success('Evidence source deleted.');
      fetchSources();
    } catch (err: any) {
      error(err.message || 'Failed to delete evidence source');
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || (!newContent && !selectedFile)) {
      error('Title and document content (or file upload) are required.');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('title', newTitle);
    formData.append('document_type', newDocType);
    formData.append('version', newVersion);
    formData.append('effective_date', newEffectiveDate);
    if (newExpirationDate) formData.append('expiration_date', newExpirationDate);
    if (newContent) formData.append('raw_content', newContent);
    if (selectedFile) formData.append('file', selectedFile);

    try {
      await api.uploadEvidenceSource(formData);
      success('Evidence document uploaded and chunked into traceable passages.');
      setIsUploadModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setSelectedFile(null);
      fetchSources();
    } catch (err: any) {
      error(err.message || 'Failed to upload evidence source');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Approved Evidence Sources Library
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified primary source documents (audit certificates, ESG reports, SLAs, benchmarks) used by the Verification Engine.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsUploadModalOpen(true)}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Upload Source Document
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500">Loading evidence documents...</span>
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Evidence Sources Available"
          description="Upload approved legal studies, audit certificates, or technical policies to anchor automated claim verification."
          actionText="Upload First Document"
          onAction={() => setIsUploadModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`p-5 rounded-lg border bg-white shadow-xs flex flex-col justify-between transition-all ${
                source.is_outdated
                  ? 'border-amber-300 bg-amber-50/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {source.document_type.replace('_', ' ')}
                  </span>
                  {source.is_outdated ? (
                    <Badge variant="review">Outdated / Expired</Badge>
                  ) : (
                    <Badge variant="success">Active Primary Source</Badge>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                    {source.title}
                  </h3>
                  {(source.title.includes('Volterra') || source.title.includes('[Demo]')) && (
                    <DemoBadge variant="outline" label="DEMO" />
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {source.raw_content}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span className="font-semibold text-slate-700 font-mono">v{source.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passages Chunked:</span>
                    <span className="font-semibold text-slate-700 font-mono">{source.passages_count || 'Multi'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective Date:</span>
                    <span className="text-slate-700">{source.effective_date}</span>
                  </div>
                  {source.expiration_date && (
                    <div className="flex justify-between">
                      <span>Expires:</span>
                      <span className="text-slate-700">{source.expiration_date}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenPassages(source)}
                  icon={<Eye className="w-3 h-3" />}
                >
                  Inspect Passages
                </Button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleToggleOutdated(source)}
                    title={source.is_outdated ? 'Mark Active' : 'Mark Outdated'}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                  >
                    <AlertTriangle className={`w-4 h-4 ${source.is_outdated ? 'text-amber-600' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteSource(source.id)}
                    title="Delete Document"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Inspect Source Passages */}
      <Modal
        isOpen={isViewingPassages}
        onClose={() => setIsViewingPassages(false)}
        title={selectedSource?.title || 'Document Passages'}
        subtitle={`Version ${selectedSource?.version} • Granular passages used for verification matching`}
        maxWidth="2xl"
      >
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {passages.map((p) => (
            <div key={p.id} className="p-3.5 border border-slate-200 rounded-md bg-slate-50/50 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-slate-800">
                  Section: {p.section_header || 'Body'}
                </span>
                <span className="font-mono bg-white px-2 py-0.5 border rounded">
                  Page {p.page_number || 1} • Passage #{p.passage_index}
                </span>
              </div>
              <p className="text-slate-800 font-serif italic bg-white p-2.5 border border-slate-200 rounded leading-relaxed">
                "{p.content}"
              </p>
            </div>
          ))}
        </div>
      </Modal>

      {/* MODAL 2: Upload Source Document */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Approved Evidence Source"
        subtitle="Ingest verified audit studies, ESG reports, or specifications into the verification repository"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSource} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Document Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. 2026 Enterprise SOC 2 Type II Attestation Report"
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Document Type
              </label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
              >
                <option value="audit_report">Audit Report / Attestation</option>
                <option value="certification">Official Certification</option>
                <option value="technical_spec">Technical Specification / SLA</option>
                <option value="benchmark_study">Benchmark Study / Empirical Data</option>
                <option value="esg_report">ESG & Sustainability Report</option>
                <option value="policy">Corporate Legal Policy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Document Version
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="1.0"
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Effective Date
              </label>
              <input
                type="date"
                required
                value={newEffectiveDate}
                onChange={(e) => setNewEffectiveDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Expiration / Re-cert Date (Optional)
              </label>
              <input
                type="date"
                value={newExpirationDate}
                onChange={(e) => setNewExpirationDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Upload Document File (PDF, TXT, DOCX)
            </label>
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-xs border border-slate-200 rounded p-2 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Document Text / Passages (Or Paste Verbatim)
            </label>
            <textarea
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste executive summary, metric tables, or audit findings..."
              className="w-full text-xs border border-slate-300 rounded p-2.5 font-mono"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSubmitting}>
              Upload & Chunk Passages
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
