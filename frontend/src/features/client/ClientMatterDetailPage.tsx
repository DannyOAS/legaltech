import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Skeleton from "../../components/ui/Skeleton";
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
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

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
  const [creatingThread, setCreatingThread] = useState(false);

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

  const resetStatus = () => {
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleCreateThread = async () => {
    if (!id) return;
    try {
      setCreatingThread(true);
      const response = await api.post<ClientThread>("/threads/", { matter: id });
      await mutateThreads();
      setSelectedThreadId(response.id);
      setStatusMessage("Conversation started");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Unable to start conversation" : "Unable to start conversation";
      setStatusMessage(message);
    } finally {
      setCreatingThread(false);
      resetStatus();
    }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedThreadId || !messageDraft.trim()) {
      return;
    }
    try {
      setSendingMessage(true);
      await api.post("/messages/", { thread: selectedThreadId, body: messageDraft.trim() });
      setMessageDraft("");
      await mutateMessages();
      setStatusMessage("Message sent");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Unable to send message" : "Unable to send message";
      setStatusMessage(message);
    } finally {
      setSendingMessage(false);
      resetStatus();
    }
  };

  const handleDocumentDownload = async (doc: ClientDocument) => {
    try {
  setDownloadingDocumentId(doc.id);
      setStatusMessage("Fetching download link...");
      const response = await api.get<{ url: string | { url: string } }>(`/client/documents/${doc.id}/download/`);
      const url = typeof response.url === "string" ? response.url : response.url?.url;
      if (!url) {
        throw new Error("No download URL returned");
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage("Download started");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Unable to download document" : "Unable to download document";
      setStatusMessage(message);
    } finally {
  setDownloadingDocumentId(null);
      resetStatus();
    }
  };

  const handleInvoiceDownload = async (invoice: ClientInvoice) => {
    try {
      setDownloadingInvoiceId(invoice.id);
      setStatusMessage("Generating invoice PDF...");
      const response = await api.get<{ url: string | { url: string } }>(`/client/invoices/${invoice.id}/download/`);
      const url = typeof response.url === "string" ? response.url : response.url?.url;
      if (!url) {
        throw new Error("No download URL returned");
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.number}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage("Invoice download started");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Unable to download invoice" : "Unable to download invoice";
      setStatusMessage(message);
    } finally {
      setDownloadingInvoiceId(null);
      resetStatus();
    }
  };

  const renderMatterMeta = () => {
    if (!matter) {
      return null;
    }
    return (
      <dl className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Reference</dt>
          <dd>{matter.reference_code}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Practice Area</dt>
          <dd>{matter.practice_area || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Opened</dt>
          <dd>{new Date(matter.opened_at).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Status</dt>
          <dd className="capitalize">{matter.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Lead Lawyer</dt>
          <dd>{matter.lead_lawyer_name || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Closed</dt>
          <dd>{matter.closed_at ? new Date(matter.closed_at).toLocaleDateString() : "—"}</dd>
        </div>
      </dl>
    );
  };

  const renderDocuments = () => {
    if (isLoadingDocuments && !documents.length) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (documents.length === 0) {
      return <p className="text-sm text-slate-500">No documents shared yet.</p>;
    }

    return (
      <div className="space-y-3">
        <ul className="space-y-3 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-700">{doc.filename}</p>
                <p className="text-xs text-slate-500">
                  {doc.mime} · {(doc.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDocumentDownload(doc)}
                  disabled={downloadingDocumentId === doc.id}
                >
                  {downloadingDocumentId === doc.id ? "Preparing..." : "Download"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{`Showing ${docPage * PAGE_SIZE + 1}-${docPage * PAGE_SIZE + documents.length} of ${totalDocuments}`}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDocPage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPrevDocs}
              className={`rounded border px-2 py-1 ${
                hasPrevDocs ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setDocPage((prev) => (hasNextDocs ? prev + 1 : prev))}
              disabled={!hasNextDocs}
              className={`rounded border px-2 py-1 ${
                hasNextDocs ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInvoices = () => {
    if (isLoadingInvoices && !invoices.length) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-2 h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-28" />
            </div>
          ))}
        </div>
      );
    }

    if (invoices.length === 0) {
      return <p className="text-sm text-slate-500">No invoices yet.</p>;
    }

    return (
      <div className="space-y-3">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Invoice</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Issued</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Due</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-3 py-2">{invoice.number}</td>
                  <td className="px-3 py-2">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{new Date(invoice.due_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">${invoice.total}</td>
                  <td className={`px-3 py-2 text-right capitalize ${
                    invoice.status === "paid"
                      ? "text-emerald-600"
                      : invoice.status === "overdue"
                      ? "text-red-600"
                      : "text-slate-600"
                  }`}
                  >
                    {invoice.status}
                  </td>
                  <td className="px-3 py-2 text-right">
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
        <div className="space-y-3 md:hidden">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-semibold text-slate-700">{invoice.number}</p>
                <span
                  className={`text-xs uppercase ${
                    invoice.status === "paid"
                      ? "text-emerald-600"
                      : invoice.status === "overdue"
                      ? "text-red-600"
                      : "text-slate-500"
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Issued</span>
                  <span>{new Date(invoice.issue_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Due</span>
                  <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Total</span>
                  <span>${invoice.total}</span>
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                size="sm"
                onClick={() => handleInvoiceDownload(invoice)}
                disabled={downloadingInvoiceId === invoice.id}
              >
                {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download"}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{`Showing ${invoicePage * PAGE_SIZE + 1}-${invoicePage * PAGE_SIZE + invoices.length} of ${totalInvoices}`}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInvoicePage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPrevInvoices}
              className={`rounded border px-2 py-1 ${
                hasPrevInvoices
                  ? "border-slate-300 hover:border-primary-500 hover:text-primary-600"
                  : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setInvoicePage((prev) => (hasNextInvoices ? prev + 1 : prev))}
              disabled={!hasNextInvoices}
              className={`rounded border px-2 py-1 ${
                hasNextInvoices
                  ? "border-slate-300 hover:border-primary-500 hover:text-primary-600"
                  : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    const messages = messagesData?.results ?? [];

    if (isLoadingThreads && !threads.length) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {threads.length > 1 ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-500" htmlFor="client-thread-select">
              Conversation
            </label>
            <select
              id="client-thread-select"
              value={selectedThreadId ?? ""}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedThreadId(event.target.value || null)}
              className="rounded border border-slate-300 px-3 py-1 text-sm focus:border-primary-500 focus:outline-none"
            >
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  Thread {thread.id.slice(0, 6)} · {new Date(thread.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p>No conversations yet.</p>
            <Button className="mt-3" size="sm" onClick={handleCreateThread} disabled={creatingThread}>
              {creatingThread ? "Starting..." : "Start Conversation"}
            </Button>
          </div>
        ) : null}

        <div className="max-h-96 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet. Start the conversation below.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {messages.map((message) => {
                const isClient = Boolean(message.sender_client);
                return (
                  <li key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isClient ? "bg-primary-600 text-white" : "bg-white text-slate-700 shadow"
                      }`}
                    >
                      <p>{message.body}</p>
                      <time className={`mt-1 block text-xs ${isClient ? "text-primary-100" : "text-slate-400"}`}>
                        {new Date(message.created_at).toLocaleString()}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form className="space-y-2" onSubmit={handleSendMessage}>
          <textarea
            value={messageDraft}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMessageDraft(event.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 p-2 text-sm focus:border-primary-500 focus:outline-none"
            placeholder="Write a message..."
            disabled={threads.length === 0 || !selectedThreadId}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!selectedThreadId || sendingMessage || !messageDraft.trim()}>
              {sendingMessage ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <section className="rounded-lg bg-white p-6 shadow">
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex gap-4 border-b border-slate-200 pb-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-20" />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded border border-slate-200 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
        </section>
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
      <section className="rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">{matter.title}</h2>
            <p className="text-xs text-slate-500">Reference: {matter.reference_code}</p>
          </div>
        </div>
        <div className="mt-6">{renderMatterMeta()}</div>
      </section>
      <section className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
          <button
            type="button"
            className={`text-sm font-medium ${
              activeTab === "documents" ? "border-b-2 border-primary-600 text-primary-600" : "text-slate-500"
            }`}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
          <button
            type="button"
            className={`text-sm font-medium ${
              activeTab === "invoices" ? "border-b-2 border-primary-600 text-primary-600" : "text-slate-500"
            }`}
            onClick={() => setActiveTab("invoices")}
          >
            Invoices
          </button>
          <button
            type="button"
            className={`text-sm font-medium ${
              activeTab === "messages" ? "border-b-2 border-primary-600 text-primary-600" : "text-slate-500"
            }`}
            onClick={() => setActiveTab("messages")}
          >
            Messages
          </button>
        </div>
        <div className="mt-4">
          {statusMessage ? (
            <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{statusMessage}</div>
          ) : null}
          {activeTab === "documents"
            ? renderDocuments()
            : activeTab === "invoices"
            ? renderInvoices()
            : renderMessages()}
        </div>
      </section>
    </div>
  );
};

export default ClientMatterDetailPage;
