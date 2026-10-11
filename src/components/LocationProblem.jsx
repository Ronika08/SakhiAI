/** components/LocationProblem.jsx – clear, actionable GPS error with Retry. */
import { LOCATION_MESSAGES } from "../services/locationService";

export default function LocationProblem({ code, onRetry }) {
  if (!code) return null;
  return (
    <div role="alert" style={{ marginTop: 14, background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 14, padding: "12px 14px", color: "#7a3d00", textAlign: "left" }}>
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>📍 Location unavailable</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{LOCATION_MESSAGES[code] || LOCATION_MESSAGES.UNAVAILABLE}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>SOS still works without GPS — your contacts will be told the location is unavailable.</div>
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 10, background: "#e65100", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: "bold", cursor: "pointer", minHeight: 44 }}>
          ↻ Retry location
        </button>
      )}
    </div>
  );
}
