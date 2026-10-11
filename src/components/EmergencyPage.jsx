import SOSButton from "../components/SOSButton";
import LiveMap from "../components/LiveMap";
import LastSOSCard from "../components/LastSOSCard";
import EmergencyContacts from "../components/EmergencyContacts";
import NationalHelplines from "../components/NationalHelplines";
import NearbyServices from "../components/NearbyServices";

export default function EmergencyPage({
  sosCountdown,
  emergencyActive,
  triggerSOSCountdown,
  cancelSOS,
  sosSent,
  currentLoc,
  gpsStatus,
  lastUpdated,
  refreshLocation,
  lastSosTs,
  lastSosLoc,
  contacts,
  setScreen,
  contactAlertMsg,
  NATIONAL_HELPLINES,
  fetchLoc,
  cardStyle,
  btnPrimary,
}) {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#b71c1c", marginBottom: 4 }}>🚨 Emergency & Safety</div>
      <div style={{ color: "#c62828", fontSize: 13, marginBottom: 20 }}>Quick access to safety tools</div>

      {/* SOS with countdown */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <SOSButton
          emergencyActive={emergencyActive}
          sosCountdown={sosCountdown}
          triggerSOSCountdown={triggerSOSCountdown}
          cancelSOS={cancelSOS}
        />

        {/* SOS sent confirmation */}
        {sosSent && (
          <div style={{ marginTop: 14, background: "#ffebee", borderRadius: 14, padding: "14px 18px", border: "1px solid #ef9a9a" }}>
            <div style={{ color: "#c62828", fontWeight: "bold", fontSize: 15 }}>🚨 SOS Triggered!</div>
            <div style={{ color: "#b71c1c", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              📱 <b>SMS app opened</b> — tap Send to alert contacts<br />
              💬 <b>WhatsApp also opened</b> as backup<br />
              📍 Your live location is included
            </div>
          </div>
        )}

        {/* Live Google Map */}
        {currentLoc && (
          <>
            <LiveMap
              location={currentLoc}
              gpsStatus={gpsStatus}
              lastUpdated={lastUpdated}
              refreshLocation={refreshLocation}
            />

            <div
              style={{
                marginTop: 12,
                background: "#fff8f8",
                borderRadius: 12,
                padding: "12px 14px",
                border: "1px solid #ffcdd2",
              }}
            >
              <div
                style={{
                  color: "#b71c1c",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                📍 Current Location
              </div>

              

              <a
                href={`https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  background: "#c2185b",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                🗺 Open in Google Maps
              </a>
            </div>
          </>
        )}

        {/* Last SOS info */}
        <LastSOSCard lastSosTs={lastSosTs} lastSosLoc={lastSosLoc} />
      </div>

      {/* Emergency Contacts (quick view) */}
      <EmergencyContacts
        contacts={contacts}
        setScreen={setScreen}
        contactAlertMsg={contactAlertMsg}
        cardStyle={cardStyle}
        btnPrimary={btnPrimary}
      />

      {/* National Helplines */}
      <NationalHelplines NATIONAL_HELPLINES={NATIONAL_HELPLINES} />

      {/* Nearby services */}
      <NearbyServices currentLoc={currentLoc} fetchLoc={fetchLoc} btnPrimary={btnPrimary} />
    </div>
  );
}
