import { useState } from "react";

export default function ActivationPage({ onActivated }) {
  const [code, setCode]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleActivate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await window.api.activateLicense(code.trim());
      if (result.success) {
        onActivated();
      } else {
        setError(result.message || "Código inválido");
      }
    } catch {
      setError("Error al verificar el código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>OpticApp</div>
        <p style={styles.subtitle}>Versión de prueba</p>

        <p style={styles.description}>
          Ingresá el código de activación para usar la aplicación
          hasta el <strong>13 de abril de 2026</strong>.
        </p>

        <form onSubmit={handleActivate} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Código de activación"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            disabled={loading}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            style={styles.button}
            disabled={loading || !code.trim()}
          >
            {loading ? "Verificando..." : "Activar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function BlockedPage() {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>OpticApp</div>
        <p style={styles.subtitle}>Período de prueba finalizado</p>
        <p style={styles.description}>
          El período de prueba venció el <strong>13 de abril de 2026</strong>.
          <br />
          Para continuar usando la aplicación, contactá al soporte.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg, #f6f7f8)",
  },
  card: {
    background: "var(--card, #ffffff)",
    border: "1px solid var(--border, rgba(15,23,42,0.10))",
    boxShadow: "var(--shadow, 0 10px 30px rgba(2,6,23,0.08))",
    borderRadius: 16,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 400,
    textAlign: "center",
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    color: "var(--sidebar, #0c5a55)",
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "var(--muted, rgba(15,23,42,0.65))",
    margin: "0 0 24px",
  },
  description: {
    fontSize: 14,
    color: "var(--text, #0f172a)",
    lineHeight: 1.6,
    margin: "0 0 28px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: "10px 14px",
    fontSize: 15,
    border: "1px solid var(--border, rgba(15,23,42,0.15))",
    borderRadius: 8,
    background: "var(--input-bg, #ffffff)",
    color: "var(--text, #0f172a)",
    outline: "none",
    textAlign: "center",
    letterSpacing: "0.05em",
  },
  error: {
    color: "#e53e3e",
    fontSize: 13,
    margin: 0,
  },
  button: {
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 700,
    background: "var(--sidebar, #0c5a55)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 4,
    opacity: 1,
  },
};
