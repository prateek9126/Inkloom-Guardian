import {
  User,
  BrandGuideline,
  ApprovedClaim,
  EvidenceSource,
  Campaign,
  ContentSubmission,
  RiskReport,
  ReviewApproval,
  AuditLog,
  SystemSettings,
  DashboardMetrics,
  ExtractedClaim,
  EvidenceGraphData,
  CampaignFact,
  CampaignContradiction,
  CampaignConsistencyScoreBreakdown,
  CampaignReviewAction,
  ContentVersion,
  SubmissionComment,
  RiskReductionComparison,
  RiskScoringConfig,
  SubmissionStatus,
  DemoStatus,
  DemoWalkthroughStep,
  DemoSnippets,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('inkloom_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('inkloom_token', token);
    } else {
      localStorage.removeItem('inkloom_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = await res.text() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  }

  // Auth
  public async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async demoLogin(role: string = 'admin'): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    this.setToken(res.token);
    return res;
  }

  public async register(data: {
    orgName: string;
    fullName: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // Dashboard
  public async getDashboardStats(): Promise<{
    metrics: DashboardMetrics;
    recentSubmissions: ContentSubmission[];
    recentActivity: AuditLog[];
  }> {
    return this.request('/dashboard/stats');
  }

  // Brand Guidelines
  public async getGuidelines(params?: { category?: string; severity?: string; search?: string }): Promise<{ guidelines: BrandGuideline[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/guidelines${query ? `?${query}` : ''}`);
  }

  public async createGuideline(data: Partial<BrandGuideline>): Promise<{ guideline: BrandGuideline }> {
    return this.request('/guidelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateGuideline(id: string, data: Partial<BrandGuideline>): Promise<{ guideline: BrandGuideline }> {
    return this.request(`/guidelines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteGuideline(id: string): Promise<{ success: boolean }> {
    return this.request(`/guidelines/${id}`, { method: 'DELETE' });
  }

  // Approved Claims
  public async getClaims(params?: { category?: string; status?: string; search?: string }): Promise<{ claims: ApprovedClaim[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/claims${query ? `?${query}` : ''}`);
  }

  public async createClaim(data: Partial<ApprovedClaim>): Promise<{ claim: ApprovedClaim }> {
    return this.request('/claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateClaim(id: string, data: Partial<ApprovedClaim>): Promise<{ claim: ApprovedClaim }> {
    return this.request(`/claims/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteClaim(id: string): Promise<{ success: boolean }> {
    return this.request(`/claims/${id}`, { method: 'DELETE' });
  }

  // Evidence Sources (Primary Company Documents)
  public async getEvidenceSources(params?: { documentType?: string; isOutdated?: boolean; search?: string }): Promise<{ sources: EvidenceSource[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/evidence${query ? `?${query}` : ''}`);
  }

  public async getEvidenceSource(id: string): Promise<{ source: EvidenceSource; passages: any[] }> {
    return this.request(`/evidence/${id}`);
  }

  public async uploadEvidenceSource(formData: FormData): Promise<{ source: EvidenceSource; passagesCount: number }> {
    return this.request('/evidence', {
      method: 'POST',
      body: formData,
    });
  }

  public async updateEvidenceSource(id: string, data: Partial<EvidenceSource>): Promise<{ source: EvidenceSource }> {
    return this.request(`/evidence/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteEvidenceSource(id: string): Promise<{ success: boolean }> {
    return this.request(`/evidence/${id}`, { method: 'DELETE' });
  }

  // Claim Verification & Evidence Graph
  public async getClaimVerification(contentId: string): Promise<{
    content: ContentSubmission;
    claims: ExtractedClaim[];
    evidenceGraph: EvidenceGraphData;
    summary: {
      total: number;
      supported: number;
      contradicted: number;
      unverified: number;
      needsReview: number;
      integrityScore: number;
    };
  }> {
    return this.request(`/claims-verification/content/${contentId}`);
  }

  public async runClaimVerification(contentId: string): Promise<any> {
    return this.request(`/claims-verification/content/${contentId}/verify`, {
      method: 'POST',
    });
  }

  public async reviewClaim(claimId: string, decision: 'confirmed' | 'rejected' | 'amended', notes?: string, amended_classification?: string): Promise<{ updatedClaim: ExtractedClaim }> {
    return this.request(`/claims-verification/claim/${claimId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes, amended_classification }),
    });
  }

  public async applyClaimCorrection(claimId: string, customCorrection?: string): Promise<{ success: boolean; updatedContentBody: string; appliedText: string }> {
    return this.request(`/claims-verification/claim/${claimId}/apply-correction`, {
      method: 'POST',
      body: JSON.stringify({ corrected_text: customCorrection }),
    });
  }

  // Campaigns
  public async getCampaigns(): Promise<{ campaigns: Campaign[] }> {
    return this.request('/campaigns');
  }

  public async getCampaign(id: string): Promise<{
    campaign: Campaign;
    assets: ContentSubmission[];
    consistencyAnalysis: any;
  }> {
    return this.request(`/campaigns/${id}`);
  }

  public async createCampaign(data: Partial<Campaign>): Promise<{ campaign: Campaign }> {
    return this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateCampaign(id: string, data: Partial<Campaign>): Promise<{ campaign: Campaign }> {
    return this.request(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Cross-Campaign Consistency Intelligence Engine
  public async getCampaignConsistency(campaignId: string): Promise<{
    campaign: Campaign;
    facts: CampaignFact[];
    contradictions: CampaignContradiction[];
    scoreBreakdown: CampaignConsistencyScoreBreakdown;
  }> {
    return this.request(`/campaigns-consistency/${campaignId}`);
  }

  public async scanCampaignConsistency(campaignId: string): Promise<{
    success: boolean;
    message: string;
    facts: CampaignFact[];
    contradictions: CampaignContradiction[];
    scoreBreakdown: CampaignConsistencyScoreBreakdown;
  }> {
    return this.request(`/campaigns-consistency/${campaignId}/scan`, {
      method: 'POST',
    });
  }

  public async reviewCampaignContradiction(
    contradictionId: string,
    action: 'resolve' | 'exception' | 'escalate',
    notes: string
  ): Promise<{ success: boolean; contradiction: CampaignContradiction }> {
    return this.request(`/campaigns-consistency/contradictions/${contradictionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  public async getContradictionHistory(contradictionId: string): Promise<{ history: CampaignReviewAction[] }> {
    return this.request(`/campaigns-consistency/contradictions/${contradictionId}/history`);
  }

  // Content Submissions
  public async getContentSubmissions(params?: {
    status?: string;
    campaignId?: string;
    channel?: string;
    riskLevel?: string;
    search?: string;
  }): Promise<{ submissions: ContentSubmission[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/content${query ? `?${query}` : ''}`);
  }

  public async getContentSubmission(id: string): Promise<{ submission: ContentSubmission }> {
    return this.request(`/content/${id}`);
  }

  public async submitContent(formData: FormData): Promise<{ submission: ContentSubmission; scanReport: any }> {
    return this.request('/content', {
      method: 'POST',
      body: formData,
    });
  }

  public async updateContentSubmission(id: string, data: Partial<ContentSubmission>): Promise<{ submission: ContentSubmission }> {
    return this.request(`/content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async runRiskScan(id: string): Promise<{ submission: ContentSubmission; scanReport: any }> {
    return this.request(`/content/${id}/scan`, {
      method: 'POST',
    });
  }

  public async deleteContentSubmission(id: string): Promise<{ success: boolean }> {
    return this.request(`/content/${id}`, { method: 'DELETE' });
  }

  public async submitContentForReview(id: string): Promise<{ success: boolean; message: string; submission: ContentSubmission }> {
    return this.request(`/content/${id}/submit-for-review`, {
      method: 'POST',
    });
  }

  // Risk Reports & Explainable Risk Engine
  public async getRiskReport(contentId: string): Promise<{
    content: ContentSubmission;
    report: RiskReport | null;
  }> {
    return this.request(`/risk/report/${contentId}`);
  }

  public async getScoringConfig(): Promise<{ config: RiskScoringConfig }> {
    return this.request('/risk/config');
  }

  public async updateScoringConfig(config: Partial<RiskScoringConfig>): Promise<{ success: boolean; config: RiskScoringConfig }> {
    return this.request('/risk/config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }

  public async compareRevisions(contentId: string, oldVersion: number, newVersion?: number): Promise<{ comparison: RiskReductionComparison }> {
    const query = new URLSearchParams({
      old: String(oldVersion),
      ...(newVersion !== undefined ? { new: String(newVersion) } : {}),
    }).toString();
    return this.request(`/risk/compare/${contentId}?${query}`);
  }

  public async updateViolationStatus(contentId: string, violationId: string, status: string, justification?: string): Promise<any> {
    return this.request(`/risk/violations/${contentId}/${violationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, justification }),
    });
  }

  // Human Review & Approvals Workflow
  public async getPendingReviews(): Promise<{ pendingReviews: any[] }> {
    return this.request('/reviews/pending');
  }

  public async submitReviewDecision(data: {
    content_id: string;
    stage?: string;
    decision: 'approved' | 'rejected' | 'needs_revision' | 'revision_requested';
    feedback_notes: string;
    conditions?: string;
  }): Promise<{ approval: ReviewApproval; updatedStatus: string }> {
    return this.request('/reviews/decision', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async assignReviewer(content_id: string, reviewer_id: string): Promise<{ success: boolean; assigned_reviewer_id: string; reviewerName: string }> {
    return this.request('/reviews/assign', {
      method: 'POST',
      body: JSON.stringify({ content_id, reviewer_id }),
    });
  }

  public async getComments(contentId: string): Promise<{ comments: SubmissionComment[] }> {
    return this.request(`/reviews/comments/${contentId}`);
  }

  public async addComment(contentId: string, comment_text: string, is_internal_only?: boolean): Promise<{ comment: SubmissionComment }> {
    return this.request(`/reviews/comments/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ comment_text, is_internal_only }),
    });
  }

  public async getReviewHistory(contentId: string): Promise<{ history: ReviewApproval[]; auditLogs?: any[] }> {
    return this.request(`/reviews/history/${contentId}`);
  }

  public async getSubmissionVersions(contentId: string): Promise<{ versions: ContentVersion[] }> {
    return this.request(`/reviews/versions/${contentId}`);
  }

  // Audit
  public async getAuditLogs(params?: {
    resourceType?: string;
    action?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number; limit: number; offset: number }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/audit${query ? `?${query}` : ''}`);
  }

  // Settings
  public async getSettings(): Promise<{
    organization: any;
    settings: SystemSettings;
    team: User[];
  }> {
    return this.request('/settings');
  }

  public async updateSystemSettings(data: Partial<SystemSettings>): Promise<{ settings: SystemSettings }> {
    return this.request('/settings/system', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async inviteTeamMember(data: { email: string; full_name: string; role: string; temporary_password?: string }): Promise<{ user: User }> {
    return this.request('/settings/team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateTeamMemberRole(memberId: string, role: string): Promise<{ user: User }> {
    return this.request(`/settings/team/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  public async removeTeamMember(memberId: string): Promise<{ success: boolean }> {
    return this.request(`/settings/team/${memberId}`, {
      method: 'DELETE',
    });
  }

  public async resetDemonstrationData(): Promise<{ success: boolean; message: string }> {
    return this.request('/settings/reset-demo', {
      method: 'POST',
    });
  }

  // ==========================================
  // Policy Learning from Reviewer Feedback
  // ==========================================

  public async getPolicyLearningSummary(): Promise<{
    total_feedback_records: number;
    overall_acceptance_rate: number;
    frequently_violated_rules: any[];
    recurring_quality_issues: any[];
    candidate_recommendations_count: { pending: number; approved: number; rejected: number };
  }> {
    return this.request('/policy-learning/summary');
  }

  public async getFrequentlyViolatedRules(): Promise<{ rules: any[] }> {
    return this.request('/policy-learning/frequently-violated');
  }

  public async getApprovedCorrectionExamples(params?: {
    ruleId?: string;
    queryText?: string;
  }): Promise<{ samples: any[]; disclaimer: string }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/policy-learning/approved-examples${query ? `?${query}` : ''}`);
  }

  public async getRecurringQualityIssues(): Promise<{ issues: any[] }> {
    return this.request('/policy-learning/recurring-issues');
  }

  public async getPolicyRecommendations(status?: string): Promise<{ recommendations: any[] }> {
    return this.request(`/policy-learning/recommendations${status ? `?status=${status}` : ''}`);
  }

  public async generatePolicyRecommendations(): Promise<{
    success: boolean;
    generatedCount: number;
    recommendations: any[];
  }> {
    return this.request('/policy-learning/recommendations/generate', {
      method: 'POST',
    });
  }

  public async approvePolicyRecommendation(
    id: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; message: string; recommendation: any; updatedRule?: any }> {
    return this.request(`/policy-learning/recommendations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
  }

  public async approveCandidateRecommendation(
    id: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; message: string; recommendation: any; updatedRule?: any }> {
    return this.approvePolicyRecommendation(id, reviewNotes);
  }

  public async rejectPolicyRecommendation(
    id: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; message: string; recommendation: any }> {
    return this.request(`/policy-learning/recommendations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
  }

  public async getReviewerFeedbackRecords(filters?: {
    decisionType?: string;
    status?: string;
    ruleId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: any[]; total: number }> {
    const query = new URLSearchParams(filters as any).toString();
    return this.request(`/policy-learning/feedback${query ? `?${query}` : ''}`);
  }

  public async updateFeedbackRecord(
    id: string,
    updates: { reviewerNotes?: string; status?: string }
  ): Promise<{ success: boolean; record: any }> {
    return this.request(`/policy-learning/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async purgeFeedbackRecord(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/policy-learning/feedback/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  // ==========================================
  // DEMO MODE & JUDGE INTERACTIVE WALKTHROUGH
  // ==========================================

  public async getDemoStatus(): Promise<{ status: string; data: DemoStatus }> {
    return this.request('/demo/status');
  }

  public async seedDemo(force = false): Promise<{
    status: string;
    message: string;
    orgId: string;
    demoStatus: DemoStatus;
    auth: { token: string; user: User; org: any };
  }> {
    return this.request('/demo/seed', {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }

  public async resetDemo(): Promise<{
    status: string;
    message: string;
    orgId: string;
    demoStatus: DemoStatus;
    auth: { token: string; user: User; org: any };
  }> {
    return this.request('/demo/reset', {
      method: 'POST',
    });
  }

  public async switchDemoUser(role: string): Promise<{
    status: string;
    message: string;
    token: string;
    user: User;
    organization: any;
  }> {
    return this.request('/demo/switch-user', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  public async getDemoSnippets(): Promise<{ status: string; snippets: DemoSnippets }> {
    return this.request('/demo/snippets');
  }

  public async getDemoWalkthroughSteps(): Promise<{ status: string; steps: DemoWalkthroughStep[] }> {
    return this.request('/demo/walkthrough-steps');
  }
}

export const api = new ApiClient();
