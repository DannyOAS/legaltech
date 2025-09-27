import { useParams } from "react-router-dom";
import useSWR from "swr";
import { api } from "../../lib/api";

interface Document {
  id: string;
  filename: string;
  uploaded_at: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const MatterPortalPage = () => {
  const { matterId } = useParams();
  const { data } = useSWR<{ results: Document[] }>(
    matterId ? `/documents/?matter=${matterId}` : null,
    fetcher
  );

  return (
    <section className="rounded bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-slate-700">Matter Documents</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {data?.results?.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span>{doc.filename}</span>
            <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
          </li>
        )) ?? <li className="text-slate-500">No documents for this matter.</li>}
      </ul>
    </section>
  );
};

export default MatterPortalPage;
