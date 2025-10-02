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

  const renderLoadingSkeleton = (rows = 6) => (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index} className="bg-white">
                <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-3 py-3"><Skeleton className="h-4 w-28" /></td>
                <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
                <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-8 w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="mt-4 h-9 w-full" />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">My Invoices</h2>
        <input
          type="search"
          value={searchValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(event.target.value);
            setPage(0);
          }}
          placeholder="Search invoices..."
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
        />
      </div>
      {statusMessage ? (
        <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{statusMessage}</div>
      ) : null}
      <div className="mt-4">
        {isLoading ? (
          renderLoadingSkeleton()
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Matter</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Issued</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Due</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-3 py-2">{invoice.number}</td>
                      <td className="px-3 py-2">{invoice.matter_title}</td>
                      <td className="px-3 py-2">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">${invoice.total}</td>
                      <td className={`px-3 py-2 text-right capitalize ${statusColor[invoice.status] ?? "text-slate-600"}`}>
                        {invoice.status}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
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
                          }}
                          disabled={downloadingId === invoice.id}
                        >
                          {downloadingId === invoice.id ? "Preparing..." : "Download"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <p className="text-base font-semibold text-slate-700">{invoice.number}</p>
                    <span className={`text-xs uppercase ${statusColor[invoice.status] ?? "text-slate-500"}`}>{invoice.status}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Matter</span>
                      <span className="ml-4 text-right text-slate-600">{invoice.matter_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Issued</span>
                      <span>{new Date(invoice.issue_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due</span>
                      <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between font-medium text-slate-700">
                      <span>Total</span>
                      <span>${invoice.total}</span>
                    </div>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
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
                    }}
                    disabled={downloadingId === invoice.id}
                  >
                    {downloadingId === invoice.id ? "Preparing..." : "Download"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {totalInvoices === 0
            ? "No results"
            : invoices.length === 0
            ? `Showing 0 of ${totalInvoices}`
            : `Showing ${offset + 1}-${offset + invoices.length} of ${totalInvoices}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={!hasPrevious}
            className={`rounded border px-3 py-1 text-sm transition-colors ${
              hasPrevious ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => (hasNext ? prev + 1 : prev))}
            disabled={!hasNext}
            className={`rounded border px-3 py-1 text-sm transition-colors ${
              hasNext ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientInvoicesPage;
