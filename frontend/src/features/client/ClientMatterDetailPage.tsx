import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
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
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
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
  const { data: documentsData } = useSWR<PaginatedResponse<ClientDocument>>(documentsKey, fetcher);

  const invoicesKey = useMemo(() => {
    if (!id) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(invoicePage * PAGE_SIZE), matter: id });
    return `/client/invoices/?${params.toString()}`;
  }, [id, invoicePage]);
  const { data: invoicesData } = useSWR<PaginatedResponse<ClientInvoice>>(invoicesKey, fetcher);

  const threadsKey = useMemo(() => {
    if (!id) return null;
    const params = new URLSearchParams({ limit: "10", matter: id });
    return `/threads/?${params.toString()}`;
  }, [id]);
  const { data: threadsData, mutate: mutateThreads } = useSWR<PaginatedResponse<ClientThread>>(threadsKey, fetcher);
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

  const resetStatusSoon = () => {
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDocumentDownload = async (doc: ClientDocument) => {
    try {
      setDownloadingDocId(doc.id);
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
      setDownloadingDocId(null);
      resetStatusSoon();
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
      resetStatusSoon();
    }
  };

  const renderMatterMeta = () => {
    if (!matter) {
      return null;
    }

    const metaItems: Array<{ label: string; value: string }> = [
      { label: "Reference", value: matter.reference_code },
      { label: "Practice Area", value: matter.practice_area || "—" },
      { label: "Opened", value: new Date(matter.opened_at).toLocaleDateString() },
      { label: "Status", value: matter.status },
      { label: "Lead Lawyer", value: matter.lead_lawyer_name || "—" },
      {
        label: "Closed",
        value: matter.closed_at ? new Date(matter.closed_at).toLocaleDateString() : "—",
      },
    ];

    return (
      <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        {metaItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-700 capitalize">{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderDocuments = () => (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents shared yet.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-700">{doc.filename}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{doc.mime || "Unknown"}</span>
                    <span>·</span>
                    <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <time className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</time>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleDocumentDownload(doc)}
                disabled={downloadingDocId === doc.id}
              >
                {downloadingDocId === doc.id ? "Preparing..." : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {totalDocuments === 0
            ? "No documents"
            : documents.length === 0
            ? `Showing 0 of ${totalDocuments}`
            : `Showing ${docPage * PAGE_SIZE + 1}-${docPage * PAGE_SIZE + documents.length} of ${totalDocuments}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDocPage((prev) => Math.max(prev - 1, 0))}
            disabled={!hasPrevDocs}
            className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              hasPrevDocs ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setDocPage((prev) => (hasNextDocs ? prev + 1 : prev))}
            disabled={!hasNextDocs}
            className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              hasNextDocs ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-4">
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-500">No invoices yet.</p>
      ) : (
        <>
          <ul className="space-y-3 text-sm md:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="space-y-3 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-700">Invoice {invoice.number}</p>
                    <p className="text-xs text-slate-500">Issued {new Date(invoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <span
                    className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize ${
                      invoice.status === "paid"
                        ? "text-emerald-600"
                        : invoice.status === "overdue"
                        ? "text-red-600"
                        : "text-slate-600"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <dl className="grid gap-2 text-xs text-slate-500">
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-600">Due</dt>
                    <dd className="text-right">{new Date(invoice.due_date).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-600">Total</dt>
                    <dd className="text-right">${invoice.total}</dd>
                  </div>
                </dl>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleInvoiceDownload(invoice)}
                  disabled={downloadingInvoiceId === invoice.id}
                >
                  {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download PDF"}
                </Button>
              </li>
            ))}
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
          </div>
        </>
      )}
      <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {totalInvoices === 0
            ? "No invoices"
            : invoices.length === 0
            ? `Showing 0 of ${totalInvoices}`
            : `Showing ${invoicePage * PAGE_SIZE + 1}-${invoicePage * PAGE_SIZE + invoices.length} of ${totalInvoices}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInvoicePage((prev) => Math.max(prev - 1, 0))}
            disabled={!hasPrevInvoices}
            className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              hasPrevInvoices ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setInvoicePage((prev) => (hasNextInvoices ? prev + 1 : prev))}
            disabled={!hasNextInvoices}
            className={`flex-1 rounded border px-3 py-1 text-center text-xs transition-colors sm:flex-none sm:w-auto ${
              hasNextInvoices ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderMessages = () => {
    const messages = messagesData?.results ?? [];
    return (
      <div className="space-y-4">
        {threads.length > 1 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversation</label>
            <select
              value={selectedThreadId ?? ""}
              onChange={(event) => setSelectedThreadId(event.target.value || null)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none sm:w-auto"
            >
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  Thread {thread.id.slice(0, 6)} · {new Date(thread.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p>No conversations yet.</p>
            <Button
              className="mt-3"
              size="sm"
              onClick={async () => {
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
                  resetStatusSoon();
                }
              }}
              disabled={creatingThread}
            >
              {creatingThread ? "Starting..." : "Start Conversation"}
            </Button>
          </div>
        ) : null}
        <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet. Start the conversation below.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {messages.map((message) => {
                const isClient = Boolean(message.sender_client);
                return (
                  <li key={message.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 ${
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
        <form
          className="space-y-2"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
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
              resetStatusSoon();
            }
          }}
        >
          <textarea
            value={messageDraft}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMessageDraft(event.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 p-3 text-sm focus:border-primary-500 focus:outline-none"
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
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
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
      <section className="space-y-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-700">{matter.title}</h2>
            <p className="text-sm text-slate-500">Reference: {matter.reference_code}</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {matter.status}
          </span>
        </div>
        {renderMatterMeta()}
      </section>
      <section className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {(["documents", "invoices", "messages"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`border-b-2 pb-1 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {statusMessage ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{statusMessage}</div>
          ) : null}
        </div>
        {activeTab === "documents"
          ? renderDocuments()
          : activeTab === "invoices"
          ? renderInvoices()
          : renderMessages()}
      </section>
    </div>
  );
};

export default ClientMatterDetailPage;
