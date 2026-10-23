import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileCheck,
  Lock,
  ArrowRight,
  BookOpen,
  Scale,
  Search,
  Compass,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-200">
      {/* Top Enterprise Nav */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight leading-none block">
                Inkloom Guardian
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                Brand Governance & Risk Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign In
            </Link>
            <Link to="/register">
              <Button size="sm">Launch Platform</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6 max-w-5xl mx-auto text-center border-b border-slate-100">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tracking-wide uppercase mb-6 border border-slate-200">
          <Scale className="w-3.5 h-3.5 text-slate-600" />
          <span>Evidence-Backed Verification & Risk Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
          Automated Brand Governance and Evidence-Backed Claim Verification
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Inkloom Guardian extracts factual, numerical, and promotional claims from enterprise communications, verifies each assertion against approved primary evidence documents, detects contradictory claims, and enforces human-in-the-loop review before publication.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" icon={<ArrowRight className="w-4 h-4" />}>
              Open Governance Workspace
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="lg" icon={<Compass className="w-4 h-4 text-emerald-600" />}>
              Explore Volterra EV Demo
            </Button>
          </Link>
        </div>

        {/* Feature Pill Tags */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 font-medium">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Granular Passage Attribution
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Contradiction vs Missing Evidence Separation
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
            <Layers className="w-3.5 h-3.5 text-slate-600" /> Traceable Evidence Graph
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
            <Lock className="w-3.5 h-3.5 text-slate-600" /> Strict Zero-Fabrication Rule
          </span>
        </div>
      </section>

      {/* Verification Pipeline Overview */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Deterministic Verification Pipeline
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl mx-auto">
            From raw input extraction to multi-stage human sign-off, every step preserves complete provenance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-xs">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800 font-bold text-xs mb-3">
              01
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Multi-Format Ingestion</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Extracts text from plain text, PDF whitepapers, and promotional imagery with deterministic structural parsing.
            </p>
          </div>

          <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-xs">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800 font-bold text-xs mb-3">
              02
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Claim Extraction</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Isolates factual, numerical percentages, comparative claims, and promotional promises with exact character positions.
            </p>
          </div>

          <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-xs">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800 font-bold text-xs mb-3">
              03
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Passage Retrieval</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Scans approved company audit reports, ESG filings, and technical specifications using PostgreSQL full-text search.
            </p>
          </div>

          <div className="p-5 border border-slate-200 rounded-lg bg-white shadow-xs">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800 font-bold text-xs mb-3">
              04
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Classification & Traceability</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Categorizes findings into Supported, Contradicted, Unverified, or Needs Human Review with exact page and version citations.
            </p>
          </div>
        </div>
      </section>

      {/* Core Architectural Guarantees */}
      <section className="py-16 px-6 bg-slate-50 border-t border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Enterprise Governance Reliability Rules
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
              Engineered specifically for legal counsel, compliance officers, and brand guardians.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Zero Evidence Fabrication</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                The platform never invents page numbers, source passages, or citations. A claim is only marked Supported when an authentic approved passage verifies it verbatim or numerically.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-md bg-red-50 text-red-700 flex items-center justify-center mb-4">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Contradiction Separation</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Distinguishes between missing evidence (unverified statement) and direct contradiction (e.g. claim promises 50% emissions reduction when audit certifies 28%).
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
                <FileCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Outdated Document Detection</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Automatically detects when a matched passage belongs to an expired audit certificate or superseded policy document, immediately requesting human compliance re-certification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-slate-700" />
            <span className="font-semibold text-slate-800">Inkloom Guardian</span>
            <span>— AI-Powered Brand Governance & Risk Intelligence Platform</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link to="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link to="/login" className="hover:text-slate-900">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
