// src/pages/PanelProfesionalPage.jsx
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { SkeletonCard, SkeletonBlock } from "../components/Skeleton";
import { toast } from "../components/Toast";

function money(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toLocaleString("es-AR") : "0";
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: 14, padding: "18px 20px",
      border: "1px solid var(--border)", boxShadow: "var(--shadow)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? "var(--text)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, opacity: 0.55 }}>{sub}</div>}
    </div>
  );
}

const CHART_COLORS = ["#55c99a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--text)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
};

function CustomTooltipVentas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CUSTOM_TOOLTIP_STYLE}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: ${money(p.value)}
        </div>
      ))}
    </div>
  );
}

function CustomTooltipPie({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={CUSTOM_TOOLTIP_STYLE}>
      <div style={{ fontWeight: 800 }}>{p.name}</div>
      <div style={{ color: p.payload.fill, fontWeight: 700 }}>
        ${money(p.value)}
      </div>
    </div>
  );
}

export default function PanelProfesionalPage() {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Datos
  const [balance,    setBalance]    = useState(null);  // { meses, gastosPorCategoria, totalVentasCobrado, totalGastos, gananciaNeta, ... }
  const [ventasStats, setVentasStats] = useState(null); // { hoy, semana, mes, mesAnt }
  const [topFrames,  setTopFrames]  = useState([]);
  const [turnosStats, setTurnosStats] = useState({ pendientes: 0, confirmados: 0, cancelados: 0, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const mesISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [bal, stats, ventas, turnos] = await Promise.allSettled([
        window.api.getBalance({}),
        window.api.getVentasStats(),
        window.api.listVentas({ pageSize: 200 }),
        window.api.listTurnosByMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      ]);

      if (bal.status === "fulfilled") setBalance(bal.value);
      if (stats.status === "fulfilled") setVentasStats(stats.value);

      // Top 5 armazones más vendidos (últimos 200 registros)
      if (ventas.status === "fulfilled") {
        const rows = ventas.value?.rows ?? [];
        const frameMap = new Map();
        for (const r of rows) {
          if (!r.armazon) continue;
          const key = r.armazon.id;
          const label = `${r.armazon.marca} ${r.armazon.modelo}${r.armazon.codigo ? ` (${r.armazon.codigo})` : ""}`;
          if (!frameMap.has(key)) frameMap.set(key, { label, count: 0, total: 0 });
          const e = frameMap.get(key);
          e.count += 1;
          e.total += Number(r.total ?? 0);
        }
        const sorted = Array.from(frameMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
        setTopFrames(sorted);
      }

      // Stats de turnos del mes
      if (turnos.status === "fulfilled") {
        const list = Array.isArray(turnos.value) ? turnos.value : [];
        setTurnosStats({
          total: list.length,
          pendientes:  list.filter((t) => t.estado === "pendiente").length,
          confirmados: list.filter((t) => t.estado === "confirmado").length,
          cancelados:  list.filter((t) => t.estado === "cancelado").length,
        });
      }
    } catch (e) {
      toast.error(e?.message || "Error cargando datos del panel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="page">
        <h2>Panel del Profesional</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <SkeletonBlock height={240} /><SkeletonBlock height={240} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <SkeletonBlock height={200} /><SkeletonBlock height={200} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h2>Panel del Profesional</h2>
        <div style={{ color: "#b91c1c", padding: 20 }}>{error}</div>
        <button className="btn" onClick={load}>Reintentar</button>
      </div>
    );
  }

  const meses = balance?.meses ?? [];
  const gastosPorCat = (balance?.gastosPorCategoria ?? []).slice(0, 6);

  // KPIs principales
  const mesActual = meses[meses.length - 1];
  const mesAnterior = meses[meses.length - 2];
  const variacionVentas = mesAnterior?.ventasCobradas
    ? (((mesActual?.ventasCobradas ?? 0) - mesAnterior.ventasCobradas) / mesAnterior.ventasCobradas * 100).toFixed(1)
    : null;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Panel del Profesional</h2>
          <div style={{ fontSize: 13, opacity: 0.55, marginTop: 4 }}>
            Resumen de rendimiento y estadísticas del negocio
          </div>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>
          Actualizar
        </button>
      </div>

      {/* ── KPIs de ventas ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Ventas hoy"
          value={`$${money(ventasStats?.hoy?.totalBruto)}`}
          sub={`${ventasStats?.hoy?.cantidad ?? 0} receta${(ventasStats?.hoy?.cantidad ?? 0) !== 1 ? "s" : ""}`}
          color="var(--green-2)"
        />
        <StatCard
          label="Ventas esta semana"
          value={`$${money(ventasStats?.semana?.totalBruto)}`}
          sub={`${ventasStats?.semana?.cantidad ?? 0} recetas`}
        />
        <StatCard
          label="Ventas este mes"
          value={`$${money(ventasStats?.mes?.totalBruto)}`}
          sub={variacionVentas !== null
            ? `${Number(variacionVentas) >= 0 ? "▲" : "▼"} ${Math.abs(variacionVentas)}% vs mes anterior`
            : `${ventasStats?.mes?.cantidad ?? 0} recetas`}
          color={variacionVentas !== null
            ? (Number(variacionVentas) >= 0 ? "#0b7a55" : "#b91c1c")
            : undefined}
        />
        <StatCard
          label="Ganancia neta (6 meses)"
          value={`$${money(balance?.gananciaNeta)}`}
          sub={`Ventas $${money(balance?.totalVentasCobrado)} – Gastos $${money(balance?.totalGastos)}`}
          color={Number(balance?.gananciaNeta ?? 0) >= 0 ? "#0b7a55" : "#b91c1c"}
        />
      </div>

      {/* ── Gráfico ventas/gastos 6 meses + Torta categorías ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Barras */}
        <div style={{
          background: "var(--card)", borderRadius: 14, padding: "20px 16px",
          border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>
            Ventas vs Gastos — últimos 6 meses
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={meses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text)", opacity: 0.6 }} />
              <YAxis
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                tick={{ fontSize: 11, fill: "var(--text)", opacity: 0.6 }}
                width={50}
              />
              <Tooltip content={<CustomTooltipVentas />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="ventasCobradas" name="Ventas cobradas" fill="#55c99a" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="gastos" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Torta gastos por categoría */}
        <div style={{
          background: "var(--card)", borderRadius: 14, padding: "20px 16px",
          border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
            Gastos por categoría
          </div>
          {gastosPorCat.length === 0 ? (
            <div style={{ opacity: 0.4, fontSize: 13, textAlign: "center", paddingTop: 40 }}>
              Sin gastos registrados
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={gastosPorCat}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={36}
                  >
                    {gastosPorCat.map((entry, i) => (
                      <Cell key={i} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltipPie />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {gastosPorCat.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                      background: g.color ?? CHART_COLORS[i % CHART_COLORS.length],
                    }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.label}
                    </span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>${money(g.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Ganancia por mes (línea simple) + Top armazones + Turnos ─────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Ganancia por mes */}
        <div style={{
          background: "var(--card)", borderRadius: 14, padding: "20px 16px",
          border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>
            Ganancia neta mensual
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={meses} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text)", opacity: 0.6 }} />
              <YAxis
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                tick={{ fontSize: 10, fill: "var(--text)", opacity: 0.6 }}
                width={46}
              />
              <Tooltip content={<CustomTooltipVentas />} />
              <Bar dataKey="ganancia" name="Ganancia" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {meses.map((entry, i) => (
                  <Cell key={i} fill={Number(entry.ganancia) >= 0 ? "#55c99a" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top armazones */}
        <div style={{
          background: "var(--card)", borderRadius: 14, padding: "20px 16px",
          border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
            Top 5 armazones más vendidos
          </div>
          {topFrames.length === 0 ? (
            <div style={{ opacity: 0.4, fontSize: 13 }}>Sin datos</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topFrames.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 11, fontWeight: 900,
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>
                      {f.count} venta{f.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                    ${money(f.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Turnos del mes */}
        <div style={{
          background: "var(--card)", borderRadius: 14, padding: "20px 16px",
          border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
            Turnos — este mes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Total",       value: turnosStats.total,       color: "var(--green-2)" },
              { label: "Confirmados", value: turnosStats.confirmados, color: "#3b82f6" },
              { label: "Pendientes",  value: turnosStats.pendientes,  color: "#f59e0b" },
              { label: "Cancelados",  value: turnosStats.cancelados,  color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color }}>{value}</span>
              </div>
            ))}
          </div>

          {turnosStats.total > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
                {turnosStats.confirmados > 0 && (
                  <div style={{ flex: turnosStats.confirmados, background: "#3b82f6" }} />
                )}
                {turnosStats.pendientes > 0 && (
                  <div style={{ flex: turnosStats.pendientes, background: "#f59e0b" }} />
                )}
                {turnosStats.cancelados > 0 && (
                  <div style={{ flex: turnosStats.cancelados, background: "#ef4444" }} />
                )}
              </div>
              <div style={{ fontSize: 10, opacity: 0.45, marginTop: 4, textAlign: "right" }}>
                {turnosStats.total} turno{turnosStats.total !== 1 ? "s" : ""} en el mes
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
