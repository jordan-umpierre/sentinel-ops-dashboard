import { createContext } from "react";

import type { LoginPayload, User } from "../../lib/api";

export type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
};

// Auth state lives in a context shared by the provider and hook. Keeping it out
// of the component file lets React Fast Refresh treat the provider cleanly.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const TOKEN_STORAGE_KEY = "sentinel.accessToken";
