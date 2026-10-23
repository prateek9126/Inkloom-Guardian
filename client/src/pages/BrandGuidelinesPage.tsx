import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { BrandGuideline, GuidelineCategory, SeverityLevel } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  FileCheck,
  Sparkles,
} from 'lucide-react';

export const BrandGuidelinesPage: React.FC = () => {
  const { success, error } = useNotification();
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Create / Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GuidelineCategory>('forbidden_terms');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('high');
  const [forbiddenWordsStr, setForbiddenWordsStr] = useState('');
  const [requiredPhrasesStr, setRequiredPhrasesStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGuidelines = async () => {
    try {
      const res = await api.getGuidelines({
        category: categoryFilter || undefined,
        severity: severityFilter || undefined,
        search: search || undefined,
      });
      setGuidelines(res.guidelines);
    } catch (err: any) {
      error(err.message || 'Failed to load brand guidelines');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, [categoryFilter, severityFilter]);

  const handleOpenCreate = () => {
    setEditingGuideline(null);
    setTitle('');
    setCategory('forbidden_terms');
    setDescription('');
    setSeverity('high');
    setForbiddenWordsStr('');
    setRequiredPhrasesStr('');
    setIsModalOpen(true);
  };

  const handleLoadDemoTemplate = () => {
    setTitle('[Demo] Prohibit Absolute Degradation & Superlative Range Claims');
    setCategory('forbidden_terms');
    setSeverity('critical');
    setDescription(
      'Physical battery degradation is governed by thermodynamics. Claims of zero degradation violate FTC guidelines and require verified cycle testing metrics.'
    );
    setForbiddenWordsStr(
      'zero degradation, infinite battery life, indestructible, charges in seconds, never needs replacement'
    );
    setRequiredPhrasesStr('validated under SAE J2288, nominal capacity');
    success('Loaded Volterra EV Battery guideline template.');
  };

  const handleOpenEdit = (g: BrandGuideline) => {
    setEditingGuideline(g);
    setTitle(g.title);
    setCategory(g.category);
    setDescription(g.description);
    setSeverity(g.severity);
    setForbiddenWordsStr((g.rules.forbiddenWords || []).join(', '));
    setRequiredPhrasesStr((g.rules.requiredPhrases || []).join(', '));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      error('Title and description are required.');
      return;
    }

    setIsSubmitting(true);
    const rules = {
      forbiddenWords: forbiddenWordsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      requiredPhrases: requiredPhrasesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingGuideline) {
        await api.updateGuideline(editingGuideline.id, {
          title,
          category,
          description,
          severity,
          rules,
        });
        success('Brand guideline updated and version incremented.');
      } else {
        await api.createGuideline({
          title,
          category,
          description,
          severity,
          rules,
          is_active: true,
        });
        success('New brand guideline registered into policy rule engine.');
      }
      setIsModalOpen(false);
      fetchGuidelines();
    } catch (err: any) {
      error(err.message || 'Failed to save guideline');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this brand guideline from the policy rule engine?')) return;
    try {
      await api.deleteGuideline(id);
      success('Guideline deleted.');
      fetchGuidelines();
    } catch (err: any) {
      error(err.message || 'Failed to delete guideline');
    }
  };

  const getSeverityBadge = (level: SeverityLevel) => {
    switch (level) {
      case 'critical':
        return <Badge variant="critical">Critical</Badge>;
      case 'high':
        return <Badge variant="danger">High</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="success">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Brand Guidelines & Policy Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure tone, prohibited hyperbole, mandatory disclaimers, and channel-specific visual standards.
          </p>
        </div>

        <Button size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
          Create Policy Rule
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
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchGuidelines()}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Rule Categories</option>
              <option value="forbidden_terms">Prohibited Terms & Superlatives</option>
              <option value="tone_voice">Tone & Voice Standards</option>
              <option value="mandatory_disclaimers">Mandatory Disclaimers</option>
              <option value="visual_guideline">Visual & Attribution Rules</option>
              <option value="regulatory">Regulatory Compliance</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <Button size="sm" variant="secondary" onClick={fetchGuidelines}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Guidelines Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500">Loading brand rules...</span>
        </div>
      ) : guidelines.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Guidelines Found"
          description="Create your first brand guideline rule or adjust your search filter."
          actionText="Create Rule"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {guidelines.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-lg border border-slate-200 bg-white shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {g.category.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    {getSeverityBadge(g.severity)}
                    <span className="text-[10px] font-mono text-slate-400">v{g.version}</span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">{g.title}</h3>
                  {(g.title.includes('[Demo]') || g.title.toLowerCase().includes('volterra')) && (
                    <DemoBadge variant="outline" label="DEMO" />
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{g.description}</p>

                {/* Prohibited Terms List */}
                {g.rules?.forbiddenWords && g.rules.forbiddenWords.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Prohibited Phrases:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {g.rules.forbiddenWords.map((w, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[11px] font-mono"
                        >
                          "{w}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required Phrases */}
                {g.rules?.requiredPhrases && g.rules.requiredPhrases.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Mandatory Phrasing / Disclaimers:
                    </span>
                    <div className="space-y-1">
                      {g.rules.requiredPhrases.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-serif italic"
                        >
                          "{p}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>By {g.author_name || 'Brand Director'}</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenEdit(g)}
                    className="p-1 text-slate-500 hover:text-slate-900 rounded"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-1 text-slate-500 hover:text-red-600 rounded"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGuideline ? 'Edit Brand Guideline Rule' : 'Create Brand Guideline Rule'}
        subtitle="Enforce automated pattern matching and tone scoring in the risk scanner"
      >
        <div className="mb-3 flex items-center justify-between p-2.5 bg-slate-900 rounded-md text-white text-xs">
          <div className="flex items-center gap-2">
            <DemoBadge label="DEMO TEMPLATE" />
            <span className="text-[11px] text-slate-300">CleanTech EV Degradation Rule</span>
          </div>
          <button
            type="button"
            onClick={handleLoadDemoTemplate}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-emerald-300 border border-slate-700 transition"
          >
            Load Volterra Rule
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Rule Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prohibited Financial Performance Guarantees"
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GuidelineCategory)}
                className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
              >
                <option value="forbidden_terms">Forbidden Terms & Phrases</option>
                <option value="tone_voice">Tone & Voice</option>
                <option value="mandatory_disclaimers">Mandatory Disclaimers</option>
                <option value="visual_guideline">Visual & Attribution</option>
                <option value="regulatory">Regulatory</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Policy Description & Legal Intent *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the regulatory or brand justification for this guideline..."
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Prohibited Words / Phrases (Comma-separated)
            </label>
            <input
              type="text"
              value={forbiddenWordsStr}
              onChange={(e) => setForbiddenWordsStr(e.target.value)}
              placeholder="guaranteed ROI, zero risk, flawless, 100% risk free"
              className="w-full text-xs border border-slate-300 rounded p-2 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mandatory Phrasing / Disclaimers (Comma-separated)
            </label>
            <input
              type="text"
              value={requiredPhrasesStr}
              onChange={(e) => setRequiredPhrasesStr(e.target.value)}
              placeholder="Results may vary based on client infrastructure, Subject to enterprise SLA"
              className="w-full text-xs border border-slate-300 rounded p-2"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSubmitting}>
              {editingGuideline ? 'Update Rule' : 'Save Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
