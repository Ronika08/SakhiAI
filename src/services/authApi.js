/** services/authApi.js – thin wrappers over the /api/auth endpoints. */
import api, { setTokens, clearTokens, getAccessToken } from "./apiClient";

const withSession = (data) => {
  setTokens({ token: data.token, refreshToken: data.refreshToken });
  return data.user;
};

export const authApi = {
  register: async ({ name, email, password }) =>
    withSession(await api("/api/auth/register", { method: "POST", body: { name, email, password }, auth: false })),
  login: async ({ email, password }) =>
    withSession(await api("/api/auth/login", { method: "POST", body: { email, password }, auth: false })),
  logout: async () => {
    const refreshToken = (() => { try { return localStorage.getItem("sakhi_refresh_token"); } catch { return null; } })();
    try {
      if (refreshToken) await api("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: Boolean(getAccessToken()) });
    } catch { /* logging out must always succeed locally */ }
    clearTokens();
  },
  forgotPassword: (email) => api("/api/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  resetPassword: ({ token, newPassword }) =>
    api("/api/auth/reset-password", { method: "POST", body: { token, newPassword }, auth: false }),
  me: async () => (await api("/api/auth/me")).user,
};

export default authApi;
