/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, useMe } from "../../lib/queries";

export default function LoginPage() {
  const router = useRouter();
  const me = useMe();
  const login = useLogin();

  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, send to apps
  useEffect(() => {
    if (me.isSuccess && me.data?.id) router.replace("/apps");
  }, [me.isSuccess, me.data?.id, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login.mutateAsync({ email, password });
    router.replace("/apps");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Admin Login</h1>
        <p style={styles.sub}>
          Sign in to manage apps + forms. (Cookies-based JWT)
        </p>

        {me.isLoading ? (
          <p style={styles.muted}>Checking session…</p>
        ) : null}

        {me.isError ? (
          <p style={styles.muted}>Not signed in.</p>
        ) : null}

        {login.isError ? (
          <p style={styles.error}>
            {(login.error as any)?.message ?? "Login failed"}
          </p>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="admin@local"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              style={styles.input}
            />
          </label>

          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Show password
          </label>

          <button
            type="submit"
            disabled={login.isPending || !email || !password}
            style={{
              ...styles.button,
              opacity: login.isPending || !email || !password ? 0.6 : 1,
              cursor: login.isPending || !email || !password ? "not-allowed" : "pointer",
            }}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>

          <div style={styles.footer}>
            <span style={styles.muted}>
              Tip: use your inserted admin email + password.
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    fontFamily: "system-ui",
    background: "#fafafa",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 20,
    background: "#fff",
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  },
  h1: { margin: 0, fontSize: 22 },
  sub: { marginTop: 6, marginBottom: 16, opacity: 0.8, fontSize: 13 },
  label: { display: "grid", gap: 6, fontSize: 13, fontWeight: 600 },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },
  button: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 800,
  },
  error: { color: "crimson", fontSize: 13, margin: "8px 0" },
  muted: { opacity: 0.75, fontSize: 13 },
  footer: { marginTop: 6 },
};
