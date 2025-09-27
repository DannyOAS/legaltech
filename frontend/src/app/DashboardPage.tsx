import useSWR from "swr";
import { api } from "../lib/api";

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

const fetcher = <T,>(url: string) => api.get<T>(url);

const DashboardPage = () => {
  const { data: summary } = useSWR<BillingSummary>("/reports/billing-summary/", fetcher);
  const { data: audit } = useSWR<AuditEvent[]>("/audit-events/", fetcher);

  return (
    <div className="grid gap-6 md:grid-cols-3">
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
          {audit?.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <span>{event.action} on {event.resource_type}</span>
              <time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time>
            </li>
          )) || <li className="text-slate-500">No recent events</li>}
        </ul>
      </section>
    </div>
  );
};

export default DashboardPage;
