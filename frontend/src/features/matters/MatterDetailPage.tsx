import { useParams } from "react-router-dom";
import useSWR from "swr";
import { api } from "../../lib/api";

interface Matter {
  id: string;
  title: string;
  practice_area: string;
  status: string;
  reference_code: string;
  opened_at: string;
  closed_at?: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const MatterDetailPage = () => {
  const { id } = useParams();
  const { data } = useSWR<Matter>(id ? `/matters/${id}/` : null, fetcher);

  if (!data) {
    return <div className="rounded bg-white p-6 shadow">Loading matter...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-700">{data.title}</h2>
        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Reference</dt>
            <dd>{data.reference_code}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Practice Area</dt>
            <dd>{data.practice_area}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Status</dt>
            <dd>{data.status}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Opened</dt>
            <dd>{new Date(data.opened_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default MatterDetailPage;
