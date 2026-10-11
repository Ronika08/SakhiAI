import { useState } from "react";
import { routeApi } from "../services/dataApi";
import { useConnectivity } from "../hooks/useConnectivity";

const fmtKm = (m) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const fmtMin = (s) => (s == null ? "—" : `${Math.max(1, Math.round(s / 60))} min`);

export default function SafeRoutePage({
  cardStyle,
  sectionTitle,
  inputStyle,
  btnPrimary,
  routeFrom,
  setRouteFrom,
  routeTo,
  setRouteTo,
  fetchLoc,
  contacts,
  APP_NAME,
  currentLoc,
  isAuthenticated,
  setScreen,
}) {
  const connectivity = useConnectivity();
  const online = connectivity === "online";
  const [mode, setMode] = useState("walking");
  const [state, setState] = useState({ phase: "idle" });

  const usingHere = !routeFrom.trim() || /^(my |current )?location$|^here$/i.test(routeFrom.trim());

  async function findRoute() {
    if (!routeTo.trim()) { setState({ phase: "error", message: "Enter a destination first." }); return; }
    if (!online) { setState({ phase: "offline" }); return; }
    if (!isAuthenticated) { setState({ phase: "signin" }); return; }
    let origin;
    if (usingHere) {
      const loc = currentLoc || (await fetchLoc());
      if (!loc) { setState({ phase: "error", message: "We couldn't get your current location. Allow location access, or type a starting point." }); return; }
      origin = { lat: loc.lat, lng: loc.lng };
    } else origin = { address: routeFrom.trim() };
    setState({ phase: "loading" });
    try {
      const route = await routeApi.plan({ origin, destination: { address: routeTo.trim() }, mode });
      setState({ phase: "done", route });
    } catch (err) {
      const offline = ["NETWORK_OFFLINE", "NETWORK_ERROR", "TIMEOUT"].includes(err.code);
      setState(offline ? { phase: "offline" } : { phase: "error", message: err.code === "MAP_ERROR" || err.code === "LOCATION_ERROR" ? err.userMessage : err.userMessage || "Route lookup failed." });
    }
  }

  const gmapsUrl = routeTo.trim()
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeTo.trim())}${usingHere ? "" : `&origin=${encodeURIComponent(routeFrom.trim())}`}&travelmode=${mode}`
    : null;

  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <h1 style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4, marginTop: 0 }}>🗺️ Safe Route</h1>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Plan your journey with safety in mind</div>

      <div style={cardStyle}>
        <div style={sectionTitle}>📍 Plan Your Route</div>
        <label htmlFor="route-from" className="sr-only">Starting point</label>
        <input id="route-from" value={routeFrom} onChange={e => setRouteFrom(e.target.value)}
          placeholder="📍 Starting point (blank = my current location)" autoComplete="off"
          style={inputStyle} />
        <label htmlFor="route-to" className="sr-only">Destination</label>
        <input id="route-to" value={routeTo} onChange={e => setRouteTo(e.target.value)}
          placeholder="🎯 Destination (e.g. Market, Friend's place)" autoComplete="off"
          style={{ ...inputStyle, marginBottom: 10 }} />
        <div role="group" aria-label="Travel mode" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["walking", "🚶 Walk"], ["driving", "🚗 Drive"], ["transit", "🚌 Transit"]].map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} style={{
              flex: 1, minHeight: 40, borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer", fontSize: 13,
              background: mode === m ? "linear-gradient(135deg,#c2185b,#e91e63)" : "#fce4ec", color: mode === m ? "#fff" : "#a0144f",
            }}>{label}</button>
          ))}
        </div>
        <button style={{ ...btnPrimary, marginTop: 4, opacity: state.phase === "loading" ? 0.7 : 1 }} disabled={state.phase === "loading"} onClick={findRoute}>
          {state.phase === "loading" ? "Finding route…" : "🗺️ Find Route"}
        </button>
        {!online && <p role="status" style={{ fontSize: 12, color: "#b71c1c", margin: "10px 0 0" }}>🌐 Route search needs internet. GPS still works offline, and emergency numbers are on the Emergency screen.</p>}

        <div aria-live="polite">
          {state.phase === "offline" && <p role="alert" style={noteStyle("#fff3e0", "#7a3d00")}>You're offline, so routes can't be looked up. Try again when you have internet.</p>}
          {state.phase === "signin" && (
            <p role="alert" style={noteStyle("#fff3e0", "#7a3d00")}>
              Route search uses our secure server, so please sign in first.{" "}
              {setScreen && <button type="button" onClick={() => setScreen("account")} style={{ background: "none", border: "none", color: "#c2185b", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 13 }}>Sign in</button>}
              {gmapsUrl && <> Or <a href={gmapsUrl} target="_blank" rel="noreferrer">open the route in Google Maps</a> (needs internet).</>}
            </p>
          )}
          {state.phase === "error" && <p role="alert" style={noteStyle("#ffebee", "#b71c1c")}>{state.message}{gmapsUrl && online && <> You can still <a href={gmapsUrl} target="_blank" rel="noreferrer">open it in Google Maps</a>.</>}</p>}
          {state.phase === "done" && (
            <div role="status" style={noteStyle("#e8f5e9", "#1b5e20")}>
              <b>{fmtKm(state.route.distanceMeters)} · {fmtMin(state.route.durationSeconds)}</b>
              <div style={{ fontSize: 12, margin: "4px 0" }}>{state.route.startAddress} → {state.route.endAddress}</div>
              <details><summary style={{ cursor: "pointer" }}>Step-by-step ({state.route.steps.length})</summary>
                <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                  {state.route.steps.map((st, i) => <li key={i}>{st.instruction} ({fmtKm(st.distanceMeters)})</li>)}
                </ol>
              </details>
              <p style={{ fontSize: 11, margin: "8px 0 0", color: "#555" }}>This is the fastest route for your travel mode — it does not rate how safe an area is. Stay on well-lit, busy roads and share your trip with your Trusted Circle.</p>
              {gmapsUrl && <a href={gmapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open in Google Maps</a>}
            </div>
          )}
        </div>
      </div>

      {/* Live Route & Nearby Services */}
<div
  style={{
    background: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
  }}
>
  <div
    style={{
      fontWeight: "bold",
      color: "#880e4f",
      marginBottom: 16,
      fontSize: 16,
    }}
  >
    🗺️ Maps & Nearby Services
  </div>

  {/* Live Map */}
  {online ? (
  <iframe
    title="Safe Route Map"
    src={
  currentLoc
    ? `https://maps.google.com/maps?q=${currentLoc.lat},${currentLoc.lng}&z=15&output=embed`
    : "https://maps.google.com/maps?q=mysuru&z=14&output=embed"
}
    width="100%"
    height="260"
    style={{
      border: 0,
      borderRadius: 16,
      marginBottom: 18,
    }}
    loading="lazy"
  />
  ) : (
    <div role="status" style={{ height: 160, border: "1px dashed #f48fb1", borderRadius: 16, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12, color: "#7a3d00", background: "#fff8f0", fontSize: 13 }}>
      🌐 The map needs internet and can't load offline.{currentLoc ? ` Your GPS position: ${currentLoc.lat.toFixed(5)}, ${currentLoc.lng.toFixed(5)}` : ""}
    </div>
  )}

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}
  >

    <a
      href="https://www.google.com/maps/search/hospital+near+me"
      target="_blank"
      rel="noreferrer"
      style={{
        background: "#e8f5e9",
        color: "#2e7d32",
        padding: 12,
        borderRadius: 12,
        textAlign: "center",
        textDecoration: "none",
        fontWeight: "bold",
      }}
    >
      🏥 Hospitals
    </a>

    <a
      href="https://www.google.com/maps/search/police+station+near+me"
      target="_blank"
      rel="noreferrer"
      style={{
        background: "#e3f2fd",
        color: "#1565c0",
        padding: 12,
        borderRadius: 12,
        textAlign: "center",
        textDecoration: "none",
        fontWeight: "bold",
      }}
    >
      👮 Police
    </a>

    <a
      href="https://www.google.com/maps/search/pharmacy+near+me"
      target="_blank"
      rel="noreferrer"
      style={{
        background: "#fff8e1",
        color: "#ef6c00",
        padding: 12,
        borderRadius: 12,
        textAlign: "center",
        textDecoration: "none",
        fontWeight: "bold",
      }}
    >
      💊 Pharmacy
    </a>

    <a
      href="https://maps.google.com"
      target="_blank"
      rel="noreferrer"
      style={{
        background: "#f3e5f5",
        color: "#6a1b9a",
        padding: 12,
        borderRadius: 12,
        textAlign: "center",
        textDecoration: "none",
        fontWeight: "bold",
      }}
    >
      🧭 Directions
    </a>

  </div>
</div>

      {/* Quick share location */}
      <div style={cardStyle}>
        <div style={sectionTitle}>📡 Share Live Location</div>
        <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          Share your real-time location with your Trusted Circle while travelling.
        </div>
        <button onClick={async () => {
          const loc = await fetchLoc();
          if (loc) {
            const msg = `📍 I'm sharing my location:\nhttps://maps.google.com/?q=${loc.lat},${loc.lng}\n— ${APP_NAME}`;
            const valid = contacts.filter(c => c.phone.trim());
            if (valid.length) window.open(`https://wa.me/${valid[0].phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
            else alert("Add contacts in Trusted Circle first!");
          } else {
            alert("Location permission required. Please enable it in your browser.");
          }
        }} style={btnPrimary}>📡 Share My Location Now</button>
      </div>

      <div style={{ background: "#e8f5e9", borderRadius: 14, padding: 14, border: "1px solid #a5d6a7" }}>
        <div style={{ fontWeight: "bold", color: "#2e7d32", fontSize: 13, marginBottom: 6 }}>🔮 Coming Soon</div>
        <div style={{ color: "#388e3c", fontSize: 12, lineHeight: 1.7 }}>
          ✦ Google Maps safer route suggestions<br/>
          ✦ Avoid poorly lit or high-crime areas<br/>
          ✦ Live location sharing with trusted contacts<br/>
          ✦ Estimated arrival time alerts
        </div>
      </div>
    </div>
  );
}

const noteStyle = (bg, fg) => ({ background: bg, color: fg, borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, margin: "12px 0 0" });
