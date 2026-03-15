"use client";

import { useRouter } from "next/navigation";
import { useLogout, useMe } from "../lib/queries";

export function AppHeader() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();

  const email = me.data?.email ?? "—";
  const role = me.data?.role ?? "";

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header style={wrap}>
      <div style={left}>
        <div style={logo}>Transform Admin</div>
      </div>

      <div style={right}>
        <div style={userInfo}>
          <span style={avatar} aria-hidden>
            👤
          </span>
          <div>
            <div style={userName}>{email}</div>
            {role ? <div style={userRole}>{role}</div> : null}
          </div>
        </div>

        <button onClick={onLogout} style={logoutBtn} disabled={logout.isPending}>
          {logout.isPending ? "Signing out…" : "Logout"}
        </button>
      </div>
    </header>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 24px",
  borderBottom: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const logo: React.CSSProperties = {
  fontWeight: 800,
  letterSpacing: 0.2,
};

const right: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const userInfo: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const avatar: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "#f2f2f2",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
};

const userName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const userRole: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
  textTransform: "uppercase",
};

const logoutBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};
