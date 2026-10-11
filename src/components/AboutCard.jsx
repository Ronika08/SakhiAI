export default function AboutCard({ APP_NAME }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg,#fff0f7,#f3e5f5)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        border: "1px solid rgba(194,24,91,0.15)",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          color: "#880e4f",
          fontSize: 15,
          marginBottom: 8,
        }}
      >
        🌸 About {APP_NAME}
      </div>

      <div
        style={{
          color: "#ad1457",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {APP_NAME} combines women's health guidance, cycle tracking,
        wellness support, emergency safety tools, and AI-powered
        assistance in one platform designed to support women in
        everyday life and emergency situations.
      </div>
    </div>
  );
}