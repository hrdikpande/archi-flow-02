import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { SkeletonRows } from "@/components/ui/States";
import { allauth, firstError, pendingFlow, redirectToProvider } from "@/lib/auth/allauth";
import { useMe } from "@/lib/auth/useMe";

type Step = "choose" | "password" | "totp";

/** Only same-site paths are allowed as the post-sign-in destination. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** S-01: SSO button(s), "Use email and password" for local accounts, TOTP step for admins. */
export function SignInPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const config = useQuery({ queryKey: ["allauth-config"], queryFn: allauth.config, staleTime: Infinity });
  const providers = config.data?.data?.socialaccount?.providers ?? [];

  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(params.get("error") === "sso" ? "Single sign-on did not complete. Use your firm account, or ask IT to add you." : "");
  const [busy, setBusy] = useState(false);

  // With no SSO provider configured, go straight to email and password.
  const current: Step = step === "choose" && config.isSuccess && providers.length === 0 ? "password" : step;

  if (me && !me.mfa.setup_required) return <Navigate to={next} replace />;

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    navigate(next, { replace: true });
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await allauth.login(email, password);
    setBusy(false);
    if (response.status === 200 || response.status === 409) return finish();
    if (response.status === 401 && pendingFlow(response) === "mfa_authenticate") {
      setStep("totp");
      return;
    }
    setError(firstError(response, "Email or password is not correct."));
  };

  const submitTotp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await allauth.mfaAuthenticate(code.replace(/\s/g, ""));
    setBusy(false);
    if (response.status === 200) return finish();
    setError(firstError(response, "That code did not work. Enter the current 6-digit code."));
  };

  return (
    <main id="main" className="grid min-h-screen place-items-center bg-bg p-4">
      <div className="w-[400px] max-w-full rounded-lg border border-border bg-surface p-8">
        <div className="mb-6 flex items-center gap-2">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <h1 className="text-display font-semibold">Sign in to DrawingOps</h1>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-small text-danger">
            {error}
          </p>
        )}

        {config.isPending && <SkeletonRows rows={2} label="Loading sign-in options" />}

        {!config.isPending && current === "choose" && (
          <div className="flex flex-col gap-3">
            {providers.map((p) => (
              <Button key={p.id} variant="primary" className="w-full" onClick={() => redirectToProvider(p.id, next)}>
                Sign in with {p.id === "microsoft" ? "Microsoft" : p.id === "google" ? "Google" : p.name}
              </Button>
            ))}
            <button type="button" className="self-start text-body text-primary underline" onClick={() => setStep("password")}>
              Use email and password
            </button>
          </div>
        )}

        {current === "password" && (
          <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
            <Field label="Email">
              {(a) => (
                <TextInput {...a} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <Field label="Password">
              {(a) => (
                <TextInput
                  {...a}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" busy={busy} disabled={!email || !password}>
              Sign in
            </Button>
            {providers.length > 0 && (
              <button type="button" className="self-start text-body text-primary underline" onClick={() => setStep("choose")}>
                Back to single sign-on
              </button>
            )}
          </form>
        )}

        {current === "totp" && (
          <form onSubmit={submitTotp} className="flex flex-col gap-4" noValidate>
            <p className="flex items-center gap-2 text-body text-muted">
              <KeyRound size={16} aria-hidden="true" />
              Enter the 6-digit code from your authenticator app.
            </p>
            <Field label="Authentication code">
              {(a) => (
                <TextInput
                  {...a}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={8}
                  className="mono tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" busy={busy} disabled={code.replace(/\s/g, "").length < 6}>
              Verify
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
