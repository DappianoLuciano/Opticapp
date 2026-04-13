export const THEMES = [
  { key: "green",  label: "Verde",   accent: "#55C99A", accent2: "#2FB983", accentSoft: "rgba(85,201,154,.18)" },
  { key: "blue",   label: "Azul",    accent: "#3B82F6", accent2: "#2563EB", accentSoft: "rgba(59,130,246,.18)" },
  { key: "purple", label: "Violeta", accent: "#8B5CF6", accent2: "#7C3AED", accentSoft: "rgba(139,92,246,.18)" },
  { key: "orange", label: "Naranja", accent: "#F59E0B", accent2: "#D97706", accentSoft: "rgba(245,158,11,.18)" },
  { key: "pink",   label: "Rosa",    accent: "#EC4899", accent2: "#DB2777", accentSoft: "rgba(236,72,153,.18)" },
  { key: "teal",   label: "Turquesa",accent: "#14B8A6", accent2: "#0D9488", accentSoft: "rgba(20,184,166,.18)" },
];

const KEY = "opticapp:settings";

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { companyName: "OpticApp", themeKey: "green" };
    const parsed = JSON.parse(raw);
    return {
      companyName: parsed.companyName ?? "OpticApp",
      themeKey: parsed.themeKey ?? "green",
    };
  } catch {
    return { companyName: "OpticApp", themeKey: "green" };
  }
}

export function saveSettings(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function applyTheme(themeKey) {
  const t = THEMES.find(x => x.key === themeKey) ?? THEMES[0];
  const r = document.documentElement;

  r.style.setProperty("--accent", t.accent);
  r.style.setProperty("--accent-2", t.accent2);
  r.style.setProperty("--accent-soft", t.accentSoft);

  // Sidebar “teñido” (sin depender de color-mix si querés)
  // Si querés más oscuro/claro, lo ajustamos
  r.style.setProperty("--sidebar", t.accent);
}