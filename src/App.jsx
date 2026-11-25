import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { LoginPage } from './pages/auth/LoginPage';
import { WorkspaceSelectPage } from './pages/auth/WorkspaceSelectPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './layouts/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomerGraphPage } from './pages/CustomerGraphPage';
import { RescueCentrePage } from './pages/RescueCentrePage';
import { NdrRecoveryPage } from './pages/NdrRecoveryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FinancialIntelligencePage } from './pages/FinancialIntelligencePage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/workspaces"
          element={
            <ProtectedRoute requireWorkspace={false}>
              <WorkspaceSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute requireWorkspace={true}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="graph" element={<CustomerGraphPage />} />
          <Route path="rescue" element={<RescueCentrePage />} />
          <Route path="ndr" element={<NdrRecoveryPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="financial" element={<FinancialIntelligencePage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
