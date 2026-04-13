// src/pages/VentasPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/index.js";
import ComboSelect from "../components/ComboSelect";
import { toast } from "../components/Toast";
import { SkeletonTable } from "../components/Skeleton";
import {
  BarChart as RechartBar, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

function money(n) {
  const x = Number(n ?? 0);
  return (Number.isFinite(x) ? x : 0).toLocaleString("es-AR");
}
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-AR");
}
function fmtDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}
function onlyDigits(v) { return String(v ?? "").replace(/\D/g, ""); }
function fmtThousands(v) {
  const d = onlyDigits(v);
  if (!d) return "";
  return Number(d).toLocaleString("es-AR");
}

// ── CAMBIO: eliminado PENDIENTE ───────────────────────────────────────────────
const ESTADOS = [
  { value: "PARCIAL", label: "Parcial", bg: "rgba(99,102,241,0.12)", color: "#3730a3", border: "rgba(99,102,241,0.35)" },
  { value: "PAGADO",  label: "Pagado",  bg: "rgba(122,216,176,0.18)", color: "#0b7a55", border: "rgba(85,201,154,0.45)" },
];

const METODOS = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "BILLETERA",     label: "T. Créd./Déb. Billetera Virtual" },
  { value: "TARJETA_BANCO", label: "T. Créd./Déb. Banco" },
  // legados para registros anteriores
  { value: "DEBITO",        label: "Débito" },
  { value: "CREDITO",       label: "Crédito" },
];

function estadoInfo(estado) {
  return ESTADOS.find((e) => e.value === estado) ?? ESTADOS[0];
}

function EstadoBadge({ estado }) {
  const info = estadoInfo(estado);
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 900, whiteSpace: "nowrap",
      background: info.bg, color: info.color, border: `1px solid ${info.border}`,
    }}>
      {info.label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent ?? "var(--text)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, marginTop: 4, color: "var(--muted)", fontWeight: 800 }}>{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.payload.color, fontWeight: 600 }}>
          {p.name}: ${money(p.value)}
        </div>
      ))}
    </div>
  );
}

function BarChart({ datos }) {
  return (
    <ResponsiveContainer width="100%" height={datos.length * 48 + 16}>
      <RechartBar data={datos} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
          tick={{ fontSize: 11, fill: "var(--text)", opacity: 0.6 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "var(--text)", fontWeight: 800 }}
          width={82}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name="Monto" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {datos.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </RechartBar>
    </ResponsiveContainer>
  );
}

function ModalEstadoPago({ venta, onClose, onSaved }) {
  // ── CAMBIO: estado inicial nunca es PENDIENTE, cae a PARCIAL si lo era ────
  const initialEstado = venta.estadoPago === "PENDIENTE" ? "PARCIAL" : (venta.estadoPago ?? "PAGADO");
  const [estado,      setEstado]      = useState(initialEstado);
  const [metodo,      setMetodo]      = useState(venta.metodoPago ?? "");
  const [montoPagado, setMontoPagado] = useState(
    venta.montoPagado ? fmtThousands(String(venta.montoPagado)) : ""
  );
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function onSave() {
    setErr("");
    if (estado === "PARCIAL") {
      const n = Number(onlyDigits(montoPagado));
      if (!n || n <= 0) return setErr("Ingresá el monto parcial cobrado.");
    }
    setLoading(true);
    try {
      await window.api.updateEstadoPago({
        id: venta.id,
        estadoPago:  estado,
        metodoPago:  metodo || null,
        montoPagado: estado === "PARCIAL" ? Number(onlyDigits(montoPagado)) : undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modalCard" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">Actualizar estado de pago</div>
          <button className="modalClose" onClick={onClose}>✕</button>
        </div>

        <div className="detailItem" style={{ marginBottom: 14 }}>
          <div className="detailLabel">Venta</div>
          <div className="detailValue" style={{ fontSize: 15 }}>
            {venta.paciente?.nombre || "-"} · ${money(venta.total)}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: "var(--muted)", fontWeight: 800 }}>
            {fmtDate(venta.createdAt)} · {venta.armazon ? `${venta.armazon.marca} ${venta.armazon.modelo}` : "-"}
          </div>
        </div>

        {err && <div className="formError" style={{ marginBottom: 12 }}>{err}</div>}

        <div className="field" style={{ marginBottom: 12 }}>
          <span>Estado de pago</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {ESTADOS.map((e) => (
              <button key={e.value} type="button"
                className={`pillBtn ${estado === e.value ? "active" : ""}`}
                onClick={() => setEstado(e.value)} disabled={loading}>
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {estado === "PARCIAL" && (
          <div className="field" style={{ marginBottom: 12 }}>
            <span>Monto cobrado ($) *</span>
            <input
              value={montoPagado}
              onChange={(e) => setMontoPagado(fmtThousands(e.target.value))}
              placeholder="Ej: 15.000"
              inputMode="numeric"
            />
            <div className="fieldErrorSlot">
              {Number(onlyDigits(montoPagado)) > (venta.total ?? 0)
                ? "El monto no puede superar el total"
                : "\u00A0"}
            </div>
          </div>
        )}

        <div className="field" style={{ marginBottom: 4 }}>
          <span>Método de pago (opcional)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button"
              className={`pillBtn ${!metodo ? "active" : ""}`}
              onClick={() => setMetodo("")} disabled={loading}>
              Sin especificar
            </button>
            {METODOS.map((m) => (
              <button key={m.value} type="button"
                className={`pillBtn ${metodo === m.value ? "active" : ""}`}
                onClick={() => setMetodo(m.value)} disabled={loading}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modalActions">
          <button className="btn" type="button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn primary" type="button" onClick={onSave} disabled={loading} style={{ maxWidth: 180 }}>
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VentasPage() {
  const today = useMemo(() => toISODate(new Date()), []);

  const ventasFiltros    = useAppStore((s) => s.ventasFiltros);
  const setVentasFiltros = useAppStore((s) => s.setVentasFiltros);

  const [loading,    setLoading]    = useState(false);
  const [stats,      setStats]      = useState(null);
  const [ventas,     setVentas]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 30;

  // Inicializar desde el store; si el store no tiene fecha válida usa hoy
  const [desde,        setDesde]        = useState(() => ventasFiltros.desde || today);
  const [hasta,        setHasta]        = useState(() => ventasFiltros.hasta || today);
  const [pacienteQ,    setPacienteQ]    = useState(() => ventasFiltros.pacienteQ);
  const [estadoFiltro, setEstadoFiltro] = useState(() => ventasFiltros.estadoFiltro);
  const [periodoTab,   setPeriodoTab]   = useState(() => ventasFiltros.periodoTab);

  const [patients,    setPatients]    = useState([]);
  const [pacienteId,  setPacienteId]  = useState(() => ventasFiltros.pacienteId);
  const [pacDropOpen, setPacDropOpen] = useState(false);

  const [modalVenta,         setModalVenta]         = useState(null);
  const [detalle,            setDetalle]            = useState(null);
  const [confirmDeleteVenta, setConfirmDeleteVenta] = useState(null);

  function showToast(msg, type = "info") {
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else toast.info(msg);
  }

  useEffect(() => {
    window.api.listPatients().then((p) => setPatients(Array.isArray(p) ? p : [])).catch(() => {});
    loadStats();
    loadVentas(0);
  }, []);

  async function loadStats() {
    try {
      const s = await window.api.getVentasStats();
      setStats(s);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    const now = new Date();
    if (periodoTab === "hoy") {
      setDesde(today); setHasta(today);
    } else if (periodoTab === "semana") {
      const diaSemana = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const lunes = new Date(now); lunes.setDate(now.getDate() - diaSemana);
      setDesde(toISODate(lunes)); setHasta(today);
    } else if (periodoTab === "mes") {
      setDesde(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`); setHasta(today);
    }
  }, [periodoTab, today]);

  // Persistir filtros al store cuando cambian
  useEffect(() => {
    setVentasFiltros({ periodoTab, desde, hasta, pacienteId, pacienteQ, estadoFiltro });
  }, [periodoTab, desde, hasta, pacienteId, pacienteQ, estadoFiltro]);

  async function loadVentas(p = 0) {
    setLoading(true);
    try {
      const res = await window.api.listVentas({
        desde, hasta,
        pacienteId: pacienteId || undefined,
        estadoPago: estadoFiltro || undefined,
        page: p, pageSize: PAGE_SIZE,
      });
      setVentas(Array.isArray(res.rows) ? res.rows : []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 0);
      setPage(res.page ?? 0);
    } catch (e) {
      showToast(e?.message || "Error cargando ventas");
    } finally {
      setLoading(false);
    }
  }

  function buscar(p = 0) {
    loadVentas(p);
    loadStats();
  }

  async function deleteVenta(id) {
    try {
      await window.api.deleteVenta(id);
      showToast("Venta eliminada. Stock del armazón restaurado.", "success");
      setDetalle(null);
      setConfirmDeleteVenta(null);
      buscar(page);
    } catch (e) {
      showToast(e?.message || "Error eliminando venta");
    }
  }

  const pacientesFiltrados = useMemo(() => {
    const term = pacienteQ.trim().toLowerCase();
    if (!term) return [];
    return patients.filter((p) =>
      (p.nombre || "").toLowerCase().includes(term) ||
      String(p.dni || "").includes(term)
    ).slice(0, 10);
  }, [pacienteQ, patients]);

  const totalesLista = useMemo(() => ({
    bruto:    ventas.reduce((a, v) => a + (v.total ?? 0), 0),
    cobrado:  ventas.reduce((a, v) => {
      if (v.estadoPago === "PAGADO")  return a + (v.total ?? 0);
      if (v.estadoPago === "PARCIAL") return a + (v.montoPagado ?? 0);
      return a;
    }, 0),
    parcial:   ventas.filter((v) => v.estadoPago === "PARCIAL").length,
    pagado:    ventas.filter((v) => v.estadoPago === "PAGADO").length,
  }), [ventas]);

  const barData = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Hoy",     value: stats.hoy?.totalBruto    ?? 0, color: "rgba(85,201,154,0.55)" },
      { label: "Semana",  value: stats.semana?.totalBruto  ?? 0, color: "rgba(85,201,154,0.40)" },
      { label: "Mes",     value: stats.mes?.totalBruto     ?? 0, color: "rgba(85,201,154,0.28)" },
      { label: "Mes ant", value: stats.mesAnt?.totalBruto  ?? 0, color: "rgba(0,0,0,0.10)"      },
    ];
  }, [stats]);

  function delta(actual, anterior) {
    if (!actual || !anterior || anterior === 0) return null;
    const pct = Math.round(((actual - anterior) / anterior) * 100);
    const sube = pct >= 0;
    return (
      <span style={{ fontSize: 12, fontWeight: 900, marginLeft: 6, color: sube ? "#0b7a55" : "#d9363e" }}>
        {sube ? "▲" : "▼"} {Math.abs(pct)}% vs mes ant.
      </span>
    );
  }

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Ventas</h1>
          <div className="pageHint">Todas las ventas generadas al cargar recetas.</div>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14, alignItems: "start" }}>
          <KpiCard label="Total hoy" value={`$${money(stats.hoy?.totalBruto ?? 0)}`}
            sub={`${stats.hoy?.cantidad ?? 0} venta${stats.hoy?.cantidad === 1 ? "" : "s"}`} accent="#0b7a55" />
          <KpiCard label="Esta semana" value={`$${money(stats.semana?.totalBruto ?? 0)}`}
            sub={`${stats.semana?.cantidad ?? 0} ventas`} />
          <KpiCard label="Este mes" value={`$${money(stats.mes?.totalBruto ?? 0)}`}
            sub={<span>{stats.mes?.cantidad ?? 0} ventas{delta(stats.mes?.totalBruto, stats.mesAnt?.totalBruto)}</span>} />
        </div>
      )}

      {barData.some((d) => d.value > 0) && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 12 }}>Comparativa de períodos</div>
          <BarChart datos={barData} />
        </div>
      )}

      {/* ── Tarjetas de resumen ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Total bruto</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#0b7a55" }}>${money(totalesLista.bruto)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{total} venta{total === 1 ? "" : "s"}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Cobrado</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#0b7a55" }}>${money(totalesLista.cobrado)}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Pendiente</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#8a4b00" }}>${money(totalesLista.bruto - totalesLista.cobrado)}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Estados</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {[
              { estado: "PAGADO",  count: totalesLista.pagado },
              { estado: "PARCIAL", count: totalesLista.parcial },
            ].map(({ estado, count }) => (
              <div key={estado} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <EstadoBadge estado={estado} />
                <span style={{ fontWeight: 900, fontSize: 14 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Filtros</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["custom","Personalizado"]].map(([k,l]) => (
            <button key={k} type="button"
              className={`pillBtn ${periodoTab === k ? "active" : ""}`}
              onClick={() => setPeriodoTab(k)}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <div className="field">
            <span>Desde</span>
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPeriodoTab("custom"); }} />
          </div>
          <div className="field">
            <span>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPeriodoTab("custom"); }} />
          </div>
          <div className="field" style={{ position: "relative" }}>
            <span>Paciente</span>
            <input
              value={pacienteId ? (patients.find((p) => String(p.id) === String(pacienteId))?.nombre ?? pacienteQ) : pacienteQ}
              placeholder="Buscar por nombre o DNI..."
              onFocus={() => setPacDropOpen(true)}
              onChange={(e) => { setPacienteQ(e.target.value); setPacienteId(""); setPacDropOpen(true); }}
              onBlur={() => setTimeout(() => setPacDropOpen(false), 150)}
            />
            {pacDropOpen && pacientesFiltrados.length > 0 && (
              <div className="comboDropdown">
                <button type="button" className="comboItem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setPacienteId(""); setPacienteQ(""); setPacDropOpen(false); }}>
                  <div style={{ opacity: 0.65 }}>— Todos los pacientes —</div>
                </button>
                {pacientesFiltrados.map((p) => (
                  <button key={p.id} type="button" className="comboItem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setPacienteId(String(p.id)); setPacienteQ(p.nombre); setPacDropOpen(false); }}>
                    <div style={{ fontWeight: 900 }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>DNI {p.dni || "-"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* ── CAMBIO: solo Parcial y Pagado en filtro ── */}
          <div className="field">
            <span>Estado de pago</span>
            <ComboSelect
              value={estadoFiltro}
              onChange={(v) => setEstadoFiltro(v)}
              placeholder="Todos"
              options={[
                { value: "", label: "Todos" },
                ...ESTADOS.map((e) => ({ value: e.value, label: e.label })),
              ]}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
          <button className="btn" type="button" onClick={() => {
            setDesde(today); setHasta(today); setPacienteId(""); setPacienteQ("");
            setEstadoFiltro(""); setPeriodoTab("hoy");
          }}>Limpiar</button>
          <button className="btn primary" type="button" style={{ width: "auto" }}
            onClick={() => buscar(0)} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="provTable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Armazón</th>
                <th>Vidrio / Color</th>
                <th style={{ textAlign: "right" }}>Armazón $</th>
                <th style={{ textAlign: "right" }}>Vidrio $</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Seña</th>
                <th>Estado pago</th>
                <th>Método</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: 16 }}>
                    <SkeletonTable rows={6} cols={6} />
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty" style={{ padding: "20px 0" }}>
                      No hay ventas para los filtros seleccionados.
                    </div>
                  </td>
                </tr>
              ) : (
                ventas.map((v) => {
                  const metodoLabel = METODOS.find((m) => m.value === v.metodoPago)?.label ?? "-";
                  return (
                    <tr key={v.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.createdAt)}</td>
                      <td style={{ fontWeight: 900 }}>{v.paciente?.nombre || "-"}</td>
                      <td style={{ opacity: 0.85 }}>{v.armazon ? `${v.armazon.marca} ${v.armazon.modelo}` : "-"}</td>
                      <td style={{ opacity: 0.85 }}>{v.tratamiento || v.vidrio?.nombre || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>
                        {v.precioArmazon != null ? `$${money(v.precioArmazon)}` : "-"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>
                        {v.precioVidrio != null ? `$${money(v.precioVidrio)}` : "-"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 900, fontSize: 15, color: "#0b7a55" }}>
                        ${money(v.total ?? 0)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, opacity: 0.8 }}>
                        {v.sena != null ? `$${money(v.sena)}` : "-"}
                      </td>
                      <td>
                        <EstadoBadge estado={v.estadoPago ?? "PARCIAL"} />
                        {v.estadoPago === "PARCIAL" && v.montoPagado != null && (
                          <div style={{ fontSize: 11, marginTop: 3, fontWeight: 800, color: "var(--muted)" }}>
                            Cobrado: ${money(v.montoPagado)}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, opacity: 0.8 }}>{metodoLabel}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btnSmall" type="button" onClick={() => setModalVenta(v)}>Pago</button>
                          <button className="btnSmall" type="button" onClick={() => setDetalle(v)}>Ver</button>
                          <button className="btnDangerSmall" type="button" onClick={() => setConfirmDeleteVenta(v)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
              {total} ventas · Pág. {page + 1} / {totalPages}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={page === 0} onClick={() => buscar(0)}>«</button>
              <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={page === 0} onClick={() => buscar(page - 1)}>‹ Ant</button>
              <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={page >= totalPages - 1} onClick={() => buscar(page + 1)}>Sig ›</button>
              <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={page >= totalPages - 1} onClick={() => buscar(totalPages - 1)}>»</button>
            </div>
          </div>
        )}
      </div>

      {modalVenta && (
        <ModalEstadoPago
          venta={modalVenta}
          onClose={() => setModalVenta(null)}
          onSaved={() => { buscar(page); showToast("Estado actualizado", "success"); }}
        />
      )}

      {/* ── Modal detalle venta ── */}
      {detalle && (
        <div className="modalOverlay" onMouseDown={() => setDetalle(null)}>
          <div className="modalCard" style={{ maxWidth: 600 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Detalle de venta</div>
              <button className="modalClose" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div className="detailGrid">
              <div className="detailItem">
                <div className="detailLabel">Paciente</div>
                <div className="detailValue">{detalle.paciente?.nombre || "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>DNI {detalle.paciente?.dni || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Fecha</div>
                <div className="detailValue">{fmtDateTime(detalle.createdAt)}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Armazón</div>
                <div className="detailValue">
                  {detalle.armazon ? `${detalle.armazon.marca} ${detalle.armazon.modelo}` : "-"}
                  {detalle.armazon?.codigo ? ` (Cod ${detalle.armazon.codigo})` : ""}
                </div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Vidrio / Color</div>
                <div className="detailValue">{detalle.tratamiento || detalle.vidrio?.nombre || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Montaje</div>
                <div className="detailValue">{detalle.montaje || "-"}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Laboratorio</div>
                <div className="detailValue">{detalle.laboratorio || "-"}</div>
              </div>
            </div>
            <div className="card" style={{ marginTop: 14, padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Importes</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[["Precio armazón", detalle.precioArmazon], ["Precio vidrio", detalle.precioVidrio]].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.8 }}>{label}</span>
                    <span style={{ fontWeight: 900 }}>{val != null ? `$${money(val)}` : "-"}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed rgba(0,0,0,.15)" }}>
                  <span style={{ fontWeight: 900 }}>TOTAL</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: "#0b7a55" }}>${money(detalle.total ?? 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ opacity: 0.8 }}>Seña</span>
                  <span style={{ fontWeight: 900 }}>{detalle.sena != null ? `$${money(detalle.sena)}` : "-"}</span>
                </div>
              </div>
            </div>
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 900 }}>Estado de pago:</span>
                <EstadoBadge estado={detalle.estadoPago ?? "PARCIAL"} />
              </div>
              {detalle.estadoPago === "PARCIAL" && detalle.montoPagado != null && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, opacity: 0.8 }}>
                  Cobrado: ${money(detalle.montoPagado)} · Saldo: ${money((detalle.total ?? 0) - detalle.montoPagado)}
                </div>
              )}
              {detalle.metodoPago && (
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Método: {METODOS.find((m) => m.value === detalle.metodoPago)?.label ?? detalle.metodoPago}
                </div>
              )}
            </div>
            <div className="modalActions">
              <button className="btn danger" type="button" onClick={() => { setDetalle(null); setConfirmDeleteVenta(detalle); }}>
                Eliminar
              </button>
              <button className="btn" type="button" onClick={() => setDetalle(null)}>Cerrar</button>
              <button className="btn primary" type="button" style={{ width: "auto" }}
                onClick={() => { setDetalle(null); setModalVenta(detalle); }}>
                Actualizar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmDeleteVenta && (
        <div className="modalOverlay" onMouseDown={() => setConfirmDeleteVenta(null)}>
          <div className="modalCard" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Eliminar venta</div>
              <button className="modalClose" type="button" onClick={() => setConfirmDeleteVenta(null)}>✕</button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              ¿Seguro que querés eliminar la venta de <b>{confirmDeleteVenta?.paciente?.nombre || "este paciente"}</b> por <b>${money(confirmDeleteVenta?.total)}</b>?
              El stock del armazón se va a restaurar automáticamente.
            </p>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setConfirmDeleteVenta(null)}>Cancelar</button>
              <button className="btn danger" type="button" onClick={() => deleteVenta(confirmDeleteVenta.id)}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toasts manejados globalmente por ToastContainer en App.jsx */}
    </div>
  );
}