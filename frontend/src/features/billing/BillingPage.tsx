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

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

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

const BillingPage = () => {
  const toast = useToast();
  const { data: summary, mutate: mutateSummary } = useSWR<BillingSummary>("/reports/billing-summary/", fetcher);
  const {
    data: timeEntriesData,
    mutate: mutateTimeEntries,
    isLoading: isTimeLoading,
  } = useSWR<PaginatedResponse<TimeEntry>>("/time-entries/", fetcher);
  const {
    data: expensesData,
    mutate: mutateExpenses,
    isLoading: isExpenseLoading,
  } = useSWR<PaginatedResponse<Expense>>("/expenses/", fetcher);
  const { data: mattersData } = useSWR<PaginatedResponse<MatterOption>>("/matters/", fetcher);

  const matters = mattersData?.results ?? [];
  const matterLookup = useMemo(() => new Map(matters.map((matter) => [matter.id, matter])), [matters]);

  const timeEntries = timeEntriesData?.results ?? [];
  const expenses = expensesData?.results ?? [];

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
      await Promise.all([mutateTimeEntries(), mutateSummary()]);
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
      await Promise.all([mutateExpenses(), mutateSummary()]);
      toast.success("Expense removed", "The expense has been deleted.");
      setDeleteExpenseTarget(null);
    } catch (error) {
      toast.error("Unable to delete", error instanceof ApiError ? error.payload.detail ?? "" : "Try again later.");
    } finally {
      setIsDeletingExpense(false);
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
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Time Entries</h3>
          <Button onClick={() => openTimeModal()} disabled={matters.length === 0}>
            Log Time
          </Button>
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
          <div className="overflow-x-auto">
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
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openTimeModal(entry)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTimeTarget(entry)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Expenses</h3>
          <Button onClick={() => openExpenseModal()} disabled={matters.length === 0}>
            Record Expense
          </Button>
        </div>
        {isExpenseLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
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
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openExpenseModal(expense)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteExpenseTarget(expense)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
