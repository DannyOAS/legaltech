import { FormEvent, useState } from "react";
import useSWR from "swr";
import { api } from "../../lib/api";

interface TimeEntryPayload {
  matter: string;
  description: string;
  minutes: number;
  rate: number;
  date: string;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const BillingPage = () => {
  const [entry, setEntry] = useState<TimeEntryPayload>({
    matter: "",
    description: "",
    minutes: 60,
    rate: 300,
    date: new Date().toISOString().slice(0, 10),
  });
  const [message, setMessage] = useState<string | null>(null);
  const { data: invoices, mutate } = useSWR<{ results: Invoice[] }>("/invoices/", fetcher);

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await api.post("/time-entries/", entry);
    setMessage("Time entry captured");
    setEntry({ ...entry, description: "" });
    mutate();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Quick Time Entry</h2>
        <form onSubmit={submitEntry} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-slate-600">Matter ID</label>
            <input
              value={entry.matter}
              onChange={(e) => setEntry((prev) => ({ ...prev, matter: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              placeholder="UUID"
              required
            />
          </div>
          <div>
            <label className="block text-slate-600">Description</label>
            <textarea
              value={entry.description}
              onChange={(e) => setEntry((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              required
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-600">Minutes</label>
              <input
                type="number"
                value={entry.minutes}
                onChange={(e) => setEntry((prev) => ({ ...prev, minutes: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-slate-300 p-2"
                min={6}
                step={6}
              />
            </div>
            <div className="flex-1">
              <label className="block text-slate-600">Rate</label>
              <input
                type="number"
                value={entry.rate}
                onChange={(e) => setEntry((prev) => ({ ...prev, rate: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-slate-300 p-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-600">Date</label>
            <input
              type="date"
              value={entry.date}
              onChange={(e) => setEntry((prev) => ({ ...prev, date: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 p-2"
            />
          </div>
          <button className="rounded bg-primary-600 px-3 py-2 text-white">Log Time</button>
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </form>
      </section>
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Invoices</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {invoices?.results?.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-700">{invoice.number}</p>
                <p className="text-xs text-slate-500">Status: {invoice.status}</p>
              </div>
              <span className="text-primary-600">${invoice.total}</span>
            </li>
          )) ?? <li className="text-slate-500">No invoices yet.</li>}
        </ul>
      </section>
    </div>
  );
};

export default BillingPage;
