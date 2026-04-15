import { useEffect, useMemo, useState } from "react";
import { toast } from "../components/Toast";
import { SkeletonCard, SkeletonBlock } from "../components/Skeleton";

function money(n) {
  const x = Number(n ?? 0);
  const safe = Number.isFinite(x) ? x : 0;
  return safe.toLocaleString("es-AR");
}
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDate(dt) {
  if (!dt) return "-";
  const iso = String(dt).slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-AR");
}
function fmtDateLong(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}
function balanceClass(n) {
  if (n < 0) return "negative";
  if (n > 0) return "positive";
  return "neutral";
}
function diasHasta(fechaVenc) {
  if (!fechaVenc) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(fechaVenc); v.setHours(0, 0, 0, 0);
  return Math.round((v - hoy) / 86400000);
}
function onlyDigits(v) { return String(v ?? "").replace(/\D/g, ""); }
function normalizePhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.startsWith("54") ? d : `54${d}`;
}
const FRECUENCIA_OPTS = [
  { label: "Mensual",     value: 1 },
  { label: "Bimensual",   value: 2 },
  { label: "Trimestral",  value: 3 },
  { label: "Semestral",   value: 6 },
  { label: "Anual",       value: 12 },
];
function addMonths(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

const MES_NOMBRES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function HomePage({ onNavigate }) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [loading,          setLoading]          = useState(true);
  const [actionLoadingId,  setActionLoadingId]  = useState(null);
  const [upcoming,         setUpcoming]         = useState([]);
  const [dayList,          setDayList]          = useState([]);
  const [gastosProx,       setGastosProx]       = useState([]);
  const [saldoProv,        setSaldoProv]        = useState(0);
  const [recetasMes,       setRecetasMes]       = useState(0);
  const [recetasMesAnt,    setRecetasMesAnt]    = useState(null);
  const [ventasHoy,        setVentasHoy]        = useState(null);

  const [ym, setYm] = useState(() => ({ year: today.getFullYear(), monthIndex: today.getMonth() }));
  const [selectedDate, setSelectedDate] = useState(toISODate(today));
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [pendingPickup,    setPendingPickup]    = useState([]);

  const [upcomingIdx,      setUpcomingIdx]      = useState(0);
  const [gastosIdx,        setGastosIdx]        = useState(0);
  const [lentesIdx,        setLentesIdx]        = useState(0);

  useEffect(() => { setUpcomingIdx(0); }, [upcoming]);
  useEffect(() => { setLentesIdx(0); }, [pendingPickup]);
  useEffect(() => { setGastosIdx(0); }, [gastosProx]);

  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [deliverTarget,    setDeliverTarget]    = useState(null);
  const [pickupModalOpen,  setPickupModalOpen]  = useState(false);
  const [pickupTarget,     setPickupTarget]     = useState(null);
  const [pickupConfirmarPago, setPickupConfirmarPago] = useState(false);

  // ── modal pago vencimiento ────────────────────────────────────────────────
  const [pagarModalOpen,  setPagarModalOpen]  = useState(false);
  const [pagarTarget,     setPagarTarget]     = useState(null);
  const [montoProximo,    setMontoProximo]    = useState("");
  const [pagoDetalles,    setPagoDetalles]    = useState([{ medioPago: "EFECTIVO", monto: "" }]);
  const [cuentasSaldos,   setCuentasSaldos]  = useState([]);

  const proxFechaLabel = useMemo(() => {
    if (!pagarTarget?.fechaVenc) return null;
    const meses = Number(pagarTarget.frecuenciaMeses) || 1;
    const d = new Date(pagarTarget.fechaVenc);
    d.setMonth(d.getMonth() + meses);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }, [pagarTarget]);

  async function loadPendingPickup() {
    try { const rows = await window.api.listPendingPickup(); setPendingPickup(Array.isArray(rows) ? rows : []); }
    catch { setPendingPickup([]); }
  }

  async function loadUpcoming() {
    try { const rows = await window.api.listUpcomingDeliveries(60); setUpcoming(Array.isArray(rows) ? rows.filter((r) => !r.entregada) : []); }
    catch { setUpcoming([]); }
  }
  async function loadDay(iso) {
    try { const rows = await window.api.listDeliveriesByDate(iso); setDayList(Array.isArray(rows) ? rows.filter((r) => !r.entregada) : []); }
    catch { setDayList([]); }
  }
  async function loadGastos() {
    try { const rows = await window.api.upcomingGastos(30); setGastosProx(Array.isArray(rows) ? rows : []); }
    catch { setGastosProx([]); }
  }
  async function refreshAll(iso = selectedDate) {
    await Promise.all([loadUpcoming(), loadDay(iso), loadPendingPickup()]);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [, , , provs, recs, gastos, ventas] = await Promise.allSettled([
          loadUpcoming(),
          loadDay(toISODate(today)),
          loadPendingPickup(),
          window.api.getPagosTotalesPorProveedor(),
          window.api.countRecipesByMonth(),
          window.api.upcomingGastos(30),
          window.api.getVentasStats(),
        ]);
        if (provs.status === "fulfilled" && Array.isArray(provs.value))
          setSaldoProv(provs.value.reduce((a, p) => a + Number(p.saldoActual ?? 0), 0));
        if (recs.status === "fulfilled" && recs.value) {
          setRecetasMes(recs.value.mesActual ?? 0);
          setRecetasMesAnt(recs.value.mesAnterior ?? 0);
        }
        if (gastos.status === "fulfilled" && Array.isArray(gastos.value)) setGastosProx(gastos.value);
        if (ventas.status === "fulfilled" && ventas.value?.hoy) setVentasHoy(ventas.value.hoy);
      } finally { setLoading(false); }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadDay(selectedDate); }, [selectedDate]);

  const monthLabel = useMemo(() => `${MES_NOMBRES[ym.monthIndex]} ${ym.year}`, [ym]);

  const gridDays = useMemo(() => {
    const days = [];
    const first = new Date(ym.year, ym.monthIndex, 1);
    const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
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

  const deliveryCountByDay = useMemo(() => {
    const map = new Map();
    for (const r of upcoming) {
      const dt = r?.entregaFecha ? new Date(r.entregaFecha) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;
      dt.setHours(0, 0, 0, 0);
      const key = toISODate(dt);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [upcoming]);

  const vencimientoCountByDay = useMemo(() => {
    const map = new Map();
    for (const g of gastosProx) {
      const dt = g?.fechaVenc ? new Date(g.fechaVenc) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;
      dt.setHours(0, 0, 0, 0);
      const key = toISODate(dt);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [gastosProx]);

  const todayISO = toISODate(today);


  async function confirmDeliver() {
    if (!deliverTarget?.id) return;
    try {
      setActionLoadingId(deliverTarget.id);
      await window.api.markRecipeDelivered(deliverTarget.id);
      toast.success("Receta marcada como entregada");
      await refreshAll(selectedDate);
      setDeliverModalOpen(false); setDeliverTarget(null);
    } catch (e) { toast.error(e?.message || "No se pudo registrar la entrega"); }
    finally { setActionLoadingId(null); }
  }

  async function handleWhatsApp(receta) {
    const tel = normalizePhone(receta?.paciente?.telefono);
    if (!tel || tel === "54") return toast.warn("Este paciente no tiene teléfono.");
    const nombre = receta?.paciente?.nombre || "paciente";
    const url = `https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(`Hola ${nombre}, tu lente ya está listo para retirar.`)}`;
    try {
      setActionLoadingId(receta.id);
      await window.api.openExternal(url);
      await window.api.markRecipeNoticeSent(receta.id);
      await refreshAll(selectedDate);
    } catch (e) { toast.error(e?.message || "Error al abrir WhatsApp."); }
    finally { setActionLoadingId(null); }
  }

  async function confirmPickedUp() {
    if (!pickupTarget?.id) return;
    try {
      setActionLoadingId(pickupTarget.id);
      await window.api.markRecipePickedUp(pickupTarget.id);
      if (pickupConfirmarPago) {
        await window.api.updateEstadoPago({ id: pickupTarget.id, estadoPago: "PAGADO", metodoPago: pickupTarget.metodoPago || null });
      }
      await refreshAll(selectedDate);
      setPickupModalOpen(false); setPickupTarget(null); setPickupConfirmarPago(false);
      toast.success("Receta marcada como retirada");
    } catch (e) { toast.error(e?.message || "No se pudo marcar como retirada."); }
    finally { setActionLoadingId(null); }
  }

  async function handlePagarGasto(g) {
    setPagoDetalles([{ medioPago: "EFECTIVO", monto: String(g.monto) }]);
    setMontoProximo(String(g.monto));
    setPagarTarget(g);
    setPagarModalOpen(true);
    try { setCuentasSaldos(await window.api.getCajaSaldos()); } catch { setCuentasSaldos([]); }
  }

  async function confirmarPagoGasto() {
    const detallesPago = pagoDetalles
      .map(d => ({ medioPago: d.medioPago, monto: Math.round(Number(String(d.monto).replace(/\./g,"").replace(",",".")) || 0) }))
      .filter(d => d.monto > 0 && d.medioPago);
    if (!detallesPago.length) { toast.warn("Especificá al menos un medio de pago."); return; }
    const n = Number(String(montoProximo).replace(/\./g,"").replace(",","."));
    const montoProx = (pagarTarget?.recurrente && pagarTarget?.fechaVenc && Number.isFinite(n) && n > 0) ? Math.round(n) : null;
    const target = pagarTarget;
    setPagarModalOpen(false);
    setPagarTarget(null);
    setMontoProximo("");
    setPagoDetalles([{ medioPago: "EFECTIVO", monto: "" }]);
    try {
      setActionLoadingId(`gasto-${target.id}`);
      await window.api.markGastoPagado({ id: target.id, montoProximo: montoProx, detallesPago });
      await loadGastos();
      toast.success("Gasto marcado como pagado");
    } catch (e) { toast.error(e?.message || "No se pudo marcar como pagado."); }
    finally { setActionLoadingId(null); }
  }

  function DeltaBadge({ actual, anterior }) {
    if (anterior === null || anterior === undefined) return null;
    if (anterior === 0 && actual === 0) return <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>sin cambios</span>;
    if (anterior === 0) return <span style={{ fontSize: 12, fontWeight: 900, color: "#0b7a55" }}>▲ nuevo este mes</span>;
    const pct = Math.round(((actual - anterior) / anterior) * 100);
    if (pct === 0) return <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>= igual que el mes anterior</span>;
    return (
      <span style={{ fontSize: 12, fontWeight: 900, color: pct > 0 ? "#0b7a55" : "#d9363e" }}>
        {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% vs mes anterior
      </span>
    );
  }

  // Saludo dinámico
  const saludo = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 6 && h < 12)  return "Buen día 👋";
    if (h >= 12 && h < 20) return "Buenas tardes 👋";
    return "Buenas noches 🌙";
  }, []);

  if (loading) return (
    <div className="page">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SkeletonBlock height={280} /><SkeletonBlock height={280} />
      </div>
    </div>
  );

  return (
    <div className="page" style={{ height: "calc(100vh - 74px)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Saludo ── */}
      <div style={{ flexShrink: 0, fontWeight: 900, fontSize: 18, paddingLeft: 2 }}>{saludo}</div>

      {/* ── KPIs en una sola fila ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, alignItems: "stretch", flexShrink: 0 }}>
        {/* Ventas hoy */}
        <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ventas hoy</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0b7a55", lineHeight: 1.2 }}>${money(ventasHoy?.totalBruto ?? 0)}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>
              {ventasHoy?.cantidad ?? 0} venta{(ventasHoy?.cantidad ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
          <button className="btnSmall" style={{ flexShrink: 0 }} onClick={() => onNavigate?.("ventas")}>Ver</button>
        </div>
        {/* Saldo proveedores */}
        <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saldo proveedores</div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2, color: saldoProv < 0 ? "#d9363e" : saldoProv > 0 ? "#0b7a55" : "var(--text)" }}>
              {saldoProv < 0 ? `-$${money(Math.abs(saldoProv))}` : `$${money(saldoProv)}`}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>{saldoProv < 0 ? "deuda pendiente" : saldoProv > 0 ? "a favor" : "—"}</div>
          </div>
          <button className="btnSmall" style={{ flexShrink: 0 }} onClick={() => onNavigate?.("proveedores")}>Ver</button>
        </div>
        {/* Recetas */}
        <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recetas este mes</div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>{recetasMes}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}><DeltaBadge actual={recetasMes} anterior={recetasMesAnt} /></div>
          </div>
          <button className="btnSmall" style={{ flexShrink: 0 }} onClick={() => onNavigate?.("buscarRecetas")}>Ver</button>
        </div>
        {/* Reloj */}
        <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Hora actual</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
              {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800 }}>
              {now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo: calendario + secciones ── */}
      <div style={{ flex: 1, display: "flex", gap: 14, alignItems: "stretch", overflow: "hidden", minHeight: 0 }}>

        {/* Columna izquierda: calendario — ancho fijo */}
        <section className="card" style={{ width: 430, minWidth: 410, maxWidth: 450, flexShrink: 0, alignSelf: "flex-start", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 8, paddingBottom: 8 }}>
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{monthLabel}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" type="button" onClick={() => setYm((p) => addMonths(p.year, p.monthIndex, -1))}>◀</button>
              <button className="btn" type="button" onClick={() => { setYm({ year: today.getFullYear(), monthIndex: today.getMonth() }); setSelectedDate(todayISO); }}>Hoy</button>
              <button className="btn" type="button" onClick={() => setYm((p) => addMonths(p.year, p.monthIndex, +1))}>▶</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 42px)", gap: 6, justifyContent: "center" }}>
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
              <div key={d} style={{ fontSize: 11, fontWeight: 900, opacity: 0.6, textAlign: "center", padding: "4px 0" }}>{d}</div>
            ))}
            {gridDays.map(({ date, inMonth }) => {
              const iso     = toISODate(date);
              const isToday = iso === todayISO;
              const isSel   = iso === selectedDate;
              const count   = deliveryCountByDay.get(iso) || 0;
              const vcount  = vencimientoCountByDay.get(iso) || 0;
              return (
                <button key={iso} type="button" onClick={() => setSelectedDate(iso)} style={{
                  width: 42, height: 42, display: "flex", alignItems: "center",
                  justifyContent: "center", position: "relative", fontWeight: 900, fontSize: 13,
                  borderRadius: 10,
                  border: isSel ? "1px solid rgba(85,201,154,0.55)" : isToday ? "1px solid rgba(85,201,154,0.30)" : "1px solid transparent",
                  background: isSel ? "rgba(122,216,176,0.28)" : isToday ? "rgba(122,216,176,0.10)" : "transparent",
                  opacity: inMonth ? 1 : 0.35, cursor: "pointer", padding: 0,
                }}>
                  {date.getDate()}
                  {count > 0 && (
                    <div style={{ position: "absolute", top: 3, right: 3, width: 14, height: 14, borderRadius: 999,
                      fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
                      background: "rgba(85,201,154,0.55)", border: "1px solid rgba(85,201,154,0.7)", color: "#083126" }}>
                      {count}
                    </div>
                  )}
                  {vcount > 0 && (
                    <div style={{ position: "absolute", bottom: 3, right: 3, width: 14, height: 14, borderRadius: 999,
                      fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900,
                      background: "rgba(251,146,60,0.55)", border: "1px solid rgba(251,146,60,0.8)", color: "#3d1a00" }}
                      title={`${vcount} vencimiento${vcount === 1 ? "" : "s"}`}>
                      {vcount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hint" style={{ marginTop: 12 }}>Elegí un día para ver las entregas programadas.</div>
        </section>

        {/* Columna derecha: 1) Entregas del día, 2) Lentes listos, 3) Próximas, 4) Vencimientos */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, height: "100%", overflowY: "auto", paddingRight: 2, scrollbarWidth: "thin" }}>

          {/* 1. Entregas del día — solo si hay entregas */}
          {dayList.length > 0 && (
          <section className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, textTransform: "capitalize" }}>
              Entregas: {fmtDateLong(selectedDate)}
            </div>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {dayList.map((r) => {
                  const tel    = String(r?.paciente?.telefono ?? "").replace(/\D/g, "");
                  const isBusy = actionLoadingId === r.id;
                  const yaPago = r.estadoPago === "PAGADO";
                  return (
                    <div key={r.id} className="card" style={{ padding: 12,
                      border: r.retirada ? "1px solid rgba(0,0,0,0.10)" : r.avisoRetiroEnviado ? "1px solid rgba(85,201,154,0.55)" : r.entregada ? "1px solid rgba(122,216,176,0.45)" : "1px solid rgba(0,0,0,0.08)",
                      background: r.avisoRetiroEnviado ? "rgba(122,216,176,0.10)" : undefined }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{r.paciente?.nombre || "Paciente"}{r.paciente?.dni ? ` (DNI ${r.paciente.dni})` : ""}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 999,
                            background: yaPago ? "rgba(122,216,176,0.22)" : "rgba(255,183,77,0.18)",
                            border: yaPago ? "1px solid rgba(85,201,154,0.45)" : "1px solid rgba(255,183,77,0.45)",
                            color: yaPago ? "#0b7a55" : "#8a4b00", whiteSpace: "nowrap" }}>
                            {yaPago ? "Pagado ✓" : r.estadoPago === "PARCIAL" ? "Parcial" : "Sin cobrar"}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999,
                            background: r.retirada ? "rgba(0,0,0,0.08)" : r.avisoRetiroEnviado ? "rgba(85,201,154,0.28)" : r.entregada ? "rgba(122,216,176,0.22)" : "rgba(0,0,0,0.06)",
                            border: r.retirada ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(85,201,154,0.45)", whiteSpace: "nowrap" }}>
                            {r.retirada ? "Retirada" : r.avisoRetiroEnviado ? "Avisado" : r.entregada ? "Entregada" : "Pendiente"}
                          </div>
                        </div>
                      </div>
                      <div style={{ opacity: 0.8, marginTop: 4 }}>
                        Armazón: {r.armazon ? `${r.armazon.marca} ${r.armazon.modelo}${r.armazon.codigo ? ` (Cod ${r.armazon.codigo})` : ""}` : "-"}
                      </div>
                      <div style={{ opacity: 0.8, marginTop: 4 }}>
                        Vidrio: {r.vidrio?.nombre || r.tratamiento || "-"} · Montaje: {r.montaje || "-"} · Uso: {r.distancia || "-"}
                      </div>
                      <div style={{ opacity: 0.8, marginTop: 4 }}>
                        Total: <b>${money(r.total ?? 0)}</b> · Seña: <b>${money(r.sena ?? 0)}</b> · Lab: {r.laboratorio || "-"}
                      </div>
                      {r.entregadaAt && <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>Entregada el: {new Date(r.entregadaAt).toLocaleString("es-AR")}</div>}
                      {r.avisoRetiroEnviadoAt && <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>Avisado el: {new Date(r.avisoRetiroEnviadoAt).toLocaleString("es-AR")}</div>}
                      {r.retiradaAt && <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>Retirada el: {new Date(r.retiradaAt).toLocaleString("es-AR")}</div>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {!r.entregada ? (
                          <button className="btn primary" type="button" disabled={isBusy} onClick={() => { setDeliverTarget(r); setDeliverModalOpen(true); }}>
                            {isBusy ? "Guardando..." : "Entregar"}
                          </button>
                        ) : !r.avisoRetiroEnviado ? (
                          <button className="btn" type="button" disabled={!tel || isBusy} onClick={() => handleWhatsApp(r)}>
                            {!tel ? "Sin teléfono" : isBusy ? "Guardando..." : "Avisar por WhatsApp"}
                          </button>
                        ) : !r.retirada ? (
                          <button className="btn primary" type="button" disabled={isBusy}
                            onClick={() => { setPickupTarget(r); setPickupConfirmarPago(!yaPago); setPickupModalOpen(true); }}>
                            {isBusy ? "Guardando..." : "Ya retiró"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
          )}

          {/* 2. Lentes listos para retirar */}
          {pendingPickup.length > 0 && (() => {
            const sortedPickup = [...pendingPickup].sort((a, b) => (b.avisoRetiroEnviado ? 1 : 0) - (a.avisoRetiroEnviado ? 1 : 0));
            const r = sortedPickup[lentesIdx] ?? sortedPickup[0];
            const tel    = String(r?.paciente?.telefono ?? "").replace(/\D/g, "");
            const isBusy = actionLoadingId === r.id;
            const yaPago = r.estadoPago === "PAGADO";
            return (
              <section className="card" style={{ flexShrink: 0, display: "flex", flexDirection: "column", paddingBottom: 14, borderColor: "rgba(85,201,154,0.45)", background: "rgba(122,216,176,0.05)" }}>
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8, color: "#0b7a55", flexShrink: 0 }}>
                  Lentes listos para retirar
                  <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.6, marginLeft: 6 }}>{lentesIdx + 1}/{sortedPickup.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
                    border: r.avisoRetiroEnviado ? "1px solid rgba(85,201,154,0.65)" : "1px solid rgba(122,216,176,0.35)",
                    background: r.avisoRetiroEnviado ? "rgba(122,216,176,0.14)" : "var(--card)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                        {r.avisoRetiroEnviado && <span style={{ fontSize: 10, fontWeight: 900, background: "rgba(85,201,154,0.3)", color: "#0b7a55", borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>Avisado</span>}
                        {r.paciente?.nombre || "Paciente"}{r.paciente?.dni ? ` (DNI ${r.paciente.dni})` : ""}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.armazon ? `${r.armazon.marca} ${r.armazon.modelo}` : "-"} · ${money(r.total ?? 0)}
                        {!yaPago && r.sena ? ` · Seña $${money(r.sena)}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {!yaPago && (
                        <div style={{ fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 999,
                          background: "rgba(255,183,77,0.18)", border: "1px solid rgba(255,183,77,0.45)",
                          color: "#8a4b00", whiteSpace: "nowrap" }}>
                          {r.estadoPago === "PARCIAL" ? "Parcial" : "Sin cobrar"}
                        </div>
                      )}
                      {!r.avisoRetiroEnviado ? (
                        <button type="button" disabled={!tel || isBusy} onClick={() => handleWhatsApp(r)} title={!tel ? "Sin teléfono" : "Avisar por WhatsApp"}
                          style={{ background: tel ? "#25D366" : "rgba(0,0,0,0.15)", border: "none", borderRadius: 8, width: 34, height: 34,
                            display: "flex", alignItems: "center", justifyContent: "center", cursor: tel ? "pointer" : "not-allowed",
                            flexShrink: 0, opacity: isBusy ? 0.6 : 1 }}>
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.847L.057 23.882a.5.5 0 0 0 .614.614l6.035-1.474A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.676-.524-5.2-1.437l-.374-.222-3.878.947.967-3.878-.241-.392A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                          </svg>
                        </button>
                      ) : (
                        <button className="btnSmall" type="button" disabled={isBusy}
                          onClick={() => { setPickupTarget(r); setPickupConfirmarPago(!yaPago); setPickupModalOpen(true); }}
                          style={{ whiteSpace: "nowrap" }}>
                          {isBusy ? "..." : "Confirmar retiro"}
                        </button>
                      )}
                    </div>
                  </div>
                  {sortedPickup.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                      <button type="button" disabled={lentesIdx === 0} onClick={() => setLentesIdx(i => i - 1)}
                        style={{ background: "none", border: "none", cursor: lentesIdx === 0 ? "default" : "pointer", color: lentesIdx === 0 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>‹</button>
                      {sortedPickup.map((_, i) => (
                        <button key={i} type="button" onClick={() => setLentesIdx(i)}
                          style={{ width: lentesIdx === i ? 10 : 7, height: lentesIdx === i ? 10 : 7, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                            background: lentesIdx === i ? "#55c99a" : "rgba(85,201,154,0.28)",
                            boxShadow: lentesIdx === i ? "0 0 0 2px rgba(85,201,154,0.35)" : "none",
                            flexShrink: 0, transition: "all 0.18s" }} />
                      ))}
                      <button type="button" disabled={lentesIdx === sortedPickup.length - 1} onClick={() => setLentesIdx(i => i + 1)}
                        style={{ background: "none", border: "none", cursor: lentesIdx === sortedPickup.length - 1 ? "default" : "pointer", color: lentesIdx === sortedPickup.length - 1 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>›</button>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* 4. Próximas entregas */}
          <section className="card" style={{ flexShrink: 0, display: "flex", flexDirection: "column", paddingBottom: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, flexShrink: 0 }}>
              Próximas entregas (60 días)
              {upcoming.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.6, marginLeft: 6 }}>{upcomingIdx + 1}/{Math.min(upcoming.length, 30)}</span>}
            </div>
            {upcoming.length === 0 ? (
              <div style={{ opacity: 0.5, fontSize: 13, textAlign: "center", padding: "6px 0" }}>Todavía no hay entregas cargadas.</div>
            ) : (() => {
              const list = upcoming.slice(0, 30);
              const r = list[upcomingIdx] ?? list[0];
              const dt = r.entregaFecha ? new Date(r.entregaFecha) : null;
              const iso = dt ? toISODate(dt) : "-";
              const esHoy = iso === todayISO;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button type="button" className="btn" disabled={iso === "-"} onClick={() => iso !== "-" && setSelectedDate(iso)} style={{ textAlign: "left", width: "100%" }}>
                    <div style={{ fontWeight: 900 }}>
                      {esHoy ? <span style={{ color: "var(--danger)" }}>Hoy</span> : iso}
                      {" · "}{r.paciente?.nombre || "Paciente"}{r.paciente?.dni ? ` (DNI ${r.paciente.dni})` : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      {r.armazon ? `${r.armazon.marca} ${r.armazon.modelo}` : "-"} · {r.vidrio?.nombre || r.tratamiento || "-"} · ${money(r.total ?? 0)}
                    </div>
                  </button>
                  {list.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                      <button type="button" disabled={upcomingIdx === 0} onClick={() => setUpcomingIdx(i => i - 1)}
                        style={{ background: "none", border: "none", cursor: upcomingIdx === 0 ? "default" : "pointer", color: upcomingIdx === 0 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>‹</button>
                      {list.map((_, i) => (
                        <button key={i} type="button" onClick={() => setUpcomingIdx(i)}
                          style={{ width: upcomingIdx === i ? 10 : 7, height: upcomingIdx === i ? 10 : 7, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                            background: upcomingIdx === i ? "#55c99a" : "rgba(85,201,154,0.28)",
                            boxShadow: upcomingIdx === i ? "0 0 0 2px rgba(85,201,154,0.35)" : "none",
                            flexShrink: 0, transition: "all 0.18s" }} />
                      ))}
                      <button type="button" disabled={upcomingIdx === list.length - 1} onClick={() => setUpcomingIdx(i => i + 1)}
                        style={{ background: "none", border: "none", cursor: upcomingIdx === list.length - 1 ? "default" : "pointer", color: upcomingIdx === list.length - 1 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>›</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* 5. Vencimientos */}
          <section className="card" style={{ display: "flex", flexDirection: "column", paddingBottom: 14 }}>
            <div className="rowBetween" style={{ marginBottom: 8, flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>
                Vencimientos (30 días)
                {gastosProx.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.6, marginLeft: 6 }}>{gastosIdx + 1}/{Math.min(gastosProx.length, 15)}</span>}
              </div>
              <button className="btnSmall" onClick={() => onNavigate?.("gastos")}>Ver gastos</button>
            </div>
            {gastosProx.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 13 }}>Sin vencimientos próximos.</div>
            ) : (() => {
              const list = gastosProx.slice(0, 15);
              const g = list[gastosIdx] ?? list[0];
              const dias = diasHasta(g.fechaVenc);
              const urgente = dias !== null && dias <= 3;
              const pagando = actionLoadingId === `gasto-${g.id}`;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "16px 16px", borderRadius: 14,
                    border: urgente ? "1px solid rgba(255,77,77,0.35)" : "1px solid var(--border)",
                    background: urgente ? "rgba(255,77,77,0.06)" : "var(--card)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.descripcion}</div>
                      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                        {g.categoria?.nombre ? `${g.categoria.nombre} · ` : ""}{fmtDate(g.fechaVenc)}
                        {dias !== null && (
                          <span style={{ marginLeft: 4, fontWeight: 900, color: urgente ? "var(--danger)" : "#0b7a55" }}>
                            {dias === 0 ? "(hoy)" : dias < 0 ? `(hace ${Math.abs(dias)}d)` : `(en ${dias}d)`}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>${money(g.monto)}</div>
                    </div>
                    <button className="btnSmall" type="button" disabled={pagando} onClick={() => handlePagarGasto(g)} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                      {pagando ? "..." : "Pagar"}
                    </button>
                  </div>
                  {list.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                      <button type="button" disabled={gastosIdx === 0} onClick={() => setGastosIdx(i => i - 1)}
                        style={{ background: "none", border: "none", cursor: gastosIdx === 0 ? "default" : "pointer", color: gastosIdx === 0 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>‹</button>
                      {list.map((_, i) => (
                        <button key={i} type="button" onClick={() => setGastosIdx(i)}
                          style={{ width: gastosIdx === i ? 10 : 7, height: gastosIdx === i ? 10 : 7, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                            background: gastosIdx === i ? "#55c99a" : "rgba(85,201,154,0.28)",
                            boxShadow: gastosIdx === i ? "0 0 0 2px rgba(85,201,154,0.35)" : "none",
                            flexShrink: 0, transition: "all 0.18s" }} />
                      ))}
                      <button type="button" disabled={gastosIdx === list.length - 1} onClick={() => setGastosIdx(i => i + 1)}
                        style={{ background: "none", border: "none", cursor: gastosIdx === list.length - 1 ? "default" : "pointer", color: gastosIdx === list.length - 1 ? "rgba(85,201,154,0.2)" : "#55c99a", fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 900 }}>›</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

        </div>
      </div>

      {/* Modal confirmar entrega */}
      {deliverModalOpen && deliverTarget && (
        <div className="modalOverlay" onClick={() => { if (!actionLoadingId) { setDeliverModalOpen(false); setDeliverTarget(null); } }}>
          <div className="modalCard" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar entrega</div>
              <button className="modalClose" type="button" onClick={() => { setDeliverModalOpen(false); setDeliverTarget(null); }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div className="detailItem"><div className="detailLabel">Paciente</div>
                <div className="detailValue">{deliverTarget.paciente?.nombre || "Paciente"} {deliverTarget.paciente?.dni ? `(DNI ${deliverTarget.paciente.dni})` : ""}</div>
              </div>
              <div className="detailItem"><div className="detailLabel">Armazón</div>
                <div className="detailValue">{deliverTarget.armazon ? `${deliverTarget.armazon.marca} ${deliverTarget.armazon.modelo}${deliverTarget.armazon.codigo ? ` (Cod ${deliverTarget.armazon.codigo})` : ""}` : "-"}</div>
              </div>
              <div className="detailItem"><div className="detailLabel">Importe</div>
                <div className="detailValue">Total ${money(deliverTarget.total ?? 0)} · Seña ${money(deliverTarget.sena ?? 0)}</div>
              </div>
            </div>
            <div className="hint" style={{ marginTop: 2 }}>Al confirmar, la receta se marcará como entregada.</div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => { setDeliverModalOpen(false); setDeliverTarget(null); }} disabled={!!actionLoadingId}>Cancelar</button>
              <button className="btn primary" type="button" onClick={confirmDeliver} disabled={actionLoadingId === deliverTarget.id} style={{ maxWidth: 180 }}>
                {actionLoadingId === deliverTarget.id ? "Guardando..." : "Confirmar entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar retiro + pago */}
      {pickupModalOpen && pickupTarget && (
        <div className="modalOverlay" onClick={() => { if (!actionLoadingId) { setPickupModalOpen(false); setPickupTarget(null); setPickupConfirmarPago(false); } }}>
          <div className="modalCard" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar retiro</div>
              <button className="modalClose" type="button" onClick={() => { setPickupModalOpen(false); setPickupTarget(null); setPickupConfirmarPago(false); }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div className="detailItem"><div className="detailLabel">Paciente</div>
                <div className="detailValue">{pickupTarget.paciente?.nombre || "Paciente"} {pickupTarget.paciente?.dni ? `(DNI ${pickupTarget.paciente.dni})` : ""}</div>
              </div>
              <div className="detailItem"><div className="detailLabel">Importe</div>
                <div className="detailValue">
                  Total ${money(pickupTarget.total ?? 0)}
                  {pickupTarget.sena ? ` · Seña $${money(pickupTarget.sena)}` : ""}
                  {pickupTarget.estadoPago === "PARCIAL" ? ` · Saldo $${money((pickupTarget.total ?? 0) - (pickupTarget.montoPagado ?? 0))}` : ""}
                </div>
              </div>
              <div className="detailItem"><div className="detailLabel">Estado de pago</div>
                <div className="detailValue" style={{ color: pickupTarget.estadoPago === "PAGADO" ? "#0b7a55" : "#8a4b00", fontWeight: 900 }}>
                  {pickupTarget.estadoPago === "PAGADO" ? "✓ Pagado" : pickupTarget.estadoPago === "PARCIAL" ? "Parcial" : "Sin cobrar"}
                </div>
              </div>
            </div>
            {pickupTarget.estadoPago !== "PAGADO" && (
              <label style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 14,
                padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                background: pickupConfirmarPago ? "rgba(122,216,176,0.12)" : "rgba(0,0,0,0.03)",
                border: pickupConfirmarPago ? "1px solid rgba(85,201,154,0.45)" : "1px solid var(--border)",
              }}>
                <input type="checkbox" checked={pickupConfirmarPago} onChange={(e) => setPickupConfirmarPago(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--green-2)", cursor: "pointer" }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>Confirmar pago al retirar</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Marcará la venta como PAGADO en Ventas</div>
                </div>
              </label>
            )}
            <div className="hint" style={{ marginTop: 10 }}>Al confirmar, esta entrega se ocultará del calendario operativo.</div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => { setPickupModalOpen(false); setPickupTarget(null); setPickupConfirmarPago(false); }} disabled={!!actionLoadingId}>Cancelar</button>
              <button className="btn primary" type="button" onClick={confirmPickedUp} disabled={actionLoadingId === pickupTarget.id} style={{ maxWidth: 220 }}>
                {actionLoadingId === pickupTarget.id ? "Guardando..." : pickupConfirmarPago ? "Confirmar retiro y pago" : "Confirmar retiro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar pago de vencimiento */}
      {pagarModalOpen && pagarTarget && (
        <div className="modalOverlay" onMouseDown={() => { setPagarModalOpen(false); setPagarTarget(null); }}>
          <div className="modalCard" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar pago</div>
              <button className="modalClose" onClick={() => { setPagarModalOpen(false); setPagarTarget(null); }}>✕</button>
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

            <div className="provFormActions">
              <button className="btnGhost" onClick={() => { setPagarModalOpen(false); setPagarTarget(null); }}>Cancelar</button>
              <button className="btnPrimary" onClick={confirmarPagoGasto}>
                {pagarTarget.recurrente && pagarTarget.fechaVenc ? "Confirmar y generar próximo" : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}