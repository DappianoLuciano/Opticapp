// src/pages/PacientesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import ComboSelect from "../components/ComboSelect";
import { toast } from "../components/Toast";

const OBRAS_SOCIALES_DEFAULT = [
  "Particular",
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Sancor Salud",
  "Medicus",
  "Omint",
  "Accord Salud",
  "IOMA",
  "PAMI",
  "Prevención Salud",
];

const OBRAS_SOCIALES_LS_KEY = "optica_obras_sociales_v1";
const OTHER_VALUE = "__other__";

// ── Dominios de email sugeridos ──────────────────────────────────────────────
const EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com"];

function normalizeOS(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function digitsOnly(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function formatThousandsDotsFromDigits(digits) {
  const s = digitsOnly(digits);
  if (!s) return "";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDniDisplay(dniDigits) {
  return formatThousandsDotsFromDigits(dniDigits);
}

function formatPhoneDisplay(phoneDigits) {
  const s = digitsOnly(phoneDigits);
  if (!s) return "";
  if (s.length <= 2) return s;
  return `${s.slice(0, 2)} ${s.slice(2)}`;
}

// ── EmailInput con sugerencias de dominio ────────────────────────────────────
function EmailInput({ value, onChange, onBlur, hasError }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const wrapRef = useRef(null);

  // Recalcula sugerencias cada vez que cambia el valor
  useEffect(() => {
    const atIdx = value.indexOf("@");
    if (atIdx === -1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const afterAt = value.slice(atIdx + 1).toLowerCase();

    const filtered = afterAt
      ? EMAIL_DOMAINS.filter((d) => d.startsWith(afterAt))
      : EMAIL_DOMAINS;

    setSuggestions(filtered);
    setOpen(filtered.length > 0);
    setActiveSuggestion(-1);
  }, [value]);

  // Cierra el dropdown si se hace click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(domain) {
    const atIdx = value.indexOf("@");
    const base = atIdx !== -1 ? value.slice(0, atIdx) : value;
    onChange(`${base}@${domain}`);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className={hasError ? "inputError" : ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder="Ej: nombre@gmail.com"
        autoComplete="off"
      />

      {open && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          }}
        >
          {suggestions.map((domain, idx) => {
            const atIdx = value.indexOf("@");
            const base = atIdx !== -1 ? value.slice(0, atIdx) : value;
            const full = `${base}@${domain}`;

            return (
              <li
                key={domain}
                onMouseDown={(e) => {
                  e.preventDefault(); // evita que el input pierda foco antes del click
                  handleSelect(domain);
                }}
                style={{
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                  background: idx === activeSuggestion ? "var(--border)" : "transparent",
                  color: "var(--text)",
                }}
                onMouseEnter={() => setActiveSuggestion(idx)}
              >
                {full}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function PacientesPage() {
  // FORM CREAR PACIENTE
  const [nombre, setNombre] = useState("");
  const [dniDigits, setDniDigits] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefonoDigits, setTelefonoDigits] = useState("");
  const [email, setEmail] = useState("");
  const [fechaNac, setFechaNac] = useState("");

  // Obra Social
  const [osList, setOsList] = useState([]);
  const [obraSocialSel, setObraSocialSel] = useState("Particular");
  const [obraSocialOtro, setObraSocialOtro] = useState("");

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Cargar lista de OS desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OBRAS_SOCIALES_LS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;

      const base = Array.isArray(parsed) && parsed.length ? parsed : OBRAS_SOCIALES_DEFAULT;

      const uniq = [];
      for (const x of base) {
        const v = normalizeOS(x);
        if (!v) continue;
        if (!uniq.some((u) => u.toLowerCase() === v.toLowerCase())) uniq.push(v);
      }
      uniq.sort((a, b) => a.localeCompare(b, "es"));

      setOsList(uniq);
    } catch {
      const fallback = [...OBRAS_SOCIALES_DEFAULT].sort((a, b) => a.localeCompare(b, "es"));
      setOsList(fallback);
    }
  }, []);

  function persistOsList(nextList) {
    try {
      localStorage.setItem(OBRAS_SOCIALES_LS_KEY, JSON.stringify(nextList));
    } catch {
      // ignore
    }
  }

  // ERRORES
  const [pErrors, setPErrors] = useState({
    nombre: "",
    dni: "",
    telefono: "",
    fechaNac: "",
    email: "",
  });

  function clearPErr(key) {
    setPErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  function validatePacienteForm() {
    const next = { nombre: "", dni: "", telefono: "", fechaNac: "", email: "" };

    if (!nombre.trim()) next.nombre = "El nombre y apellido es obligatorio";

    const dni = digitsOnly(dniDigits);
    if (dni && !/^\d{7,8}$/.test(dni)) next.dni = "DNI inválido";

    const tel = digitsOnly(telefonoDigits);
    if (!tel) next.telefono = "El teléfono es obligatorio";
    else if (tel.length < 8) next.telefono = "Teléfono inválido";

    if (email.trim()) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!ok) next.email = "Email inválido";
    }

    setPErrors(next);
    return !next.nombre && !next.dni && !next.telefono && !next.email;
  }

  async function onCreate(e) {
    e.preventDefault();

    const ok = validatePacienteForm();
    if (!ok) return;

    // Resolver obra social final
    let obraSocialFinal = null;

    if (obraSocialSel === OTHER_VALUE) {
      const v = normalizeOS(obraSocialOtro);
      obraSocialFinal = v || null;

      if (v) {
        const exists = osList.some((x) => x.toLowerCase() === v.toLowerCase());
        if (!exists) {
          const nextList = [...osList, v].sort((a, b) => a.localeCompare(b, "es"));
          setOsList(nextList);
          persistOsList(nextList);
        }
      }
    } else {
      const v = normalizeOS(obraSocialSel);
      obraSocialFinal = v || null;
    }

    try {
      await window.api.createPatient({
        nombre: nombre.trim(),
        dni: digitsOnly(dniDigits),
        direccion: direccion.trim() || null,
        telefono: digitsOnly(telefonoDigits),
        email: email.trim() || null,
        fechaNac,
        obraSocial: obraSocialFinal,
      });

      toast.success("Paciente creado correctamente");
      setNombre("");
      setDniDigits("");
      setDireccion("");
      setTelefonoDigits("");
      setEmail("");
      setFechaNac("");
      setObraSocialSel("Particular");
      setObraSocialOtro("");
      setPErrors({ nombre: "", dni: "", telefono: "", fechaNac: "", email: "" });
    } catch (err) {
      let msg = String(err?.message || err || "Error creando paciente").trim();
      msg = msg.replace(/^Error invoking remote method '[^']*':\s*/i, "").trim();
      msg = msg.replace(/^Error:\s*/i, "").trim();

      const valIdx = msg.indexOf("VALIDATION:");
      if (valIdx !== -1) {
        try {
          const fieldErrors = JSON.parse(msg.slice(valIdx + "VALIDATION:".length));
          setPErrors((p) => ({ ...p, ...fieldErrors }));
          return;
        } catch {
          // si falla el parse, cae al manejo genérico
        }
      }

      const lower = msg.toLowerCase();
      if (lower.includes("unique constraint") || lower.includes("p2002")) {
        if (lower.includes("dni")) {
          setPErrors((p) => ({ ...p, dni: "Ya existe un paciente con ese DNI" }));
          return;
        }
        setPErrors((p) => ({ ...p, nombre: "Ya existe un registro con esos datos" }));
        return;
      }

      setPErrors((p) => ({ ...p, nombre: msg || "Error creando paciente" }));
    }
  }

  const dniDisplay = useMemo(() => formatDniDisplay(dniDigits), [dniDigits]);
  const telDisplay = useMemo(() => formatPhoneDisplay(telefonoDigits), [telefonoDigits]);

  return (
    <div className="page">
      <h2>Pacientes</h2>

      <section className="card">
        <h3>Crear paciente</h3>

        <form onSubmit={onCreate} className="form" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Nombre y apellido *</span>
            <input
              className={pErrors.nombre ? "inputError" : ""}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                clearPErr("nombre");
              }}
              onBlur={() => {
                if (!nombre.trim())
                  setPErrors((p) => ({ ...p, nombre: "El nombre y apellido es obligatorio" }));
              }}
            />
            <div className="fieldErrorSlot">{pErrors.nombre || "\u00A0"}</div>
          </label>

          <label className="field">
            <span>DNI</span>
            <input
              className={pErrors.dni ? "inputError" : ""}
              value={dniDisplay}
              onChange={(e) => {
                const v = digitsOnly(e.target.value);
                setDniDigits(v.slice(0, 8));
                clearPErr("dni");
              }}
              onBlur={() => {
                const dni = digitsOnly(dniDigits);
                if (dni && !/^\d{7,8}$/.test(dni)) setPErrors((p) => ({ ...p, dni: "DNI inválido" }));
              }}
              inputMode="numeric"
              placeholder="Ej: 40.123.456"
            />
            <div className="fieldErrorSlot">{pErrors.dni || "\u00A0"}</div>
          </label>

          <label className="field">
            <span>Dirección</span>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <div className="fieldErrorSlot">{"\u00A0"}</div>
          </label>

          <div className="grid2">
            <label className="field">
              <span>Teléfono *</span>
              <input
                className={pErrors.telefono ? "inputError" : ""}
                value={telDisplay}
                onChange={(e) => {
                  const v = digitsOnly(e.target.value);
                  setTelefonoDigits(v.slice(0, 14));
                  clearPErr("telefono");
                }}
                onBlur={() => {
                  const tel = digitsOnly(telefonoDigits);
                  if (!tel) setPErrors((p) => ({ ...p, telefono: "El teléfono es obligatorio" }));
                  else if (tel.length < 8) setPErrors((p) => ({ ...p, telefono: "Teléfono inválido" }));
                }}
                inputMode="numeric"
                placeholder="Ej: 11 23456789"
              />
              <div className="fieldErrorSlot">{pErrors.telefono || "\u00A0"}</div>
            </label>

            {/* ── Email con sugerencias de dominio ── */}
            <div className="field">
              <span>Email (opcional)</span>
              <EmailInput
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  clearPErr("email");
                }}
                onBlur={() => {
                  if (!email.trim()) return;
                  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
                  if (!ok) setPErrors((p) => ({ ...p, email: "Email inválido" }));
                }}
                hasError={!!pErrors.email}
              />
              <div className="fieldErrorSlot">{pErrors.email || "\u00A0"}</div>
            </div>
          </div>

          <div className="grid2">
            <label className="field">
              <span>Fecha de nacimiento</span>
              <input
                type="date"
                max={todayISO}
                className={pErrors.fechaNac ? "inputError" : ""}
                value={fechaNac}
                onChange={(e) => {
                  setFechaNac(e.target.value);
                  clearPErr("fechaNac");
                }}
              />
              <div className="fieldErrorSlot">{pErrors.fechaNac || "\u00A0"}</div>
            </label>

            <div className="field">
              <span>Obra Social</span>

              <ComboSelect
                value={obraSocialSel}
                onChange={(v) => {
                  setObraSocialSel(v);
                  if (v !== OTHER_VALUE) setObraSocialOtro("");
                }}
                placeholder="— Seleccionar —"
                options={[
                  { value: "", label: "— Seleccionar —" },
                  ...osList.map((os) => ({ value: os, label: os })),
                  { value: OTHER_VALUE, label: "Otro..." },
                ]}
              />

              {obraSocialSel === OTHER_VALUE && (
                <input
                  style={{ marginTop: 8 }}
                  value={obraSocialOtro}
                  onChange={(e) => setObraSocialOtro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="Escribí la obra social"
                />
              )}

              <div className="fieldErrorSlot">{"\u00A0"}</div>
            </div>
          </div>

          <button className="btn primary" type="submit">
            Guardar
          </button>
        </form>
      </section>
    </div>
  );
}