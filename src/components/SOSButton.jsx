export default function SOSButton({
  emergencyActive,
  sosCountdown,
  triggerSOSCountdown,
  cancelSOS,
}) {
  return (
    <>
      {sosCountdown !== null ? (
        /* COUNTDOWN UI */
        <div role="alertdialog" aria-modal="false" aria-label="SOS countdown">
          <div role="status" aria-live="assertive" className="sr-only">
            SOS will be sent in {sosCountdown} second{sosCountdown === 1 ? "" : "s"}. Press Cancel to stop.
          </div>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
            <svg aria-hidden="true" focusable="false" width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="90" cy="90" r="80" fill="none" stroke="#ffcdd2" strokeWidth="10" />
              <circle cx="90" cy="90" r="80" fill="none" stroke="#f44336" strokeWidth="10"
                strokeDasharray="503"
                strokeDashoffset={503 - (503 * (5 - sosCountdown) / 5)}
                style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 56, fontWeight: "bold", color: "#b71c1c", lineHeight: 1 }}>{sosCountdown}</div>
              <div style={{ fontSize: 13, color: "#c62828", marginTop: 4 }}>SOS sending...</div>
            </div>
          </div>
          <br />
          <button onClick={cancelSOS} autoFocus aria-label="Cancel SOS" style={{
            background: "#fff", border: "2px solid #e53935", borderRadius: 24,
            color: "#c62828", padding: "12px 36px", fontSize: 16, fontWeight: "bold",
            cursor: "pointer", boxShadow: "0 4px 15px rgba(244,67,54,0.2)", minHeight: 48,
          }}>✕ Cancel SOS</button>
        </div>
      ) : (
        /* NORMAL SOS BUTTON */
        <button onClick={triggerSOSCountdown} aria-label="Send SOS emergency alert. A 5 second countdown starts and you can cancel." style={{
          width: 160, height: 160, borderRadius: "50%",
          background: emergencyActive ? "linear-gradient(135deg,#b71c1c,#d32f2f)" : "linear-gradient(135deg,#d32f2f,#f44336)",
          border: "6px solid rgba(255,255,255,0.4)",
          color: "#fff", fontSize: 28, fontWeight: "bold", cursor: "pointer",
          boxShadow: "0 8px 30px rgba(244,67,54,0.5)",
          animation: "pulse 2s infinite", transition: "all 0.3s",
        }}>
          🚨<br /><span style={{ fontSize: 18 }}>SOS</span>
        </button>
      )}
    </>
  );
}
