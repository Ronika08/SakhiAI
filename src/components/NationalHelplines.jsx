export default function NationalHelplines({ NATIONAL_HELPLINES }) {
  return (
    <div style={{ background: "#fff3e0", borderRadius: 20, padding: 18, border: "1px solid #ffcc80", marginBottom: 14 }}>
      <div style={{ fontWeight: "bold", color: "#e65100", marginBottom: 14, fontSize: 16 }}>📞 National Helplines</div>
      {NATIONAL_HELPLINES.map(([name, num]) => (
        <div key={num} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,152,0,0.2)" }}>
          <span style={{ color: "#bf360c", fontSize: 14 }}>{name}</span>
          <a href={`tel:${num}`} style={{ background: "linear-gradient(135deg,#e65100,#f4511e)", color: "#fff", padding: "6px 16px", borderRadius: 20, fontWeight: "bold", fontSize: 14, textDecoration: "none" }}>{num}</a>
        </div>
      ))}
    </div>
  );
}
