import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { apiRequest } from "./api";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { useAuth } from "./use-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      async signIn(email, password) {
        const result = await apiRequest<{ token: string }>("/auth/login", "", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(result.token);
      },
      signOut() {
        setToken("");
      },
    }),
    [token],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-card">
        <div className="brand-mark">A</div>
        <p className="eyebrow">ACME PEOPLE OPERATIONS</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to access salary intelligence.</p>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="button primary w-full h-[42px]"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="sign-in-note">
          HR accounts are provisioned by an administrator.
        </p>
      </div>
    </main>
  );
}
