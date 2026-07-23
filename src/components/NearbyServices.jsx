export default function NearbyServices({ currentLoc, fetchLoc, btnPrimary }) {
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
