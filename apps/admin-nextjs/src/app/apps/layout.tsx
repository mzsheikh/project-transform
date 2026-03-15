import { RequireAuth } from "../../components/RequireAuth";
import { AppHeader } from "../../components/AppHeader";

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppHeader />
      {children}
    </RequireAuth>
  );
}
