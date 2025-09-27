import { Link } from "react-router-dom";
import useSWR from "swr";
import { api } from "../../lib/api";

interface Matter {
  id: string;
  title: string;
  practice_area: string;
  status: string;
  reference_code: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const MattersPage = () => {
  const { data } = useSWR<{ results: Matter[] }>("/matters/", fetcher);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Matters</h2>
        <button className="rounded bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500">New Matter</button>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Reference</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Practice Area</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.results?.map((matter) => (
            <tr key={matter.id}>
              <td className="px-3 py-2 text-primary-600">
                <Link to={`/matters/${matter.id}`}>{matter.reference_code}</Link>
              </td>
              <td className="px-3 py-2">{matter.title}</td>
              <td className="px-3 py-2">{matter.practice_area}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${matter.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {matter.status}
                </span>
              </td>
            </tr>
          )) ?? (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                No matters yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MattersPage;
