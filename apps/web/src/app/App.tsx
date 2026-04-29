import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { AssetsPage } from "../features/assets/AssetsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { EventsPage } from "../features/events/EventsPage";
import { IncidentsPage } from "../features/incidents/IncidentsPage";
import { SitePage } from "../features/site/SitePage";

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
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="site" element={<SitePage />} />
        <Route path="events" element={<EventsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
