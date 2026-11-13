import { useState } from "react";
import type { AuthState } from "../lib/auth";

export default function AuthForm({
  auth,
  redirectTo,
}: {
  auth: AuthState;
  redirectTo: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    // Store intended destination so the OAuth/email callback returns here
    window.sessionStorage.setItem("7games:redirect", redirectTo);

    const result =
      mode === "signin"
        ? await auth.signInWithPassword(email, password)
        : await auth.signUp(email, password);
    setBusy(false);

    if (result) setMessage(result);
  }

  async function google() {
    setBusy(true);
    window.sessionStorage.setItem("7games:redirect", redirectTo);
    await auth.signInWithGoogle();
  }

  return (
    <div className="auth-panel">
      <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={mode === "signin" ? "active" : ""}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>

      <button type="button" className="google-btn" onClick={google} disabled={busy}>
        <GoogleMark />
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or with email</span>
      </div>

      <form onSubmit={submit} className="auth-form">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          aria-label="Email"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          aria-label="Password"
        />
        <button className="primary-btn full" type="submit" disabled={busy}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {message ? <p className="auth-message">{message}</p> : null}
      {!auth.configured ? (
        <p className="auth-message muted">
          Supabase isn’t configured yet — add your keys to `.env.local` (see README).
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"
      />
    </svg>
  );
}
