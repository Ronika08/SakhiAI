import { useConnectivity } from "../hooks/useConnectivity";

/** Nearby police/hospitals open Google Maps searches: INTERNET REQUIRED. Offline we say so and point to phone numbers. */
export default function NearbyServices({ currentLoc, fetchLoc, btnPrimary }) {
  const online = useConnectivity() === "online";
  if (!online) {
    return (
      <div role="status" style={{ background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 14, padding: 14, color: "#7a3d00", fontSize: 13, lineHeight: 1.5 }}>
        🌐 Searching for nearby police stations and hospitals needs internet. You're offline — call <a href="tel:112">112</a> (emergency), <a href="tel:100">100</a> (police) or <a href="tel:108">108</a> (ambulance); these work without data.
        {currentLoc && <div style={{ marginTop: 6 }}>📍 Your GPS position is still available: {currentLoc.lat.toFixed(5)}, {currentLoc.lng.toFixed(5)}</div>}
      </div>
    );
  }
  return (
    <>
      {currentLoc ? (
        <div>
          <a href={`https://www.google.com/maps/search/police+station/@${currentLoc.lat},${currentLoc.lng},15z`} target="_blank" rel="noreferrer"
            style={{ display:"block", background:"linear-gradient(135deg,#1565c0,#1976d2)", color:"#fff", padding:14, borderRadius:14, textAlign:"center", textDecoration:"none", fontWeight:"bold", marginBottom:10 }}>🗺️ Nearby Police Stations</a>
          <a href={`https://www.google.com/maps/search/hospital/@${currentLoc.lat},${currentLoc.lng},15z`} target="_blank" rel="noreferrer"
            style={{ display:"block", background:"linear-gradient(135deg,#2e7d32,#388e3c)", color:"#fff", padding:14, borderRadius:14, textAlign:"center", textDecoration:"none", fontWeight:"bold" }}>🏥 Nearby Hospitals</a>
        </div>
      ) : (
        <button onClick={() => fetchLoc()} style={btnPrimary}>📍 Enable Location for Nearby Help</button>
      )}
    </>
  );
}
