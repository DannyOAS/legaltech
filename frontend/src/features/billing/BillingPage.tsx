import { ChangeEvent, FormEvent, useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import CheckboxField from "../../components/ui/CheckboxField";
import Modal from "../../components/ui/Modal";
import SelectField from "../../components/ui/SelectField";
import Spinner from "../../components/ui/Spinner";
import TextAreaField from "../../components/ui/TextAreaField";
import TextField from "../../components/ui/TextField";
import { useToast } from "../../components/ui/ToastProvider";
import { api, ApiError } from "../../lib/api";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";

interface BillingSummary {
  total_hours: string;
  total_expenses: string;
  outstanding_balance: string;
}

interface MatterOption {
  id: string;
  title: string;
  reference_code: string;
}

interface TimeEntry {
  id: string;
  matter: string;
  description: string;
  minutes: number;
  rate: string;
  date: string;
  billable: boolean;
  source: string;
}

interface Expense {
  id: string;
  matter: string;
  description: string;
  amount: string;
  date: string;
  tax_code: string;
  receipt_file: string;
}

interface InvoiceRecord {
  id: string;
  matter: string;
  number: string;
  issue_date: string;
  due_date: string;
  subtotal: string;
  tax_total: string;
  total: string;
  status: "draft" | "sent" | "paid" | "overdue";
  pdf_file: string | null;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

interface TimeEntryFormState {
  matter: string;
  description: string;
  minutes: string;
  rate: string;
  date: string;
  billable: boolean;
  source: string;
}

const defaultTimeEntryForm: TimeEntryFormState = {
  matter: "",
  description: "",
  minutes: "60",
  rate: "300",
  date: new Date().toISOString().slice(0, 10),
  billable: true,
  source: "manual",
};

interface ExpenseFormState {
  matter: string;
  description: string;
  amount: string;
  date: string;
  tax_code: string;
  receipt_file: string;
}

const defaultExpenseForm: ExpenseFormState = {
  matter: "",
  description: "",
  amount: "0",
  date: new Date().toISOString().slice(0, 10),
  tax_code: "",
  receipt_file: "",
};

const sourceOptions = [
  { value: "manual", label: "Manual" },
  { value: "email", label: "Email" },
  { value: "doc", label: "Document" },
  { value: "call", label: "Phone Call" },
];

const invoiceStatusOptions = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const BillingPage = () => {
  const toast = useToast();
  const [timePage, setTimePage] = useState(0);
  const [timeSearch, setTimeSearch] = useState("");
  const timeOffset = timePage * PAGE_SIZE;
  const timeEntriesKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(timeOffset) });
    if (timeSearch.trim()) {
      params.set("search", timeSearch.trim());
    }
    return `/time-entries/?${params.toString()}`;
  }, [timeOffset, timeSearch]);
  const [expensePage, setExpensePage] = useState(0);
  const [expenseSearch, setExpenseSearch] = useState("");
  const expenseOffset = expensePage * PAGE_SIZE;
  const expensesKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(expenseOffset) });
    if (expenseSearch.trim()) {
      params.set("search", expenseSearch.trim());
    }
    return `/expenses/?${params.toString()}`;
  }, [expenseOffset, expenseSearch]);
  const { data: summary, mutate: mutateSummary } = useSWR<BillingSummary>("/reports/billing-summary/", fetcher);
  const {
    data: timeEntriesData,
    mutate: mutateTimeEntries,
    isLoading: isTimeLoading,
  } = useSWR<PaginatedResponse<TimeEntry>>(timeEntriesKey, fetcher);
  const {
    data: expensesData,
    mutate: mutateExpenses,
    isLoading: isExpenseLoading,
  } = useSWR<PaginatedResponse<Expense>>(expensesKey, fetcher);
  const [invoicePage, setInvoicePage] = useState(0);
  const [invoiceStatus, setInvoiceStatus] = useState("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const invoiceOffset = invoicePage * PAGE_SIZE;
  const invoicesKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(invoiceOffset) });
    if (invoiceStatus !== "all") {
      params.set("status", invoiceStatus);
    }
    if (invoiceSearch.trim()) {
      params.set("search", invoiceSearch.trim());
    }
    return `/invoices/?${params.toString()}`;
  }, [invoiceOffset, invoiceStatus, invoiceSearch]);
  const {
    data: invoicesData,
    mutate: mutateInvoices,
    isLoading: isInvoiceLoading,
  } = useSWR<PaginatedResponse<InvoiceRecord>>(invoicesKey, fetcher);
  const { data: mattersData } = useSWR<PaginatedResponse<MatterOption>>("/matters/?limit=500", fetcher);

  const matters = mattersData?.results ?? [];
  const matterLookup = useMemo(() => new Map(matters.map((matter) => [matter.id, matter])), [matters]);

  const timeEntries = timeEntriesData?.results ?? [];
  const totalTimeEntries = timeEntriesData?.count ?? 0;
  const expenses = expensesData?.results ?? [];
  const totalExpenses = expensesData?.count ?? 0;
  const hasPreviousTime = timePage > 0;
  const hasNextTime = timeOffset + timeEntries.length < totalTimeEntries;
  const hasPreviousExpense = expensePage > 0;
  const hasNextExpense = expenseOffset + expenses.length < totalExpenses;
  const invoices = invoicesData?.results ?? [];
  const totalInvoices = invoicesData?.count ?? 0;
  const hasPreviousInvoice = invoicePage > 0;
  const hasNextInvoice = invoiceOffset + invoices.length < totalInvoices;

  const [timeForm, setTimeForm] = useState<TimeEntryFormState>(defaultTimeEntryForm);
  const [timeErrors, setTimeErrors] = useState<Partial<Record<keyof TimeEntryFormState, string>>>({});
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [editingTime, setEditingTime] = useState<TimeEntry | null>(null);
  const [isSavingTime, setIsSavingTime] = useState(false);
  const [deleteTimeTarget, setDeleteTimeTarget] = useState<TimeEntry | null>(null);
  const [isDeletingTime, setIsDeletingTime] = useState(false);

  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(defaultExpenseForm);
  const [expenseErrors, setExpenseErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({});
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [markingInvoiceId, setMarkingInvoiceId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const resetTimeForm = useCallback(() => {
    setTimeForm({ ...defaultTimeEntryForm, matter: matters[0]?.id ?? "" });
    setTimeErrors({});
    setEditingTime(null);
  }, [matters]);

  const resetExpenseForm = useCallback(() => {
    setExpenseForm({ ...defaultExpenseForm, matter: matters[0]?.id ?? "" });
    setExpenseErrors({});
    setEditingExpense(null);
  }, [matters]);

  const openTimeModal = (entry?: TimeEntry) => {
    if (entry) {
      setEditingTime(entry);
      setTimeForm({
        matter: entry.matter,
        description: entry.description,
        minutes: String(entry.minutes),
        rate: entry.rate,
        date: entry.date,
        billable: entry.billable,
        source: entry.source,
      });
    } else {
      resetTimeForm();
    }
    setIsTimeModalOpen(true);
  };

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        matter: expense.matter,
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        tax_code: expense.tax_code ?? "",
        receipt_file: expense.receipt_file ?? "",
      });
    } else {
      resetExpenseForm();
    }
    setIsExpenseModalOpen(true);
  };

  const closeTimeModal = () => {
    setIsTimeModalOpen(false);
    resetTimeForm();
  };

  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false);
    resetExpenseForm();
  };

  const handleTimeInputChange = (field: keyof TimeEntryFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setTimeForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (timeErrors[field]) {
      setTimeErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeCheckboxChange = (field: keyof TimeEntryFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setTimeForm((prev) => ({ ...prev, [field]: event.target.checked }));
    if (timeErrors[field]) {
      setTimeErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleExpenseInputChange = (field: keyof ExpenseFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setExpenseForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (expenseErrors[field]) {
      setExpenseErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeSelectChange = (field: keyof TimeEntryFormState) => (event: ChangeEvent<HTMLSelectElement>) => {
    setTimeForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (timeErrors[field]) {
      setTimeErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleExpenseSelectChange = (field: keyof ExpenseFormState) => (event: ChangeEvent<HTMLSelectElement>) => {
    setExpenseForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (expenseErrors[field]) {
      setExpenseErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTimeSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTimeSearch(event.target.value);
    setTimePage(0);
  };

  const handleExpenseSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setExpenseSearch(event.target.value);
    setExpensePage(0);
  };

  const handleInvoiceSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInvoiceSearch(event.target.value);
    setInvoicePage(0);
  };

  const handleInvoiceStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setInvoiceStatus(event.target.value);
    setInvoicePage(0);
  };

  const validateTimeForm = () => {
    const errors: Partial<Record<keyof TimeEntryFormState, string>> = {};
    if (!timeForm.matter) errors.matter = "Select a matter";
    if (!timeForm.description.trim()) errors.description = "Description is required";
    const minutes = Number(timeForm.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) errors.minutes = "Minutes must be greater than zero";
    const rate = Number(timeForm.rate);
    if (!Number.isFinite(rate) || rate < 0) errors.rate = "Rate must be zero or positive";
    if (!timeForm.date) errors.date = "Date is required";
    setTimeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateExpenseForm = () => {
    const errors: Partial<Record<keyof ExpenseFormState, string>> = {};
    if (!expenseForm.matter) errors.matter = "Select a matter";
    if (!expenseForm.description.trim()) errors.description = "Description is required";
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Amount must be greater than zero";
    if (!expenseForm.date) errors.date = "Date is required";
    setExpenseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitTimeEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateTimeForm()) {
      toast.error("Unable to save time entry", "Please fix the highlighted fields.");
      return;
    }
    setIsSavingTime(true);
    const payload = {
      matter: timeForm.matter,
      description: timeForm.description.trim(),
      minutes: Number(timeForm.minutes),
      rate: Number(timeForm.rate),
      date: timeForm.date,
      billable: timeForm.billable,
      source: timeForm.source,
    };
    const isEdit = Boolean(editingTime);
    try {
      if (isEdit) {
        await api.patch(`/time-entries/${editingTime!.id}/`, payload);
      } else {
        await api.post("/time-entries/", payload);
        setTimePage(0);
      }
      await Promise.all([mutateTimeEntries(), mutateSummary()]);
      toast.success(`Time entry ${isEdit ? "updated" : "captured"}`, `${payload.description.slice(0, 40)} saved.`);
      closeTimeModal();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error("Unable to save time entry", error.payload.detail ?? "Try again later.");
      } else {
        toast.error("Unexpected error", "An unexpected error occurred while saving the time entry.");
      }
    } finally {
      setIsSavingTime(false);
    }
  };

  const submitExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateExpenseForm()) {
      toast.error("Unable to save expense", "Please fix the highlighted fields.");
      return;
    }
    setIsSavingExpense(true);
    const payload = {
      matter: expenseForm.matter,
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      tax_code: expenseForm.tax_code.trim(),
      receipt_file: expenseForm.receipt_file.trim(),
    };
    const isEdit = Boolean(editingExpense);
    try {
      if (isEdit) {
        await api.patch(`/expenses/${editingExpense!.id}/`, payload);
      } else {
        await api.post("/expenses/", payload);
        setExpensePage(0);
      }
      await Promise.all([mutateExpenses(), mutateSummary()]);
      toast.success(`Expense ${isEdit ? "updated" : "recorded"}`, `${payload.description.slice(0, 40)} saved.`);
      closeExpenseModal();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error("Unable to save expense", error.payload.detail ?? "Try again later.");
      } else {
        toast.error("Unexpected error", "An unexpected error occurred while saving the expense.");
      }
    } finally {
      setIsSavingExpense(false);
    }
  };

  const confirmDeleteTime = async () => {
    if (!deleteTimeTarget) return;
    setIsDeletingTime(true);
    try {
      await api.delete(`/time-entries/${deleteTimeTarget.id}/`);
      const [updated] = await Promise.all([mutateTimeEntries(), mutateSummary()]);
      const remaining = updated?.count ?? 0;
      if (remaining === 0) {
        setTimePage(0);
      } else if (remaining <= timeOffset && timePage > 0) {
        setTimePage((prev) => Math.max(prev - 1, 0));
      }
      toast.success("Time entry removed", "The entry has been deleted.");
      setDeleteTimeTarget(null);
    } catch (error) {
      toast.error("Unable to delete", error instanceof ApiError ? error.payload.detail ?? "" : "Try again later.");
    } finally {
      setIsDeletingTime(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseTarget) return;
    setIsDeletingExpense(true);
    try {
      await api.delete(`/expenses/${deleteExpenseTarget.id}/`);
      const [updated] = await Promise.all([mutateExpenses(), mutateSummary()]);
      const remaining = updated?.count ?? 0;
      if (remaining === 0) {
        setExpensePage(0);
      } else if (remaining <= expenseOffset && expensePage > 0) {
        setExpensePage((prev) => Math.max(prev - 1, 0));
      }
      toast.success("Expense removed", "The expense has been deleted.");
      setDeleteExpenseTarget(null);
    } catch (error) {
      toast.error("Unable to delete", error instanceof ApiError ? error.payload.detail ?? "" : "Try again later.");
    } finally {
      setIsDeletingExpense(false);
    }
  };

  const handleSendInvoice = async (invoice: InvoiceRecord) => {
    if (invoice.status === "paid") {
      toast.info("Invoice already paid", "This invoice has already been settled.");
      return;
    }
    setSendingInvoiceId(invoice.id);
    try {
      await api.post(`/invoices/${invoice.id}/send/`);
      await Promise.all([mutateInvoices(), mutateSummary()]);
      toast.success("Invoice sent", `${invoice.number} emailed to the client.`);
    } catch (error) {
      toast.error(
        "Unable to send invoice",
        error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error occurred.",
      );
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleMarkInvoicePaid = async (invoice: InvoiceRecord) => {
    if (invoice.status === "paid") {
      toast.info("Already paid", "This invoice is already marked as paid.");
      return;
    }
    setMarkingInvoiceId(invoice.id);
    try {
      await api.post(`/invoices/${invoice.id}/mark-paid/`, {
        amount: Number(invoice.total),
        method: "manual",
      });
      await Promise.all([mutateInvoices(), mutateSummary()]);
      toast.success("Payment recorded", `${invoice.number} marked as paid.`);
    } catch (error) {
      toast.error(
        "Unable to mark paid",
        error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error occurred.",
      );
    } finally {
      setMarkingInvoiceId(null);
    }
  };

  const handleDownloadInvoice = async (invoice: InvoiceRecord) => {
    setDownloadingInvoiceId(invoice.id);
    try {
      const response = await api.get<{ url: string | { url: string } }>(`/invoices/${invoice.id}/download/`);
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
      toast.success("Download started", `${invoice.number} opened in a new tab.`);
    } catch (error) {
      toast.error(
        "Unable to download",
        error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error occurred.",
      );
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const renderMatterName = useCallback(
    (matterId: string) => {
      const matter = matterLookup.get(matterId);
      if (!matter) return "Unknown";
      return `${matter.reference_code} · ${matter.title}`;
    },
    [matterLookup],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Billing Snapshot</h2>
        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <dt>Total Billable Hours</dt>
            <dd className="text-xl font-semibold text-primary-600">{summary?.total_hours ?? "--"}</dd>
          </div>
          <div>
            <dt>Expenses</dt>
            <dd className="text-xl font-semibold text-primary-600">${summary?.total_expenses ?? "--"}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd className="text-xl font-semibold text-primary-600">${summary?.outstanding_balance ?? "--"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Time Entries</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <input
              type="search"
              value={timeSearch}
              onChange={handleTimeSearchChange}
              placeholder="Search time entries..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
            />
            <Button className="w-full md:w-auto" onClick={() => openTimeModal()} disabled={matters.length === 0}>
              Log Time
            </Button>
          </div>
        </div>
        {matters.length === 0 ? (
          <p className="text-sm text-amber-600">Create a matter before logging time.</p>
        ) : null}
        {isTimeLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : timeEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No time entries captured yet.</p>
        ) : (
          <div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Matter</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Hours</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Rate</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Source</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2">{renderMatterName(entry.matter)}</td>
                      <td className="px-3 py-2 text-slate-600">{entry.description}</td>
                      <td className="px-3 py-2">{(entry.minutes / 60).toFixed(2)}</td>
                      <td className="px-3 py-2">${Number(entry.rate).toFixed(2)}</td>
                      <td className="px-3 py-2">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 capitalize">{entry.source}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openTimeModal(entry)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                            aria-label="Edit time entry"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTimeTarget(entry)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                            aria-label="Delete time entry"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{renderMatterName(entry.matter)}</span>
                      <span className="text-xs uppercase text-slate-500">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-700">{entry.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <span className="rounded bg-white px-2 py-1 font-medium text-primary-700">
                        {(entry.minutes / 60).toFixed(2)} hrs
                      </span>
                      <span className="rounded bg-white px-2 py-1 text-slate-700">@ ${Number(entry.rate).toFixed(2)}</span>
                      <span className="rounded bg-white px-2 py-1 capitalize text-slate-700">{entry.source}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openTimeModal(entry)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                      aria-label="Edit time entry"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTimeTarget(entry)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                      aria-label="Delete time entry"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalTimeEntries === 0
              ? "No results"
              : timeEntries.length === 0
              ? `Showing 0 of ${totalTimeEntries}`
              : `Showing ${timeOffset + 1}-${timeOffset + timeEntries.length} of ${totalTimeEntries}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimePage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPreviousTime}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasPreviousTime ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setTimePage((prev) => (hasNextTime ? prev + 1 : prev))}
              disabled={!hasNextTime}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasNextTime ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Expenses</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <input
              type="search"
              value={expenseSearch}
              onChange={handleExpenseSearchChange}
              placeholder="Search expenses..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
            />
            <Button className="w-full md:w-auto" onClick={() => openExpenseModal()} disabled={matters.length === 0}>
              Record Expense
            </Button>
          </div>
        </div>
        {isExpenseLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses recorded yet.</p>
        ) : (
          <div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Matter</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Tax Code</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Receipt</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-3 py-2">{renderMatterName(expense.matter)}</td>
                      <td className="px-3 py-2 text-slate-600">{expense.description}</td>
                      <td className="px-3 py-2">${Number(expense.amount).toFixed(2)}</td>
                      <td className="px-3 py-2">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{expense.tax_code || "—"}</td>
                      <td className="px-3 py-2">{expense.receipt_file || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openExpenseModal(expense)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                            aria-label="Edit expense"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteExpenseTarget(expense)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                            aria-label="Delete expense"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {expenses.map((expense) => (
                <div key={expense.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{renderMatterName(expense.matter)}</span>
                      <span className="text-xs uppercase text-slate-500">{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-700">{expense.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">${Number(expense.amount).toFixed(2)}</span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{expense.tax_code || "No tax"}</span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{expense.receipt_file ? "Receipt on file" : "No receipt"}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openExpenseModal(expense)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                      aria-label="Edit expense"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteExpenseTarget(expense)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                      aria-label="Delete expense"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalExpenses === 0
              ? "No results"
              : expenses.length === 0
              ? `Showing 0 of ${totalExpenses}`
              : `Showing ${expenseOffset + 1}-${expenseOffset + expenses.length} of ${totalExpenses}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpensePage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPreviousExpense}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasPreviousExpense ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setExpensePage((prev) => (hasNextExpense ? prev + 1 : prev))}
              disabled={!hasNextExpense}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasNextExpense ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Invoices</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <input
              type="search"
              value={invoiceSearch}
              onChange={handleInvoiceSearchChange}
              placeholder="Search invoices..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
            />
            <select
              value={invoiceStatus}
              onChange={handleInvoiceStatusChange}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none md:max-w-xs"
            >
              {invoiceStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isInvoiceLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Number</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Matter</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Issued</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Due</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-3 py-2">{invoice.number}</td>
                      <td className="px-3 py-2">{renderMatterName(invoice.matter)}</td>
                      <td className="px-3 py-2">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">${Number(invoice.total).toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right capitalize ${
                        invoice.status === "paid"
                          ? "text-emerald-600"
                          : invoice.status === "overdue"
                          ? "text-red-600"
                          : "text-slate-600"
                      }`}>
                        {invoice.status}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendInvoice(invoice)}
                            disabled={sendingInvoiceId === invoice.id || invoice.status === "paid"}
                          >
                            {sendingInvoiceId === invoice.id ? "Sending..." : "Send"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleMarkInvoicePaid(invoice)}
                            disabled={markingInvoiceId === invoice.id || invoice.status === "paid"}
                          >
                            {markingInvoiceId === invoice.id ? "Saving..." : "Mark Paid"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                            disabled={downloadingInvoiceId === invoice.id}
                          >
                            {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {invoices.map((invoice) => {
                const statusColor =
                  invoice.status === "paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : invoice.status === "overdue"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-700";

                return (
                  <div key={invoice.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-2 text-sm text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">Invoice {invoice.number}</span>
                        <span className={`rounded-full px-2 py-1 text-xs capitalize ${statusColor}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-slate-700">{renderMatterName(invoice.matter)}</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                          Issued {new Date(invoice.issue_date).toLocaleDateString()}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                          Due {new Date(invoice.due_date).toLocaleDateString()}
                        </span>
                        <span className="rounded bg-white px-2 py-1 font-medium text-slate-900">
                          ${Number(invoice.total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => handleSendInvoice(invoice)}
                        disabled={sendingInvoiceId === invoice.id || invoice.status === "paid"}
                      >
                        {sendingInvoiceId === invoice.id ? "Sending..." : "Send"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => handleMarkInvoicePaid(invoice)}
                        disabled={markingInvoiceId === invoice.id || invoice.status === "paid"}
                      >
                        {markingInvoiceId === invoice.id ? "Saving..." : "Mark Paid"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDownloadInvoice(invoice)}
                        disabled={downloadingInvoiceId === invoice.id}
                      >
                        {downloadingInvoiceId === invoice.id ? "Preparing..." : "Download"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalInvoices === 0
              ? "No results"
              : invoices.length === 0
              ? `Showing 0 of ${totalInvoices}`
              : `Showing ${invoiceOffset + 1}-${invoiceOffset + invoices.length} of ${totalInvoices}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInvoicePage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPreviousInvoice}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasPreviousInvoice ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setInvoicePage((prev) => (hasNextInvoice ? prev + 1 : prev))}
              disabled={!hasNextInvoice}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasNextInvoice ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <Modal
        isOpen={isTimeModalOpen}
        onClose={closeTimeModal}
        title={editingTime ? "Edit Time Entry" : "Log Time"}
        footer={
          <>
            <Button variant="secondary" onClick={closeTimeModal} disabled={isSavingTime}>
              Cancel
            </Button>
            <Button type="submit" form="time-entry-form" isLoading={isSavingTime}>
              {editingTime ? "Save Changes" : "Save Entry"}
            </Button>
          </>
        }
      >
        <form id="time-entry-form" className="space-y-4" onSubmit={submitTimeEntry}>
          <SelectField
            label="Matter"
            name="matter"
            value={timeForm.matter}
            onChange={handleTimeSelectChange("matter")}
            required
            error={timeErrors.matter}
          >
            <option value="" disabled>
              Select matter
            </option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.reference_code} · {matter.title}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Description"
            name="description"
            rows={3}
            value={timeForm.description}
            onChange={handleTimeInputChange("description")}
            required
            error={timeErrors.description}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Minutes"
              name="minutes"
              type="number"
              min={6}
              step={6}
              value={timeForm.minutes}
              onChange={handleTimeInputChange("minutes")}
              required
              error={timeErrors.minutes}
            />
            <TextField
              label="Rate"
              name="rate"
              type="number"
              min={0}
              step={1}
              value={timeForm.rate}
              onChange={handleTimeInputChange("rate")}
              required
              error={timeErrors.rate}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Date"
              name="date"
              type="date"
              value={timeForm.date}
              onChange={handleTimeInputChange("date")}
              required
              error={timeErrors.date}
            />
            <SelectField label="Source" name="source" value={timeForm.source} onChange={handleTimeSelectChange("source")}>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
          <CheckboxField label="Billable" name="billable" checked={timeForm.billable} onChange={handleTimeCheckboxChange("billable")} />
        </form>
      </Modal>

      <Modal
        isOpen={isExpenseModalOpen}
        onClose={closeExpenseModal}
        title={editingExpense ? "Edit Expense" : "Record Expense"}
        footer={
          <>
            <Button variant="secondary" onClick={closeExpenseModal} disabled={isSavingExpense}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" isLoading={isSavingExpense}>
              {editingExpense ? "Save Changes" : "Save Expense"}
            </Button>
          </>
        }
      >
        <form id="expense-form" className="space-y-4" onSubmit={submitExpense}>
          <SelectField
            label="Matter"
            name="matter"
            value={expenseForm.matter}
            onChange={handleExpenseSelectChange("matter")}
            required
            error={expenseErrors.matter}
          >
            <option value="" disabled>
              Select matter
            </option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.reference_code} · {matter.title}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Description"
            name="description"
            rows={3}
            value={expenseForm.description}
            onChange={handleExpenseInputChange("description")}
            required
            error={expenseErrors.description}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Amount"
              name="amount"
              type="number"
              min={0}
              step={0.01}
              value={expenseForm.amount}
              onChange={handleExpenseInputChange("amount")}
              required
              error={expenseErrors.amount}
            />
            <TextField
              label="Date"
              name="date"
              type="date"
              value={expenseForm.date}
              onChange={handleExpenseInputChange("date")}
              required
              error={expenseErrors.date}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Tax Code"
              name="tax_code"
              value={expenseForm.tax_code}
              onChange={handleExpenseInputChange("tax_code")}
              error={expenseErrors.tax_code}
            />
            <TextField
              label="Receipt File"
              name="receipt_file"
              value={expenseForm.receipt_file}
              onChange={handleExpenseInputChange("receipt_file")}
              error={expenseErrors.receipt_file}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTimeTarget)}
        onClose={() => (isDeletingTime ? undefined : setDeleteTimeTarget(null))}
        title="Delete Time Entry"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTimeTarget(null)} disabled={isDeletingTime}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteTime} isLoading={isDeletingTime}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this time entry? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={Boolean(deleteExpenseTarget)}
        onClose={() => (isDeletingExpense ? undefined : setDeleteExpenseTarget(null))}
        title="Delete Expense"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteExpenseTarget(null)} disabled={isDeletingExpense}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteExpense} isLoading={isDeletingExpense}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this expense? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default BillingPage;
