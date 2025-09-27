import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { AuthProvider } from "../features/auth/AuthContext";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import BillingPage from "../features/billing/BillingPage";
import InvoiceDetailPage from "../features/billing/InvoiceDetailPage";
import ClientsPage from "../features/clients/ClientsPage";
import LoginPage from "../features/auth/LoginPage";
import MattersPage from "../features/matters/MattersPage";
import MatterDetailPage from "../features/matters/MatterDetailPage";
import PortalPage from "../features/portal/PortalPage";
import MatterPortalPage from "../features/portal/MatterPortalPage";
import OrgSettingsPage from "../features/org/OrgSettingsPage";
import DashboardPage from "./DashboardPage";

const App = () => (
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/matters" element={<MattersPage />} />
          <Route path="/matters/:id" element={<MatterDetailPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/portal/:matterId" element={<MatterPortalPage />} />
          <Route path="/settings" element={<OrgSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  </AuthProvider>
);

export default App;
