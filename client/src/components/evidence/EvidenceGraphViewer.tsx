import React, { useState } from 'react';
import { EvidenceGraphData, EvidenceGraphNode, EvidenceGraphEdge } from '../../types';
import { Badge } from '../ui/Badge';
import { FileText, CheckCircle2, AlertTriangle, XCircle, Shield, BookOpen, UserCheck, Eye, Layers } from 'lucide-react';

interface EvidenceGraphViewerProps {
  data: EvidenceGraphData;
  onSelectClaim?: (claimId: string) => void;
}

export const EvidenceGraphViewer: React.FC<EvidenceGraphViewerProps> = ({ data, onSelectClaim }) => {
  const [selectedNode, setSelectedNode] = useState<EvidenceGraphNode | null>(data.nodes[0] || null);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredNodes = filterType === 'all'
    ? data.nodes
    : data.nodes.filter(n => n.type === filterType);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'content':
        return <FileText className="w-4 h-4 text-sky-600" />;
      case 'claim':
        return <CheckCircle2 className="w-4 h-4 text-indigo-600" />;
      case 'evidence_passage':
        return <BookOpen className="w-4 h-4 text-emerald-600" />;
      case 'source_document':
        return <Layers className="w-4 h-4 text-slate-700" />;
      case 'brand_rule':
        return <Shield className="w-4 h-4 text-amber-600" />;
      case 'human_decision':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const getNodeBadgeVariant = (node: EvidenceGraphNode) => {
    if (node.status === 'Supported') return 'supported';
    if (node.status === 'Contradicted') return 'contradicted';
    if (node.status === 'Needs Human Review') return 'review';
    if (node.status === 'Unverified') return 'unverified';
    if (node.severity === 'critical') return 'critical';
    if (node.severity === 'high') return 'danger';
    return 'neutral';
  };

  // Find incoming & outgoing edges for selected node
  const activeEdges = selectedNode
    ? data.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Top Controls */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Traceable Evidence Provenance Graph ({data.nodes.length} Nodes, {data.edges.length} Relations)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-medium text-slate-600">Filter Nodes:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Graph Entities</option>
            <option value="content">Content Asset</option>
            <option value="claim">Extracted Claims</option>
            <option value="evidence_passage">Evidence Passages</option>
            <option value="source_document">Approved Documents</option>
            <option value="brand_rule">Brand Rules</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 min-h-[460px]">
        {/* Visual Node Matrix & Relationship Map */}
        <div className="lg:col-span-8 p-5 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <p className="text-xs text-slate-500">
                Select any node in the evidence hierarchy to trace source passages, verbatim document page citations, and policy links.
              </p>
            </div>

            {/* Hierarchical Column View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Content Asset & Claims */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <FileText className="w-3.5 h-3.5" /> Content & Claims
                </div>
                <div className="space-y-2">
                  {filteredNodes
                    .filter(n => n.type === 'content' || n.type === 'claim')
                    .map(node => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSelectedNode(node);
                          if (node.type === 'claim' && onSelectClaim) {
                            const rawId = node.id.replace('claim-', '');
                            onSelectClaim(rawId);
                          }
                        }}
                        className={`w-full text-left p-3 rounded-md border text-xs transition-all ${
                          selectedNode?.id === node.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold capitalize flex items-center gap-1.5">
                            {getNodeIcon(node.type)}
                            {node.type.replace('_', ' ')}
                          </span>
                          {node.status && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              selectedNode?.id === node.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {node.status}
                            </span>
                          )}
                        </div>
                        <p className={`line-clamp-2 ${selectedNode?.id === node.id ? 'text-slate-200' : 'text-slate-600'}`}>
                          {node.label}
                        </p>
                      </button>
                    ))}
                </div>
              </div>

              {/* Column 2: Evidence Passages */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <BookOpen className="w-3.5 h-3.5" /> Source Passages
                </div>
                <div className="space-y-2">
                  {filteredNodes
                    .filter(n => n.type === 'evidence_passage')
                    .map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`w-full text-left p-3 rounded-md border text-xs transition-all ${
                          selectedNode?.id === node.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                            Passage
                          </span>
                          <span className="text-[10px] text-slate-400">Page {node.meta?.page || 1}</span>
                        </div>
                        <p className={`line-clamp-3 italic ${selectedNode?.id === node.id ? 'text-slate-200' : 'text-slate-600'}`}>
                          "{node.meta?.content}"
                        </p>
                      </button>
                    ))}
                  {filteredNodes.filter(n => n.type === 'evidence_passage').length === 0 && (
                    <div className="p-4 border border-dashed rounded text-center text-xs text-slate-400">
                      No passages linked for active filter.
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Approved Documents & Brand Rules */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <Layers className="w-3.5 h-3.5" /> Primary Docs & Rules
                </div>
                <div className="space-y-2">
                  {filteredNodes
                    .filter(n => n.type === 'source_document' || n.type === 'brand_rule')
                    .map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`w-full text-left p-3 rounded-md border text-xs transition-all ${
                          selectedNode?.id === node.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold capitalize flex items-center gap-1.5">
                            {getNodeIcon(node.type)}
                            {node.type === 'source_document' ? 'Doc' : 'Brand Rule'}
                          </span>
                          {node.status && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              node.status === 'Outdated' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {node.status}
                            </span>
                          )}
                        </div>
                        <p className={`line-clamp-2 ${selectedNode?.id === node.id ? 'text-slate-200' : 'text-slate-600'}`}>
                          {node.label}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Relationship Trace Bar */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Active Link Traceability:
            </div>
            <div className="flex flex-wrap gap-2">
              {activeEdges.map(e => (
                <div
                  key={e.id}
                  className="inline-flex items-center text-xs bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-700 shadow-xs"
                >
                  <span className="font-mono text-[10px] text-slate-400 mr-1.5">{e.source.split('-')[0]}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-medium text-slate-800">{e.label}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-mono text-[10px] text-slate-400 ml-1.5">{e.target.split('-')[0]}</span>
                </div>
              ))}
              {activeEdges.length === 0 && (
                <span className="text-xs text-slate-400 italic">Select a node above to trace its relationships.</span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Node Inspector Drawer */}
        <div className="lg:col-span-4 p-5 bg-white flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Entity Inspector
                  </span>
                  <Badge variant={getNodeBadgeVariant(selectedNode)}>
                    {selectedNode.status || selectedNode.type}
                  </Badge>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                  {selectedNode.label}
                </h4>
              </div>

              <div className="space-y-3 text-xs border-t border-slate-100 pt-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">Entity Type:</span>
                  <span className="font-mono text-slate-700 capitalize">{selectedNode.type.replace('_', ' ')}</span>
                </div>

                {selectedNode.meta?.fullText && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Full Claim Text:</span>
                    <p className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 leading-relaxed">
                      {selectedNode.meta.fullText}
                    </p>
                  </div>
                )}

                {selectedNode.meta?.confidence !== undefined && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Verification Confidence:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-slate-900 h-2 rounded-full"
                          style={{ width: `${Math.round(selectedNode.meta.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-800">{Math.round(selectedNode.meta.confidence * 100)}%</span>
                    </div>
                  </div>
                )}

                {selectedNode.meta?.content && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Passage Citation Excerpt:</span>
                    <p className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded text-slate-800 leading-relaxed font-serif text-xs">
                      "{selectedNode.meta.content}"
                    </p>
                    <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
                      <span>Page: {selectedNode.meta.page}</span>
                      <span>Section: {selectedNode.meta.section}</span>
                    </div>
                  </div>
                )}

                {selectedNode.meta?.version && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Document Version:</span>
                    <span className="font-semibold text-slate-800">v{selectedNode.meta.version}</span>
                    {selectedNode.meta.isOutdated && (
                      <span className="ml-2 text-red-600 font-medium">(Outdated/Expired)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select a node in the graph to inspect detailed attributes and evidence provenance.
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Inkloom Evidence Graph Engine</span>
            <span>Deterministic Provenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};
