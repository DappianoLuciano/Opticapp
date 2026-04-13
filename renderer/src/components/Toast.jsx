/**
 * Toast.jsx
 * Sistema de notificaciones global.
 *
 * Uso:
 *   import { toast } from "../components/Toast";
 *   toast.success("Guardado correctamente");
 *   toast.error("Ocurrió un error");
 *   toast.info("Información");
 *   toast.warn("Atención");
 *
 * Montar <ToastContainer /> una sola vez en App.jsx.
 */
import { useEffect, useState } from "react";

// ─── Event bus mínimo ────────────────────────────────────────────────────────
let _listeners = [];
function emit(event) {
  _listeners.forEach((fn) => fn(event));
}
function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((x) => x !== fn); };
}

// ─── API pública ─────────────────────────────────────────────────────────────
let _idCounter = 0;
function push(type, message, duration = 3000) {
  emit({ id: ++_idCounter, type, message, duration });
}

export const toast = {
  success: (msg, dur) => push("success", msg, dur),
  error:   (msg, dur) => push("error",   msg, dur ?? 4500),
  info:    (msg, dur) => push("info",    msg, dur),
  warn:    (msg, dur) => push("warn",    msg, dur ?? 3500),
};

// ─── Estilos por tipo ────────────────────────────────────────────────────────
const STYLES = {
  success: {
    bg: "#0b7a55",
    border: "#0b7a55",
    icon: "✓",
  },
  error: {
    bg: "#b91c1c",
    border: "#b91c1c",
    icon: "✕",
  },
  info: {
    bg: "#1d4ed8",
    border: "#1d4ed8",
    icon: "i",
  },
  warn: {
    bg: "#b45309",
    border: "#b45309",
    icon: "!",
  },
};

// ─── Item individual ─────────────────────────────────────────────────────────
function ToastItem({ item, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Entrada
    const t1 = setTimeout(() => setVisible(true), 10);
    // Salida automática
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, item.duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [item.id, item.duration, onRemove]);

  const s = STYLES[item.type] ?? STYLES.info;

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(() => onRemove(item.id), 300); }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 10,
        background: s.bg,
        color: "#fff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 500,
        maxWidth: 360,
        wordBreak: "break-word",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(40px)",
        transition: "opacity 0.28s ease, transform 0.28s ease",
        userSelect: "none",
      }}
    >
      <span style={{
        flexShrink: 0,
        width: 22, height: 22,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.20)",
        fontWeight: 900,
        fontSize: 12,
      }}>
        {s.icon}
      </span>
      <span style={{ lineHeight: 1.45, paddingTop: 2 }}>{item.message}</span>
    </div>
  );
}

// ─── Contenedor global ───────────────────────────────────────────────────────
export function ToastContainer() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribe((item) => {
      setItems((prev) => [...prev, item]);
    });
  }, []);

  function remove(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (!items.length) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      pointerEvents: "none",
    }}>
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: "auto" }}>
          <ToastItem item={item} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
