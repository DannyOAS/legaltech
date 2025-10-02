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

const STAFF_ROLES = ["Owner", "Admin", "Lawyer", "Paralegal", "Assistant"];
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route element={<RoleProtectedRoute allow={STAFF_ROLES} />}>
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/matters" element={<MattersPage />} />
            <Route path="/matters/:id" element={<MatterDetailPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/portal/:matterId" element={<MatterPortalPage />} />
            <Route path="/deadlines" element={<DeadlinesListPage />} />
            <Route path="/deadlines/calendar" element={<DeadlinesCalendarPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={['Owner', 'Admin']} />}>
            <Route path="/settings" element={<OrgSettingsPage />} />
          </Route>
          <Route element={<RoleProtectedRoute allow={CLIENT_ROLES} />}>
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
