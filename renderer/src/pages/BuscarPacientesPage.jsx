// src/pages/BuscarPacientesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import trashIcon from "../assets/trash.png";
import ComboSelect from "../components/ComboSelect";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../components/Toast";

/* =========================
   Helpers graduación (0.25)
========================= */
function normalizeQuarter(value) {
  const s = String(value ?? "").trim();
  if (s === "" || s === "-") return s;
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return "";
  const rounded = Math.round(n / 0.25) * 0.25;
  const result = (Math.round(rounded * 100) / 100).toFixed(2);
  return Number(result) > 0 ? "+" + result : result;
}

function stepQuarter(current, delta) {
  const s = String(current ?? "").trim();
  const base = s === "" || s === "-" ? 0 : Number(s.replace(",", "."));
  const safeBase = Number.isNaN(base) ? 0 : base;
  const next = safeBase + delta;
  const rounded = Math.round(next / 0.25) * 0.25;
  const result = (Math.round(rounded * 100) / 100).toFixed(2);
  return Number(result) > 0 ? "+" + result : result;
}

function toNumberOrNull(v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return n;
}

function toIntOrNull(v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isInteger(n)) return NaN;
  return n;
}

/* =========================
   Formatos AR
========================= */
function fmtThousandsInt(v) {
  if (v === null || v === undefined || v === "") return "-";
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return "-";
  const num = Number(digits);
  if (!Number.isFinite(num)) return String(v);
  return num.toLocaleString("es-AR");
}

function fmtNumberAR(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function formatDniInput(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (!d) return "";
  return Number(d).toLocaleString("es-AR");
}

function formatPhoneInput(value) {
  const d = onlyDigits(value).slice(0, 13);
  if (!d) return "";
  let rest = d;
  let prefix = "";
  if (rest.startsWith("54")) {
    prefix = "54 ";
    rest = rest.slice(2);
  }
  let area = rest.slice(0, 2);
  let num = rest.slice(2);
  const p1 = num.slice(0, 4);
  const p2 = num.slice(4, 8);
  const p3 = num.slice(8);
  let out = `${area}`;
  if (p1) out += ` ${p1}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += ` ${p3}`;
  return prefix + out.trim();
}

/* =========================
   WhatsApp WEB
========================= */
function buildWhatsAppWebUrl(rawPhone, rawName) {
  const name = String(rawName ?? "").trim();
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let d = digits;
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("54")) d = `54${d}`;
  const m = d.match(/^54(\d{2,4})15(\d{6,8})$/);
  if (m) d = `54${m[1]}${m[2]}`;
  const text = name ? `Hola ${name}!` : "Hola!";
  const msg = encodeURIComponent(text);
  return `https://web.whatsapp.com/send?phone=${d}&text=${msg}`;
}

const PATOLOGIAS = [
  "Cataratas", "Glaucoma", "Degeneración macular", "Retinopatía diabética",
  "Astigmatismo", "Miopía", "Hipermetropía", "Presbicia",
  "Ojo seco", "Conjuntivitis alérgica", "Queratocono", "Otro",
];

const VIDRIO_NINGUNO = "__ninguno__";

export default function BuscarPacientesPage() {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [vidrios, setVidrios] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [q, setQ] = useState("");
  const [resultsOpen, setResultsOpen] = useState(true);
  const searchRef = useRef(null);

  // EVOLUCIONES
  const [evoluciones, setEvoluciones] = useState([]);

  // ===== MODAL EVOLUCIÓN =====
  const [evoOpen, setEvoOpen] = useState(false);
  const [evoEditId, setEvoEditId] = useState(null);

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [evoFecha, setEvoFecha] = useState(todayISO);
  const [evoDistancia, setEvoDistancia] = useState("");
  const [evoOdEsf, setEvoOdEsf] = useState("");
  const [evoOdCil, setEvoOdCil] = useState("");
  const [evoOdEje, setEvoOdEje] = useState("");
  const [evoOiEsf, setEvoOiEsf] = useState("");
  const [evoOiCil, setEvoOiCil] = useState("");
  const [evoOiEje, setEvoOiEje] = useState("");
  const [evoTratamiento, setEvoTratamiento] = useState("");
  const [evoFormato, setEvoFormato] = useState("");
  const [evoDip, setEvoDip] = useState("");
  const [evoMontaje, setEvoMontaje] = useState("");
  const [evoVidrioId, setEvoVidrioId] = useState("");
  const [evoVidrioQuery, setEvoVidrioQuery] = useState("");
  const [evoVidrioOpen, setEvoVidrioOpen] = useState(false);
  const [evoFechaReceta, setEvoFechaReceta] = useState("");
  const [evoDoctor, setEvoDoctor] = useState("");
  const [evoPatologias, setEvoPatologias] = useState([]);
  const [evoPatologiaQuery, setEvoPatologiaQuery] = useState("");
  const [evoPatologiaOpen, setEvoPatologiaOpen] = useState(false);
  const [evoObs, setEvoObs] = useState("");

  const [evoErrors, setEvoErrors] = useState({
    fecha: "", distancia: "", odEsf: "", odCil: "", odEje: "",
    oiEsf: "", oiCil: "", oiEje: "", montaje: "", dip: "",
  });

  function clearEvoErr(key) {
    setEvoErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  // ===== MODAL CONFIRM DELETE =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  function openDeleteConfirm(row) {
    setConfirmError("");
    setToDelete(row);
    setConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (confirmLoading) return;
    setConfirmOpen(false);
    setToDelete(null);
    setConfirmError("");
  }

  function prettyDeleteError(err) {
    let msg = String(err?.message || err || "").trim();
    msg = msg.replace(/^Error invoking remote method '.*?':\s*/i, "").trim();
    msg = msg.replace(/^Error:\s*/i, "").trim();
    if (!msg) return "No se pudo eliminar la evolución.";
    return msg;
  }

  async function onConfirmDelete() {
    if (!toDelete?.id) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      await window.api.deleteEvolucion(toDelete.id);
      const data = await window.api.listEvoluciones(selectedId);
      setEvoluciones(Array.isArray(data) ? data : []);
      closeDeleteConfirm();
    } catch (e) {
      setConfirmError(prettyDeleteError(e));
    } finally {
      setConfirmLoading(false);
    }
  }

  // ===== MODAL EDICIÓN PACIENTE =====
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [eNombre, setENombre] = useState("");
  const [eDni, setEDni] = useState("");
  const [eDireccion, setEDireccion] = useState("");
  const [eTelefono, setETelefono] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eFechaNac, setEFechaNac] = useState("");
  const [eObraSocial, setEObraSocial] = useState("");

  const [eErrors, setEErrors] = useState({
    nombre: "", dni: "", telefono: "", fechaNac: "", email: "",
  });

  function clearEErr(key) {
    setEErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  function openEditModal() {
    if (!selected) return;
    setENombre(selected.nombre || "");
    setEDni(formatDniInput(selected.dni || ""));
    setEDireccion(selected.direccion || "");
    setETelefono(formatPhoneInput(selected.telefono || ""));
    setEEmail(selected.email || "");
    const d = selected.fechaNac ? new Date(selected.fechaNac) : null;
    const yyyy = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : "";
    const mm = d && !Number.isNaN(d.getTime()) ? String(d.getMonth() + 1).padStart(2, "0") : "";
    const dd = d && !Number.isNaN(d.getTime()) ? String(d.getDate()).padStart(2, "0") : "";
    setEFechaNac(yyyy ? `${yyyy}-${mm}-${dd}` : "");
    setEObraSocial(selected.obraSocial || "");
    setEErrors({ nombre: "", dni: "", telefono: "", fechaNac: "", email: "" });
    setEditOpen(true);
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditOpen(false);
  }

  async function load() {
    try {
      setLoading(true);
      const [data, v] = await Promise.all([
        window.api.listPatients(),
        window.api.listVidrios(),
      ]);
      setPatients(Array.isArray(data) ? data : []);
      setVidrios(Array.isArray(v) ? v : []);
    } catch (e) {
      toast.error(e?.message || "Error cargando pacientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Reset edición al cambiar paciente seleccionado
  useEffect(() => {
    if (!selected) return;
    setEErrors({ nombre: "", dni: "", telefono: "", fechaNac: "", email: "" });
  }, [selectedId]);

  const debouncedQ = useDebounce(q, 300);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return [];
    return patients.filter((p) => {
      const n = (p.nombre || "").toLowerCase();
      const d = String(p.dni || "").toLowerCase();
      return n.includes(term) || d.includes(term);
    });
  }, [debouncedQ, patients]);

  const { page: filteredPage, setPage: setFilteredPage, totalPages: filteredTotalPages, pageItems: filteredPageItems } = usePagination(filtered, 20);

  const selected = useMemo(() => {
    return patients.find((p) => p.id === selectedId) || null;
  }, [patients, selectedId]);

  // ── BUSCADOR VIDRIO (modal evo) ────────────────────────────────────────────
  const evoVidriosFiltrados = useMemo(() => {
    const term = evoVidrioQuery.trim().toLowerCase();
    if (!term) return vidrios;
    return vidrios.filter((v) => {
      const nombre = (v.nombre      || "").toLowerCase();
      const desc   = (v.descripcion || "").toLowerCase();
      return nombre.includes(term) || desc.includes(term);
    });
  }, [evoVidrioQuery, vidrios]);

  const evoVidrioSeleccionado = useMemo(
    () => (!evoVidrioId || evoVidrioId === VIDRIO_NINGUNO ? null : vidrios.find((v) => String(v.id) === String(evoVidrioId)) || null),
    [evoVidrioId, vidrios]
  );

  function selectEvoVidrio(v) {
    setEvoVidrioId(String(v.id));
    setEvoTratamiento(v.nombre);
    setEvoVidrioQuery(`${v.nombre}${v.descripcion ? ` — ${v.descripcion}` : ""}`);
    setEvoVidrioOpen(false);
  }

  function selectEvoVidrioNinguno() {
    setEvoVidrioId(VIDRIO_NINGUNO);
    setEvoTratamiento("Ninguno");
    setEvoVidrioQuery("Ninguno");
    setEvoVidrioOpen(false);
  }

  useEffect(() => {
    async function loadEvo() {
      if (!selectedId) { setEvoluciones([]); return; }
      try {
        const data = await window.api.listEvoluciones(selectedId);
        setEvoluciones(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setEvoluciones([]);
      }
    }
    loadEvo();
  }, [selectedId]);

  function selectPatient(p) {
    setSelectedId(p.id);
    setResultsOpen(false);
    setQ(`${p.nombre} (${fmtThousandsInt(p.dni)})`);
  }

  function changePatient() {
    setSelectedId(null);
    setResultsOpen(true);
    setQ("");
    setTimeout(() => searchRef.current?.focus?.(), 0);
  }

  function validateEdit() {
    const next = { nombre: "", dni: "", telefono: "", fechaNac: "", email: "" };
    if (!eNombre.trim()) next.nombre = "El nombre y apellido es obligatorio";
    const dniDigits = onlyDigits(eDni);
    if (!dniDigits) next.dni = "El DNI es obligatorio";
    else if (!/^\d{7,8}$/.test(dniDigits)) next.dni = "DNI inválido";
    const telDigits = onlyDigits(eTelefono);
    if (!telDigits) next.telefono = "El teléfono es obligatorio";
    else if (telDigits.length < 10) next.telefono = "Teléfono inválido";
    if (!eFechaNac) next.fechaNac = "La fecha de nacimiento es obligatoria";
    if (eEmail.trim()) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eEmail.trim());
      if (!ok) next.email = "Email inválido";
    }
    setEErrors(next);
    return Object.values(next).every((x) => !x);
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!selected) return;
    const ok = validateEdit();
    if (!ok) return;

    setEditSaving(true);
    try {
      await window.api.updatePatient({
        id: selected.id,
        nombre: eNombre.trim(),
        dni: onlyDigits(eDni),
        direccion: eDireccion.trim() || null,
        telefono: onlyDigits(eTelefono),
        email: eEmail.trim() || null,
        fechaNac: eFechaNac,
        obraSocial: eObraSocial,
      });
      toast.success("Paciente actualizado");
      setEditOpen(false);
      await load();
      setSelectedId(selected.id);
    } catch (err) {
      // Errores de validación estructurados (VALIDATION:{...})
      let msg = String(err?.message || err || "Error actualizando paciente").trim();
      msg = msg.replace(/^Error invoking remote method '[^']*':\s*/i, "").trim();
      msg = msg.replace(/^Error:\s*/i, "").trim();

      const valIdx = msg.indexOf("VALIDATION:");
      if (valIdx !== -1) {
        try {
          const fieldErrors = JSON.parse(msg.slice(valIdx + "VALIDATION:".length));
          setEErrors((p) => ({ ...p, ...fieldErrors }));
        } catch {
          setEErrors((p) => ({ ...p, nombre: msg }));
        }
      } else {
        const lower = msg.toLowerCase();
        if (lower.includes("unique constraint") || lower.includes("p2002")) {
          if (lower.includes("dni")) {
            setEErrors((p) => ({ ...p, dni: "Ya existe un paciente con ese DNI" }));
          } else {
            setEErrors((p) => ({ ...p, nombre: "Ya existe un registro con esos datos" }));
          }
        } else {
          setEErrors((p) => ({ ...p, nombre: msg || "Error actualizando paciente" }));
        }
      }
    } finally {
      setEditSaving(false);
    }
  }

  function fmtPlus(n) {
    if (n === null || n === undefined || n === "") return "-";
    const num = Number(n);
    if (Number.isNaN(num)) return "-";
    return num > 0 ? `+${num}` : `${num}`;
  }

  function fmtEje(v) {
    const n = Number(v);
    if (!Number.isInteger(n)) return "-";
    return String(n);
  }

  async function onContactPatient() {
    if (!selected) return;
    const url = buildWhatsAppWebUrl(selected.telefono, selected.nombre);
    if (!url) { toast.warn("Este paciente no tiene teléfono cargado."); return; }
    try {
      await window.api.openExternal(url);
    } catch (e) {
      toast.error(e?.message || "No se pudo abrir WhatsApp Web en el navegador.");
    }
  }

  function resetEvoNewFields() {
    setEvoMontaje(""); setEvoVidrioId(""); setEvoVidrioQuery(""); setEvoVidrioOpen(false);
    setEvoFechaReceta(""); setEvoDoctor(""); setEvoPatologias([]); setEvoPatologiaQuery(""); setEvoPatologiaOpen(false); setEvoObs("");
  }

  function openEvoModal() {
    setEvoEditId(null);
    if (!selectedId) return;
    const last = evoluciones?.[0];
    if (last) {
      setEvoDistancia(last.distancia ?? "");
      setEvoOdEsf(last.odEsf ?? "");
      setEvoOdCil(last.odCil ?? "");
      setEvoOdEje(last.odEje ?? "");
      setEvoOiEsf(last.oiEsf ?? "");
      setEvoOiCil(last.oiCil ?? "");
      setEvoOiEje(last.oiEje ?? "");
      setEvoTratamiento(last.tratamiento ?? "");
      setEvoVidrioId(""); setEvoVidrioQuery(last.tratamiento ?? "");
      setEvoFormato(last.formato ?? "");
      setEvoDip(last.dip ?? "");
      setEvoMontaje(last.montaje ?? "");
      setEvoFechaReceta(last.fechaReceta ?? ""); setEvoDoctor(last.doctor ?? "");
      setEvoPatologias(Array.isArray(last.patologias) ? last.patologias : []); setEvoPatologiaQuery(""); setEvoPatologiaOpen(false);
      setEvoObs(last.obs ?? "");
    } else {
      setEvoDistancia(""); setEvoOdEsf(""); setEvoOdCil(""); setEvoOdEje("");
      setEvoOiEsf(""); setEvoOiCil(""); setEvoOiEje("");
      setEvoTratamiento(""); setEvoFormato(""); setEvoDip("");
      resetEvoNewFields();
    }
    setEvoFecha(todayISO);
    setEvoErrors({ fecha: "", distancia: "", odEsf: "", odCil: "", odEje: "", oiEsf: "", oiCil: "", oiEje: "", montaje: "", dip: "" });
    setEvoOpen(true);
  }

  function openEditEvoModal(row) {
    if (!selectedId || !row) return;
    setEvoEditId(row.id);
    const d = row.fecha ? new Date(row.fecha) : null;
    const yyyy = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : "";
    const mm = d && !Number.isNaN(d.getTime()) ? String(d.getMonth() + 1).padStart(2, "0") : "";
    const dd = d && !Number.isNaN(d.getTime()) ? String(d.getDate()).padStart(2, "0") : "";
    setEvoFecha(yyyy ? `${yyyy}-${mm}-${dd}` : todayISO);
    setEvoDistancia(row.distancia ?? "");
    setEvoOdEsf(row.odEsf ?? ""); setEvoOdCil(row.odCil ?? ""); setEvoOdEje(row.odEje ?? "");
    setEvoOiEsf(row.oiEsf ?? ""); setEvoOiCil(row.oiCil ?? ""); setEvoOiEje(row.oiEje ?? "");
    setEvoTratamiento(row.tratamiento ?? ""); setEvoVidrioId(""); setEvoVidrioQuery(row.tratamiento ?? "");
    setEvoFormato(row.formato ?? ""); setEvoDip(row.dip ?? ""); setEvoMontaje(row.montaje ?? "");
    setEvoFechaReceta(row.fechaReceta ?? ""); setEvoDoctor(row.doctor ?? "");
    setEvoPatologias(Array.isArray(row.patologias) ? row.patologias : []); setEvoPatologiaQuery(""); setEvoPatologiaOpen(false);
    setEvoObs(row.obs ?? "");
    setEvoErrors({ fecha: "", distancia: "", odEsf: "", odCil: "", odEje: "", oiEsf: "", oiCil: "", oiEje: "", montaje: "", dip: "" });
    setEvoOpen(true);
  }

  function validateEvo() {
    const next = {
      fecha: "", distancia: "", odEsf: "", odCil: "", odEje: "",
      oiEsf: "", oiCil: "", oiEje: "", montaje: "", dip: "",
    };
    if (!evoFecha) next.fecha = "La fecha es obligatoria";
    if (!evoDistancia) next.distancia = "Seleccioná el uso";
    const odEsfN = toNumberOrNull(evoOdEsf);
    const odCilN = toNumberOrNull(evoOdCil);
    const oiEsfN = toNumberOrNull(evoOiEsf);
    const oiCilN = toNumberOrNull(evoOiCil);
    if (odEsfN !== null && Number.isNaN(odEsfN)) next.odEsf = "Esf OD inválido";
    if (odCilN !== null && Number.isNaN(odCilN)) next.odCil = "Cil OD inválido";
    if (oiEsfN !== null && Number.isNaN(oiEsfN)) next.oiEsf = "Esf OI inválido";
    if (oiCilN !== null && Number.isNaN(oiCilN)) next.oiCil = "Cil OI inválido";
    const odEjeN = toIntOrNull(evoOdEje);
    const oiEjeN = toIntOrNull(evoOiEje);
    if (odEjeN !== null && Number.isNaN(odEjeN)) next.odEje = "Eje OD inválido";
    if (oiEjeN !== null && Number.isNaN(oiEjeN)) next.oiEje = "Eje OI inválido";
    if (String(evoDip ?? "").trim() !== "") {
      const dipN = toNumberOrNull(evoDip);
      if (Number.isNaN(dipN)) next.dip = "DIP inválido";
    }
    setEvoErrors(next);
    return Object.values(next).every((x) => !x);
  }

  async function onSaveEvo(e) {
    e.preventDefault();
    if (!selectedId) return;
    const ok = validateEvo();
    if (!ok) return;
    try {
      const payload = {
        pacienteId: selectedId, fecha: evoFecha, distancia: evoDistancia,
        odEsf: String(evoOdEsf).replace(",", "."), odCil: String(evoOdCil).replace(",", "."), odEje: String(evoOdEje).trim(),
        oiEsf: String(evoOiEsf).replace(",", "."), oiCil: String(evoOiCil).replace(",", "."), oiEje: String(evoOiEje).trim(),
        tratamiento: evoTratamiento || null, formato: evoFormato || null, dip: String(evoDip).replace(",", ".") || null,
        montaje: evoMontaje || null,
        fechaReceta: evoFechaReceta || null, doctor: evoDoctor || null,
        patologias: evoPatologias.length ? evoPatologias : null,
        obs: evoObs || null,
      };
      if (evoEditId) {
        await window.api.updateEvolucion({ id: evoEditId, ...payload });
      } else {
        await window.api.addEvolucion(payload);
      }
      const data = await window.api.listEvoluciones(selectedId);
      setEvoluciones(Array.isArray(data) ? data : []);
      toast.success(evoEditId ? "Evolución actualizada" : "Evolución guardada");
      setEvoOpen(false);
      setEvoEditId(null);
    } catch (err) {
      toast.error(err?.message || "Error guardando evolución");
    }
  }

  return (
    <div className="page">
      <h2>Buscar paciente</h2>

      <section className="card">
        <div className="rowBetween">
          <h3>Buscar</h3>
          <div />
        </div>

        <div className="form" style={{ marginTop: 12 }}>
          <label className="field">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelectedId(null);
                setResultsOpen(true);
              }}
              placeholder="Ej: Luciano / 40.123.456"
            />
            <div className="fieldErrorSlot">{"\u00A0"}</div>
          </label>
        </div>

        {selected && !resultsOpen && (
          <div className="rowBetween" style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 900 }}>
              Seleccionado: {selected.nombre} (DNI {fmtThousandsInt(selected.dni) || "-"})
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn primary" type="button" onClick={onContactPatient} style={{ width: 220 }}>
                Contactar a paciente
              </button>
              <button className="btn" type="button" onClick={changePatient} style={{ width: 220 }}>
                Cambiar paciente
              </button>
            </div>
          </div>
        )}

        {resultsOpen && q.trim() !== "" && (
          <>
            {filtered.length === 0 ? (
              <div className="empty" style={{ marginTop: 14 }}>No se encontraron resultados.</div>
            ) : (
              <div className="table compact" style={{ marginTop: 15 }}>
                <div className="thead thead2">
                  <div>Paciente</div>
                  <div>DNI</div>
                </div>
                {filteredPageItems.map((p) => (
                  <div key={p.id} className="trow trow2" onClick={() => selectPatient(p)} style={{ cursor: "pointer" }}>
                    <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                    <div>{fmtThousandsInt(p.dni) || "-"}</div>
                  </div>
                ))}
                <Pagination page={filteredPage} totalPages={filteredTotalPages} onPage={setFilteredPage} />
              </div>
            )}
          </>
        )}

        {selected && (
          <div style={{ marginTop: 20 }}>
            <h3>Detalle del paciente</h3>

            <div className="detailGrid">
              <div className="detailItem">
                <div className="detailLabel">Nombre</div>
                <div className="detailValue">{selected.nombre}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">DNI</div>
                <div className="detailValue">{fmtThousandsInt(selected.dni) || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Dirección</div>
                <div className="detailValue">{selected.direccion || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Teléfono</div>
                <div className="detailValue">{formatPhoneInput(selected.telefono || "") || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Email</div>
                <div className="detailValue">{selected.email || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Obra Social</div>
                <div className="detailValue">{selected.obraSocial || "-"}</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }} className="rowBetween">
              <div />
              <button type="button" className="btn" onClick={openEditModal}>
                Editar
              </button>
            </div>

            {/* EVOLUCIÓN */}
            <div className="evoCard" style={{ marginTop: 16 }}>
              <div className="evoHeader">
                <div className="evoTitle">Evolución de la Refracción</div>
                <button type="button" className="btn evoAddBtn" onClick={openEvoModal} disabled={!selectedId}>
                  + Agregar
                </button>
              </div>

              <div className="evoTable">
                <div className="evoThead">
                  <div className="evoTh">Fecha</div>
                  <div className="evoTh">O.D</div>
                  <div className="evoTh">O.I</div>
                  <div className="evoTh">Lente</div>
                  <div className="evoTh">Acciones</div>
                </div>

                {evoluciones.length === 0 ? (
                  <div className="evoEmpty">Sin evolución cargada.</div>
                ) : (
                  evoluciones.map((row) => (
                    <div className="evoRow" key={row.id}>
                      <div className="evoDate">
                        {row.fecha ? new Date(row.fecha).toLocaleDateString() : "-"}
                        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginTop: 2 }}>
                          {row.distancia || "-"}
                        </div>
                      </div>
                      <div className="evoCell">
                        <div className="evoVal hi">Esf {fmtPlus(row.odEsf)}</div>
                        <div className="evoVal">Cil {fmtPlus(row.odCil)} · Eje {fmtEje(row.odEje)}</div>
                      </div>
                      <div className="evoCell">
                        <div className="evoVal hi">Esf {fmtPlus(row.oiEsf)}</div>
                        <div className="evoVal">Cil {fmtPlus(row.oiCil)} · Eje {fmtEje(row.oiEje)}</div>
                      </div>
                      <div className="evoCell">
                        <div className="evoVal muted">{row.tratamiento || "-"} / {row.formato || "-"}</div>
                        <div className="evoVal muted">DIP: {fmtNumberAR(row.dip)}</div>
                      </div>
                      <div className="evoActions">
                        <button type="button" className="btn" onClick={() => openEditEvoModal(row)}>Editar</button>
                        <button type="button" className="evoTrashBtn" onClick={() => openDeleteConfirm(row)} title="Eliminar">
                          <img src={trashIcon} alt="" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== MODAL EDITAR PACIENTE ===== */}
      {editOpen && (
        <div className="modalOverlay" onMouseDown={closeEditModal}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Editar paciente</div>
              <button type="button" className="modalClose" onClick={closeEditModal}>✕</button>
            </div>

            <form className="form" onSubmit={onSaveEdit}>
              <label className="field">
                <span>Nombre y apellido *</span>
                <input
                  className={eErrors.nombre ? "inputError" : ""}
                  value={eNombre}
                  onChange={(e) => { setENombre(e.target.value); clearEErr("nombre"); }}
                />
                <div className="fieldErrorSlot">{eErrors.nombre || "\u00A0"}</div>
              </label>

              <label className="field">
                <span>DNI *</span>
                <input
                  className={eErrors.dni ? "inputError" : ""}
                  value={eDni}
                  onChange={(e) => { setEDni(formatDniInput(e.target.value)); clearEErr("dni"); }}
                  onBlur={() => {
                    const cleaned = onlyDigits(eDni);
                    if (!cleaned) setEErrors((p) => ({ ...p, dni: "El DNI es obligatorio" }));
                    else if (!/^\d{7,8}$/.test(cleaned)) setEErrors((p) => ({ ...p, dni: "DNI inválido" }));
                    else setEDni(formatDniInput(cleaned));
                  }}
                  inputMode="numeric"
                  placeholder="Ej: 40.123.456"
                />
                <div className="fieldErrorSlot">{eErrors.dni || "\u00A0"}</div>
              </label>

              <div className="grid2">
                <label className="field">
                  <span>Teléfono *</span>
                  <input
                    className={eErrors.telefono ? "inputError" : ""}
                    value={eTelefono}
                    onChange={(e) => { setETelefono(formatPhoneInput(e.target.value)); clearEErr("telefono"); }}
                    onBlur={() => {
                      const cleaned = onlyDigits(eTelefono);
                      if (!cleaned) setEErrors((p) => ({ ...p, telefono: "El teléfono es obligatorio" }));
                      else if (cleaned.length < 10) setEErrors((p) => ({ ...p, telefono: "Teléfono inválido" }));
                      else setETelefono(formatPhoneInput(cleaned));
                    }}
                    inputMode="numeric"
                    placeholder="Ej: 11 1234 5678"
                  />
                  <div className="fieldErrorSlot">{eErrors.telefono || "\u00A0"}</div>
                </label>

                <label className="field">
                  <span>Email (opcional)</span>
                  <input
                    className={eErrors.email ? "inputError" : ""}
                    value={eEmail}
                    onChange={(e) => { setEEmail(e.target.value); clearEErr("email"); }}
                    placeholder="Ej: nombre@correo.com"
                  />
                  <div className="fieldErrorSlot">{eErrors.email || "\u00A0"}</div>
                </label>
              </div>

              <div className="grid2">
                <label className="field">
                  <span>Fecha de nacimiento *</span>
                  <input
                    type="date"
                    className={eErrors.fechaNac ? "inputError" : ""}
                    value={eFechaNac}
                    max={todayISO}
                    onChange={(e) => { setEFechaNac(e.target.value); clearEErr("fechaNac"); }}
                  />
                  <div className="fieldErrorSlot">{eErrors.fechaNac || "\u00A0"}</div>
                </label>

                <label className="field">
                  <span>Obra Social</span>
                  <input value={eObraSocial} onChange={(e) => setEObraSocial(e.target.value)} />
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>
              </div>

              <label className="field">
                <span>Dirección (opcional)</span>
                <input value={eDireccion} onChange={(e) => setEDireccion(e.target.value)} />
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </label>

              <div className="modalActions">
                <button type="button" className="btn" onClick={closeEditModal} disabled={editSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={editSaving}>
                  {editSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL EVOLUCIÓN ===== */}
      {evoOpen && (
        <div className="modalOverlay" onMouseDown={() => setEvoOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{evoEditId ? "Editar evolución" : "Agregar evolución"}</div>
              <button type="button" className="modalClose" onClick={() => setEvoOpen(false)}>✕</button>
            </div>

            <form className="form" onSubmit={onSaveEvo}>
              <div className="grid2">
                <label className="field">
                  <span>Fecha *</span>
                  <input
                    type="date" max={todayISO}
                    className={evoErrors.fecha ? "inputError" : ""}
                    value={evoFecha}
                    onChange={(e) => { setEvoFecha(e.target.value); clearEvoErr("fecha"); }}
                  />
                  <div className="fieldErrorSlot">{evoErrors.fecha || "\u00A0"}</div>
                </label>

                <label className="field">
                  <span>Uso *</span>
                  <ComboSelect
                    className={evoErrors.distancia ? "inputError" : ""}
                    value={evoDistancia}
                    onChange={(v) => { setEvoDistancia(v); clearEvoErr("distancia"); }}
                    options={[
                      { value: "", label: "Seleccionar..." },
                      { value: "LEJOS", label: "Lejos" },
                      { value: "CERCA", label: "Cerca" },
                      { value: "INTERMEDIA", label: "Intermedia" },
                      { value: "LENTE_CONTACTO", label: "Lente de contacto" },
                      { value: "SOL", label: "Sol" },
                    ]}
                  />
                  <div className="fieldErrorSlot">{evoErrors.distancia || "\u00A0"}</div>
                </label>
              </div>

              {/* ── GRADUACIÓN ── */}
              <div className="grid2" style={{ alignItems: "stretch" }}>
                <div className="card" style={{ padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px" }}>Ojo derecho (OD)</h4>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label className="field">
                      <span>Esférico</span>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => { setEvoOdEsf(stepQuarter(evoOdEsf, -0.25)); clearEvoErr("odEsf"); }}>-</button>
                        <input className={evoErrors.odEsf ? "inputError" : ""} value={evoOdEsf}
                          onChange={(e) => { setEvoOdEsf(e.target.value); clearEvoErr("odEsf"); }}
                          onBlur={() => { const s = String(evoOdEsf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setEvoErrors(p=>({...p,odEsf:"Esf OD inválido"})); else setEvoOdEsf(normalizeQuarter(evoOdEsf)); }}
                          placeholder="Ej: -1.25" inputMode="decimal" />
                        <button type="button" className="stepBtn" onClick={() => { setEvoOdEsf(stepQuarter(evoOdEsf, +0.25)); clearEvoErr("odEsf"); }}>+</button>
                      </div>
                      <div className="fieldErrorSlot">{evoErrors.odEsf || "\u00A0"}</div>
                    </label>
                    <label className="field">
                      <span>Cilíndrico</span>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => { setEvoOdCil(stepQuarter(evoOdCil, -0.25)); clearEvoErr("odCil"); }}>-</button>
                        <input className={evoErrors.odCil ? "inputError" : ""} value={evoOdCil}
                          onChange={(e) => { setEvoOdCil(e.target.value); clearEvoErr("odCil"); }}
                          onBlur={() => { const s = String(evoOdCil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setEvoErrors(p=>({...p,odCil:"Cil OD inválido"})); else setEvoOdCil(normalizeQuarter(evoOdCil)); }}
                          placeholder="Ej: -0.50" inputMode="decimal" />
                        <button type="button" className="stepBtn" onClick={() => { setEvoOdCil(stepQuarter(evoOdCil, +0.25)); clearEvoErr("odCil"); }}>+</button>
                      </div>
                      <div className="fieldErrorSlot">{evoErrors.odCil || "\u00A0"}</div>
                    </label>
                  </div>
                  <label className="field">
                    <span>Eje (-360 a 360)</span>
                    <input className={evoErrors.odEje ? "inputError" : ""} value={evoOdEje}
                      onChange={(e) => { setEvoOdEje(e.target.value); clearEvoErr("odEje"); }}
                      placeholder="Ej: 90" inputMode="numeric" />
                    <div className="fieldErrorSlot">{evoErrors.odEje || "\u00A0"}</div>
                  </label>
                </div>

                <div className="card" style={{ padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px" }}>Ojo izquierdo (OI)</h4>
                  <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label className="field">
                      <span>Esférico</span>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => { setEvoOiEsf(stepQuarter(evoOiEsf, -0.25)); clearEvoErr("oiEsf"); }}>-</button>
                        <input className={evoErrors.oiEsf ? "inputError" : ""} value={evoOiEsf}
                          onChange={(e) => { setEvoOiEsf(e.target.value); clearEvoErr("oiEsf"); }}
                          onBlur={() => { const s = String(evoOiEsf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setEvoErrors(p=>({...p,oiEsf:"Esf OI inválido"})); else setEvoOiEsf(normalizeQuarter(evoOiEsf)); }}
                          placeholder="Ej: -1.00" inputMode="decimal" />
                        <button type="button" className="stepBtn" onClick={() => { setEvoOiEsf(stepQuarter(evoOiEsf, +0.25)); clearEvoErr("oiEsf"); }}>+</button>
                      </div>
                      <div className="fieldErrorSlot">{evoErrors.oiEsf || "\u00A0"}</div>
                    </label>
                    <label className="field">
                      <span>Cilíndrico</span>
                      <div className="stepper">
                        <button type="button" className="stepBtn" onClick={() => { setEvoOiCil(stepQuarter(evoOiCil, -0.25)); clearEvoErr("oiCil"); }}>-</button>
                        <input className={evoErrors.oiCil ? "inputError" : ""} value={evoOiCil}
                          onChange={(e) => { setEvoOiCil(e.target.value); clearEvoErr("oiCil"); }}
                          onBlur={() => { const s = String(evoOiCil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setEvoErrors(p=>({...p,oiCil:"Cil OI inválido"})); else setEvoOiCil(normalizeQuarter(evoOiCil)); }}
                          placeholder="Ej: -0.75" inputMode="decimal" />
                        <button type="button" className="stepBtn" onClick={() => { setEvoOiCil(stepQuarter(evoOiCil, +0.25)); clearEvoErr("oiCil"); }}>+</button>
                      </div>
                      <div className="fieldErrorSlot">{evoErrors.oiCil || "\u00A0"}</div>
                    </label>
                  </div>
                  <label className="field">
                    <span>Eje (-360 a 360)</span>
                    <input className={evoErrors.oiEje ? "inputError" : ""} value={evoOiEje}
                      onChange={(e) => { setEvoOiEje(e.target.value); clearEvoErr("oiEje"); }}
                      placeholder="Ej: 80" inputMode="numeric" />
                    <div className="fieldErrorSlot">{evoErrors.oiEje || "\u00A0"}</div>
                  </label>
                </div>
              </div>

              {/* ── LENTE + MÉDICO ── */}
              <div className="grid2" style={{ alignItems: "stretch" }}>
                <div className="card" style={{ padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px" }}>Opciones de lente</h4>

                  <div className="grid2">
                    <label className="field" style={{ position: "relative" }}>
                      <span>Color / Vidrio</span>
                      <input
                        value={
                          evoVidrioOpen
                            ? evoVidrioQuery
                            : evoVidrioId === VIDRIO_NINGUNO
                            ? "Ninguno"
                            : evoVidrioSeleccionado
                            ? `${evoVidrioSeleccionado.nombre}${evoVidrioSeleccionado.descripcion ? ` — ${evoVidrioSeleccionado.descripcion}` : ""}`
                            : evoVidrioQuery
                        }
                        placeholder="Escribí para buscar..."
                        onFocus={() => setEvoVidrioOpen(true)}
                        onChange={(e) => {
                          setEvoVidrioQuery(e.target.value);
                          setEvoVidrioId("");
                          setEvoTratamiento("");
                          setEvoVidrioOpen(true);
                        }}
                        onBlur={() => setTimeout(() => setEvoVidrioOpen(false), 120)}
                      />
                      {evoVidrioOpen && (
                        <div className="comboDropdown" style={{ maxHeight: 220, overflowY: "auto" }}>
                          <button type="button" className="comboItem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={selectEvoVidrioNinguno}
                            style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <div style={{ fontWeight: 900, opacity: 0.55 }}>— Ninguno —</div>
                          </button>
                          {evoVidriosFiltrados.length === 0
                            ? <div className="comboEmpty">Sin resultados</div>
                            : evoVidriosFiltrados.map((v) => (
                              <button type="button" key={v.id} className="comboItem"
                                onMouseDown={(e) => e.preventDefault()} onClick={() => selectEvoVidrio(v)}>
                                <div style={{ fontWeight: 900 }}>{v.nombre}</div>
                                <div style={{ opacity: 0.75, fontSize: 12 }}>{v.descripcion || "\u00A0"}</div>
                              </button>
                            ))
                          }
                        </div>
                      )}
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>

                    <label className="field">
                      <span>Montaje</span>
                      <ComboSelect
                        className={evoErrors.montaje ? "inputError" : ""}
                        value={evoMontaje}
                        onChange={(v) => { setEvoMontaje(v); clearEvoErr("montaje"); }}
                        options={[
                          { value: "", label: "Seleccionar..." },
                          { value: "NINGUNO", label: "Ninguno" },
                          { value: "CAL", label: "Calibrado Común (CAL)" },
                          { value: "RANURA", label: "Ranurado (RANURA)" },
                          { value: "PERFORADO", label: "Perforado" },
                        ]}
                      />
                      <div className="fieldErrorSlot">{evoErrors.montaje || "\u00A0"}</div>
                    </label>
                  </div>

                  <div className="grid2">
                    <label className="field">
                      <span>Formato</span>
                      <ComboSelect
                        value={evoFormato}
                        onChange={(v) => setEvoFormato(v)}
                        options={[
                          { value: "", label: "Seleccionar..." },
                          { value: "NINGUNO", label: "Ninguno" },
                          { value: "MONOFOCAL", label: "Monofocal" },
                          { value: "CONTACTO", label: "Lentes de contacto" },
                          { value: "BIFOCAL", label: "Bifocal" },
                          { value: "MULTIFOCAL", label: "Multifocal" },
                        ]}
                      />
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>

                    <label className="field">
                      <span>DIP (opcional)</span>
                      <input className={evoErrors.dip ? "inputError" : ""} value={evoDip}
                        onChange={(e) => { setEvoDip(e.target.value); clearEvoErr("dip"); }}
                        placeholder="Ej: 62" inputMode="decimal" />
                      <div className="fieldErrorSlot">{evoErrors.dip || "\u00A0"}</div>
                    </label>
                  </div>
                </div>

                <div className="card" style={{ padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px" }}>Datos médicos</h4>
                  <div className="grid2">
                    <label className="field">
                      <span>Doctor (opcional)</span>
                      <input value={evoDoctor} onChange={(e) => setEvoDoctor(e.target.value)} />
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>

                    <label className="field">
                      <span>Observaciones (opcional)</span>
                      <input value={evoObs} onChange={(e) => setEvoObs(e.target.value)} />
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>

                    <label className="field" style={{ position: "relative" }}>
                      <span>Patología (opcional)</span>
                      <div onClick={() => setEvoPatologiaOpen((o) => !o)} style={{
                        width: "100%", height: 42, padding: "0 12px", borderRadius: 12,
                        border: evoPatologiaOpen ? "1px solid rgba(85,201,154,0.9)" : "1px solid var(--border)",
                        boxShadow: evoPatologiaOpen ? "0 0 0 4px rgba(122,216,176,0.25)" : "none",
                        background: "var(--input-bg)", cursor: "pointer", display: "flex", flexWrap: "nowrap",
                        alignItems: "center", gap: 4, userSelect: "none", boxSizing: "border-box", overflow: "hidden",
                      }}>
                        {evoPatologias.length === 0
                          ? <span style={{ opacity: 0.45, fontSize: 13 }}>Seleccionar...</span>
                          : <span style={{ fontSize: 13, fontWeight: 700 }}>{evoPatologias.join(", ")}</span>
                        }
                        <span style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4, fontSize: 11 }}>{evoPatologiaOpen ? "▲" : "▼"}</span>
                      </div>
                      {evoPatologiaOpen && (
                        <div className="comboDropdown" style={{ padding: 0, overflow: "hidden", position: "absolute", bottom: "100%", top: "auto", left: 0, right: 0, zIndex: 999, marginBottom: 4 }}
                          onMouseDown={(e) => e.preventDefault()}>
                          <div style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <input autoFocus value={evoPatologiaQuery} onChange={(e) => setEvoPatologiaQuery(e.target.value)}
                              placeholder="Escribí para buscar..."
                              style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent", padding: "2px 4px" }} />
                          </div>
                          <div style={{ maxHeight: 160, overflowY: "auto" }}>
                            {PATOLOGIAS.filter((p) => p.toLowerCase().includes(evoPatologiaQuery.toLowerCase())).map((p) => {
                              const checked = evoPatologias.includes(p);
                              return (
                                <label key={p} style={{
                                  display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                                  cursor: "pointer", background: checked ? "rgba(37,99,235,0.07)" : "transparent",
                                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                                }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={() => setEvoPatologias((prev) => checked ? prev.filter((x) => x !== p) : [...prev, p])}
                                    style={{ accentColor: "var(--color-primary, #2563eb)", width: 15, height: 15 }} />
                                  <span style={{ fontSize: 13, fontWeight: checked ? 800 : 500 }}>{p}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modalActions">
                <button type="button" className="btn" onClick={() => setEvoOpen(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL CONFIRM DELETE ===== */}
      {confirmOpen && (
        <div className="modalOverlay" onMouseDown={closeDeleteConfirm}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button className="modalClose" onClick={closeDeleteConfirm}>✕</button>
            </div>

            <div style={{ fontWeight: 800 }}>
              ¿Querés eliminar esta evolución?
              <div style={{ marginTop: 8, color: "rgba(15,23,42,0.75)" }}>
                {toDelete?.fecha ? new Date(toDelete.fecha).toLocaleDateString() : "-"}
                {" — "}
                OD Esf {fmtPlus(toDelete?.odEsf)} Cil {fmtPlus(toDelete?.odCil)} Eje {fmtEje(toDelete?.odEje)}
                {" / "}
                OI Esf {fmtPlus(toDelete?.oiEsf)} Cil {fmtPlus(toDelete?.oiCil)} Eje {fmtEje(toDelete?.oiEje)}
                {" — "}
                {(toDelete?.tratamiento || "-")} / {(toDelete?.formato || "-")}
                {" — "}DIP {fmtNumberAR(toDelete?.dip)}
              </div>
            </div>

            {confirmError && (
              <div className="fieldErrorSlot" style={{ marginTop: 12 }}>{confirmError}</div>
            )}

            <div className="modalActions">
              <button className="btn" onClick={closeDeleteConfirm}>Cancelar</button>
              <button className="btn danger" onClick={onConfirmDelete} disabled={confirmLoading}>
                {confirmLoading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}