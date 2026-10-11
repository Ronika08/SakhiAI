export default function TipsPage() {
  return (
    <div style={{ padding: 20, paddingBottom: 80 }}>
      <div style={{ fontWeight: "bold", fontSize: 22, color: "#880e4f", marginBottom: 4 }}>🌿 Health Tips</div>
      <div style={{ color: "#ad1457", fontSize: 13, marginBottom: 20 }}>Curated wellness advice for women</div>

      {[
        { cat: "Nutrition",        color: "#e8f5e9", accent: "#2e7d32", icon: "🥗",
          tips: ["Eat iron-rich foods (spinach, dates, lentils) during your period","Add flaxseeds to your diet — great for hormonal balance","Reduce processed sugar to improve PCOS symptoms","Calcium + Vitamin D is essential for women's bone health"] },
        { cat: "Mental Wellbeing", color: "#fce4ec", accent: "#c2185b", icon: "🧘",
          tips: ["Track mood alongside your cycle — they're connected","Journaling 5 minutes a day reduces stress hormones","Limit social media during PMS week for better mood","Deep breathing activates the parasympathetic nervous system"] },
        { cat: "Fitness",          color: "#e8eaf6", accent: "#3949ab", icon: "🏃",
          tips: ["Light yoga during period reduces cramp intensity","Strength training boosts estrogen and bone density","Walk 30 min daily — it's enough to see hormonal improvements","Avoid intense workouts 2 days before your period"] },
        { cat: "Sleep & Recovery", color: "#fff3e0", accent: "#e65100", icon: "😴",
          tips: ["Your sleep quality directly affects your cycle regularity","Avoid screens 1 hour before bed for better melatonin production","Sleep 7–9 hours to keep cortisol levels in check","A consistent sleep schedule regulates hormones naturally"] },
      ].map(({ cat, color, accent, icon, tips }) => (
        <div key={cat} style={{ background: color, borderRadius: 20, padding: 18, marginBottom: 14, border: `1px solid ${accent}30` }}>
          <div style={{ fontWeight: "bold", color: accent, fontSize: 16, marginBottom: 10 }}>{icon} {cat}</div>
          {tips.map(t => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: accent, fontSize: 16, flexShrink: 0 }}>✦</span>
              <span style={{ color: accent, fontSize: 13, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
