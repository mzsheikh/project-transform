"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApps, useLogout, useMe } from "../lib/queries";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const apps = useApps();
  const logout = useLogout();

  const email = me.data?.email ?? "—";
  const role = me.data?.role ?? "";

  const headerContext = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const appsIndex = parts.indexOf("apps");
    if (appsIndex === -1) return null;

    const appCode = parts[appsIndex + 1];
    if (!appCode || appCode === "new") return null;

    const appName = apps.data?.find((app) => app.appCode === appCode)?.name ?? appCode;

    const formsIndex = parts.indexOf("forms");
    const formKey = formsIndex !== -1 ? parts[formsIndex + 1] : null;

    return { appName, appCode, formKey };
  }, [apps.data, pathname]);

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
        <div>
          <div style={logo}>Transform Admin</div>
          {headerContext ? (
            <div style={contextLine}>
              <span><b>{headerContext.appName}</b></span>
              <span style={divider}>/</span>
              <span>{headerContext.appCode}</span>
              {headerContext.formKey ? (
                <>
                  <span style={divider}>/</span>
                  <span>{headerContext.formKey}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
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
  fontSize: 22,
};

const contextLine: React.CSSProperties = {
  marginTop: 6,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 13,
  color: "#667085",
};

const divider: React.CSSProperties = {
  color: "#d0d5dd",
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
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};
