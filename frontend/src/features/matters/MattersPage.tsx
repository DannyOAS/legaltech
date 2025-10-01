import { ChangeEvent, FormEvent, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import SelectField from "../../components/ui/SelectField";
import Spinner from "../../components/ui/Spinner";
import TextField from "../../components/ui/TextField";
import { useToast } from "../../components/ui/ToastProvider";
import { api, ApiError } from "../../lib/api";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";

interface ClientOption {
  id: string;
  display_name: string;
}

interface MatterClient {
  id: string;
  display_name: string;
}

interface Matter {
  id: string;
  client: MatterClient | null;
  client_id?: string;
  title: string;
  practice_area: string;
  status: "open" | "closed";
  reference_code: string;
  opened_at: string;
  closed_at: string | null;
  notes?: string;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

interface FormState {
  client: string;
  title: string;
  practice_area: string;
  status: "open" | "closed";
  reference_code: string;
  opened_at: string;
  closed_at: string;
}

const defaultFormState: FormState = {
  client: "",
  title: "",
  practice_area: "",
  status: "open",
  reference_code: "",
  opened_at: new Date().toISOString().slice(0, 10),
  closed_at: "",
};

const sanitizeMatterPayload = (values: FormState) => ({
  client_id: values.client,
  title: values.title.trim(),
  practice_area: values.practice_area.trim(),
  status: values.status,
  reference_code: values.reference_code.trim() || undefined,
  opened_at: values.opened_at,
  closed_at: values.status === "closed" ? values.closed_at || null : null,
});

const MattersPage = () => {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const offset = page * PAGE_SIZE;
  const mattersKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/matters/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data: mattersData, mutate, isLoading } = useSWR<PaginatedResponse<Matter>>(mattersKey, fetcher);
  const { data: clientsData } = useSWR<PaginatedResponse<ClientOption>>("/clients/?limit=500", fetcher);

  const matters = mattersData?.results ?? [];
  const totalMatters = mattersData?.count ?? 0;
  const clients = clientsData?.results ?? [];
  const hasPrevious = page > 0;
  const hasNext = offset + matters.length < totalMatters;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<FormState>(defaultFormState);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Matter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetForm = useCallback(() => {
    setFormValues(defaultFormState);
    setFormErrors({});
    setEditingMatter(null);
  }, []);

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (matter: Matter) => {
    setEditingMatter(matter);
    setFormValues({
      client: matter.client?.id ?? "",
      title: matter.title,
      practice_area: matter.practice_area,
      status: matter.status,
      reference_code: matter.reference_code,
      opened_at: matter.opened_at,
      closed_at: matter.closed_at ?? "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (field: keyof FormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
    setPage(0);
  };

  const handleSelectChange = (field: keyof FormState) => (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as FormState[keyof FormState];
    setFormValues((prev) => {
      const next = { ...prev, [field]: value } as FormState;
      if (field === "status" && value === "open") {
        next.closed_at = "";
      }
      return next;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    const payload = sanitizeMatterPayload(formValues);
    const isEdit = Boolean(editingMatter);

    try {
      if (isEdit) {
        await api.patch(`/matters/${editingMatter!.id}/`, payload);
      } else {
        await api.post("/matters/", payload);
        setPage(0);
      }
      await mutate();
      toast.success(`Matter ${isEdit ? "updated" : "created"}`, `${payload.title} saved successfully.`);
      closeModal();
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = Object.fromEntries(
          Object.entries(error.payload.errors ?? {}).map(([key, value]) => [key as keyof FormState, value.join(" ")]),
        );
        setFormErrors(fieldErrors);
        toast.error("Unable to save matter", error.payload.detail ?? "Please fix highlighted fields.");
      } else {
        toast.error("Unexpected error", "An unexpected error occurred while saving the matter.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/matters/${deleteTarget.id}/`);
      const updated = await mutate();
      const remaining = updated?.count ?? 0;
      if (remaining === 0) {
        setPage(0);
      } else if (remaining <= offset && page > 0) {
        setPage((prev) => Math.max(prev - 1, 0));
      }
      toast.success("Matter removed", `${deleteTarget.title} has been deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Unable to delete", error instanceof ApiError ? error.payload.detail ?? "" : "Try again later.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalTitle = editingMatter ? `Edit ${editingMatter.title}` : "New Matter";

  const modalFooter = useMemo(
    () => (
      <>
        <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="matter-form" isLoading={isSubmitting}>
          {editingMatter ? "Save Changes" : "Create Matter"}
        </Button>
      </>
    ),
    [closeModal, editingMatter, isSubmitting],
  );

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Matters</h2>
        <div className="flex flex-1 items-center gap-3 sm:justify-end">
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search matters..."
            className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
          />
          <Button onClick={openCreateModal} disabled={clients.length === 0}>
            New Matter
          </Button>
        </div>
      </div>
      {clients.length === 0 ? (
        <p className="mb-4 text-sm text-amber-600">
          Add a client before creating matters. Matters must be associated with a client.
        </p>
      ) : null}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : matters.length === 0 ? (
        <p className="text-sm text-slate-500">No matters yet. Create your first matter to get started.</p>
      ) : (
        <div>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Reference</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Client</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Practice Area</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matters.map((matter) => (
                  <tr key={matter.id}>
                    <td className="px-3 py-2 text-primary-600">
                      <Link to={`/matters/${matter.id}`}>{matter.reference_code}</Link>
                    </td>
                    <td className="px-3 py-2">{matter.title}</td>
                    <td className="px-3 py-2">{matter.client?.display_name ?? "Unknown"}</td>
                    <td className="px-3 py-2">{matter.practice_area}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          matter.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {matter.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(matter)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                          aria-label="Edit matter"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(matter)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                          aria-label="Delete matter"
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
          
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {matters.map((matter) => (
              <div key={matter.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/matters/${matter.id}`} className="font-medium text-primary-600">
                        {matter.reference_code}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          matter.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {matter.status}
                      </span>
                    </div>
                    <h3 className="mt-1 font-medium text-slate-900">{matter.title}</h3>
                    <p className="text-sm text-slate-600">{matter.client?.display_name ?? "Unknown"}</p>
                    <p className="text-sm text-slate-500">{matter.practice_area}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(matter)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    aria-label="Edit matter"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(matter)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                    aria-label="Delete matter"
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
          {totalMatters === 0
            ? "No results"
            : matters.length === 0
            ? `Showing 0 of ${totalMatters}`
            : `Showing ${offset + 1}-${offset + matters.length} of ${totalMatters}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={!hasPrevious}
            className={`rounded border px-3 py-1 text-sm transition-colors ${
              hasPrevious ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => (hasNext ? prev + 1 : prev))}
            disabled={!hasNext}
            className={`rounded border px-3 py-1 text-sm transition-colors ${
              hasNext ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
            }`}
          >
            Next
          </button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle} footer={modalFooter}>
        <form id="matter-form" className="space-y-4" onSubmit={handleSubmit}>
          <SelectField
            label="Client"
            name="client"
            value={formValues.client}
            onChange={handleSelectChange("client")}
            required
            error={formErrors.client}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.display_name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Title"
            name="title"
            value={formValues.title}
            onChange={handleInputChange("title")}
            required
            error={formErrors.title}
          />
          <TextField
            label="Practice Area"
            name="practice_area"
            value={formValues.practice_area}
            onChange={handleInputChange("practice_area")}
            required
            error={formErrors.practice_area}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Reference Code"
              name="reference_code"
              value={formValues.reference_code}
              onChange={handleInputChange("reference_code")}
              description="Leave blank to auto-generate"
              error={formErrors.reference_code}
            />
            <SelectField
              label="Status"
              name="status"
              value={formValues.status}
              onChange={handleSelectChange("status")}
              required
              error={formErrors.status}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </SelectField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Opened"
              name="opened_at"
              type="date"
              value={formValues.opened_at}
              onChange={handleInputChange("opened_at")}
              required
              error={formErrors.opened_at}
            />
            <TextField
              label="Closed"
              name="closed_at"
              type="date"
              value={formValues.closed_at}
              onChange={handleInputChange("closed_at")}
              disabled={formValues.status !== "closed"}
              error={formErrors.closed_at}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => (isDeleting ? undefined : setDeleteTarget(null))}
        title="Delete Matter"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This will remove the matter and related
          billing entries.
        </p>
      </Modal>
    </div>
  );
};

export default MattersPage;
