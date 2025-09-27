import useSWR from "swr";
import { api } from "../../lib/api";

interface Client {
  id: string;
  display_name: string;
  primary_email: string;
  phone: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const ClientsPage = () => {
  const { data } = useSWR<{ results: Client[] }>("/clients/", fetcher);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Clients</h2>
        <button className="rounded bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500">New Client</button>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Phone</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.results?.map((client) => (
            <tr key={client.id}>
              <td className="px-3 py-2">{client.display_name}</td>
              <td className="px-3 py-2">{client.primary_email}</td>
              <td className="px-3 py-2">{client.phone}</td>
            </tr>
          )) ?? (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                No clients yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ClientsPage;
