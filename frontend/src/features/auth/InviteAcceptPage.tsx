import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";

const InviteAcceptPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invitation token missing or invalid.");
    }
  }, [token]);

  const validatePassword = () => {
    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Invitation token missing or invalid.");
      return;
    }
    if (!validatePassword()) {
      return;
    }
    try {
      setIsSubmitting(true);
      setStatus(null);
      setError(null);
      const response = await api.post<{ roles?: string[] }>("/auth/invite/accept/", {
        token,
        first_name: firstName,
        last_name: lastName,
        password,
      });
      setStatus("Invitation accepted. Redirecting to sign in…");
      toast.success("Account created", "Use your new credentials to sign in.");
      const roles = response?.roles ?? [];
      const redirectPath = roles.includes("Client") ? "/login-client" : "/login";
      setTimeout(() => navigate(redirectPath, { replace: true }), 1800);
    } catch (err) {
      if (err instanceof ApiError) {
        const detailedError = err.payload?.detail ?? err.payload?.errors?.token?.join(" ") ?? "Unable to accept invitation";
        setError(detailedError);
        toast.error("Unable to accept invitation", detailedError);
      } else {
        const fallback = "Unexpected error";
        setError(fallback);
        toast.error("Unable to accept invitation", fallback);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-semibold text-primary-600">Accept Invitation</h1>
        <p className="mb-6 text-xs text-slate-500">Create your Maple Legal account.</p>
        <input type="hidden" value={token} />
        <label className="mb-4 block">
          <span className="text-sm font-medium text-slate-600">First Name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
            required
          />
        </label>
        <label className="mb-4 block">
          <span className="text-sm font-medium text-slate-600">Last Name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
            required
          />
        </label>
        <label className="mb-6 block">
          <span className="text-sm font-medium text-slate-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-slate-500">Use at least 12 characters, including letters and numbers.</p>
        </label>
        <label className="mb-6 block">
          <span className="text-sm font-medium text-slate-600">Confirm Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
            required
          />
        </label>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {status && <p className="mb-4 text-sm text-emerald-600">{status}</p>}
        <button
          type="submit"
          className="w-full rounded bg-primary-600 py-2 text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-primary-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create Account"}
        </button>
      </form>
    </div>
  );
};

export default InviteAcceptPage;
