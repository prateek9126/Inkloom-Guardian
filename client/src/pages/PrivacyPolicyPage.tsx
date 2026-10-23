import React from 'react';
import { Shield, Lock, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Privacy Policy & Data Processing Standards
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Enterprise commitments regarding data handling, zero model training on customer data, and GDPR/CCPA compliance.
        </p>
      </div>

      <Card title="1. Enterprise Data Isolation & Multi-Tenant Boundaries">
        <p className="text-xs text-slate-600 leading-relaxed mb-3">
          Inkloom Guardian provides complete cryptographic and logical tenant isolation. All content submissions, extracted marketing claims, approved evidence documents, and audit logs are scoped strictly to the authenticated organization tenant (`org_id`). Under no circumstances is content accessible across tenant boundaries.
        </p>
      </Card>

      <Card title="2. Zero AI Training Retention Commitment">
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            When utilizing configured third-party LLM providers (e.g., Google Gemini, OpenAI, Anthropic), all API communication occurs via enterprise-tier zero-retention proxies:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>Customer content and uploaded documents are <strong>never</strong> used to train or fine-tune public foundation models.</li>
            <li>Uploaded documents and evidence passages are treated as untrusted data inputs, not instructional system prompts, preventing prompt-injection attacks.</li>
            <li>All transmission occurs over TLS 1.3 with AES-256 encryption at rest.</li>
          </ul>
        </div>
      </Card>

      <Card title="3. Policy Learning Feedback & Data Retention Schedules">
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            Inkloom Guardian records authorized reviewer decisions (accepted corrections, rejected suggestions, and documented exceptions) to suggest approved phrasing and recommend candidate guideline updates.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><strong>Confidentiality Protection:</strong> Content flagged as confidential customer data is strictly excluded from generic learning summaries and candidate recommendation generation.</li>
            <li><strong>Retention Schedule:</strong> Feedback records are maintained under an enterprise 365-day retention schedule by default.</li>
            <li><strong>Admin Inspection & Right to Erasure:</strong> Designated administrators maintain full rights to inspect, correct inaccurate reviewer notes, or permanently purge feedback records in accordance with GDPR Article 17 and CCPA data subject erasure rights.</li>
          </ul>
        </div>
      </Card>

      <Card title="4. Full Audit Provenance & Data Subject Rights">
        <p className="text-xs text-slate-600 leading-relaxed">
          Organizations maintain complete ownership and sovereignty over their evidence library, submission history, and reviewer audit trails. Data subjects may request full exports or deletion of personal data in accordance with applicable data protection legislation.
        </p>
      </Card>
    </div>
  );
};
