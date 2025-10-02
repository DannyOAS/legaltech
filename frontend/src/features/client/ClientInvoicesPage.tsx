import { ChangeEvent, useMemo, useState } from "react";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import { api, ApiError } from "../../lib/api";

interface ClientInvoice {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  total: string;
  status: string;
  matter_title: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const statusColor: Record<string, string> = {
  paid: "text-emerald-600",
  overdue: "text-red-600",
  draft: "text-slate-500",
  sent: "text-slate-600",
};

const ClientInvoicesPage = () => {
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const offset = page * PAGE_SIZE;
  const key = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/client/invoices/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data, isLoading } = useSWR<PaginatedResponse<ClientInvoice>>(key, fetcher);
  const invoices = data?.results ?? [];
  const totalInvoices = data?.count ?? 0;
  const hasPrevious = page > 0;
  const hasNext = offset + invoices.length < totalInvoices;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (invoice: ClientInvoice) => {
    try {
      setDownloadingId(invoice.id);
      setStatusMessage("Generating invoice PDF...");
      const response = await api.get<{ url: string | { url: string } }>(`/client/invoices/${invoice.id}/download/`);
      const url = typeof response.url === "string" ? response.url : response.url?.url;
      if (!url) {
        throw new Error("No download URL returned");
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.number}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage("Invoice download started");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Unable to download invoice" : "Unable to download invoice";
      setStatusMessage(message);
    } finally {
      setDownloadingId(null);
      window.setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const renderDownloadButton = (invoice: ClientInvoice, label = "Download") => (
    <Button variant="secondary" size="sm" onClick={() => handleDownload(invoice)} disabled={downloadingId === invoice.id}>
      {downloadingId === invoice.id ? "Preparing..." : label}
    </Button>
  );

  return (
    <section className="space-y-6 rounded-lg bg-white p-6 shadow">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-700">My Invoices</h2>
          <p className="text-sm text-slate-500 md:hidden">
            Review balances, due dates, and download PDFs from anywhere.
          </p>
        </div>
        <input
          type="search"
          value={searchValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(event.target.value);
            setPage(0);
          }}
          placeholder="Search invoices..."
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
        />
      </div>
      {statusMessage ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{statusMessage}</div>
      ) : null}
      {invoices.length ? (
        <>
          <ul className="space-y-3 text-sm md:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-700">Invoice {invoice.number}</p>
                    <p className="text-xs text-slate-500">{invoice.matter_title}</p>
                  </div>
                  <span
                    className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize ${
                      statusColor[invoice.status] ?? "text-slate-600"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <dl className="grid gap-2 text-xs text-slate-500">
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-600">Issued</dt>
                    <dd className="text-right">{new Date(invoice.issue_date).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-600">Due</dt>
                    <dd className="text-right">{new Date(invoice.due_date).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-600">Total</dt>
                    <dd className="text-right">${invoice.total}</dd>
                  </div>
                </dl>
                {renderDownloadButton(invoice, "Download PDF")}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Invoice</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Matter</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Issued</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Due</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Total</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Status</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">{invoice.number}</td>
                      <td className="px-3 py-3">{invoice.matter_title}</td>
                      <td className="px-3 py-3">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td className="px-3 py-3">{new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-right">${invoice.total}</td>
                      <td className={`px-3 py-3 text-right capitalize ${statusColor[invoice.status] ?? "text-slate-600"}`}>
                        {invoice.status}
                      </td>
                      <td className="px-3 py-3 text-right">{renderDownloadButton(invoice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No invoices yet.</p>
      )}
      <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          {totalInvoices === 0
            ? "No results"
            : invoices.length === 0
            ? `Showing 0 of ${totalInvoices}`
            : `Showing ${offset + 1}-${offset + invoices.length} of ${totalInvoices}`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={!hasPrevious}
            className={`flex-1 rounded border px-3 py-1 text-center text-sm transition-colors md:flex-none md:w-auto ${
              hasPrevious ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => (hasNext ? prev + 1 : prev))}
            disabled={!hasNext}
            className={`flex-1 rounded border px-3 py-1 text-center text-sm transition-colors md:flex-none md:w-auto ${
              hasNext ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default ClientInvoicesPage;
