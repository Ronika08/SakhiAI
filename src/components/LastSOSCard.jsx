export default function LastSOSCard({ lastSosTs, lastSosLoc }) {
  return (
    <>
      {(lastSosTs || lastSosLoc) && (
        <div style={{ marginTop: 12, background: "#fff8f8", borderRadius: 12, padding: "10px 14px", border: "1px solid #ffcdd2", textAlign: "left" }}>
          <div style={{ color: "#b71c1c", fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>🕐 Last SOS</div>
          {lastSosTs  && <div style={{ color: "#c62828", fontSize: 12 }}>{lastSosTs}</div>}
          {lastSosLoc && <a href={`https://maps.google.com/?q=${lastSosLoc.lat},${lastSosLoc.lng}`} target="_blank" rel="noreferrer" style={{ color: "#e53935", fontSize: 12 }}>📍 Last known location →</a>}
        </div>
      )}
    </>
  );
}
