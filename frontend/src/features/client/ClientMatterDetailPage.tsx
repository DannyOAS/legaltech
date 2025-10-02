import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
import Spinner from "../../components/ui/Spinner";
import { api, ApiError } from "../../lib/api";

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

interface ClientDocument {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
}

interface ClientInvoice {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  total: string;
  status: string;
  matter_title: string;
}

interface ClientThread {
  id: string;
  matter: string;
  created_at: string;
}

interface ClientMessage {
  id: string;
  thread: string;
  body: string;
  created_at: string;
  sender_user: string | null;
  sender_client: string | null;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

type TabKey = "documents" | "invoices" | "messages";

const ClientMatterDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [docPage, setDocPage] = useState(0);
  const [invoicePage, setInvoicePage] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [creatingThread, setCreatingThread] = useState(false);

  const { data: matter, error, isLoading } = useSWR<ClientMatter>(id ? `/client/matters/${id}/` : null, fetcher);

  const documentsKey = useMemo(() => {
    if (!id) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(docPage * PAGE_SIZE), matter: id });
    return `/client/documents/?${params.toString()}`;
  }, [id, docPage]);
  const { data: documentsData, isLoading: isLoadingDocuments } = useSWR<PaginatedResponse<ClientDocument>>(documentsKey, fetcher);

  const invoicesKey = useMemo(() => {
    if (!id) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(invoicePage * PAGE_SIZE), matter: id });
    return `/client/invoices/?${params.toString()}`;
  }, [id, invoicePage]);
  const { data: invoicesData, isLoading: isLoadingInvoices } = useSWR<PaginatedResponse<ClientInvoice>>(invoicesKey, fetcher);

  const threadsKey = useMemo(() => {
    if (!id) return null;
    const params = new URLSearchParams({ limit: "10", matter: id });
    return `/threads/?${params.toString()}`;
  }, [id]);
  const {
    data: threadsData,
    mutate: mutateThreads,
    isLoading: isLoadingThreads,
  } = useSWR<PaginatedResponse<ClientThread>>(threadsKey, fetcher);

  const threads = threadsData?.results ?? [];

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId(null);
      return;
    }
    setSelectedThreadId((prev) => prev ?? threads[0].id);
  }, [threads]);

  const messagesKey = useMemo(() => {
    if (!selectedThreadId) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: "0", thread: selectedThreadId });
    return `/messages/?${params.toString()}`;
  }, [selectedThreadId]);
  const { data: messagesData, mutate: mutateMessages } = useSWR<PaginatedResponse<ClientMessage>>(messagesKey, fetcher);

  const documents = documentsData?.results ?? [];
  const totalDocuments = documentsData?.count ?? 0;
  const hasPrevDocs = docPage > 0;
  const hasNextDocs = docPage * PAGE_SIZE + documents.length < totalDocuments;

  const invoices = invoicesData?.results ?? [];
  const totalInvoices = invoicesData?.count ?? 0;
  const hasPrevInvoices = invoicePage > 0;
  const hasNextInvoices = invoicePage * PAGE_SIZE + invoices.length < totalInvoices;

      resetStatusSoon();
      resetStatusSoon();
  };

  const renderDocumentSkeleton = (rows = 3) => (
    <ul className="space-y-3 text-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-9 w-full sm:w-32" />
        </li>
      ))}
    </ul>
  );

      return renderDocumentSkeleton();
      <>
        <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {totalDocuments === 0
              ? "No documents"
              : documents.length === 0
              ? `Showing 0 of ${totalDocuments}`
              : `Showing ${docPage * PAGE_SIZE + 1}-${docPage * PAGE_SIZE + documents.length} of ${totalDocuments}`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
              className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
      </>
        <ul className="space-y-3 text-sm">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full sm:w-32" />
            </li>
        </ul>
      <>
        <ul className="space-y-3 text-sm md:hidden">
            <li key={invoice.id} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-700">Invoice {invoice.number}</p>
                  <p className="text-xs text-slate-500">Issued {new Date(invoice.issue_date).toLocaleDateString()}</p>
                </div>
                  className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize ${
                      : "text-slate-600"
              </div>
              <dl className="grid gap-2 text-xs text-slate-500">
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-600">Due</dt>
                  <dd className="text-right">{new Date(invoice.due_date).toLocaleDateString()}</dd>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-600">Total</dt>
                  <dd className="text-right">${invoice.total}</dd>
              </dl>
                className="w-full"
                {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download PDF"}
            </li>
        </ul>
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Issued</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Due</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Total</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Status</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">{invoice.number}</td>
                    <td className="px-3 py-3">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                    <td className="px-3 py-3">{new Date(invoice.due_date).toLocaleDateString()}</td>
                    <td className="px-3 py-3 text-right">${invoice.total}</td>
                    <td
                      className={`px-3 py-3 text-right capitalize ${
                        invoice.status === "paid"
                          ? "text-emerald-600"
                          : invoice.status === "overdue"
                          ? "text-red-600"
                          : "text-slate-600"
                      }`}
                    >
                      {invoice.status}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInvoiceDownload(invoice)}
                        disabled={downloadingInvoiceId === invoice.id}
                      >
                        {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {totalInvoices === 0
              ? "No invoices"
              : invoices.length === 0
              ? `Showing 0 of ${totalInvoices}`
              : `Showing ${invoicePage * PAGE_SIZE + 1}-${invoicePage * PAGE_SIZE + invoices.length} of ${totalInvoices}`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
              type="button"
              className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
      </>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="client-thread-select">
            <Button className="mt-3" size="sm" onClick={handleCreateThread} disabled={creatingThread}>


        <form className="space-y-2" onSubmit={handleSendMessage}>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load matter.</p>;
  }

  if (!matter) {
    return <p className="text-sm text-slate-500">Matter not found.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-lg bg-white p-4 shadow sm:p-6">
      <section className="space-y-4 rounded-lg bg-white p-4 shadow sm:p-6">
export default ClientMatterDetailPage;
