import { ChangeEvent, FormEvent, useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import TextAreaField from "../../components/ui/TextAreaField";
import TextField from "../../components/ui/TextField";
import Spinner from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/ToastProvider";
import { api, ApiError } from "../../lib/api";

interface Client {
  id: string;
  display_name: string;
  primary_email: string;
  phone: string;
  address: string;
  notes: string;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const emptyForm: FormState = {
  display_name: "",
  primary_email: "",
  phone: "",
  address: "",
  notes: "",
};

interface FormState {
  display_name: string;
  primary_email: string;
  phone: string;
  address: string;
  notes: string;
}

const sanitizePayload = (values: FormState) => ({
  display_name: values.display_name.trim(),
  primary_email: values.primary_email.trim(),
  phone: values.phone.trim(),
  address: values.address.trim(),
  notes: values.notes.trim(),
});

const ClientsPage = () => {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<PaginatedResponse<Client>>("/clients/", fetcher);
  const clients = data?.results ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetForm = useCallback(() => {
    setFormValues(emptyForm);
    setFormErrors({});
    setEditingClient(null);
  }, []);

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormValues({
      display_name: client.display_name,
      primary_email: client.primary_email,
      phone: client.phone ?? "",
      address: client.address ?? "",
      notes: client.notes ?? "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    const payload = sanitizePayload(formValues);
    const isEdit = Boolean(editingClient);

    try {
      if (isEdit) {
        await api.patch<Client>(`/clients/${editingClient!.id}/`, payload);
      } else {
        await api.post<Client>("/clients/", payload);
      }
      await mutate();
      toast.success(`Client ${isEdit ? "updated" : "created"}`, `${payload.display_name} saved successfully.`);
      closeModal();
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = Object.fromEntries(
          Object.entries(error.payload.errors ?? {}).map(([key, value]) => [key as keyof FormState, value.join(" ")]),
        );
        setFormErrors(fieldErrors);
        toast.error("Unable to save client", error.payload.detail ?? "Please fix highlighted fields.");
      } else {
        toast.error("Unexpected error", "An unexpected error occurred while saving the client.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/clients/${deleteTarget.id}/`);
      await mutate();
      toast.success("Client removed", `${deleteTarget.display_name} has been deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Unable to delete", error instanceof ApiError ? error.payload.detail ?? "" : "Try again later.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalTitle = editingClient ? `Edit ${editingClient.display_name}` : "New Client";

  const modalFooter = useMemo(
    () => (
      <>
        <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="client-form" isLoading={isSubmitting}>
          {editingClient ? "Save Changes" : "Create Client"}
        </Button>
      </>
    ),
    [closeModal, editingClient, isSubmitting],
  );

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Clients</h2>
        <Button onClick={openCreateModal}>New Client</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-slate-500">No clients yet. Create your first client to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Phone</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Notes</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-3 py-2">{client.display_name}</td>
                  <td className="px-3 py-2">{client.primary_email}</td>
                  <td className="px-3 py-2">{client.phone || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{client.notes ? client.notes.slice(0, 60) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEditModal(client)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(client)}>
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
        <form id="client-form" className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Display Name"
            name="display_name"
            value={formValues.display_name}
            onChange={handleChange("display_name")}
            required
            error={formErrors.display_name}
          />
          <TextField
            label="Primary Email"
            name="primary_email"
            type="email"
            autoComplete="email"
            value={formValues.primary_email}
            onChange={handleChange("primary_email")}
            required
            error={formErrors.primary_email}
          />
          <TextField
            label="Phone"
            name="phone"
            value={formValues.phone}
            onChange={handleChange("phone")}
            error={formErrors.phone}
          />
          <TextAreaField
            label="Address"
            name="address"
            rows={3}
            value={formValues.address}
            onChange={handleChange("address")}
            error={formErrors.address}
          />
          <TextAreaField
            label="Notes"
            name="notes"
            rows={3}
            value={formValues.notes}
            onChange={handleChange("notes")}
            error={formErrors.notes}
          />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => (isDeleting ? undefined : setDeleteTarget(null))}
        title="Delete Client"
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
          Are you sure you want to delete <strong>{deleteTarget?.display_name}</strong>? This action cannot be undone and
          related matters will lose their client reference.
        </p>
      </Modal>
    </div>
  );
};

export default ClientsPage;
