export default function LiveMap({
  location,
  gpsStatus,
  lastUpdated,
  refreshLocation,
}) {
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
        <span role="status">📍 Waiting for GPS...</span>
      </div>
    );
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const lowAccuracy = typeof location.accuracy === "number" && location.accuracy > 1000;
  const mapUrl = `https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`;

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        background: "#fff",
      }}
    >
      {offline && (
        <div role="status" style={{ background: "#fff3e0", color: "#7a3d00", padding: "8px 12px", fontSize: 12 }}>
          You're offline — the map can't load, but your coordinates below are still current.
        </div>
      )}
      {lowAccuracy && (
        <div role="status" style={{ background: "#fff3e0", color: "#7a3d00", padding: "8px 12px", fontSize: 12 }}>
          Location accuracy is low (about {Math.round(location.accuracy)} m). The pin may be far from you.
        </div>
      )}
      <iframe
        title="Live Location map"
        src={mapUrl}
        width="100%"
        height="260"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
      />

      <div
        style={{
          padding: 15,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <strong style={{ color: "#c2185b" }}>
            {gpsStatus === "Connected"
              ? "🟢 GPS Connected"
              : "🔴 GPS Searching"}
          </strong>

          <button
            onClick={refreshLocation}
            style={{
              background: "#c2185b",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>

        <div style={{ fontSize: 13, marginBottom: 5 }}>
          📍 Latitude: {location.lat.toFixed(6)}
        </div>

        <div style={{ fontSize: 13, marginBottom: 5 }}>
          📍 Longitude: {location.lng.toFixed(6)}
        </div>

        <div style={{ fontSize: 13, marginBottom: 5 }}>
          🎯 Accuracy:{" "}
          {location.accuracy
            ? `${Math.round(location.accuracy)} meters`
            : "Unknown"}
        </div>

        <div style={{ fontSize: 13, marginBottom: 5 }}>
          🚶 Speed:{" "}
          {location.speed != null
            ? `${(location.speed * 3.6).toFixed(1)} km/h`
            : "Not Available"}
        </div>

        <div style={{ fontSize: 13, marginBottom: 10 }}>
          🕒 Updated:{" "}
          {lastUpdated
            ? lastUpdated.toLocaleTimeString()
            : "Just Now"}
        </div>

        <a
          href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            background: "#1976d2",
            color: "#fff",
            padding: 10,
            borderRadius: 10,
            fontWeight: "bold",
          }}
        >
          📌 Open in Google Maps
        </a>
      </div>
    </div>
  );
}