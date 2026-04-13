import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../components/Toast";

// ── helpers ────────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function toISOTime(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function addMonths(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

const MES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const ESTADOS = [
  { value: "pendiente",  label: "Pendiente",  color: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.30)" },
  { value: "confirmado", label: "Confirmado", color: "#0b7a55", bg: "rgba(85,201,154,0.12)",  border: "rgba(85,201,154,0.35)"  },
  { value: "atendido",   label: "Atendido",   color: "#1d4ed8", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.30)"  },
  { value: "cancelado",  label: "Cancelado",  color: "#b91c1c", bg: "rgba(217,54,62,0.10)",   border: "rgba(217,54,62,0.25)"   },
];
function estadoInfo(e) { return ESTADOS.find((x) => x.value === e) ?? ESTADOS[0]; }

const TIPOS_CONSULTA = [
  { value: "control",  label: "Control",         duracion: 15 },
  { value: "consulta", label: "Consulta",         duracion: 30 },
  { value: "examen",   label: "Examen visual",    duracion: 45 },
  { value: "entrega",  label: "Entrega",          duracion: 15 },
  { value: "primera",  label: "Primera visita",   duracion: 60 },
];

const TIME_SLOTS = (() => {
  const s = [];
  for (let h = 8; h < 20; h++)
    for (let m = 0; m < 60; m += 15)
      s.push(`${pad2(h)}:${pad2(m)}`);
  s.push("20:00");
  return s;
})();

function snapToSlot(hora) {
  if (TIME_SLOTS.includes(hora)) return hora;
  const [h, m] = hora.split(":").map(Number);
  const snapped = Math.round((h * 60 + m) / 15) * 15;
  const sh = Math.min(20, Math.max(8, Math.floor(snapped / 60)));
  const candidate = `${pad2(sh)}:${pad2(snapped % 60)}`;
  return TIME_SLOTS.includes(candidate) ? candidate : "09:00";
}

const EMPTY_FORM = {
  fecha: "", hora: "09:00", duracion: 30,
  nombrePaciente: "", telefono: "", motivo: "", notas: "",
  estado: "pendiente", pacienteId: null,
};

export default function TurnosPage() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayISO = toISODate(today);

  const [ym,           setYm]           = useState({ year: today.getFullYear(), monthIndex: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [monthTurnos,  setMonthTurnos]  = useState([]);
  const [dayTurnos,    setDayTurnos]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  // toasts via sistema global

  const [modalOpen,  setModalOpen]  = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [fieldErrs,  setFieldErrs]  = useState({ fecha: "", hora: "", nombrePaciente: "" });
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const [pacSearch,  setPacSearch]  = useState("");
  const [pacResults, setPacResults] = useState([]);


  // ── carga ──────────────────────────────────────────────────────────────────
  const loadMonth = useCallback(async (year, monthIndex) => {
    try {
      const rows = await window.api.listTurnosByMonth({ year, month: monthIndex + 1 });
      setMonthTurnos(Array.isArray(rows) ? rows : []);
    } catch { setMonthTurnos([]); }
  }, []);

  const loadDay = useCallback(async (iso) => {
    setLoading(true);
    try {
      const rows = await window.api.listTurnosByDate(iso);
      setDayTurnos(Array.isArray(rows) ? rows : []);
    } catch { setDayTurnos([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMonth(ym.year, ym.monthIndex); }, [ym, loadMonth]);
  useEffect(() => { loadDay(selectedDate); }, [selectedDate, loadDay]);

  async function refresh() {
    await Promise.all([loadMonth(ym.year, ym.monthIndex), loadDay(selectedDate)]);
  }

  // ── dots/conteo por fecha ─────────────────────────────────────────────────
  const countByDate = useMemo(() => {
    const map = new Map();
    for (const t of monthTurnos) {
      const iso = toISODate(new Date(t.fecha));
      map.set(iso, (map.get(iso) || 0) + 1);
    }
    return map;
  }, [monthTurnos]);

  // ── grilla del calendario (mismo algoritmo que HomePage) ─────────────────
  const gridDays = useMemo(() => {
    const first   = new Date(ym.year, ym.monthIndex, 1);
    const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const days    = [];
    for (let i = leading; i > 0; i--) {
      const d = new Date(first); d.setDate(d.getDate() - i);
      days.push({ date: d, inMonth: false });
    }
    const lastDay = new Date(ym.year, ym.monthIndex + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++)
      days.push({ date: new Date(ym.year, ym.monthIndex, day), inMonth: true });
    while (days.length % 7 !== 0) {
      const prev = days[days.length - 1].date;
      const next = new Date(prev); next.setDate(next.getDate() + 1);
      days.push({ date: next, inMonth: false });
    }
    return days;
  }, [ym]);

  const monthLabel = useMemo(() => `${MES[ym.monthIndex]} ${ym.year}`, [ym]);

  // ── modal ─────────────────────────────────────────────────────────────────
  function openNew(iso) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, fecha: iso ?? selectedDate });
    setFieldErrs({ fecha: "", hora: "", nombrePaciente: "" });
    setPacSearch(""); setPacResults([]);
    setModalOpen(true);
  }

  function openEdit(t) {
    const d = new Date(t.fecha);
    setEditingId(t.id);
    setForm({
      fecha:          toISODate(d),
      hora:           snapToSlot(toISOTime(d)),
      duracion:       t.duracion ?? 30,
      nombrePaciente: t.nombrePaciente ?? t.paciente?.nombre ?? "",
      telefono:       t.telefono ?? "",
      motivo:         t.motivo  ?? "",
      notas:          t.notas   ?? "",
      estado:         t.estado  ?? "pendiente",
      pacienteId:     t.pacienteId ?? null,
    });
    setFieldErrs({ fecha: "", hora: "", nombrePaciente: "" });
    setPacSearch(""); setPacResults([]);
    setModalOpen(true);
  }

  async function onSave() {
    const errs = { fecha: "", hora: "", nombrePaciente: "" };
    if (!form.fecha)                 errs.fecha          = "Seleccioná una fecha.";
    if (!form.hora)                  errs.hora           = "Seleccioná una hora.";
    if (!form.nombrePaciente.trim()) errs.nombrePaciente = "Ingresá el nombre del paciente.";
    if (errs.fecha || errs.hora || errs.nombrePaciente) { setFieldErrs(errs); return; }

    const payload = {
      fecha:          `${form.fecha}T${form.hora}:00`,
      duracion:       form.duracion,
      nombrePaciente: form.nombrePaciente.trim(),
      telefono:       form.telefono.trim(),
      motivo:         form.motivo.trim(),
      notas:          form.notas.trim(),
      estado:         form.estado,
      pacienteId:     form.pacienteId,
    };
    setSaving(true);
    try {
      if (editingId) await window.api.updateTurno({ id: editingId, ...payload });
      else           await window.api.createTurno(payload);
      setModalOpen(false);
      await refresh();
      toast.success(editingId ? "Turno actualizado" : "Turno creado");
    } catch { toast.error("Error guardando turno"); }
    finally { setSaving(false); }
  }

  async function onEstado(t, estado) {
    try {
      if (estado === "atendido") {
        await window.api.deleteTurno(t.id);
        await refresh();
        toast.success("Turno atendido y eliminado");
      } else {
        await window.api.updateTurnoEstado({ id: t.id, estado });
        await refresh();
      }
    } catch { toast.error("Error actualizando estado"); }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await window.api.deleteTurno(confirmDel.id);
      setConfirmDel(null);
      await refresh();
      toast.success("Turno eliminado");
    } catch { toast.error("Error eliminando turno"); }
  }

  // ── búsqueda de pacientes ─────────────────────────────────────────────────
  useEffect(() => {
    if (!pacSearch.trim()) { setPacResults([]); return; }
    const t = window.setTimeout(async () => {
      try {
        const pacs = await window.api.listPatients();
        const term = pacSearch.toLowerCase();
        setPacResults(
          (Array.isArray(pacs) ? pacs : [])
            .filter((p) => `${p.nombre} ${p.dni ?? ""}`.toLowerCase().includes(term))
            .slice(0, 6)
        );
      } catch { setPacResults([]); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [pacSearch]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Turnos</h1>
          <div className="pageHint">Agenda de citas y consultas.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 16, alignItems: "stretch" }}>

        {/* ── Calendario ── */}
        <section className="card">
          {/* encabezado */}
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{monthLabel}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="button" onClick={() => setYm((p) => addMonths(p.year, p.monthIndex, -1))}>◀</button>
              <button className="btn" type="button" onClick={() => { setYm({ year: today.getFullYear(), monthIndex: today.getMonth() }); setSelectedDate(todayISO); }}>Hoy</button>
              <button className="btn" type="button" onClick={() => setYm((p) => addMonths(p.year, p.monthIndex, +1))}>▶</button>
            </div>
          </div>

          {/* días de la semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {DIAS.map((d) => (
              <div key={d} style={{ fontSize: 11, fontWeight: 900, opacity: 0.6, textAlign: "center", padding: "4px 0" }}>{d}</div>
            ))}

            {/* celdas */}
            {gridDays.map(({ date, inMonth }) => {
              const iso    = toISODate(date);
              const isSel  = iso === selectedDate;
              const isToday = iso === todayISO;
              const count  = countByDate.get(iso) || 0;
              return (
                <button key={iso} type="button" onClick={() => setSelectedDate(iso)} style={{
                  width: "100%", aspectRatio: "1 / 1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", fontWeight: 900, fontSize: 13,
                  borderRadius: 10, cursor: "pointer", padding: 0,
                  border: isSel
                    ? "1px solid rgba(85,201,154,0.55)"
                    : isToday
                    ? "1px solid rgba(85,201,154,0.30)"
                    : "1px solid transparent",
                  background: isSel
                    ? "rgba(122,216,176,0.28)"
                    : isToday
                    ? "rgba(122,216,176,0.10)"
                    : "transparent",
                  opacity: inMonth ? 1 : 0.35,
                }}>
                  {date.getDate()}
                  {count > 0 && (
                    <div style={{
                      position: "absolute", top: 3, right: 3,
                      width: 14, height: 14, borderRadius: 999,
                      fontSize: 9, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(85,201,154,0.55)",
                      border: "1px solid rgba(85,201,154,0.7)",
                      color: "#083126",
                    }}>
                      {count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* leyenda */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            {ESTADOS.map((e) => (
              <div key={e.value} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, opacity: 0.7 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color }} />
                {e.label}
              </div>
            ))}
          </div>

          <div className="hint" style={{ marginTop: 10 }}>
            Elegí un día para ver los turnos agendados.
          </div>
        </section>

        {/* ── Panel del día ── */}
        <section className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="rowBetween" style={{ marginBottom: 12, flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <button className="btnPrimary" onClick={() => openNew(selectedDate)}>+ Nuevo turno</button>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.5, fontSize: 13 }}>Cargando...</div>
          ) : dayTurnos.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ opacity: 0.4, fontSize: 13 }}>No hay turnos para este día.</div>
              <button className="btnSmall" onClick={() => openNew(selectedDate)}>Agendar turno</button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, alignContent: "start", overflowY: "auto", flex: 1 }}>
              {dayTurnos.map((t) => {
                const ei     = estadoInfo(t.estado);
                const hora   = new Date(t.fecha);
                const nombre = t.nombrePaciente || t.paciente?.nombre || "—";
                return (
                  <div key={t.id} className="card" style={{
                    padding: "12px 16px",
                    borderLeft: `3px solid ${ei.color}`,
                    opacity: t.estado === "cancelado" ? 0.55 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: ei.color, marginBottom: 3 }}>
                          {toISOTime(hora)} hs · {t.duracion} min
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nombre}
                        </div>
                        {t.motivo   && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{t.motivo}</div>}
                        {t.telefono && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>📞 {t.telefono}</div>}
                        {t.notas    && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2, fontStyle: "italic" }}>{t.notas}</div>}
                      </div>
                      <span style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 900, padding: "3px 9px",
                        borderRadius: 999, background: ei.bg, color: ei.color, border: `1px solid ${ei.border}`,
                      }}>
                        {ei.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {t.estado !== "atendido" && t.estado !== "cancelado" && (
                        <button className="btnSmall" style={{ background: "rgba(59,130,246,0.10)", color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.25)" }}
                          onClick={() => onEstado(t, "atendido")}>Atendido</button>
                      )}
                      {t.estado === "pendiente" && (
                        <button className="btnSmall" style={{ background: "rgba(85,201,154,0.10)", color: "#0b7a55", border: "1px solid rgba(85,201,154,0.30)" }}
                          onClick={() => onEstado(t, "confirmado")}>Confirmar</button>
                      )}
                      {t.estado !== "cancelado" && (
                        <button className="btnSmall" style={{ background: "rgba(217,54,62,0.08)", color: "#b91c1c", border: "1px solid rgba(217,54,62,0.22)" }}
                          onClick={() => onEstado(t, "cancelado")}>Cancelar</button>
                      )}
                      <button className="btnSmall" onClick={() => openEdit(t)}>Editar</button>
                      <button className="btnSmall" style={{ background: "rgba(217,54,62,0.08)", color: "#b91c1c", border: "1px solid rgba(217,54,62,0.22)" }}
                        onClick={() => setConfirmDel(t)}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Modal nuevo / editar turno ── */}
      {modalOpen && (
        <div className="modalOverlay" onMouseDown={() => setModalOpen(false)}>
          <div className="modalCard" style={{ maxWidth: 700, width: "92vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{editingId ? "Editar turno" : "Nuevo turno"}</div>
              <button className="modalClose" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {/* layout 2 columnas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

              {/* Fecha */}
              <div className="field">
                <label>Fecha *</label>
                <input type="date" className={`input${fieldErrs.fecha ? " inputError" : ""}`}
                  value={form.fecha}
                  onChange={(e) => { setForm((p) => ({ ...p, fecha: e.target.value })); if (fieldErrs.fecha) setFieldErrs((p) => ({ ...p, fecha: "" })); }}
                />
                <div className="fieldErrorSlot">{fieldErrs.fecha}</div>
              </div>

              {/* Hora */}
              <div className="field">
                <label>Hora *</label>
                <select
                  className={`input${fieldErrs.hora ? " inputError" : ""}`}
                  value={form.hora}
                  onChange={(e) => { setForm((p) => ({ ...p, hora: e.target.value })); if (fieldErrs.hora) setFieldErrs((p) => ({ ...p, hora: "" })); }}
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>{s} hs</option>
                  ))}
                </select>
                <div className="fieldErrorSlot">{fieldErrs.hora}</div>
              </div>

              {/* Tipo de consulta — ocupa las 2 columnas */}
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Tipo de consulta</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TIPOS_CONSULTA.map((t) => (
                    <button key={t.value} type="button"
                      className={`pillBtn${form.motivo === t.label ? " active" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, motivo: t.label, duracion: t.duracion }))}>
                      {t.label} · {t.duracion} min
                    </button>
                  ))}
                </div>
                {form.motivo && (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 5 }}>
                    Duración: <strong>{form.duracion} min</strong>
                  </div>
                )}
              </div>

              {/* Paciente — ocupa las 2 columnas con dropdown */}
              <div className="field" style={{ gridColumn: "1/-1", position: "relative" }}>
                <label>Paciente *</label>
                <input
                  className={`input${fieldErrs.nombrePaciente ? " inputError" : ""}`}
                  value={form.nombrePaciente}
                  placeholder="Nombre o buscar paciente registrado..."
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((p) => ({ ...p, nombrePaciente: v, pacienteId: null }));
                    setPacSearch(v);
                    if (fieldErrs.nombrePaciente) setFieldErrs((p) => ({ ...p, nombrePaciente: "" }));
                  }}
                />
                <div className="fieldErrorSlot">{fieldErrs.nombrePaciente}</div>
                {pacResults.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 10, boxShadow: "var(--shadow)", marginTop: 2,
                  }}>
                    {pacResults.map((p) => (
                      <button key={p.id} type="button" style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "9px 14px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 13,
                      }}
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, nombrePaciente: p.nombre, pacienteId: p.id, telefono: f.telefono || (p.telefono ?? "") }));
                          setPacSearch(""); setPacResults([]);
                        }}>
                        <span style={{ fontWeight: 900 }}>{p.nombre}</span>
                        {p.dni && <span style={{ opacity: 0.55, marginLeft: 8, fontSize: 12 }}>DNI {p.dni}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Teléfono */}
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Teléfono</label>
                <input className="input" value={form.telefono}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Opcional..." />
              </div>

              {/* Notas — ocupa las 2 columnas */}
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Notas internas</label>
                <input className="input" value={form.notas}
                  onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                  placeholder="Opcional..." />
              </div>

              {/* Estado — solo en edición, ocupa las 2 columnas */}
              {editingId && (
                <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label>Estado</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ESTADOS.map((e) => (
                      <button key={e.value} type="button"
                        className={`pillBtn${form.estado === e.value ? " active" : ""}`}
                        onClick={() => setForm((p) => ({ ...p, estado: e.value }))}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="provFormActions" style={{ marginTop: 20 }}>
              <button className="btnGhost" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="btnPrimary" onClick={onSave} disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ── */}
      {confirmDel && (
        <div className="modalOverlay" onMouseDown={() => setConfirmDel(null)}>
          <div className="modalCard" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Eliminar turno</div>
              <button className="modalClose" onClick={() => setConfirmDel(null)}>✕</button>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14 }}>
              ¿Eliminás el turno de <strong>{confirmDel.nombrePaciente || confirmDel.paciente?.nombre}</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btnGhost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btnDangerSmall" onClick={onDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* toasts manejados globalmente por ToastContainer en App.jsx */}
    </div>
  );
}
