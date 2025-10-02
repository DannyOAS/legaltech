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
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">My Documents</h2>
        <input
          type="search"
          value={searchValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(event.target.value);
            setPage(0);
          }}
          placeholder="Search documents..."
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
        />
      </div>
      {status && <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{status}</div>}
      {isLoading ? (
        renderLoadingSkeleton()
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {documents.length ? (
            documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-700">{doc.filename}</p>
                  <p className="text-xs text-slate-500">{doc.mime} · {(doc.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
                  <button
                    type="button"
                    onClick={() => downloadDocument(doc)}
                    disabled={downloadingId === doc.id}
                    className="rounded bg-primary-600 px-2 py-1 text-xs text-white transition-colors hover:bg-primary-500 disabled:cursor-progress disabled:bg-primary-300"
                  >
                    {downloadingId === doc.id ? "Preparing..." : "Download"}
                  </button>
                </div>
              </li>
            ))
          ) : (
            <li className="text-slate-500">No documents available yet.</li>
          )}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {totalDocuments === 0
            ? "No results"
            : documents.length === 0
            ? `Showing 0 of ${totalDocuments}`
            : `Showing ${offset + 1}-${offset + documents.length} of ${totalDocuments}`}
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

export default ClientDocumentsPage;
