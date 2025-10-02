import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { AuthProvider } from "../features/auth/AuthContext";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import BillingPage from "../features/billing/BillingPage";
import InvoiceDetailPage from "../features/billing/InvoiceDetailPage";
import ClientsPage from "../features/clients/ClientsPage";
import LoginPage from "../features/auth/LoginPage";
import ClientLoginPage from "../features/auth/ClientLoginPage";
import InviteAcceptPage from "../features/auth/InviteAcceptPage";
import MattersPage from "../features/matters/MattersPage";
import MatterDetailPage from "../features/matters/MatterDetailPage";
import PortalPage from "../features/portal/PortalPage";
import MatterPortalPage from "../features/portal/MatterPortalPage";
import OrgSettingsPage from "../features/org/OrgSettingsPage";
import DashboardPage from "./DashboardPage";
import ClientDocumentsPage from "../features/client/ClientDocumentsPage";
import ClientInvoicesPage from "../features/client/ClientInvoicesPage";
import ClientMattersPage from "../features/client/ClientMattersPage";
import ClientMatterDetailPage from "../features/client/ClientMatterDetailPage";
import DeadlinesListPage from "../features/deadlines/DeadlinesListPage";
import DeadlinesCalendarPage from "../features/deadlines/DeadlinesCalendarPage";
import RoleProtectedRoute from "../features/auth/RoleProtectedRoute";

const DASHBOARD_ROLES = [
  "Owner",
  "Admin",
  "Lawyer",
  "Paralegal",
  "Assistant",
  "Operations Admin",
  "IT / Security",
  "Accounting / Finance",
];

const CLIENT_MANAGEMENT_ROLES = [
  "Owner",
  "Admin",
  "Lawyer",
  "Paralegal",
  "Assistant",
  "Operations Admin",
];

const MATTER_ROLES = ["Owner", "Admin", "Lawyer", "Paralegal", "Assistant"];

const BILLING_ROLES = [
  "Owner",
  "Admin",
  "Lawyer",
  "Paralegal",
  "Operations Admin",
  "Accounting / Finance",
];

const PORTAL_ROLES = ["Owner", "Admin", "Lawyer", "Paralegal", "Assistant"];

const DEADLINE_ROLES = ["Owner", "Admin", "Lawyer", "Paralegal", "Assistant"];

const SETTINGS_ROLES = ["Owner", "Admin", "Operations Admin", "IT / Security"];

const CLIENT_ROLES = ["Client"];

const App = () => (
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login-client" element={<ClientLoginPage />} />
      <Route path="/invite/accept" element={<InviteAcceptPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route element={<RoleProtectedRoute allow={DASHBOARD_ROLES} fallbackPath="/client/matters" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={CLIENT_MANAGEMENT_ROLES} />}>
            <Route path="/clients" element={<ClientsPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={MATTER_ROLES} />}>
            <Route path="/matters" element={<MattersPage />} />
            <Route path="/matters/:id" element={<MatterDetailPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={BILLING_ROLES} />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={PORTAL_ROLES} />}>
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/portal/:matterId" element={<MatterPortalPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={DEADLINE_ROLES} />}>
            <Route path="/deadlines" element={<DeadlinesListPage />} />
            <Route path="/deadlines/calendar" element={<DeadlinesCalendarPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={SETTINGS_ROLES} />}>
            <Route path="/settings" element={<OrgSettingsPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={CLIENT_ROLES} fallbackPath="/dashboard" />}>
            <Route path="/client/documents" element={<ClientDocumentsPage />} />
            <Route path="/client/matters" element={<ClientMattersPage />} />
            <Route path="/client/matters/:id" element={<ClientMatterDetailPage />} />
            <Route path="/client/invoices" element={<ClientInvoicesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  </AuthProvider>
);

export default App;
