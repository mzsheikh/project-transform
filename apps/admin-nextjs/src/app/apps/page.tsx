import Link from "next/link";
import { api } from "../../lib/api";

export default async function AppsPage() {
  const apps = await api.listApps();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <h1>Admin</h1>
      <p>Apps</p>

      <ul>
        {apps.map((a) => (
          <li key={a.appCode}>
            <Link href={`/apps/${a.appCode}`}>{a.appCode} — {a.name}</Link>
          </li>
        ))}
      </ul>

      <hr style={{ margin: "16px 0" }} />

      <Link href="/apps/new">+ Create App</Link>
    </main>
  );
}
