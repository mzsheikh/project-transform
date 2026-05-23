"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLogout, useMe } from "../lib/queries";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  const email = me.data?.email ?? "—";
  const role = me.data?.role ?? "";
  const showBreadcrumb = pathname.includes("/apps/");
  const parts = pathname.split("/").filter(Boolean);
  const appCode = parts[1];
  const formKey = parts[3];

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <>
      <header style={wrap}>
        <div style={left}>
          <button type="button" style={menuBtn} aria-label="Open navigation">
            <MenuIcon />
          </button>
          <div style={brandMark} aria-hidden>
            <span style={brandDotLarge} />
            <span style={brandDotSmall} />
            <span style={brandBar} />
          </div>
          <div style={logo}>Transform Admin</div>
        </div>

        <div style={right}>
          <div style={userInfo}>
            <span style={avatar} aria-hidden>
              <UserIcon />
            </span>
            <div>
              <div style={userName}>{email}</div>
              {role ? <div style={userRole}>{role}</div> : null}
            </div>
            <ChevronIcon />
          </div>

          <button onClick={onLogout} style={logoutBtn} disabled={logout.isPending}>
            {logout.isPending ? "Signing out…" : "Logout"}
          </button>
        </div>
      </header>
      {showBreadcrumb && appCode ? (
        <nav style={breadcrumb} aria-label="Breadcrumb">
          <Link href="/apps" style={breadcrumbLink}>Apps</Link>
          <ChevronText />
          <Link href={`/apps/${encodeURIComponent(appCode)}`} style={breadcrumbLink}>{appCode}</Link>
          {formKey ? (
            <>
              <ChevronText />
              <Link href={`/apps/${encodeURIComponent(appCode)}`} style={breadcrumbLink}>Forms</Link>
              <ChevronText />
              <Link href={`/apps/${encodeURIComponent(appCode)}/forms/${encodeURIComponent(formKey)}/edit`} style={breadcrumbLink}>{formKey}</Link>
              <ChevronText />
              <b>Edit</b>
            </>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 22px",
  borderBottom: "1px solid #e6ebf2",
  background: "#fff",
  color: "#111",
  minHeight: 64,
};

const left: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logo: React.CSSProperties = {
  fontWeight: 800,
  letterSpacing: 0.2,
  fontSize: 24,
  color: "#07183f",
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
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: "#eef4ff",
  color: "#3565c8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
  padding: "13px 18px",
  borderRadius: 8,
  border: "1px solid #091936",
  background: "#071225",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 8px 18px rgba(7, 18, 37, 0.18)",
};

const menuBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 8,
  border: "1px solid #e1e7ef",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#1f2937",
  cursor: "pointer",
};

const brandMark: React.CSSProperties = {
  width: 34,
  height: 34,
  position: "relative",
};

const brandDotLarge: React.CSSProperties = {
  position: "absolute",
  left: 0,
  bottom: 3,
  width: 13,
  height: 13,
  borderRadius: 4,
  background: "#2f6fed",
};

const brandDotSmall: React.CSSProperties = {
  position: "absolute",
  left: 6,
  top: 4,
  width: 11,
  height: 11,
  borderRadius: 4,
  background: "#78a6ff",
};

const brandBar: React.CSSProperties = {
  position: "absolute",
  right: 1,
  top: 6,
  width: 15,
  height: 23,
  borderRadius: 5,
  background: "linear-gradient(180deg, #113a9f, #2f6fed)",
};

const breadcrumb: React.CSSProperties = {
  height: 62,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "0 22px",
  borderBottom: "1px solid #e6ebf2",
  background: "#fbfcfe",
  color: "#2f3a4a",
  fontSize: 15,
  fontWeight: 600,
};

const breadcrumbLink: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
};

const icon: React.CSSProperties = { width: 20, height: 20, display: "block" };

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" style={icon} aria-hidden>
      <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" style={icon} aria-hidden>
      <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="currentColor" opacity="0.85" />
      <path d="M3 18a7 7 0 0 1 14 0" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" style={{ width: 16, height: 16, color: "#475467" }} aria-hidden>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronText() {
  return <span style={{ color: "#98a2b3", fontWeight: 800 }}>›</span>;
}
