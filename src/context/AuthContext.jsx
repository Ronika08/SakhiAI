/**
 * context/AuthContext.jsx
 *
 * Optional authentication. Anonymous users keep using the app exactly as
 * before (localStorage only). Signing in adds backend persistence + SOS
 * notifications on top.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authApi from "../services/authApi";
import { restoreSession, setSessionExpiredHandler, hasStoredSession } from "../services/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "loading" only while restoring a stored session at startup.
  const [status, setStatus] = useState(hasStoredSession() ? "loading" : "anonymous");
  const [sessionNotice, setSessionNotice] = useState(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("anonymous");
      setSessionNotice("Your session expired. Please sign in again to keep syncing.");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasStoredSession()) return undefined;
    restoreSession()
      .then((u) => { if (!cancelled) { setUser(u); setStatus("authenticated"); } })
      .catch(() => { if (!cancelled) setStatus("anonymous"); }); // offline / server down → stay anonymous, data stays local
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (creds) => {
    const u = await authApi.login(creds);
    setUser(u); setStatus("authenticated"); setSessionNotice(null);
    return u;
  }, []);
  const register = useCallback(async (data) => {
    const u = await authApi.register(data);
    setUser(u); setStatus("authenticated"); setSessionNotice(null);
    return u;
  }, []);
  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null); setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === "authenticated", sessionNotice, login, register, logout,
      forgotPassword: authApi.forgotPassword, resetPassword: authApi.resetPassword }),
    [user, status, sessionNotice, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
