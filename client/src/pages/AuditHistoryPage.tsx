import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { AuditLog } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import {
  History,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  User,
  Activity,
  Code,
} from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const { success, error } = useNotification();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [resourceFilter, setResourceFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Log JSON Details Drawer / Inspector
  const [inspectingLog, setInspectingLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await api.getAuditLogs({
        resourceType: resourceFilter || undefined,
        action: actionFilter || undefined,
        search: search || undefined,
        limit: 100,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err: any) {
      error(err.message || 'Failed to fetch audit history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [resourceFilter, actionFilter]);

  const handleExportCSV = () => {
    window.open('/api/audit/export?format=csv', '_blank');
    success('Exporting audit log CSV...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Immutable Compliance Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete cryptographic record of all content submissions, claim verifications, policy updates, and human approvals.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={handleExportCSV}
          icon={<Download className="w-3.5 h-3.5" />}
        >
          Export Audit Trail (CSV)
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
                placeholder="Search audit trail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Resource Types</option>
              <option value="content">Content Submissions</option>
              <option value="claim">Claims & Evidence</option>
              <option value="guideline">Brand Guidelines</option>
              <option value="evidence">Evidence Source Documents</option>
              <option value="org">Organization Settings</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Actions</option>
              <option value="CLAIM_VERIFICATION_EXECUTED">Claim Verification Executed</option>
              <option value="CLAIM_CORRECTION_APPLIED">Claim Correction Applied</option>
              <option value="CLAIM_DECISION_RECORDED">Claim Decision Recorded</option>
              <option value="APPROVAL_GRANTED">Approval Granted</option>
              <option value="CONTENT_SUBMITTED">Content Submitted</option>
              <option value="GUIDELINE_CREATED">Guideline Created</option>
              <option value="SOURCE_DOCUMENT_UPLOADED">Source Document Uploaded</option>
            </select>
          </div>

          <Button size="sm" variant="secondary" onClick={fetchLogs}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Table & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={inspectingLog ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <span className="text-sm text-slate-500">Retrieving audit events...</span>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Audit Logs Recorded"
              description="Events and modifications will automatically be recorded here with complete immutability."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setInspectingLog(log)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                          inspectingLog?.id === log.id ? 'bg-slate-100/70' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {log.action.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[130px]">
                          {log.user_name || 'System Engine'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {log.resource_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingLog(log);
                            }}
                            className="text-xs text-slate-600 hover:text-slate-900 underline"
                          >
                            Inspect
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

        {/* Selected Log Inspector Panel */}
        {inspectingLog && (
          <div className="lg:col-span-4">
            <Card
              title="Audit Event Inspector"
              subtitle={`ID: ${inspectingLog.id.slice(0, 8)}...`}
              actions={
                <button
                  onClick={() => setInspectingLog(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Close
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Event Type:
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {inspectingLog.action}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Timestamp:
                  </span>
                  <span className="font-mono text-slate-700">
                    {new Date(inspectingLog.created_at).toISOString()}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Actor:
                  </span>
                  <span className="font-medium text-slate-900">
                    {inspectingLog.user_name || 'System Auto-Engine'} ({inspectingLog.user_role || 'system'})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Client IP:
                  </span>
                  <span className="font-mono text-slate-600">
                    {inspectingLog.ip_address || '127.0.0.1'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 uppercase tracking-wider text-[10px]">
                    Payload & State Change Metadata:
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto max-h-[300px]">
                    {JSON.stringify(inspectingLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
