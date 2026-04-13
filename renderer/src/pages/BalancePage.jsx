// src/pages/BalancePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/index.js";
import { toast } from "../components/Toast";
import {
  BarChart as RechartBar, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

// ─── utils ────────────────────────────────────────────────────────────────────
function money(n) {
  const x = Number(n ?? 0);
  return (Number.isFinite(x) ? x : 0).toLocaleString("es-AR");
}
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const CHART_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: ${money(p.value)}</div>
      ))}
    </div>
  );
}

// ─── Gráfico de barras dobles (recharts) ─────────────────────────────────────
function BarChart({ meses }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartBar data={meses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text)", opacity: 0.6 }} />
        <YAxis
          tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
          tick={{ fontSize: 11, fill: "var(--text)", opacity: 0.6 }}
          width={50}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="ventasCobradas" name="Cobrado" fill="#55c99a" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="gastos" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </RechartBar>
    </ResponsiveContainer>
  );
}

// ─── Donut gastos por categoría (recharts) ────────────────────────────────────
function DonutChart({ datos }) {
  const total = useMemo(() => datos.reduce((a, d) => a + d.total, 0), [datos]);
  if (!datos.length || total === 0) return <div className="empty">Sin gastos en el período.</div>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flexShrink: 0 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={datos} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={36}>
              {datos.map((entry, i) => (
                <Cell key={i} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
        {datos.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color ?? CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>${money(d.total)}</span>
            <span style={{ opacity: 0.5, fontSize: 11 }}>({Math.round((d.total / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
// ── CAMBIO: recibe onNavigate para ir a Ventas y Proveedores ─────────────────
export default function BalancePage({ onNavigate }) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const today = useMemo(() => toISODate(new Date()), []);
  const primerDiaMes = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }, []);

  const balanceFiltros    = useAppStore((s) => s.balanceFiltros);
  const setBalanceFiltros = useAppStore((s) => s.setBalanceFiltros);

  const [loading,    setLoading]    = useState(false);
  const [data,       setData]       = useState(null);
  const [periodoTab, setPeriodoTab] = useState(() => balanceFiltros.periodoTab || "mes");
  const [desde,      setDesde]      = useState(() => balanceFiltros.desde || primerDiaMes);
  const [hasta,      setHasta]      = useState(() => balanceFiltros.hasta || today);
  const [pagosPorProv,  setPagosPorProv]  = useState([]); // para el donut

  useEffect(() => {
    const now = new Date();
    if (periodoTab === "mes") {
      setDesde(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`);
      setHasta(today);
    } else if (periodoTab === "semana") {
      const dia = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const lunes = new Date(now); lunes.setDate(now.getDate() - dia);
      setDesde(toISODate(lunes)); setHasta(today);
    } else if (periodoTab === "año") {
      setDesde(`${now.getFullYear()}-01-01`); setHasta(today);
    }
  }, [periodoTab, today]);

  // Persistir filtros al store cuando cambian
  useEffect(() => {
    setBalanceFiltros({ periodoTab, desde, hasta });
  }, [periodoTab, desde, hasta]);

  async function load() {
    setLoading(true);
    try {
      const [res, pagosRes] = await Promise.all([
        window.api.getBalance({ desde, hasta }),
        window.api.getPagosResumen().catch(() => []),
      ]);
      setData(res);

      // Sumar haberes por proveedor para el donut
      const pagos = Array.isArray(pagosRes) ? pagosRes : [];
      const mapaHaber = {};
      for (const mov of pagos) {
        if (!mov.haber || !mov.proveedor) continue;
        const nombre = mov.proveedor.nombre;
        mapaHaber[nombre] = (mapaHaber[nombre] || 0) + Number(mov.haber);
      }
      // Colores para proveedores en el donut
      const COLORES_PROV = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];
      const provDonut = Object.entries(mapaHaber)
        .map(([label, total], i) => ({ label, total, color: COLORES_PROV[i % COLORES_PROV.length] }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total);
      setPagosPorProv(provDonut);
    } catch (e) {
      toast.error(e?.message || "Error cargando balance");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const mesActual   = data?.meses?.[data.meses.length - 1];
  const mesAnterior = data?.meses?.[data.meses.length - 2];

  function deltaColor(actual, anterior) {
    if (!anterior || anterior === 0) return "var(--muted)";
    return actual >= anterior ? "#0b7a55" : "#d9363e";
  }
  function deltaPct(actual, anterior) {
    if (!anterior || anterior === 0) return null;
    const pct = Math.round(((actual - anterior) / anterior) * 100);
    return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
  }

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Balance</h1>
          <div className="pageHint">Ventas cobradas vs gastos pagados.</div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[["semana","Esta semana"],["mes","Este mes"],["año","Este año"],["custom","Personalizado"]].map(([k,l]) => (
            <button key={k} type="button" className={`pillBtn ${periodoTab === k ? "active" : ""}`}
              onClick={() => setPeriodoTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div className="field">
            <span>Desde</span>
            <input type="date" value={desde}
              onChange={(e) => { setDesde(e.target.value); setPeriodoTab("custom"); }} />
          </div>
          <div className="field">
            <span>Hasta</span>
            <input type="date" value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPeriodoTab("custom"); }} />
          </div>
          <button className="btn primary" type="button" style={{ width: "auto", alignSelf: "end" }}
            onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Calcular"}
          </button>
        </div>
      </div>

      {!data ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div className="hint">Cargando balance...</div>
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Ventas brutas</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>${money(data.totalVentasBruto)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{data.cantidadVentas} venta{data.cantidadVentas === 1 ? "" : "s"}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Cobrado</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0b7a55" }}>${money(data.totalVentasCobrado)}</div>
              {data.totalVentasBruto > data.totalVentasCobrado && (
                <div style={{ fontSize: 12, color: "#8a4b00", marginTop: 4 }}>
                  Pendiente: ${money(data.totalVentasBruto - data.totalVentasCobrado)}
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Gastos pagados</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#d9363e" }}>${money(data.totalGastos)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{data.cantidadGastos} gasto{data.cantidadGastos === 1 ? "" : "s"}</div>
            </div>
            <div className="card" style={{ padding: 16, border: `1px solid ${data.gananciaNeta >= 0 ? "rgba(85,201,154,0.45)" : "rgba(255,77,77,0.35)"}`, background: data.gananciaNeta >= 0 ? "rgba(122,216,176,0.08)" : "rgba(255,77,77,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Ganancia neta</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: data.gananciaNeta >= 0 ? "#0b7a55" : "#d9363e" }}>
                {data.gananciaNeta < 0 ? "-" : ""}${money(Math.abs(data.gananciaNeta))}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "var(--muted)" }}>Cobrado − Gastos</div>
            </div>
          </div>

          {/* ── Comparativa vs mes anterior ── */}
          {mesActual && mesAnterior && (
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>Comparativa vs mes anterior</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  ["Cobrado",  mesActual.ventasCobradas, mesAnterior.ventasCobradas],
                  ["Gastos",   mesActual.gastos,         mesAnterior.gastos],
                  ["Ganancia", mesActual.ganancia,        mesAnterior.ganancia],
                ].map(([label, actual, anterior]) => (
                  <div key={label} style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>${money(actual)}</div>
                    {deltaPct(actual, anterior) && (
                      <div style={{ fontSize: 12, fontWeight: 900, marginTop: 4, color: deltaColor(actual, anterior) }}>
                        {deltaPct(actual, anterior)} vs ${money(anterior)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Gráfico 6 meses ── */}
          {data.meses?.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>Evolución últimos 6 meses</div>
              <BarChart meses={data.meses} />
            </div>
          )}

          {/* ── Desglose gastos por categoría ── */}
          {data.gastosPorCategoria?.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>Gastos por categoría</div>
              <DonutChart datos={data.gastosPorCategoria} />
            </div>
          )}

          {/* ── Pagos a proveedores ── */}
          {pagosPorProv.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 12 }}>Pagos a proveedores</div>
              <DonutChart datos={pagosPorProv} />
            </div>
          )}

        </>
      )}

    </div>
  );
}