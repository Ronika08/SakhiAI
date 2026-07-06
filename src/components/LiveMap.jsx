export default function LiveMap({ location }) {
  if (!location) {
    return (
      <div
        style={{
          height: 250,
          borderRadius: 16,
          background: "#f5f5f5",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#666",
          fontWeight: "bold",
          marginTop: 16,
        }}
      >
        📍 Waiting for location...
      </div>
    );
  }

  const mapUrl = `https://maps.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`;

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
      }}
    >
      <iframe
        title="Live Location"
        src={mapUrl}
        width="100%"
        height="250"
        style={{
          border: 0,
        }}
        loading="lazy"
        allowFullScreen
      />

      <div
        style={{
          background: "#fff",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: "bold", color: "#c2185b" }}>
          📍 Your Current Location
        </div>

        <div style={{ fontSize: 13, marginTop: 6 }}>
          Latitude : {location.lat.toFixed(6)}
        </div>

        <div style={{ fontSize: 13 }}>
          Longitude : {location.lng.toFixed(6)}
        </div>

        <div style={{ fontSize: 13 }}>
          Accuracy : {Math.round(location.accuracy)} meters
        </div>
      </div>
    </div>
  );
}