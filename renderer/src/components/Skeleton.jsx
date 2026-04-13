/**
 * Skeleton.jsx
 * Componentes de loading skeleton para evitar pantallas en blanco.
 *
 * Uso:
 *   <SkeletonLine />              → línea de texto
 *   <SkeletonLine width="60%" />  → línea corta
 *   <SkeletonBlock height={200} /> → bloque grande (ej: tabla)
 *   <SkeletonCard />               → card completa
 *   <SkeletonTable rows={5} cols={4} /> → tabla simulada
 */

const PULSE = {
  background: "linear-gradient(90deg, var(--border) 25%, rgba(255,255,255,0.12) 50%, var(--border) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeletonPulse 1.5s ease-in-out infinite",
  borderRadius: 6,
};

// Inyectar la keyframe una sola vez
if (typeof document !== "undefined" && !document.getElementById("skeleton-style")) {
  const style = document.createElement("style");
  style.id = "skeleton-style";
  style.textContent = `
    @keyframes skeletonPulse {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

export function SkeletonLine({ width = "100%", height = 14, style: extra }) {
  return (
    <div style={{ ...PULSE, width, height, marginBottom: 6, ...extra }} />
  );
}

export function SkeletonBlock({ width = "100%", height = 120, style: extra }) {
  return (
    <div style={{ ...PULSE, width, height, borderRadius: 10, ...extra }} />
  );
}

export function SkeletonCard({ style: extra } = {}) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: 20,
      ...extra,
    }}>
      <SkeletonLine width="40%" height={16} style={{ marginBottom: 14 }} />
      <SkeletonLine width="100%" height={12} />
      <SkeletonLine width="85%"  height={12} />
      <SkeletonLine width="60%"  height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 } = {}) {
  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${100 / cols}%`} height={16} style={{ borderRadius: 6 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 12, marginBottom: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine
              key={c}
              width={c === 0 ? "25%" : `${75 / (cols - 1)}%`}
              height={13}
              style={{ opacity: 0.7 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
