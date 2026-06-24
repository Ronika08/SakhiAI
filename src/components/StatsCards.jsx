export default function StatsCards({ stats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 16,
      }}
    >
      {[
        {
          label: "Mood Logs",
          value: stats.moodLogs,
          icon: "😊",
          color: "#fce4ec",
          tc: "#c2185b",
        },
        {
          label: "Wellness Entries",
          value: stats.wellnessEntries,
          icon: "💪",
          color: "#e8f5e9",
          tc: "#2e7d32",
        },
        {
          label: "Safety Contacts",
          value: stats.safetyContacts,
          icon: "👥",
          color: "#fff3e0",
          tc: "#e65100",
        },
        {
          label: "Cycle Records",
          value: stats.cycleRecords,
          icon: "📅",
          color: "#f3e5f5",
          tc: "#7b1fa2",
        },
      ].map(({ label, value, icon, color, tc }) => (
        <div
          key={label}
          style={{
            background: color,
            borderRadius: 14,
            padding: "14px 16px",
            border: `1px solid ${tc}22`,
          }}
        >
          <div style={{ fontSize: 22 }}>{icon}</div>
          <div
            style={{
              fontSize: 26,
              fontWeight: "bold",
              color: tc,
              lineHeight: 1.2,
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 11,
              color: tc,
              fontWeight: "bold",
              marginTop: 2,
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}