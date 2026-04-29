import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient, type LoginPayload, type User } from "../../lib/api";
import { AuthContext, TOKEN_STORAGE_KEY, type AuthContextValue } from "./authState";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(Boolean(token));

  const logout = useCallback(() => {
    // Clearing both localStorage and React state guarantees protected routes
    // react immediately when the operator signs out or an API call fails auth.
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      if (!token) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const restoredUser = await apiClient.getMe(token);
        if (isActive) {
          setUser(restoredUser);
        }
      } catch {
        if (isActive) {
          logout();
        }
      } finally {
        if (isActive) {
          setIsRestoringSession(false);
        }
      }
    }

    restoreSession();
    return () => {
      isActive = false;
    };
  }, [logout, token]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await apiClient.login(payload);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      navigate("/", { replace: true });
    },
    [navigate]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isRestoringSession,
      login,
      logout
    }),
    [isRestoringSession, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
