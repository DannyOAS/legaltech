import { ChangeEvent, useMemo, useState } from "react";
import useSWR from "swr";
import Skeleton from "../../components/ui/Skeleton";
import { api } from "../../lib/api";

interface ClientDocument {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const ClientDocumentsPage = () => {
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const offset = page * PAGE_SIZE;
  const key = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/client/documents/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data, isLoading } = useSWR<PaginatedResponse<ClientDocument>>(key, fetcher);
  const documents = data?.results ?? [];
  const totalDocuments = data?.count ?? 0;
  const hasPrevious = page > 0;
  const hasNext = offset + documents.length < totalDocuments;

  const resetStatusSoon = () => {
    window.setTimeout(() => setStatus(null), 3000);
  };

  const downloadDocument = async (doc: ClientDocument) => {
    try {
      setDownloadingId(doc.id);
      setStatus("Fetching download link...");
      const response = await api.get<{ url: string | { url: string } }>(`/client/documents/${doc.id}/download/`);
      const linkUrl = typeof response.url === "string" ? response.url : response.url?.url;
      if (!linkUrl) {
        throw new Error("No download URL returned");
      }
      const link = document.createElement("a");
      link.href = linkUrl;
      link.download = doc.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus("Download started");
    } catch (error) {
      console.error("Client download failed", error);
      setStatus("Unable to download document");
    } finally {
      setDownloadingId(null);
      resetStatusSoon();
    }
  };

  const renderLoadingSkeleton = (rows = 6) => (
    <ul className="mt-4 space-y-3 text-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-center justify-between rounded border border-slate-200 p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="space-y-6 rounded-lg bg-white p-6 shadow">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-700">My Documents</h2>
          <p className="text-sm text-slate-500 md:hidden">Download and review files shared to your matters.</p>
        </div>
        <input
          type="search"
          value={searchValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(event.target.value);
            setPage(0);
          }}
          placeholder="Search documents..."
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
        />
      </div>
      {status && <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{status}</div>}
      <ul className="space-y-3 text-sm">
        {documents.length ? (
          documents.map((doc) => (
            <li key={doc.id} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-700">{doc.filename}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{doc.mime || "Unknown"}</span>
                    <span>·</span>
                    <span>{(doc.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 sm:text-sm">Tap download to save a copy of this file.</p>
                <button
                  type="button"
                  onClick={() => downloadDocument(doc)}
                  disabled={downloadingId === doc.id}
                  className="w-full rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-progress disabled:bg-primary-300 sm:w-auto"
                >
                  {downloadingId === doc.id ? "Preparing..." : "Download"}
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
            No documents available yet.
          </li>
        )}
      </ul>
      <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          {totalDocuments === 0
            ? "No results"
            : documents.length === 0
            ? `Showing 0 of ${totalDocuments}`
            : `Showing ${offset + 1}-${offset + documents.length} of ${totalDocuments}`}
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

export default ClientDocumentsPage;
