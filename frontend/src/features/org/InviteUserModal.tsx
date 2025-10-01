import { FormEvent, useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";

interface RoleOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  display_name: string;
  primary_email: string;
}

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles?: RoleOption[];
  clients?: ClientOption[];
  isLoadingClients?: boolean;
  onInvited?: () => void;
}

interface FormErrors {
  email?: string;
  role?: string;
  client?: string;
  base?: string;
}

const emptyErrors: FormErrors = {};

const InviteUserModal = ({ isOpen, onClose, roles, clients, isLoadingClients = false, onInvited }: InviteUserModalProps) => {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>(emptyErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasClientRoleSelected = useMemo(() => {
    if (!roles?.length || !roleId) {
      return false;
    }
    return roles.some((role) => role.id === roleId && role.name === "Client");
  }, [roles, roleId]);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setRoleId("");
      setClientId("");
      setErrors(emptyErrors);
      setIsSubmitting(false);
      return;
    }
    if (roles?.length && !roleId) {
      const defaultRole = roles.find((role) => role.name !== "Client") ?? roles[0];
      setRoleId(defaultRole.id);
    }
  }, [isOpen, roles, roleId]);

  useEffect(() => {
    if (!hasClientRoleSelected) {
      setClientId("");
    }
  }, [hasClientRoleSelected]);

  const resolveErrorMessage = (error: ApiError): FormErrors => {
    const payloadErrors = error.payload?.errors ?? {};
    const mapped: FormErrors = {};
    Object.entries(payloadErrors).forEach(([field, messages]) => {
      const message = Array.isArray(messages) ? messages.join(" ") : String(messages);
      if (field in emptyErrors) {
        mapped[field as keyof FormErrors] = message;
      }
    });
    if (!Object.keys(mapped).length && error.payload.detail) {
      mapped.base = error.payload.detail;
    }
    return mapped;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!roleId) {
      setErrors({ role: "Select a role" });
      return;
    }
    if (hasClientRoleSelected && !clientId) {
      setErrors({ client: "Select a client to link" });
      return;
    }
    setIsSubmitting(true);
    setErrors(emptyErrors);
    try {
      const payload: Record<string, unknown> = {
        email: email.trim(),
        role: roleId,
      };
      if (hasClientRoleSelected && clientId) {
        payload.client = clientId;
      }
      payload.metadata = {
        invited_from: "org_settings",
      };
      await api.post("/invitations/", payload);
      toast.success("Invitation sent", "The recipient will receive an email shortly.");
      onClose();
      onInvited?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(resolveErrorMessage(err));
        toast.error("Unable to send invite", err.payload.detail ?? "Check the form and try again.");
      } else {
        toast.error("Unable to send invite", "Unexpected error. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" form="invite-user-form" isLoading={isSubmitting}>
        Send Invitation
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite New User" footer={footer} size="sm">
      {!roles?.length ? (
        <p className="text-sm text-slate-500">Roles are loading. Please try again shortly.</p>
      ) : (
        <form id="invite-user-form" className="space-y-4 text-sm" onSubmit={handleSubmit}>
          <div>
            <label className="block text-slate-600">
              Email Address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
                placeholder="person@example.com"
              />
            </label>
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>
          <div>
            <label className="block text-slate-600">
              Role
              <select
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role}</p> : null}
          </div>
          {hasClientRoleSelected ? (
            <div>
              <label className="block text-slate-600">
                Client
                <select
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
                  disabled={isLoadingClients}
                >
                  <option value="">Select client…</option>
                  {clients?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.display_name} ({client.primary_email})
                    </option>
                  ))}
                </select>
              </label>
              {isLoadingClients ? <p className="mt-1 text-xs text-slate-500">Loading clients…</p> : null}
              {errors.client ? <p className="mt-1 text-xs text-red-600">{errors.client}</p> : null}
            </div>
          ) : null}
          {errors.base ? <p className="text-xs text-red-600">{errors.base}</p> : null}
        </form>
      )}
    </Modal>
  );
};

export default InviteUserModal;
