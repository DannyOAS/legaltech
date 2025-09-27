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
  reference_code: values.reference_code.trim(),
  opened_at: values.opened_at,
  closed_at: values.status === "closed" ? values.closed_at || null : null,
});

const MattersPage = () => {
  const toast = useToast();
  const { data: mattersData, mutate, isLoading } = useSWR<PaginatedResponse<Matter>>("/matters/", fetcher);
  const { data: clientsData } = useSWR<PaginatedResponse<ClientOption>>("/clients/", fetcher);

  const matters = mattersData?.results ?? [];
  const clients = clientsData?.results ?? [];

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
      await mutate();
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Matters</h2>
        <Button onClick={openCreateModal} disabled={clients.length === 0}>
          New Matter
        </Button>
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
        <div className="overflow-x-auto">
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
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEditModal(matter)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(matter)}>
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
              required
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
