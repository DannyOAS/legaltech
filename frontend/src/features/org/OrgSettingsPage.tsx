import { useMemo, useState } from "react";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import InviteUserModal from "./InviteUserModal";
import MFASetupModal from "../auth/MFASetupModal";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuth } from "../auth/AuthContext";

interface Organization {
  id: string;
  name: string;
  region: string;
}

interface Settings {
  organization_id: string | null;
  features: Record<string, boolean>;
  ca_region: string;
  storage_bucket: string;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

interface RoleOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  display_name: string;
  primary_email: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  client: string | null;
  expires_at: string;
  status: string;
  created_at: string;
  last_sent_at?: string | null;
  metadata?: Record<string, unknown>;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const OrgSettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const { data: settings } = useSWR<Settings>("/settings/", fetcher);
  const organizationId = settings ? settings.organization_id : null;
  const {
    data: org,
    error: orgError,
    isLoading: isOrgLoading,
  } = useSWR<Organization>(organizationId ? `/org/${organizationId}/` : null, fetcher);
  const [mfaStatus, setMfaStatus] = useState<string | null>(null);
  const [isInviteOpen, setInviteOpen] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const toast = useToast();

  const { data: rolesData } = useSWR<PaginatedResponse<RoleOption>>("/roles/", fetcher);
  const inviteClientsKey = useMemo(() => (isInviteOpen ? "/clients/?limit=100" : null), [isInviteOpen]);
  const { data: clientsData, isLoading: isClientsLoading } = useSWR<PaginatedResponse<ClientOption>>(inviteClientsKey, fetcher);
  const inviteListKey = useMemo(() => "/invitations/?limit=100&status=pending", []);
  const {
    data: invitesData,
    mutate: mutateInvites,
    isLoading: isInvitesLoading,
  } = useSWR<PaginatedResponse<Invitation>>(inviteListKey, fetcher);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const invites = invitesData?.results ?? [];
  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    rolesData?.results.forEach((role) => map.set(role.id, role.name));
    return map;
  }, [rolesData]);

  const handleResend = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      await api.post(`/invitations/${invitation.id}/resend/`);
      toast.success("Invitation resent", `${invitation.email} will receive a new email.`);
      await mutateInvites();
    } catch (error) {
      toast.error("Unable to resend invite", error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error");
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    setRevokingId(invitation.id);
    try {
      await api.delete(`/invitations/${invitation.id}/`);
      toast.info("Invitation revoked", `${invitation.email} can no longer use the invite link.`);
      await mutateInvites();
    } catch (error) {
      toast.error("Unable to revoke invite", error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded bg-white p-6 shadow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Team & Client Access</h2>
            <p className="text-sm text-slate-500">Send invitations to staff or clients. Invitations expire after 72 hours.</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}>Invite User</Button>
        </div>
        <div className="mt-6">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Expires</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Last Sent</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isInvitesLoading ? (
                  <tr>
                    <td className="px-3 py-3 text-center text-slate-500" colSpan={6}>
                      Loading invitations...
                    </td>
                  </tr>
                ) : invites.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-center text-slate-500" colSpan={6}>
                      No pending invitations.
                    </td>
                  </tr>
                ) : (
                  invites.map((invitation) => {
                    const roleName = roleNameById.get(invitation.role) ?? "—";
                    const expires = new Date(invitation.expires_at).toLocaleString();
                    const lastSent = invitation.last_sent_at ? new Date(invitation.last_sent_at).toLocaleString() : "—";
                    const isCompleted = invitation.status !== "pending";
                    return (
                      <tr key={invitation.id}>
                        <td className="px-3 py-2 text-slate-700">{invitation.email}</td>
                        <td className="px-3 py-2 text-slate-600">{roleName}</td>
                        <td className="px-3 py-2 capitalize text-slate-600">{invitation.status}</td>
                        <td className="px-3 py-2 text-slate-500">{expires}</td>
                        <td className="px-3 py-2 text-slate-500">{lastSent}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResend(invitation)}
                              disabled={isCompleted || resendingId === invitation.id}
                            >
                              {resendingId === invitation.id ? "Resending…" : "Resend"}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRevoke(invitation)}
                              disabled={revokingId === invitation.id}
                            >
                              {revokingId === invitation.id ? "Revoking…" : "Revoke"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 text-sm md:hidden">
            {isInvitesLoading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">Loading invitations...</div>
            ) : invites.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">No pending invitations.</div>
            ) : (
              invites.map((invitation) => {
                const roleName = roleNameById.get(invitation.role) ?? "—";
                const expires = new Date(invitation.expires_at).toLocaleString();
                const lastSent = invitation.last_sent_at ? new Date(invitation.last_sent_at).toLocaleString() : "—";
                const isCompleted = invitation.status !== "pending";
                return (
                  <div key={invitation.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-slate-900">{invitation.email}</span>
                      <span className="text-xs uppercase tracking-wide text-slate-500">{roleName}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-1 capitalize text-slate-700">Status: {invitation.status}</span>
                      <span className="rounded bg-slate-100 px-2 py-1">Expires {expires}</span>
                      <span className="rounded bg-slate-100 px-2 py-1">Last sent {lastSent}</span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full sm:flex-1"
                        onClick={() => handleResend(invitation)}
                        disabled={isCompleted || resendingId === invitation.id}
                      >
                        {resendingId === invitation.id ? "Resending…" : "Resend"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full sm:flex-1"
                        onClick={() => handleRevoke(invitation)}
                        disabled={revokingId === invitation.id}
                      >
                        {revokingId === invitation.id ? "Revoking…" : "Revoke"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Organization Profile</h2>
        {!settings ? (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        ) : !organizationId ? (
          <p className="mt-4 text-sm text-red-600">Organization information is not available.</p>
        ) : isOrgLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        ) : org ? (
          <dl className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Name</dt>
              <dd>{org.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Region</dt>
              <dd>{org.region}</dd>
            </div>
          </dl>
        ) : orgError ? (
          <p className="mt-4 text-sm text-red-600">Unable to load organization details.</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        )}
      </section>
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Security Features</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {settings ? (
            Object.entries(settings.features).map(([name, enabled]) => (
              <li key={name} className="flex items-center justify-between">
                <span className="capitalize">{name.replace(/_/g, " ")}</span>
                <span className={`text-xs ${enabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {enabled ? "enabled" : "disabled"}
                </span>
              </li>
            ))
          ) : (
            <li>Loading...</li>
          )}
        </ul>
      </section>
      {settings && (
        <section className="rounded bg-white p-6 shadow text-sm text-slate-600">
          <h2 className="text-lg font-semibold text-slate-700">Data Residency</h2>
          <p className="mt-2">Storage bucket: {settings.storage_bucket}</p>
          <p>Canadian region: {settings.ca_region}</p>
        </section>
      )}
      <section className="rounded bg-white p-6 shadow text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-700">Multi-Factor Authentication</h2>
        <p className="mt-2 text-slate-500">
          Protect your account with a time-based one-time password (TOTP) authenticator.
        </p>
        
        {user?.mfa_enabled ? (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-medium text-emerald-700">MFA Enabled</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Your account is protected with two-factor authentication.
            </p>
            <button
              onClick={() => {
                setMfaStatus(null);
                setIsMfaModalOpen(true);
              }}
              className="mt-3 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              type="button"
            >
              Reset MFA
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              <span className="text-sm font-medium text-amber-700">MFA Not Set Up</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {user?.roles?.includes("Client") 
                ? "Optional: Add extra security to your account."
                : "Required: Staff accounts must enable MFA for Ontario compliance."
              }
            </p>
            <button
              onClick={() => {
                setMfaStatus(null);
                setIsMfaModalOpen(true);
              }}
              className={`mt-3 rounded px-3 py-2 text-sm text-white ${
                user?.roles?.includes("Client")
                  ? "bg-primary-600 hover:bg-primary-500"
                  : "bg-amber-600 hover:bg-amber-500"
              }`}
              type="button"
            >
              Set Up MFA
            </button>
          </div>
        )}
        
        {mfaStatus && <p className="mt-3 text-sm text-emerald-600">{mfaStatus}</p>}
        {/* Errors handled within MFA modal */}
      </section>
      <InviteUserModal
        isOpen={isInviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={rolesData?.results}
        clients={clientsData?.results}
        isLoadingClients={isClientsLoading}
        onInvited={() => mutateInvites()}
      />
      <MFASetupModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        onEnabled={async () => {
          await refreshUser();
          setMfaStatus("MFA enabled successfully");
          setIsMfaModalOpen(false);
        }}
      />
    </div>
  );
};

export default OrgSettingsPage;
