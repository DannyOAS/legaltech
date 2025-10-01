import { FormEvent, useEffect, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import TextField from "../../components/ui/TextField";
import { api, ApiError } from "../../lib/api";
import QRCode from "qrcode";

interface MFASetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: () => Promise<void> | void;
}

interface MfaSecretResponse {
  secret: string;
  qr_uri: string;
}

const MFASetupModal = ({ isOpen, onClose, onEnabled }: MFASetupModalProps) => {
  const [secret, setSecret] = useState<MfaSecretResponse | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSecret(null);
      setToken("");
      setError(null);
      setStatus(null);
      return;
    }
    const fetchSecret = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.post<MfaSecretResponse>("/auth/mfa/setup/");
        setSecret(data);
        setStatus("Scan the code or enter the secret into your authenticator app.");
      } catch (err) {
        const message = err instanceof ApiError ? err.payload.detail ?? "Unable to initialize MFA." : "Unexpected error.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchSecret();
  }, [isOpen]);

  useEffect(() => {
    if (secret && qrCodeRef.current) {
      QRCode.toCanvas(qrCodeRef.current, secret.qr_uri, {
        width: 160,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }).catch((err) => {
        console.error("QR Code generation failed:", err);
      });
    }
  }, [secret]);

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await api.post("/auth/mfa/verify/", { token: token.trim() });
      setStatus("MFA enabled successfully.");
      await onEnabled();
      setToken("");
    } catch (err) {
      const message = err instanceof ApiError ? err.payload.detail ?? "Invalid MFA code." : "Unexpected error.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={verifying}>
        Close
      </Button>
      <Button type="submit" form="mfa-setup-form" isLoading={verifying} disabled={!secret}>
        Verify & Enable
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Secure Your Account" footer={footer} size="md" loading={loading}>
      {!secret ? (
        <p className="text-sm text-slate-500">{error ?? "Generating your MFA secret..."}</p>
      ) : (
        <form id="mfa-setup-form" className="space-y-4 text-sm text-slate-600" onSubmit={handleVerify}>
          <div>
            <p className="font-medium text-slate-700">Step 1</p>
            <p className="mt-1 text-xs text-slate-500">Scan this QR code or enter the secret manually.</p>
            <div className="mt-3 flex items-center gap-4">
              <canvas
                ref={qrCodeRef}
                className="h-40 w-40 rounded border border-slate-200 bg-white"
              />
              <div>
                <p className="text-xs uppercase text-slate-500">Secret</p>
                <code className="block rounded bg-slate-100 px-2 py-1 text-xs">{secret.secret}</code>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-700">Step 2</p>
            <p className="mt-1 text-xs text-slate-500">Enter the 6-digit code from the app to confirm activation.</p>
            <TextField
              label="Authenticator Code"
              name="otp"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              autoComplete="one-time-code"
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {status ? <p className="text-xs text-emerald-600">{status}</p> : null}
        </form>
      )}
    </Modal>
  );
};

export default MFASetupModal;
