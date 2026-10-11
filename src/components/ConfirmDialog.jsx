/**
 * components/ConfirmDialog.jsx
 *
 * Accessible modal confirmation: role="alertdialog", labelled + described,
 * focus moves into the dialog, Tab is trapped, Escape cancels, and focus
 * returns to the previously focused element on close.
 */
import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm, onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    cancelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onCancel?.(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); previous?.focus?.(); };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
        style={{ background: "#fff", borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <h2 id="confirm-title" style={{ margin: "0 0 8px", fontSize: 18, color: "#880e4f" }}>{title}</h2>
        <p id="confirm-desc" style={{ margin: "0 0 18px", fontSize: 14, color: "#444", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button ref={cancelRef} onClick={onCancel}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #c2185b", background: "#fff", color: "#c2185b", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: danger ? "#c62828" : "linear-gradient(135deg,#c2185b,#e91e63)", color: "#fff", fontWeight: "bold", cursor: "pointer", fontSize: 14 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
