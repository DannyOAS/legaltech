import { ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/ToastProvider";
import { api, ApiError } from "../../lib/api";
import { CheckIcon } from "@heroicons/react/24/outline";

interface CaseDeadline {
  id: string;
  title: string;
  deadline_type: string;
  due_date: string;
  priority: string;
  status: string;
  matter_title: string;
  matter_reference: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

const renderLoadingSkeleton = (rows = 5) => (
  <>
    <div className="hidden md:block">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <ul className="divide-y divide-slate-200">
          {Array.from({ length: rows }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            </li>
          ))}
        </ul>
      </div>
    </div>
    <div className="space-y-3 md:hidden">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  </>
);

const DeadlinesListPage = () => {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  
  const offset = page * PAGE_SIZE;
  
  const deadlinesKey = useMemo(() => {
    const params = new URLSearchParams({ 
      limit: String(PAGE_SIZE), 
      offset: String(offset),
      ordering: "due_date"
    });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (priorityFilter) {
      params.set("priority", priorityFilter);
    }
    return `/deadlines/?${params.toString()}`;
  }, [offset, searchValue, statusFilter, priorityFilter]);

  const { data: deadlinesData, mutate, isLoading } = useSWR<PaginatedResponse<CaseDeadline>>(deadlinesKey, fetcher);

  const deadlines = deadlinesData?.results ?? [];
  const totalDeadlines = deadlinesData?.count ?? 0;
  const hasPrevious = page > 0;
  const hasNext = offset + deadlines.length < totalDeadlines;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
    setPage(0);
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handlePriorityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPriorityFilter(event.target.value);
    setPage(0);
  };

  const handleMarkCompleted = async (deadlineId: string) => {
    try {
      await api.post(`/deadlines/${deadlineId}/mark_completed/`);
      toast.success("Deadline completed", "Deadline marked as completed successfully.");
      mutate();
    } catch (error) {
      toast.error("Unable to update deadline", error instanceof ApiError ? error.payload.detail ?? "Please try again" : "Please try again");
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    return new Date(dueDate) < new Date() && status === "pending";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "overdue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Deadlines</h2>
        <div className="flex flex-1 items-center gap-3 sm:justify-end">
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search deadlines..."
            className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            value={priorityFilter}
            onChange={handlePriorityChange}
            className="rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/deadlines/calendar'}
          >
            Calendar View
          </Button>
        </div>
      </div>

      {isLoading ? (
        renderLoadingSkeleton()
      ) : deadlines.length === 0 ? (
        <p className="text-sm text-slate-500">No deadlines found matching your criteria.</p>
      ) : (
        <div>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Matter</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Due Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Priority</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadlines.map((deadline) => (
                  <tr key={deadline.id} className={isOverdue(deadline.due_date, deadline.status) ? "bg-red-50" : ""}>
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-900">{deadline.title}</p>
                        <p className="text-xs text-slate-500">{deadline.deadline_type.replace(/_/g, ' ')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <Link to={`/matters/${deadline.matter_reference.split('-')[0]}`} className="text-primary-600">
                          {deadline.matter_reference}
                        </Link>
                        <p className="text-xs text-slate-500">{deadline.matter_title}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className={isOverdue(deadline.due_date, deadline.status) ? "text-red-600 font-medium" : ""}>
                        {new Date(deadline.due_date).toLocaleDateString()}
                        {isOverdue(deadline.due_date, deadline.status) && (
                          <p className="text-xs text-red-600">Overdue</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${getPriorityBadge(deadline.priority)}`}>
                        {deadline.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusBadge(deadline.status)}`}>
                        {deadline.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {deadline.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleMarkCompleted(deadline.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                          aria-label="Mark complete"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {deadlines.map((deadline) => (
              <div key={deadline.id} className={`rounded-lg border p-4 ${
                isOverdue(deadline.due_date, deadline.status) ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
              }`}>
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{deadline.title}</h3>
                    <p className="text-sm text-slate-600">{deadline.deadline_type.replace(/_/g, ' ')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Link to={`/matters/${deadline.matter_reference.split('-')[0]}`} className="text-sm text-primary-600">
                        {deadline.matter_reference}
                      </Link>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">{deadline.matter_title}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${getPriorityBadge(deadline.priority)}`}>
                        {deadline.priority}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusBadge(deadline.status)}`}>
                        {deadline.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className={isOverdue(deadline.due_date, deadline.status) ? "text-red-600 font-medium" : "text-slate-900"}>
                    <span className="text-sm">{new Date(deadline.due_date).toLocaleDateString()}</span>
                    {isOverdue(deadline.due_date, deadline.status) && (
                      <p className="text-xs text-red-600">Overdue</p>
                    )}
                  </div>
                  {deadline.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted(deadline.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                      aria-label="Mark complete"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {totalDeadlines === 0
            ? "No results"
            : deadlines.length === 0
            ? `Showing 0 of ${totalDeadlines}`
            : `Showing ${offset + 1}-${offset + deadlines.length} of ${totalDeadlines}`}
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

export default DeadlinesListPage;