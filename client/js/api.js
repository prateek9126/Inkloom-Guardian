/**
 * Inkloom Guardian - API Client (Vanilla JavaScript)
 */
class ApiClient {
  constructor() {
    if (window.API_BASE_URL) {
      this.apiBase = window.API_BASE_URL;
    } else if (
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port && window.location.port !== '5000') ||
      (window.location.hostname === '127.0.0.1' && window.location.port && window.location.port !== '5000')
    ) {
      this.apiBase = 'http://localhost:5000/api';
    } else {
      this.apiBase = '/api';
    }
  }

  getToken() {
    return localStorage.getItem('inkloom_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('inkloom_token', token);
    } else {
      localStorage.removeItem('inkloom_token');
    }
  }

  async request(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let res;
    try {
      res = await fetch(`${this.apiBase}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      throw new Error(`Unable to connect to backend API server (${this.apiBase}). Ensure the server is running on port 5000.`);
    }

    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;
      try {
        const text = await res.text();
        if (text) {
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = text;
          }
        }
      } catch {
        // Fallback to default message
      }
      throw new Error(errorMessage);
    }

    return res.json();
  }

  // --- Auth ---
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async demoLogin(role = 'admin') {
    const res = await this.request('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    this.setToken(res.token);
    return res;
  }

  async register(data) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // --- Dashboard ---
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // --- Brand Guidelines ---
  async getGuidelines(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/guidelines${query ? `?${query}` : ''}`);
  }

  async createGuideline(data) {
    return this.request('/guidelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGuideline(id, data) {
    return this.request(`/guidelines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGuideline(id) {
    return this.request(`/guidelines/${id}`, { method: 'DELETE' });
  }

  // --- Approved Claims ---
  async getClaims(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/claims${query ? `?${query}` : ''}`);
  }

  async createClaim(data) {
    return this.request('/claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClaim(id, data) {
    return this.request(`/claims/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClaim(id) {
    return this.request(`/claims/${id}`, { method: 'DELETE' });
  }

  // --- Evidence Sources ---
  async getEvidenceSources(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/evidence${query ? `?${query}` : ''}`);
  }

  async getEvidenceSource(id) {
    return this.request(`/evidence/${id}`);
  }

  async uploadEvidenceSource(formData) {
    return this.request('/evidence', {
      method: 'POST',
      body: formData,
    });
  }

  async updateEvidenceSource(id, data) {
    return this.request(`/evidence/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvidenceSource(id) {
    return this.request(`/evidence/${id}`, { method: 'DELETE' });
  }

  // --- Claim Verification ---
  async getClaimVerification(contentId) {
    return this.request(`/claims-verification/content/${contentId}`);
  }

  async runClaimVerification(contentId) {
    return this.request(`/claims-verification/content/${contentId}/verify`, {
      method: 'POST',
    });
  }

  async reviewClaim(claimId, decision, notes, amended_classification) {
    return this.request(`/claims-verification/claim/${claimId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes, amended_classification }),
    });
  }

  async applyClaimCorrection(claimId, customCorrection) {
    return this.request(`/claims-verification/claim/${claimId}/apply-correction`, {
      method: 'POST',
      body: JSON.stringify({ corrected_text: customCorrection }),
    });
  }

  // --- Campaigns ---
  async getCampaigns() {
    return this.request('/campaigns');
  }

  async getCampaign(id) {
    return this.request(`/campaigns/${id}`);
  }

  async createCampaign(data) {
    return this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id, data) {
    return this.request(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Campaign Consistency Intelligence ---
  async getCampaignConsistency(campaignId) {
    return this.request(`/campaigns-consistency/${campaignId}`);
  }

  async scanCampaignConsistency(campaignId) {
    return this.request(`/campaigns-consistency/${campaignId}/scan`, {
      method: 'POST',
    });
  }

  async reviewCampaignContradiction(contradictionId, action, notes) {
    return this.request(`/campaigns-consistency/contradictions/${contradictionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  async getContradictionHistory(contradictionId) {
    return this.request(`/campaigns-consistency/contradictions/${contradictionId}/history`);
  }

  // --- Content Submissions ---
  async getContentSubmissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/content${query ? `?${query}` : ''}`);
  }

  async getContentSubmission(id) {
    return this.request(`/content/${id}`);
  }

  async submitContent(formData) {
    return this.request('/content', {
      method: 'POST',
      body: formData,
    });
  }

  async updateContentSubmission(id, data) {
    return this.request(`/content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async runRiskScan(id) {
    return this.request(`/content/${id}/scan`, {
      method: 'POST',
    });
  }

  async deleteContentSubmission(id) {
    return this.request(`/content/${id}`, { method: 'DELETE' });
  }

  async submitContentForReview(id) {
    return this.request(`/content/${id}/submit-for-review`, {
      method: 'POST',
    });
  }

  // --- Risk Analysis ---
  async getRiskReport(contentId) {
    return this.request(`/risk/report/${contentId}`);
  }

  async getScoringConfig() {
    return this.request('/risk/config');
  }

  async updateScoringConfig(config) {
    return this.request('/risk/config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });
  }

  async compareRevisions(contentId, oldVersion, newVersion) {
    const query = new URLSearchParams({
      old: String(oldVersion),
      ...(newVersion !== undefined ? { new: String(newVersion) } : {}),
    }).toString();
    return this.request(`/risk/compare/${contentId}?${query}`);
  }

  async updateViolationStatus(contentId, violationId, status, justification) {
    return this.request(`/risk/violations/${contentId}/${violationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, justification }),
    });
  }

  // --- Human Reviews & Approvals ---
  async getPendingReviews() {
    return this.request('/reviews/pending');
  }

  async submitReviewDecision(data) {
    return this.request('/reviews/decision', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async assignReviewer(content_id, reviewer_id) {
    return this.request('/reviews/assign', {
      method: 'POST',
      body: JSON.stringify({ content_id, reviewer_id }),
    });
  }

  async getComments(contentId) {
    return this.request(`/reviews/comments/${contentId}`);
  }

  async addComment(contentId, comment_text, is_internal_only = false) {
    return this.request(`/reviews/comments/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ comment_text, is_internal_only }),
    });
  }

  async getReviewHistory(contentId) {
    return this.request(`/reviews/history/${contentId}`);
  }

  async getSubmissionVersions(contentId) {
    return this.request(`/reviews/versions/${contentId}`);
  }

  // --- Audit Trail ---
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/audit${query ? `?${query}` : ''}`);
  }

  // --- Settings & Team ---
  async getSettings() {
    return this.request('/settings');
  }

  async updateSystemSettings(data) {
    return this.request('/settings/system', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async inviteTeamMember(data) {
    return this.request('/settings/team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeamMemberRole(memberId, role) {
    return this.request(`/settings/team/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async removeTeamMember(memberId) {
    return this.request(`/settings/team/${memberId}`, {
      method: 'DELETE',
    });
  }

  async resetDemonstrationData() {
    return this.request('/settings/reset-demo', {
      method: 'POST',
    });
  }

  // --- Policy Learning ---
  async getPolicyLearningSummary() {
    return this.request('/policy-learning/summary');
  }

  async getFrequentlyViolatedRules() {
    return this.request('/policy-learning/frequently-violated');
  }

  async getApprovedCorrectionExamples(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/policy-learning/approved-examples${query ? `?${query}` : ''}`);
  }

  async getRecurringQualityIssues() {
    return this.request('/policy-learning/recurring-issues');
  }

  async getPolicyRecommendations(status) {
    return this.request(`/policy-learning/recommendations${status ? `?status=${status}` : ''}`);
  }

  async generatePolicyRecommendations() {
    return this.request('/policy-learning/recommendations/generate', {
      method: 'POST',
    });
  }

  async approvePolicyRecommendation(id, reviewNotes) {
    return this.request(`/policy-learning/recommendations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
  }

  async rejectPolicyRecommendation(id, reviewNotes) {
    return this.request(`/policy-learning/recommendations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
  }

  async getReviewerFeedbackRecords(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/policy-learning/feedback${query ? `?${query}` : ''}`);
  }

  async updateFeedbackRecord(id, updates) {
    return this.request(`/policy-learning/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async purgeFeedbackRecord(id, reason) {
    return this.request(`/policy-learning/feedback/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  // --- Demo Mode ---
  async getDemoStatus() {
    return this.request('/demo/status');
  }

  async seedDemo(force = false) {
    return this.request('/demo/seed', {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }

  async resetDemo() {
    return this.request('/demo/reset', {
      method: 'POST',
    });
  }

  async switchDemoUser(role) {
    return this.request('/demo/switch-user', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  async getDemoSnippets() {
    return this.request('/demo/snippets');
  }

  async getDemoWalkthroughSteps() {
    return this.request('/demo/walkthrough-steps');
  }
}

window.api = new ApiClient();
