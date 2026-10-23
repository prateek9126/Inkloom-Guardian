import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ContentSubmissionsListPage } from './pages/ContentSubmissionsListPage';
import { ContentSubmissionPage } from './pages/ContentSubmissionPage';
import { ClaimVerificationPage } from './pages/ClaimVerificationPage';
import { EvidenceSourcesPage } from './pages/EvidenceSourcesPage';
import { ClaimsLibraryPage } from './pages/ClaimsLibraryPage';
import { BrandGuidelinesPage } from './pages/BrandGuidelinesPage';
import { CampaignWorkspacePage } from './pages/CampaignWorkspacePage';
import { RiskAnalysisPage } from './pages/RiskAnalysisPage';
import { ReviewApprovalPage } from './pages/ReviewApprovalPage';
import { PolicyLearningPage } from './pages/PolicyLearningPage';
import { AuditHistoryPage } from './pages/AuditHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-sm text-slate-500">
          <svg className="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Authenticating session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Governance Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions"
              element={
                <ProtectedRoute>
                  <ContentSubmissionsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions/new"
              element={
                <ProtectedRoute>
                  <ContentSubmissionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/claim-verification"
              element={
                <ProtectedRoute>
                  <ClaimVerificationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evidence-sources"
              element={
                <ProtectedRoute>
                  <EvidenceSourcesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/claims"
              element={
                <ProtectedRoute>
                  <ClaimsLibraryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/guidelines"
              element={
                <ProtectedRoute>
                  <BrandGuidelinesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <CampaignWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/risk-reports"
              element={
                <ProtectedRoute>
                  <RiskAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reviews"
              element={
                <ProtectedRoute>
                  <ReviewApprovalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review-approval"
              element={
                <ProtectedRoute>
                  <ReviewApprovalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/risk-analysis"
              element={
                <ProtectedRoute>
                  <RiskAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/policy-learning"
              element={
                <ProtectedRoute>
                  <PolicyLearningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/privacy"
              element={
                <ProtectedRoute>
                  <PrivacyPolicyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/terms"
              element={
                <ProtectedRoute>
                  <TermsPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
