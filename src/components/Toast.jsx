/**
 * components/Toast.jsx
 *
 * Lightweight, accessible toast notifications (replaces blocking alert()).
 * Success/info toasts use role="status" (polite); errors use role="alert".
 * Honors prefers-reduced-motion via index.css.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext({ toast: () => {} });

const COLORS = {
  success: { bg: "#e8f5e9", fg: "#1b5e20", border: "#a5d6a7", icon: "✅" },
  error: { bg: "#ffebee", fg: "#b71c1c", border: "#ef9a9a", icon: "⚠️" },
  info: { bg: "#fff3e0", fg: "#7a3d00", border: "#ffcc80", icon: "ℹ️" },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((message, type = "info", { duration } = {}) => {
    idRef.current += 1;
    const id = idRef.current;
    setItems((list) => [...list.slice(-3), { id, message, type }]);
    const ms = duration ?? (type === "error" ? 7000 : 4000);
    if (ms > 0) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    toast,
    success: (m, o) => toast(m, "success", o),
    error: (m, o) => toast(m, "error", o),
    info: (m, o) => toast(m, "info", o),
  }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false"
        style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 84, width: "min(94vw, 400px)", zIndex: 1000, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {items.map((t) => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div key={t.id} role={t.type === "error" ? "alert" : "status"} className="toast-item"
              style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.4, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", gap: 8, alignItems: "flex-start", pointerEvents: "auto" }}>
              <span aria-hidden="true">{c.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification"
                style={{ background: "none", border: "none", color: c.fg, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
