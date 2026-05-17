import Link from "next/link";
import { api } from "../../lib/api";

export default async function AppsPage() {
  const apps = await api.listApps();

  return (
    <main style={page}>
      <div style={hero}>
        <div>
          <div style={eyebrow}>Workspace</div>
          <h1 style={title}>Apps</h1>
        </div>

        <Link href="/apps/new" style={iconAction} title="Create app" aria-label="Create app">
          <PlusIcon />
        </Link>
      </div>

      <div style={listWrap}>
        {apps.map((app) => (
          <div key={app.appCode} style={rowCard}>
            <div style={rowMeta}>
              <div style={codePill}>{app.appCode}</div>
              <div>
                <div style={appName}>{app.name}</div>
                <div style={appSubtext}>Open app forms and drafts</div>
              </div>
            </div>

            <Link href={`/apps/${app.appCode}`} style={iconAction} title={`Open ${app.appCode}`} aria-label={`Open ${app.appCode}`}>
              <ArrowRightIcon />
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  padding: 24,
  fontFamily: "system-ui",
  background: "#fff",
  color: "#111",
  minHeight: "100vh",
};

const hero: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#667085",
  fontWeight: 700,
  marginBottom: 8,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
};

const subtitle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#667085",
  maxWidth: 560,
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const rowCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "16px 18px",
  border: "1px solid #d0d5dd",
  borderRadius: 18,
  background: "#fcfcfd",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
};

const rowMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  minWidth: 0,
};

const codePill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#f2f4f7",
  border: "1px solid #e4e7ec",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.3,
};

const appName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
};

const appSubtext: React.CSSProperties = {
  fontSize: 13,
  color: "#667085",
  marginTop: 4,
};

const iconAction: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#111",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
  flexShrink: 0,
};

const iconBase: React.CSSProperties = {
  width: 18,
  height: 18,
  display: "block",
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
