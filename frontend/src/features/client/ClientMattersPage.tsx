import { ChangeEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import { api } from "../../lib/api";

interface ClientMatter {
  id: string;
  title: string;
  practice_area: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  reference_code: string;
  client_name: string;
  lead_lawyer_name?: string | null;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

const ClientMattersPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const offset = page * PAGE_SIZE;
  const key = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/client/matters/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data, isLoading } = useSWR<PaginatedResponse<ClientMatter>>(key, fetcher);
  const matters = data?.results ?? [];
  const total = data?.count ?? 0;
  const hasPrevious = page > 0;
  const hasNext = offset + matters.length < total;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
    setPage(0);
  };

  const renderStatusBadge = (status: string) => {
    const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
    switch (status) {
      case "open":
        return <span className={`${base} bg-emerald-100 text-emerald-700`}>Open</span>;
      case "closed":
        return <span className={`${base} bg-slate-200 text-slate-700`}>Closed</span>;
      default:
        return <span className={`${base} bg-slate-100 text-slate-600`}>{status}</span>;
    }
  };

  const renderLoadingSkeleton = (rows = 5) => (
    <>
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: rows }).map((_, index) => (
                <tr key={index} className="bg-white">
                  <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-8 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mt-4 h-9 w-24" />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">My Matters</h2>
        <input
          type="search"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search matters..."
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
        />
      </div>
      {isLoading ? (
        renderLoadingSkeleton()
      ) : matters.length === 0 ? (
        <p className="text-sm text-slate-500">No matters available yet.</p>
      ) : (
        <div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Reference</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Practice Area</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Lead Lawyer</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matters.map((matter) => (
                  <tr key={matter.id}>
                    <td className="px-3 py-2 font-medium text-slate-700">{matter.reference_code}</td>
                    <td className="px-3 py-2 text-slate-600">{matter.title}</td>
                    <td className="px-3 py-2 text-slate-500">{matter.practice_area || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{matter.lead_lawyer_name || "—"}</td>
                    <td className="px-3 py-2">{renderStatusBadge(matter.status)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/client/matters/${matter.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {matters.map((matter) => (
              <div key={matter.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Reference</p>
                  <p className="text-base font-semibold text-slate-700">{matter.reference_code}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{matter.title}</p>
                    <p className="text-xs text-slate-500">{matter.practice_area || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Lead lawyer</span>
                    <span className="font-medium text-slate-600">{matter.lead_lawyer_name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Status</span>
                    <div>{renderStatusBadge(matter.status)}</div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/client/matters/${matter.id}`)}>
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {total === 0
            ? "No results"
            : matters.length === 0
            ? `Showing 0 of ${total}`
            : `Showing ${offset + 1}-${offset + matters.length} of ${total}`}
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

export default ClientMattersPage;
