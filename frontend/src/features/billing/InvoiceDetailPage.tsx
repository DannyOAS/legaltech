import { useParams } from "react-router-dom";
import useSWR from "swr";
import { api } from "../../lib/api";

interface Invoice {
  id: string;
  number: string;
  subtotal: string;
  tax_total: string;
  total: string;
  status: string;
  issue_date: string;
  due_date: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const { data } = useSWR<Invoice>(id ? `/invoices/${id}/` : null, fetcher);

  if (!data) {
    return <div className="rounded bg-white p-6 shadow">Loading invoice...</div>;
  }

  return (
    <section className="rounded bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-slate-700">Invoice {data.number}</h2>
      <dl className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Status</dt>
          <dd>{data.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Issue Date</dt>
          <dd>{new Date(data.issue_date).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Due Date</dt>
          <dd>{new Date(data.due_date).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Subtotal</dt>
          <dd>${data.subtotal}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Tax</dt>
          <dd>${data.tax_total}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Total</dt>
          <dd className="text-lg font-semibold text-primary-600">${data.total}</dd>
        </div>
      </dl>
    </section>
  );
};

export default InvoiceDetailPage;
