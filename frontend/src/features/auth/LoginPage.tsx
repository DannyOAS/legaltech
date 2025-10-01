import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setError(null);
      await login(email, password, needsOtp ? otp : undefined);
    } catch (err: any) {
      const code = err?.payload?.code;
      const detail = typeof err?.payload?.detail === "string" ? err.payload.detail.toLowerCase() : "";
      if (code === "mfa_required" || detail.includes("mfa required")) {
        setNeedsOtp(true);
        setError("Enter your MFA code to continue");
        return;
      }
      setError(err?.payload?.detail ?? "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-2xl font-semibold text-primary-600">Maple Legal Portal</h1>
        <label className="mb-4 block">
          <span className="text-sm font-medium text-slate-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        </label>
        {needsOtp && (
          <label className="mb-6 block">
            <span className="text-sm font-medium text-slate-600">MFA Code</span>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-primary-500 focus:outline-none"
              required
            />
          </label>
        )}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-primary-600 py-2 text-white hover:bg-primary-500">
          Sign In
        </button>
        {needsOtp && (
          <p className="mt-3 text-center text-xs text-slate-500">Multi-factor authentication is enabled for this account.</p>
        )}
      </form>
    </div>
  );
};

export default LoginPage;
