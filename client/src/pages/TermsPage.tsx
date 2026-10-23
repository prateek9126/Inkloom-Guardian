import React from 'react';
import { Card } from '../components/ui/Card';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Terms of Service & SLA Commitments
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Enterprise software-as-a-service agreement governing the use of Inkloom Guardian.
        </p>
      </div>

      <Card title="1. Purpose of the Platform">
        <p className="text-xs text-slate-600 leading-relaxed">
          Inkloom Guardian is designed as an automated policy enforcement, brand governance, and claim verification platform. While the system extracts claims and cross-references them against primary company documentation with zero citation fabrication, the final determination of publication readiness rests with designated human compliance and brand reviewers.
        </p>
      </Card>

      <Card title="2. Verified Claims & Human Review Responsibilities">
        <p className="text-xs text-slate-600 leading-relaxed">
          The customer is solely responsible for ensuring that all documents uploaded into the Evidence Sources Library are authentic, current, and legally valid. The automated verification engine classifies claims based on provided evidence; marking a claim as "Supported" reflects correlation with uploaded primary documents and does not substitute for independent licensed legal counsel.
        </p>
      </Card>

      <Card title="3. Deterministic Risk Scoring & Disclaimers">
        <p className="text-xs text-slate-600 leading-relaxed mb-2">
          Inkloom Guardian provides explainable risk scoring bounded deterministically from 0 to 100 based on configured rule severities, confidence levels, and evidence grounding factors.
        </p>
        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
          <strong>Non-Predictive Disclaimer:</strong> A score of 100 represents elevated compliance rule violations according to defined enterprise weights and is <strong>not</strong> a scientifically proven or empirical probability of actual brand damage or financial loss.
        </p>
      </Card>

      <Card title="4. Policy Learning & Non-Autonomous Changes">
        <p className="text-xs text-slate-600 leading-relaxed">
          The system analyzes reviewer decisions to suggest candidate updates to brand guidelines. Official guidelines are <strong>never</strong> modified autonomously by the AI engine. Every guideline update requires explicit authorization and review by a credentialed Administrator or Brand Manager. Past reviewer approvals reflect corporate stylistic conventions and do not certify factual accuracy.
        </p>
      </Card>

      <Card title="5. Service Level Availability (SLA)">
        <p className="text-xs text-slate-600 leading-relaxed">
          Inkloom Guardian guarantees 99.99% monthly availability for core governance APIs, evidence retrieval engines, and review workflows under standard Enterprise SLA provisions, excluding scheduled maintenance windows announced with at least 72 hours advance notice.
        </p>
      </Card>
    </div>
  );
};
