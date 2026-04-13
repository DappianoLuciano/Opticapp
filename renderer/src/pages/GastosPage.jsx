import { useEffect, useMemo, useState } from "react";
import ComboSelect from "../components/ComboSelect";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../components/Toast";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

function money(n) {
  return (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("es-AR");
}
function fmtDate(dt) {
  if (!dt) return "-";
  const iso = String(dt).slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-AR");
}
function onlyDigits(v) { return String(v ?? "").replace(/\D/g, ""); }

const COLORES = ["#7ad8b0","#60A5FA","#A78BFA","#FBBF24","#F472B6","#2DD4BF","#FB923C","#94A3B8"];
const COLOR_SIN_CAT = "#d1d5db";

const FRECUENCIA_OPTS = [
  { label: "Mensual",     value: 1 },
  { label: "Bimensual",   value: 2 },
  { label: "Trimestral",  value: 3 },
  { label: "Semestral",   value: 6 },
  { label: "Anual",       value: 12 },
];

const EMPTY_GASTO = {
  descripcion: "", monto: "", categoriaId: "", recurrente: false,
  frecuenciaMeses: 1, fechaVenc: "", obs: "",
  codigoCliente: "", numeroPago: "",
};

function ChartTooltipPie({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      <div style={{ color: p.payload.fill ?? p.color, fontWeight: 600 }}>${money(p.value)}</div>
    </div>
  );
}

function TortaChart({ datos }) {
  const total = useMemo(() => datos.reduce((a, d) => a + d.monto, 0), [datos]);
  if (datos.length === 0 || total === 0) return null;

  const data = datos.map((d) => ({ ...d, value: d.monto }));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flexShrink: 0 }}>
        <ResponsiveContainer width={170} height={170}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={72} innerRadius={36}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipPie />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
        {datos.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ fontWeight: 900, whiteSpace: "nowrap", color: "var(--text)" }}>${money(d.monto)}</span>
            <span style={{ opacity: 0.55, fontSize: 12 }}>({Math.round((d.monto / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GastosPage() {
  const api = window.api;

  const [loading,    setLoading]    = useState(false);
  const [gastos,     setGastos]     = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [err,        setErr]        = useState("");

  const [filtroTab, setFiltroTab] = useState("pendientes");
  const [q,         setQ]         = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [openForm,  setOpenForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(EMPTY_GASTO);
  const [formErr,   setFormErr]   = useState("");
  const [fieldErrs, setFieldErrs] = useState({ descripcion: "", monto: "" });

  // ── modal confirmar pago ──────────────────────────────────────────────────
  const [pagarModalOpen,  setPagarModalOpen]  = useState(false);
  const [pagarTarget,     setPagarTarget]     = useState(null);
  const [montoProximo,    setMontoProximo]    = useState("");
  const [pagoDetalles,    setPagoDetalles]    = useState([{ medioPago: "EFECTIVO", monto: "" }]);
  const [cuentasSaldos,   setCuentasSaldos]  = useState([]);
  const [pagarErr,        setPagarErr]        = useState("");

  // ── modal confirmar eliminación ──────────────────────────────────────────
  const [confirmDelete,   setConfirmDelete]   = useState(null); // { id, tipo: "gasto"|"categoria", label }



  const [openCat,   setOpenCat]   = useState(false);
  const [catNombre, setCatNombre] = useState("");
  const [catColor,  setCatColor]  = useState(COLORES[0]);
  const [catErr,    setCatErr]    = useState("");

  async function loadAll() {
    setLoading(true); setErr("");
    try {
      const [g, c] = await Promise.all([api.listGastos({}), api.listCategoriasGasto()]);
      setGastos(Array.isArray(g) ? g : []);
      setCategorias(Array.isArray(c) ? c : []);
    } catch(e) { toast.error(String(e?.message || e || "Error cargando gastos")); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    let list = gastos;
    if (filtroTab === "pendientes") list = list.filter((g) => {
      if (g.pagado) return false;
      if (!g.fechaVenc) return true;
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const venc = new Date(g.fechaVenc); venc.setHours(0, 0, 0, 0);
      return Math.round((venc - hoy) / 86400000) <= 7;
    });
    if (filtroTab === "pagados")    list = list.filter((g) =>  g.pagado);
    const needle = debouncedQ.trim().toLowerCase();
    if (needle) list = list.filter((g) =>
      `${g.descripcion} ${g.categoria?.nombre ?? ""}`.toLowerCase().includes(needle)
    );
    return list;
  }, [gastos, filtroTab, debouncedQ]);

  const totalPendiente = useMemo(() => gastos.filter((g) => {
    if (g.pagado) return false;
    if (!g.fechaVenc) return true;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const venc = new Date(g.fechaVenc); venc.setHours(0, 0, 0, 0);
    return Math.round((venc - hoy) / 86400000) <= 7;
  }).reduce((a, g) => a + g.monto, 0), [gastos]);
  const totalPagado    = useMemo(() => gastos.filter((g) =>  g.pagado).reduce((a, g) => a + g.monto, 0), [gastos]);

  const tortaRecurrentes = useMemo(() => {
    const lista = gastos.filter((g) => g.recurrente && !g.pagado);
    if (!lista.length) return [];
    const map = new Map();
    for (const g of lista) {
      const key   = g.categoriaId ?? "sin";
      const cat   = categorias.find((c) => c.id === g.categoriaId);
      const label = cat?.nombre ?? "Sin categoría";
      const color = cat?.color  ?? COLOR_SIN_CAT;
      if (!map.has(key)) map.set(key, { label, monto: 0, color });
      map.get(key).monto += g.monto;
    }
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [gastos, categorias]);

  const tortaOcasionales = useMemo(() => {
    const ahora = new Date();
    const lista = gastos.filter((g) => {
      if (g.recurrente) return false;
      const fecha = new Date(g.createdAt);
      return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    });
    if (!lista.length) return [];
    const map = new Map();
    for (const g of lista) {
      const key   = g.categoriaId ?? "sin";
      const cat   = categorias.find((c) => c.id === g.categoriaId);
      const label = cat?.nombre ?? "Sin categoría";
      const color = cat?.color  ?? COLOR_SIN_CAT;
      if (!map.has(key)) map.set(key, { label, monto: 0, color });
      map.get(key).monto += g.monto;
    }
    return Array.from(map.values()).sort((a, b) => b.monto - a.monto);
  }, [gastos, categorias]);

  function openNew() {
    setEditingId(null); setForm(EMPTY_GASTO); setFormErr(""); setFieldErrs({ descripcion: "", monto: "" }); setOpenForm(true);
  }

  function openEdit(g) {
    setEditingId(g.id);
    setForm({
      descripcion:     g.descripcion,
      monto:           String(g.monto),
      categoriaId:     String(g.categoriaId ?? ""),
      recurrente:      g.recurrente,
      frecuenciaMeses: g.frecuenciaMeses ?? 1,
      fechaVenc:       g.fechaVenc ? new Date(g.fechaVenc).toISOString().slice(0, 10) : "",
      obs:             g.obs ?? "",
      codigoCliente:   g.codigoCliente ?? "",
      numeroPago:      g.numeroPago ?? "",
    });
    setFormErr(""); setFieldErrs({ descripcion: "", monto: "" }); setOpenForm(true);
  }

  async function onSaveGasto() {
    const errs = { descripcion: "", monto: "" };
    if (!form.descripcion.trim()) errs.descripcion = "La descripción es requerida.";
    const n = Number(String(form.monto).replace(/\./g,"").replace(",","."));
    if (!Number.isFinite(n) || n <= 0) errs.monto = "Ingresá un monto válido.";
    if (errs.descripcion || errs.monto) { setFieldErrs(errs); return; }
    setFieldErrs({ descripcion: "", monto: "" }); setFormErr("");
    setLoading(true);
    try {
      const payload = {
        ...form, monto: Math.round(n),
        categoriaId:     form.categoriaId ? Number(form.categoriaId) : null,
        frecuenciaMeses: form.recurrente ? Number(form.frecuenciaMeses || 1) : null,
        fechaVenc:       form.fechaVenc || null,
      };
      if (editingId) await api.updateGasto({ id: editingId, ...payload });
      else           await api.createGasto(payload);
      toast.success(editingId ? "Gasto actualizado" : "Gasto creado");
      setOpenForm(false); setEditingId(null); setForm(EMPTY_GASTO);
      await loadAll();
    } catch(e) { toast.error(String(e?.message || e || "Error guardando gasto")); }
    finally { setLoading(false); }
  }

  // ── Pagar: si es recurrente abre modal para confirmar monto próximo ───────
  async function handlePagar(g) {
    setPagoDetalles([{ medioPago: "EFECTIVO", monto: String(g.monto) }]);
    setMontoProximo(String(g.monto));
    setPagarTarget(g);
    setPagarErr("");
    setPagarModalOpen(true);
    try { setCuentasSaldos(await api.getCajaSaldos()); } catch { setCuentasSaldos([]); }
  }

  async function onMarkPagado(id, montoProx, detallesPago) {
    setLoading(true);
    try {
      await api.markGastoPagado({ id, montoProximo: montoProx, detallesPago: detallesPago || [] });
      toast.success("Gasto marcado como pagado");
      await loadAll();
    } catch(e) { toast.error(String(e?.message || e || "Error al marcar como pagado")); }
    finally { setLoading(false); }
  }

  async function confirmarPago() {
    const detallesPago = pagoDetalles
      .map(d => ({ medioPago: d.medioPago, monto: Math.round(Number(String(d.monto).replace(/\./g,"").replace(",",".")) || 0) }))
      .filter(d => d.monto > 0 && d.medioPago);
    if (!detallesPago.length) { setPagarErr("Especificá al menos un medio de pago."); return; }
    const totalIngresado = detallesPago.reduce((a, d) => a + d.monto, 0);
    if (totalIngresado < pagarTarget.monto) {
      setPagarErr(`El total ingresado ($${money(totalIngresado)}) es menor al monto del gasto ($${money(pagarTarget.monto)}).`);
      return;
    }
    setPagarErr("");
    const n = Number(String(montoProximo).replace(/\./g,"").replace(",","."));
    const montoProx = (pagarTarget?.recurrente && pagarTarget?.fechaVenc && Number.isFinite(n) && n > 0) ? Math.round(n) : null;
    const target = pagarTarget;
    setPagarModalOpen(false);
    setPagarTarget(null);
    setMontoProximo("");
    setPagoDetalles([{ medioPago: "EFECTIVO", monto: "" }]);
    await onMarkPagado(target.id, montoProx, detallesPago);
  }

  // ── NUEVO: volver a pendiente ─────────────────────────────────────────────
  async function onMarkPendiente(id) {
    setLoading(true);
    try { await api.markGastoPendiente(id); toast.info("Gasto vuelto a pendiente"); await loadAll(); }
    catch(e) { toast.error(String(e?.message || e || "Error")); }
    finally { setLoading(false); }
  }

  async function onDeleteGasto(id, label) {
    setConfirmDelete({ id, tipo: "gasto", label });
  }

  async function doDeleteGasto() {
    const id = confirmDelete?.id;
    setConfirmDelete(null);
    setLoading(true);
    try { await api.deleteGasto(id); toast.success("Gasto eliminado"); await loadAll(); }
    catch(e) { toast.error(String(e?.message || e || "Error eliminando gasto")); }
    finally { setLoading(false); }
  }

  async function onSaveCat() {
    setCatErr("");
    if (!catNombre.trim()) return setCatErr("Falta el nombre.");
    setLoading(true);
    try {
      await api.createCategoriaGasto({ nombre: catNombre.trim(), color: catColor });
      toast.success("Categoría creada");
      setCatNombre(""); setCatColor(COLORES[0]); setOpenCat(false);
      await loadAll();
    } catch(e) { toast.error(String(e?.message || e || "Error creando categoría")); }
    finally { setLoading(false); }
  }

  async function onDeleteCat(id, nombre) {
    setConfirmDelete({ id, tipo: "categoria", label: nombre });
  }

  async function doDeleteCat() {
    const id = confirmDelete?.id;
    setConfirmDelete(null);
    setLoading(true);
    try { await api.deleteCategoriaGasto(id); toast.success("Categoría eliminada"); await loadAll(); }
    catch(e) { toast.error(String(e?.message || e || "Error eliminando categoría")); }
    finally { setLoading(false); }
  }

  function diasHasta(fechaVenc) {
    if (!fechaVenc) return null;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const venc = new Date(fechaVenc); venc.setHours(0,0,0,0);
    return Math.round((venc - hoy) / 86400000);
  }

  function vencBadge(dias) {
    if (dias === null) return null;
    if (dias < 0)   return { label: `Venció hace ${Math.abs(dias)}d`, bg: "rgba(255,77,77,0.12)",   color: "#b91c1c", border: "rgba(255,77,77,0.35)" };
    if (dias === 0) return { label: "Vence hoy",                      bg: "rgba(255,183,77,0.18)",  color: "#8a4b00", border: "rgba(255,183,77,0.45)" };
    if (dias <= 7)  return { label: `${dias}d`,                       bg: "rgba(255,183,77,0.18)",  color: "#8a4b00", border: "rgba(255,183,77,0.45)" };
    if (dias <= 30) return { label: `${dias}d`,                       bg: "rgba(122,216,176,0.15)", color: "#0b7a55", border: "rgba(85,201,154,0.35)" };
    return             { label: `${dias}d`,                           bg: "rgba(15,23,42,0.05)",    color: "var(--muted)", border: "rgba(15,23,42,0.10)" };
  }

  // Calcula la próxima fecha de vencimiento para mostrar en el modal
  const proxFechaLabel = useMemo(() => {
    if (!pagarTarget?.fechaVenc) return null;
    const meses = Number(pagarTarget.frecuenciaMeses) || 1;
    const d = new Date(pagarTarget.fechaVenc);
    d.setMonth(d.getMonth() + meses);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }, [pagarTarget]);

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Gastos</h1>
          <div className="pageHint">Gastos operativos, impuestos, servicios y empleados.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btnGhost" onClick={() => setOpenCat((v) => !v)}>
            {openCat ? "Cerrar categorías" : "Categorías"}
          </button>
<button className="btnPrimary" onClick={openNew}>Nuevo gasto</button>
        </div>
      </div>

      {err ? <div className="formError" style={{ marginBottom: 12 }}>{err}</div> : null}

      {/* KPIs + torta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, alignItems: "start" }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", marginBottom: 6 }}>PENDIENTE DE PAGO</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#d9363e" }}>${money(totalPendiente)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", marginBottom: 6 }}>TOTAL PAGADO</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0b7a55" }}>${money(totalPagado)}</div>
        </div>
      </div>

      {/* Categorías */}
      {openCat && (
        <div className="card provCard" style={{ marginBottom: 14 }}>
          <div className="provCardTitle">Categorías</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {categorias.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px", background: "var(--card)", fontSize: 13, fontWeight: 800 }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: c.color }} />
                {c.nombre}
                <button style={{ border: "none", background: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 900, fontSize: 14, padding: 0 }}
                  onClick={() => onDeleteCat(c.id, c.nombre)}>✕</button>
              </div>
            ))}
            {categorias.length === 0 && <div className="empty">Sin categorías aún.</div>}
          </div>
          {catErr ? <div className="formError" style={{ marginBottom: 8 }}>{catErr}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>Nombre</label>
              <input className="input" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej: Empleados" />
            </div>
            <div className="field">
              <label>Color</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COLORES.map((c) => (
                  <button key={c} type="button" onClick={() => setCatColor(c)} style={{ width: 28, height: 28, borderRadius: 999, background: c, border: catColor === c ? "3px solid #0b3a2f" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <button className="btnPrimary" style={{ alignSelf: "flex-end" }} onClick={onSaveCat} disabled={loading}>Agregar categoría</button>
          </div>
        </div>
      )}

      {/* Modal form gasto */}
      {openForm && (
        <div className="modalOverlay" onMouseDown={() => setOpenForm(false)}>
          <div className="modalCard" style={{ maxWidth: 540 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{editingId ? "Editar gasto" : "Nuevo gasto"}</div>
              <button className="modalClose" onClick={() => setOpenForm(false)}>✕</button>
            </div>
            {formErr ? <div className="formError" style={{ marginBottom: 10 }}>{formErr}</div> : null}
            <div className="provFormGrid" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", paddingRight: 4 }}>
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Descripción *</label>
                <input
                  className={`input${fieldErrs.descripcion ? " inputError" : ""}`}
                  value={form.descripcion}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, descripcion: e.target.value }));
                    if (fieldErrs.descripcion) setFieldErrs((p) => ({ ...p, descripcion: "" }));
                  }}
                  placeholder="Ej: Sueldo Julio, Monotributo, Alquiler..."
                />
                <div className="fieldErrorSlot">{fieldErrs.descripcion}</div>
              </div>
              <div className="field">
                <label>Monto *</label>
                <input
                  className={`input${fieldErrs.monto ? " inputError" : ""}`}
                  value={form.monto ? Number(form.monto).toLocaleString("es-AR") : ""}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, monto: onlyDigits(e.target.value) }));
                    if (fieldErrs.monto) setFieldErrs((p) => ({ ...p, monto: "" }));
                  }}
                  placeholder="Ej: 150.000"
                />
                <div className="fieldErrorSlot">{fieldErrs.monto}</div>
              </div>
              <div className="field">
                <label>Categoría</label>
                <ComboSelect
                  value={form.categoriaId}
                  onChange={(v) => setForm((p) => ({ ...p, categoriaId: v }))}
                  placeholder="— Sin categoría —"
                  options={[
                    { value: "", label: "— Sin categoría —" },
                    ...categorias.map((c) => ({ value: String(c.id), label: c.nombre })),
                  ]}
                />
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </div>
              <div className="field">
                <label>Fecha de vencimiento</label>
                <input type="date" className="input" value={form.fechaVenc}
                  onChange={(e) => setForm((p) => ({ ...p, fechaVenc: e.target.value }))} />
              </div>
              <div className="field">
                <label>Tipo</label>
                <div className="provToggleRow">
                  <button type="button" className={`pillBtn ${!form.recurrente ? "active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, recurrente: false }))}>Único</button>
                  <button type="button" className={`pillBtn ${form.recurrente ? "active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, recurrente: true }))}>Recurrente</button>
                </div>
              </div>

              {/* ── NUEVO: frecuencia solo si es recurrente ── */}
              {form.recurrente && (
                <div className="field">
                  <label>Frecuencia</label>
                  <div className="provToggleRow" style={{ flexWrap: "wrap" }}>
                    {FRECUENCIA_OPTS.map((o) => (
                      <button key={o.value} type="button"
                        className={`pillBtn ${form.frecuenciaMeses === o.value ? "active" : ""}`}
                        onClick={() => setForm((p) => ({ ...p, frecuenciaMeses: o.value }))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Observaciones</label>
                <input className="input" value={form.obs}
                  onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))}
                  placeholder="Opcional..." />
              </div>
              <div className="field">
                <label>Código de cliente</label>
                <input className="input" value={form.codigoCliente}
                  onChange={(e) => setForm((p) => ({ ...p, codigoCliente: e.target.value }))}
                  placeholder="Opcional..." />
              </div>
              <div className="field">
                <label>Número de pago</label>
                <input className="input" value={form.numeroPago}
                  onChange={(e) => setForm((p) => ({ ...p, numeroPago: e.target.value }))}
                  placeholder="Opcional..." />
              </div>
            </div>
            <div className="provFormActions">
              <button className="btnGhost" onClick={() => setOpenForm(false)} disabled={loading}>Cancelar</button>
              <button className="btnPrimary" onClick={onSaveGasto} disabled={loading}>
                {editingId ? "Guardar cambios" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── modal confirmar pago ── */}
      {pagarModalOpen && pagarTarget && (
        <div className="modalOverlay" onMouseDown={() => { setPagarModalOpen(false); setPagarTarget(null); setPagarErr(""); }}>
          <div className="modalCard" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar pago</div>
              <button className="modalClose" onClick={() => { setPagarModalOpen(false); setPagarTarget(null); setPagarErr(""); }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{pagarTarget.descripcion}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Total: ${money(pagarTarget.monto)}
                {pagarTarget.recurrente && (
                  <> · Recurrente · {FRECUENCIA_OPTS.find((o) => o.value === (pagarTarget.frecuenciaMeses ?? 1))?.label ?? "Mensual"}</>
                )}
              </div>
            </div>

            {/* Medios de pago */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ marginBottom: 8, display: "block" }}>¿Cómo se pagó?</label>
              {pagoDetalles.map((d, i) => {
                const saldoCuenta = cuentasSaldos
                  .filter(c => c.medioPago === d.medioPago)
                  .reduce((a, c) => a + Number(c.saldoActual ?? 0), 0);
                const hasSaldo = cuentasSaldos.length > 0;
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                      <select className="input" value={d.medioPago}
                        onChange={(e) => { const arr = [...pagoDetalles]; arr[i] = { ...arr[i], medioPago: e.target.value }; setPagoDetalles(arr); }}>
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia / Billetera Virtual</option>
                        <option value="TARJETA_BANCO">Déb./Cré. Bancarios</option>
                      </select>
                      <input className="input" value={d.monto ? Number(d.monto).toLocaleString("es-AR") : ""}
                        placeholder="Monto"
                        onChange={(e) => { const arr = [...pagoDetalles]; arr[i] = { ...arr[i], monto: onlyDigits(e.target.value) }; setPagoDetalles(arr); }} />
                      {pagoDetalles.length > 1 && (
                        <button type="button" onClick={() => setPagoDetalles(pagoDetalles.filter((_, j) => j !== i))}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "#d9363e", fontWeight: 900 }}>
                          ×
                        </button>
                      )}
                    </div>
                    {hasSaldo && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: saldoCuenta >= 0 ? "#0b7a55" : "#d9363e", marginTop: 3, paddingLeft: 2 }}>
                        Disponible: ${money(saldoCuenta)}
                      </div>
                    )}
                  </div>
                );
              })}
              <button type="button" className="btnGhost" style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setPagoDetalles([...pagoDetalles, { medioPago: "EFECTIVO", monto: "" }])}>
                + Agregar medio de pago
              </button>
            </div>

            {/* Próximo vencimiento (solo recurrentes) */}
            {pagarTarget.recurrente && pagarTarget.fechaVenc && (
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Monto del próximo gasto <span style={{ fontWeight: 400, opacity: 0.65 }}>(podés cambiarlo si varió)</span></label>
                <input className="input"
                  value={montoProximo ? Number(montoProximo).toLocaleString("es-AR") : ""}
                  onChange={(e) => setMontoProximo(onlyDigits(e.target.value))}
                  placeholder="Ej: 160.000" />
                {proxFechaLabel && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#0b7a55" }}>
                    Se creará el próximo para el {proxFechaLabel}
                  </div>
                )}
              </div>
            )}

            {pagarErr && (
              <div style={{ color: "#d9363e", fontSize: 13, fontWeight: 800, marginBottom: 10, padding: "8px 12px", background: "rgba(217,54,62,0.08)", borderRadius: 8, border: "1px solid rgba(217,54,62,0.25)" }}>
                {pagarErr}
              </div>
            )}
            <div className="provFormActions">
              <button className="btnGhost" onClick={() => { setPagarModalOpen(false); setPagarTarget(null); setPagarErr(""); }} disabled={loading}>Cancelar</button>
              <button className="btnPrimary" onClick={confirmarPago} disabled={loading}>
                {pagarTarget.recurrente && pagarTarget.fechaVenc ? "Confirmar y generar próximo" : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distribución por categoría */}
      {(tortaRecurrentes.length > 0 || tortaOcasionales.length > 0) && (
        <div className="card" style={{ padding: 20, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 16 }}>Distribución de gastos</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>RECURRENTES</div>
              {tortaRecurrentes.length > 0
                ? <TortaChart datos={tortaRecurrentes} />
                : <div className="empty">Sin gastos recurrentes.</div>}
            </div>
            <div style={{ width: 1, background: "var(--border)", flexShrink: 0, alignSelf: "stretch" }} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                OCASIONALES — {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase()}
              </div>
              {tortaOcasionales.length > 0
                ? <TortaChart datos={tortaOcasionales} />
                : <div className="empty">Sin gastos ocasionales este mes.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card provCard">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[["pendientes","Pendientes"],["todos","Todos"],["pagados","Pagados"]].map(([k,l]) => (
              <button key={k} type="button" className={`pillBtn ${filtroTab === k ? "active" : ""}`}
                onClick={() => setFiltroTab(k)}>{l}</button>
            ))}
          </div>
          <input className="input" style={{ width: 260 }} value={q}
            onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." />
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No hay gastos en esta vista.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((g) => {
              const dias  = diasHasta(g.fechaVenc);
              const badge = vencBadge(dias);
              const cat   = categorias.find((c) => c.id === g.categoriaId);
              const frecLabel = g.recurrente
                ? (FRECUENCIA_OPTS.find((o) => o.value === (g.frecuenciaMeses ?? 1))?.label ?? "Mensual")
                : null;

              return (
                <div key={g.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, padding: "14px 16px",
                  background: g.pagado ? "rgba(122,216,176,0.06)" : "var(--card)",
                  border: `1px solid ${g.pagado ? "rgba(85,201,154,0.25)" : "var(--border)"}`,
                  borderRadius: 14, flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 999, background: cat?.color ?? COLOR_SIN_CAT, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{g.descripcion}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {cat && <span>{cat.nombre}</span>}
                        <span>{g.recurrente ? `↻ ${frecLabel}` : "Único"}</span>
                        {g.fechaVenc && <span>Venc: {fmtDate(g.fechaVenc)}</span>}
                        {g.pagadoAt  && <span>Pagado: {fmtDate(g.pagadoAt)}</span>}
                        {g.codigoCliente && <span>Cód. cliente: {g.codigoCliente}</span>}
                        {g.numeroPago    && <span>Nro. pago: {g.numeroPago}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {badge && !g.pagado && (
                      <div style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {badge.label}
                      </div>
                    )}
                    <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap" }}>${money(g.monto)}</div>

                    {!g.pagado && (() => {
                      const bloqueado = g.recurrente && g.fechaVenc && diasHasta(g.fechaVenc) > 7;
                      return (
                        <button className="btnSmall" onClick={() => handlePagar(g)}
                          disabled={loading || bloqueado}
                          title={bloqueado ? `Disponible en ${diasHasta(g.fechaVenc) - 7}d` : undefined}
                          style={bloqueado ? { background: "var(--border)", color: "var(--muted)", borderColor: "var(--border)", cursor: "not-allowed" } : undefined}>
                          ✓ Pagar
                        </button>
                      );
                    })()}

                    {/* ── NUEVO: volver a pendiente ── */}
                    {g.pagado && (
                      <button className="btnSmall" onClick={() => onMarkPendiente(g.id)} disabled={loading}
                        style={{ opacity: 0.7 }}>
                        ↩ Pendiente
                      </button>
                    )}

                    <button className="btnSmall" onClick={() => openEdit(g)} disabled={loading}>Editar</button>
                    <button className="btnDangerSmall" onClick={() => onDeleteGasto(g.id, g.descripcion)} disabled={loading}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal confirmar eliminación ── */}
      {confirmDelete && (
        <div className="modalOverlay" onMouseDown={() => setConfirmDelete(null)}>
          <div className="modalCard" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">
                {confirmDelete.tipo === "categoria" ? "Eliminar categoría" : "Eliminar gasto"}
              </div>
              <button className="modalClose" type="button" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14 }}>
              {confirmDelete.tipo === "categoria"
                ? <>¿Eliminar la categoría <b>{confirmDelete.label}</b>? Los gastos asociados quedarán sin categoría.</>
                : <>¿Eliminar el gasto <b>{confirmDelete.label}</b>? Esta acción no se puede deshacer.</>
              }
            </p>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn danger" type="button"
                onClick={confirmDelete.tipo === "categoria" ? doDeleteCat : doDeleteGasto}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}