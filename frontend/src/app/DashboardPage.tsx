import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "../lib/api";
import { useAuth } from "../features/auth/AuthContext";
import Button from "../components/ui/Button";
import MFASetupModal from "../features/auth/MFASetupModal";

type BillingSummary = {
  total_hours: string;
  total_expenses: string;
  outstanding_balance: string;
};

type AuditEvent = {
  id: string;
  action: string;
  resource_type: string;
  created_at: string;
};

type ClientDashboard = {
  documents_count: number;
  outstanding_balance: string;
  recent_documents: Array<{
    id: string;
    filename: string;
    uploaded_at: string;
  }>;
};

const fetcher = <T,>(url: string) => api.get<T>(url);

const DashboardPage = () => {
  const { user, refreshUser } = useAuth();
  const isClient = user?.roles?.includes("Client");
  const [showMfaModal, setShowMfaModal] = useState(false);
  useEffect(() => {
    if (user && !isClient && !user.mfa_enabled) {
      setShowMfaModal(true);
    }
  }, [user, isClient]);

  const { data: summary } = useSWR<BillingSummary>(isClient ? null : "/reports/billing-summary/", fetcher);
  const { data: audit } = useSWR<AuditEvent[] | { results: AuditEvent[] }>(isClient ? null : "/audit-events/", fetcher);
  const { data: clientSummary } = useSWR<ClientDashboard>(
    isClient ? "/client/dashboard/" : null,
    fetcher,
  );
  const rawEvents = Array.isArray(audit) ? audit : audit?.results ?? [];
  const events = rawEvents.filter((event) => !event.action.startsWith("auth."));

  if (isClient) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-slate-700">My Overview</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div>
              <dt>Outstanding Balance</dt>
              <dd className="text-xl font-semibold text-primary-600">${clientSummary?.outstanding_balance ?? "0.00"}</dd>
            </div>
            <div>
              <dt>Documents Available</dt>
              <dd className="text-xl font-semibold text-primary-600">{clientSummary?.documents_count ?? 0}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-lg bg-white p-6 shadow md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-700">Recent Documents</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {clientSummary?.recent_documents?.length ? (
              clientSummary.recent_documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <span>{doc.filename}</span>
                  <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
                </li>
              ))
            ) : (
              <li className="text-slate-500">No recent documents</li>
            )}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {!isClient && user && !user.mfa_enabled ? (
        <section className="md:col-span-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Secure your account</h2>
              <p className="text-xs text-amber-600">Multi-factor authentication is required for staff users. Enable it now to continue working securely.</p>
            </div>
            <Button onClick={() => setShowMfaModal(true)}>Set Up MFA</Button>
          </div>
        </section>
      ) : null}
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Billing Snapshot</h2>
        <dl className="mt-4 space-y-2 text-sm text-slate-600">
          <div>
            <dt>Total Billable Hours</dt>
            <dd className="text-xl font-semibold text-primary-600">{summary?.total_hours ?? "--"}</dd>
          </div>
          <div>
            <dt>Expenses</dt>
            <dd className="text-xl font-semibold text-primary-600">${summary?.total_expenses ?? "--"}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd className="text-xl font-semibold text-primary-600">${summary?.outstanding_balance ?? "--"}</dd>
          </div>
        </dl>
      </section>
      <section className="rounded-lg bg-white p-6 shadow md:col-span-2">
        <h2 className="text-lg font-semibold text-slate-700">Recent Activity</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {events.length > 0 ? (
            events.slice(0, 5).map((event) => (
              <li key={event.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
                <span>{event.action} on {event.resource_type}</span>
                <time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time>
              </li>
            ))
          ) : (
            <li className="text-slate-500">No recent events</li>
          )}
        </ul>
      </section>
      <MFASetupModal
        isOpen={showMfaModal}
        onClose={() => setShowMfaModal(false)}
        onEnabled={async () => {
          await refreshUser();
          setShowMfaModal(false);
        }}
      />
    </div>
  );
};

export default DashboardPage;
