/**
 * Inkloom Guardian - Legal, Privacy, and Terms Views (Vanilla JS)
 */
window.LegalPageView = {
  renderPrivacy(container) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 font-sans">
        <div class="pb-2 border-b border-slate-200">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Privacy Policy & Data Handling Standards</h1>
          <p class="text-xs text-slate-500 mt-1">Enterprise Confidentiality, Zero AI Training Without Consent, and Data Retention.</p>
        </div>

        <div class="card-standard p-6 space-y-4 text-xs text-slate-700 leading-relaxed bg-white">
          <h2 class="text-sm font-bold text-slate-900">1. Zero AI Training on Confidential Customer Content</h2>
          <p>
            Inkloom Guardian operates under strict enterprise isolation. Customer marketing drafts, unannounced product specifications, and proprietary pricing sheets uploaded to this platform are never used to train generalized foundation models or shared across tenant boundaries.
          </p>

          <h2 class="text-sm font-bold text-slate-900">2. Localized In-Memory Engine & Storage Security</h2>
          <p>
            All extracted facts, claim benchmarks, and reviewer exceptions are stored securely with strict tenant isolation. In-memory data structures are encrypted in transit and at rest.
          </p>

          <h2 class="text-sm font-bold text-slate-900">3. Reviewer Decisions and Preference Learning</h2>
          <p>
            Stylistic preferences and approved phrasing recorded by reviewers are maintained exclusively for your organization. Policy learning models operate with explicit distinctions between observed human preferences and certified primary factual evidence.
          </p>

          <h2 class="text-sm font-bold text-slate-900">4. Right to Audit and Data Purge</h2>
          <p>
            Authorized administrators retain full capability to inspect, export, and permanently purge any feedback record, content submission, or audit event in accordance with GDPR and SOC-2 data retention policies.
          </p>
        </div>
      </div>
    `;
  },

  renderTerms(container) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 font-sans">
        <div class="pb-2 border-b border-slate-200">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Terms of Governance Service</h1>
          <p class="text-xs text-slate-500 mt-1">Deterministic Verification Disclaimer and Scope of AI Governance.</p>
        </div>

        <div class="card-standard p-6 space-y-4 text-xs text-slate-700 leading-relaxed bg-white">
          <h2 class="text-sm font-bold text-slate-900">1. Deterministic Scoring Disclaimer</h2>
          <p>
            Inkloom Guardian provides rule-based and deterministic verification against customer-provided primary evidence documents. An overall risk score of 100 or 0 represents an internal compliance metric based on detected contradictions and does not constitute an empirical or scientific probability of brand damage or legal liability.
          </p>

          <h2 class="text-sm font-bold text-slate-900">2. Human-in-the-Loop Requirement</h2>
          <p>
            Automated claim classifications and suggested corrections are provided to assist authorized human reviewers. Formal publication approval requires human sign-off with recorded justification notes.
          </p>

          <h2 class="text-sm font-bold text-slate-900">3. Source of Truth Grounding</h2>
          <p>
            The accuracy of claim verification is strictly dependent upon the certified primary documents uploaded to the evidence library. Inkloom Guardian does not fabricate unverified citations.
          </p>
        </div>
      </div>
    `;
  }
};
