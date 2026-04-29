import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isRestoringSession } = useAuth();

  if (isRestoringSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 text-slate-300">
        <div className="border border-white/10 bg-ink-850 px-5 py-4 text-sm shadow-panel">
          Restoring secure session...
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
