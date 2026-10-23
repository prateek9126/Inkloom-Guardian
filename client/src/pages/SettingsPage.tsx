import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { User, SystemSettings, DemoStatus } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DemoBadge } from '../components/demo/DemoBadge';
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCcw,
  Compass,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { success, error, info } = useNotification();
  const [organization, setOrganization] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // System settings state
  const [llmProvider, setLlmProvider] = useState('mock');
  const [llmModel, setLlmModel] = useState('inkloom-deterministic-v2');
  const [strictnessLevel, setStrictnessLevel] = useState<'lenient' | 'standard' | 'strict'>('standard');
  const [autoScan, setAutoScan] = useState(true);
  const [dualApproval, setDualApproval] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('content_creator');
  const [isInviting, setIsInviting] = useState(false);

  // Reset demo loading
  const { setAuthSession } = useAuth();
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [isResettingVolterra, setIsResettingVolterra] = useState(false);

  const fetchSettings = async () => {
    try {
      const [res, demoRes] = await Promise.all([
        api.getSettings(),
        api.getDemoStatus().catch(() => ({ status: 'error', data: { isInitialized: false } })),
      ]);
      setOrganization(res.organization);
      setSettings(res.settings);
      setTeam(res.team);
      if (demoRes?.data) setDemoStatus(demoRes.data);

      if (res.settings) {
        setLlmProvider(res.settings.llm_provider);
        setLlmModel(res.settings.llm_model);
        setStrictnessLevel(res.settings.strictness_level);
        setAutoScan(res.settings.auto_scan_on_submit);
        setDualApproval(res.settings.require_dual_approval);
      }
    } catch (err: any) {
      error(err.message || 'Failed to fetch settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await api.updateSystemSettings({
        llm_provider: llmProvider,
        llm_model: llmModel,
        strictness_level: strictnessLevel,
        auto_scan_on_submit: autoScan,
        require_dual_approval: dualApproval,
      });
      setSettings(res.settings);
      success('AI Engine and governance settings updated.');
    } catch (err: any) {
      error(err.message || 'Failed to update settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleInviteTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) {
      error('Email and full name are required.');
      return;
    }

    setIsInviting(true);
    try {
      await api.inviteTeamMember({
        email: newEmail,
        full_name: newName,
        role: newRole,
      });
      success(`User ${newName} added to organization.`);
      setIsInviteModalOpen(false);
      setNewEmail('');
      setNewName('');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Failed to add team member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: string, name: string) => {
    if (!window.confirm(`Remove user ${name} from organization?`)) return;
    try {
      await api.removeTeamMember(id);
      success('Team member removed.');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Failed to remove member');
    }
  };

  const handleResetVolterraDemo = async () => {
    if (
      !window.confirm(
        'Reset ONLY the sandboxed VOLTERRA demonstration environment back to pristine baseline?\n\nThis restores all preloaded guidelines, certified evidence sheets, and deliberate contradictions.'
      )
    ) {
      return;
    }
    setIsResettingVolterra(true);
    try {
      const res = await api.resetDemo();
      setAuthSession(res.auth.token, res.auth.user);
      setDemoStatus(res.demoStatus);
      success('VOLTERRA demo environment restored to initial pristine state.');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Reset failed');
    } finally {
      setIsResettingVolterra(false);
    }
  };

  const handleResetDemoData = async () => {
    if (!window.confirm('Reset database to pristine demonstration state with verified claims and evidence sources?')) return;
    setIsResettingDemo(true);
    try {
      await api.resetDemonstrationData();
      success('Database successfully reset to pristine demonstration state.');
      fetchSettings();
    } catch (err: any) {
      error(err.message || 'Reset failed');
    } finally {
      setIsResettingDemo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Organization & Governance Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage enterprise tenant details, AI engine providers, strictness levels, and team role permissions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-sm text-slate-500">Loading settings...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tenant Profile */}
          <Card title="Enterprise Tenant Profile" subtitle="Organization credentials and security isolation">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Company Name</span>
                <span className="font-semibold text-slate-900 text-sm">{organization?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Tenant Slug</span>
                <span className="font-mono text-slate-700">{organization?.slug}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Tier Plan</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  {organization?.plan || 'Enterprise Guardian'}
                </span>
              </div>
            </div>
          </Card>

          {/* AI Engine & Provider Configuration */}
          <Card title="AI Intelligence Engine & Claim Verification Settings" subtitle="Configure automated scan providers and verification strictness">
            <form onSubmit={handleSaveSystemSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Intelligence Engine Provider
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2.5 bg-white font-medium"
                  >
                    <option value="mock">Inkloom Deterministic Heuristic Rule Engine (Out of the box)</option>
                    <option value="gemini">Google Gemini 1.5 Flash (via Enterprise API)</option>
                    <option value="openai">OpenAI GPT-4o Mini (via Enterprise API)</option>
                    <option value="anthropic">Anthropic Claude 3.5 Sonnet (via Enterprise API)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Deterministic engine operates with 100% reliability, zero external tokens required, and strict provenance verification.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Verification Strictness Level
                  </label>
                  <select
                    value={strictnessLevel}
                    onChange={(e) => setStrictnessLevel(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded p-2.5 bg-white font-medium"
                  >
                    <option value="strict">Strict (Requires exact numerical & passage alignment)</option>
                    <option value="standard">Standard (Flags minor deviations for human review)</option>
                    <option value="lenient">Lenient (Tolerates approximate marketing phrasing)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoScanSetting"
                    checked={autoScan}
                    onChange={(e) => setAutoScan(e.target.checked)}
                    className="h-4 w-4 text-slate-900 border-slate-300 rounded"
                  />
                  <label htmlFor="autoScanSetting" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Automatically trigger Claim Verification & Brand Risk scan on every new submission
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="dualApprovalSetting"
                    checked={dualApproval}
                    onChange={(e) => setDualApproval(e.target.checked)}
                    className="h-4 w-4 text-slate-900 border-slate-300 rounded"
                  />
                  <label htmlFor="dualApprovalSetting" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Enforce Dual Approval Gateway (Requires both Legal and Brand Director sign-off)
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" type="submit" isLoading={isSavingSettings}>
                  Save AI & Governance Settings
                </Button>
              </div>
            </form>
          </Card>

          {/* Team Members & Role Access Control */}
          <Card
            title={`Team Members & Role-Based Access (${team.length})`}
            subtitle="Grant reviewer, brand manager, or administrator permissions"
            actions={
              <Button size="sm" variant="secondary" onClick={() => setIsInviteModalOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                Add Member
              </Button>
            }
          >
            <div className="divide-y divide-slate-100 -mx-5 -my-5">
              {team.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-slate-900 block">{member.full_name}</span>
                    <span className="text-[11px] text-slate-500">{member.email}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono capitalize">
                      {member.role.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.full_name)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Demonstration Maintenance */}
          <Card
            title="VOLTERRA Demonstration Workspace Controls"
            subtitle="Manage judge demonstration environment and restore pristine hackathon baseline"
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900 rounded-lg text-white">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DemoBadge label="VOLTERRA SCENARIO" />
                    <span className="text-xs font-semibold text-slate-100">
                      {demoStatus?.orgName || 'VOLTERRA Energy Dynamics (Demo)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Fictional clean-tech EV battery manufacturer with deliberate cross-asset contradictions for hackathon evaluation.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleResetVolterraDemo}
                  isLoading={isResettingVolterra}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shrink-0"
                  icon={<RotateCcw className="w-3.5 h-3.5 text-white" />}
                >
                  Reset VOLTERRA Demo
                </Button>
              </div>

              {demoStatus?.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Campaign Assets</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {demoStatus.stats.campaignAssetsCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Brand Rules</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {demoStatus.stats.guidelinesCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Evidence Sources</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {demoStatus.stats.evidenceDocumentsCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Contradictions</span>
                    <span className="text-base font-bold text-red-600 font-mono">
                      {demoStatus.stats.contradictionsCount}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-700 font-medium">Standard Tenant Reset</p>
                  <p className="text-[11px] text-slate-500">
                    Resets generic baseline data for current tenant organization.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetDemoData}
                  isLoading={isResettingDemo}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reset Tenant Data
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Add Team Member"
        subtitle="Invite collaborator and assign governance privileges"
      >
        <form onSubmit={handleInviteTeam} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Jonathan Drake"
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Work Email Address *
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assigned Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
            >
              <option value="content_creator">Content Creator (Submit & edit drafts)</option>
              <option value="brand_manager">Brand Manager (Manage tone & voice guidelines)</option>
              <option value="compliance_officer">Compliance Officer (Review & legal sign-off)</option>
              <option value="admin">Administrator (Full tenant administration)</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isInviting}>
              Add User to Tenant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
