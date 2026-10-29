import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import QRCode from "qrcode";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { allauth, firstError } from "@/lib/auth/allauth";

/** Admins who sign in with a password set up TOTP before anything else (F-40). */
export function MfaSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ["totp-setup"], queryFn: allauth.totpSetup, staleTime: Infinity, refetchInterval: false });
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const secret = setup.data?.meta?.secret;
  const url = setup.data?.meta?.totp_url;

  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 192 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  if (setup.isPending) return <SkeletonRows label="Preparing two-factor setup" />;
  if (setup.data?.status === 401) {
    return <ErrorState message="For security, sign in again before setting up two-factor authentication." onRetry={() => navigate("/sign-in?next=/setup-2fa")} />;
  }
  if (!secret) {
    return <ErrorState message="Two-factor setup could not start. Try again." onRetry={() => setup.refetch()} />;
  }

  const activate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await allauth.totpActivate(code.replace(/\s/g, ""));
    if (response.status !== 200) {
      setBusy(false);
      setError(firstError(response, "That code did not work. Enter the current 6-digit code."));
      return;
    }
    const codes = await allauth.recoveryCodes();
    setBusy(false);
    setRecoveryCodes(codes.data?.unused_codes ?? []);
  };

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    navigate("/", { replace: true });
  };

  return (
    <main id="main" className="grid min-h-screen place-items-center bg-bg p-4">
      <div className="w-[480px] max-w-full rounded-lg border border-border bg-surface p-8">
        <h1 className="text-display font-semibold">Set up two-factor authentication</h1>
        {recoveryCodes ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-body">
              Two-factor authentication is on. Save these recovery codes somewhere safe. Each works once if you lose your phone.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-4">
              {recoveryCodes.map((c) => (
                <li key={c} className="mono text-body">
                  {c}
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={done}>
              I have saved my recovery codes
            </Button>
          </div>
        ) : (
          <form onSubmit={activate} className="mt-4 flex flex-col gap-4" noValidate>
            <p className="text-body text-muted">
              Admins who sign in with a password need a second step. Scan this code with an authenticator app (Microsoft Authenticator, Google
              Authenticator, 1Password), then enter the 6-digit code it shows.
            </p>
            {qr && <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="self-center rounded-sm bg-white p-1" />}
            <div className="flex items-center gap-2 text-small text-muted">
              <span>Or enter this key:</span>
              <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-text">{secret.match(/.{1,4}/g)?.join(" ")}</code>
              <button
                type="button"
                aria-label="Copy key"
                className="rounded-sm p-1 hover:bg-surface-muted"
                onClick={() => navigator.clipboard?.writeText(secret)}
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            </div>
            <Field label="Code from your app" error={error}>
              {(a) => (
                <TextInput {...a} inputMode="numeric" autoComplete="one-time-code" className="mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />
              )}
            </Field>
            <Button type="submit" variant="primary" busy={busy} disabled={code.replace(/\s/g, "").length < 6}>
              Turn on two-factor authentication
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
