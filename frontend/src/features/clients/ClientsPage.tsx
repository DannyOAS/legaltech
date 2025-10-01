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
  portal_user: string | null;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const offset = page * PAGE_SIZE;
  const clientsKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/clients/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data, mutate, isLoading } = useSWR<PaginatedResponse<Client>>(clientsKey, fetcher);
  const { data: roles } = useSWR<PaginatedResponse<{ id: string; name: string }>>("/roles/", fetcher);
  const clients = data?.results ?? [];
  const totalClients = data?.count ?? 0;
  const clientRoleId = roles?.results?.find((role) => role.name === "Client")?.id ?? null;
  const hasPrevious = page > 0;
  const hasNext = offset + clients.length < totalClients;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

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

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
    setPage(0);
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
        setPage(0);
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

  const resolveApiErrorMessage = (error: ApiError) => {
    if (error.payload.detail) {
      return error.payload.detail;
    }
    const fieldErrors = error.payload.errors;
    if (fieldErrors) {
      for (const key of Object.keys(fieldErrors)) {
        const messages = fieldErrors[key];
        if (messages?.length) {
          return messages.join(" ");
        }
      }
    }
    // DRF serializer errors arrive as field: [messages]
    if (typeof error.payload === "object" && error.payload) {
      for (const [key, value] of Object.entries(error.payload)) {
        if (key === "detail" || key === "errors") continue;
        if (Array.isArray(value) && value.length > 0) {
          return value.join(" ");
        }
        if (typeof value === "string" && value.trim()) {
          return value;
        }
      }
    }
    return "";
  };

  const inviteClient = async (client: Client) => {
    if (!clientRoleId) {
      toast.error("Unable to send invite", "Client role not configured");
      return;
    }
    if (!client.primary_email?.trim()) {
      toast.error("Unable to send invite", "Client is missing a primary email address.");
      return;
    }
    setIsInviting(true);
    try {
      await api.post("/invitations/", {
        email: client.primary_email,
        role: clientRoleId,
        client: client.id,
      });
      toast.success("Invitation sent", `${client.display_name} will receive an email shortly.`);
    } catch (error) {
      let message = "Please try again later.";
      if (error instanceof ApiError) {
        message = resolveApiErrorMessage(error) || `Request failed (${error.status})`;
      }
      toast.error("Unable to send invite", message);
    } finally {
      setIsInviting(false);
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Clients</h2>
        <div className="flex flex-1 items-center gap-3 sm:justify-end">
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search clients..."
            className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
          />
          <Button onClick={openCreateModal}>New Client</Button>
        </div>
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
                      {client.portal_user ? (
                        <Button variant="secondary" size="sm" disabled>
                          Portal User
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => inviteClient(client)}
                          disabled={isInviting || !clientRoleId}
                        >
                          Invite
                        </Button>
                      )}
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

      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {totalClients === 0
            ? "No results"
            : clients.length === 0
            ? `Showing 0 of ${totalClients}`
            : `Showing ${offset + 1}-${offset + clients.length} of ${totalClients}`}
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
