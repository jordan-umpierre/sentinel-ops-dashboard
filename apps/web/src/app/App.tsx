import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { AssetsPage } from "../features/assets/AssetsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="min-h-[420px] border border-white/10 bg-ink-850 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Workspace</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Operational records for this surface are queued behind the primary
        command dashboard.
      </p>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="incidents" element={<PlaceholderPage title="Incidents" />} />
        <Route path="site" element={<PlaceholderPage title="Site View" />} />
        <Route path="events" element={<PlaceholderPage title="Event History" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
