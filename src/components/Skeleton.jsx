/** components/Skeleton.jsx – loading placeholder (decorative; announce via aria-busy on the parent). */
export default function Skeleton({ height = 16, width = "100%", radius = 8, style }) {
  return <div aria-hidden="true" className="skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? "60%" : "100%"} style={{ marginBottom: 10 }} />
      ))}
    </div>
  );
}
