import { useContext } from "react";

import { AuthContext } from "./authState";

export function useAuth() {
  // This guard fails loudly during development if a future route is mounted
  // outside the provider, which is much easier to debug than null auth state.
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
