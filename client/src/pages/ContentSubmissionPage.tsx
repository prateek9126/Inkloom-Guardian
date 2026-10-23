import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Campaign } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  Upload,
  FileText,
  FileImage,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Compass,
  RotateCcw,
} from 'lucide-react';

export const ContentSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error, info } = useNotification();

  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('Press Release');
  const [campaignId, setCampaignId] = useState('none');
  const [contentBody, setContentBody] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoScan, setAutoScan] = useState(true);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snippets, setSnippets] = useState<Record<string, any>>({});

  useEffect(() => {
    api.getDemoSnippets()
      .then((res) => setSnippets(res.snippets || {}))
      .catch((err) => console.error('Failed to load demo snippets:', err));
  }, []);

  const handleApplySnippet = (snippetKey: string) => {
    const s = snippets[snippetKey];
    if (!s) return;
    setTitle(s.title);
    setChannel(s.channel === 'Print & Billboard Ad' ? 'Ad Copy' : s.channel);
    setContentBody(s.body);

    // Auto-select volterra campaign if available
    const volterraCampaign = campaigns.find(
      (c) => c.name.toLowerCase().includes('volterra') || c.code.toLowerCase().includes('volt')
    );
    if (volterraCampaign) {
      setCampaignId(volterraCampaign.id);
    }
    info(`Loaded demo template: "${s.title}". ${s.issuesDescription || ''}`);
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await api.getCampaigns();
        setCampaigns(res.campaigns);
      } catch (err: any) {
        console.error('Failed to load campaigns:', err);
      } finally {
        setIsLoadingCampaigns(false);
      }
    };
    fetchCampaigns();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      info(`Attached file: ${file.name} (${Math.round(file.size / 1024)} KB). Text parser will extract content automatically.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      error('Please provide a submission title.');
      return;
    }
    if (!contentBody && !selectedFile) {
      error('Please enter content text or attach a document / image file.');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('channel', channel);
    formData.append('campaign_id', campaignId);
    formData.append('content_body', contentBody);
    formData.append('auto_scan', autoScan ? 'true' : 'false');
    if (selectedFile) {
      formData.append('attachment', selectedFile);
    }

    try {
      const res = await api.submitContent(formData);
      success('Content draft submitted and verified against evidence sources.');
      navigate(`/claim-verification?contentId=${res.submission.id}`);
    } catch (err: any) {
      error(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Submit Content for Governance & Verification
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Supports text, PDF whitepapers, and promotional imagery. Runs automated claim extraction and evidence cross-examination.
        </p>
      </div>

      {/* Quick-fill Demo Templates Bar */}
      <div className="bg-slate-900 rounded-lg p-4 text-white border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <DemoBadge label="DEMO QUICK FILL" />
            <span className="text-xs font-semibold text-slate-200">
              Load Preloaded Fictional Volterra Assets (Hackathon Evaluation)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">1-click form autofill</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleApplySnippet('volterra_ad')}
            className="text-left px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md transition text-xs"
          >
            <div className="font-semibold text-slate-100 flex items-center justify-between">
              <span>Print & Billboard Ad</span>
              <span className="text-[10px] text-red-400 font-mono">4 Issues</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              1,800 cycles, $5,800 price, missing disclaimer
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplySnippet('volterra_social')}
            className="text-left px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md transition text-xs"
          >
            <div className="font-semibold text-slate-100 flex items-center justify-between">
              <span>Social Media Post</span>
              <span className="text-[10px] text-amber-400 font-mono">Conflict</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              1,500 continuous cycles, $6,200 fleet pricing
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplySnippet('volterra_press_release')}
            className="text-left px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md transition text-xs"
          >
            <div className="font-semibold text-slate-100 flex items-center justify-between">
              <span>Press Release</span>
              <span className="text-[10px] text-emerald-400 font-mono">Ground Truth</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              1,200 cycles SAE J2288, $7,400 base
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplySnippet('volterra_corrected_ad')}
            className="text-left px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-emerald-800/80 rounded-md transition text-xs"
          >
            <div className="font-semibold text-emerald-300 flex items-center justify-between">
              <span>Remediated Ad (v2)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Score 12</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              Certified cycle data + EPA disclaimer
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Asset Metadata" subtitle="Target distribution channel and campaign alignment">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Asset Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 Cloud Security & Availability Executive Summary"
                className="w-full text-sm border border-slate-300 rounded-md p-2.5 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Distribution Channel *
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md p-2.5 bg-white focus:ring-1 focus:ring-slate-900"
                >
                  <option value="Press Release">Press Release</option>
                  <option value="Landing Page">Landing Page</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Whitepaper">Whitepaper / Technical Report</option>
                  <option value="Email Campaign">Email Campaign</option>
                  <option value="Ad Copy">Ad Copy / Banner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Associated Campaign
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md p-2.5 bg-white focus:ring-1 focus:ring-slate-900"
                >
                  <option value="none">None / Independent Asset</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Input Methods: File Upload or Direct Text */}
        <Card title="Content Body or Document Upload" subtitle="Paste draft or upload PDF / image file">
          <div className="space-y-4">
            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Upload Document or Poster Image'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to change`
                    : 'PDF, TXT, DOCX, PNG, JPG (OCR text extraction will be performed)'}
                </span>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Content Text Draft (Or Paste Directly)
                </label>
                {selectedFile && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Text will also be extracted from file if left blank
                  </span>
                )}
              </div>
              <textarea
                rows={8}
                value={contentBody}
                onChange={(e) => setContentBody(e.target.value)}
                placeholder="Paste marketing copy, press release paragraphs, product claims, or SLA promises..."
                className="w-full text-sm border border-slate-300 rounded-md p-3 focus:ring-1 focus:ring-slate-900 font-sans"
              />
            </div>

            {/* Auto-scan Checkbox */}
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="autoScan"
                checked={autoScan}
                onChange={(e) => setAutoScan(e.target.checked)}
                className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="autoScan" className="text-xs text-slate-700 font-medium cursor-pointer">
                Automatically run Claim Verification & Brand Risk Intelligence on submission
              </label>
            </div>
          </div>
        </Card>

        <div className="flex justify-end space-x-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/submissions')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Submit for Governance Scan
          </Button>
        </div>
      </form>
    </div>
  );
};
