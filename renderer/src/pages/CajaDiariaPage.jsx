// src/pages/CajaDiariaPage.jsx
import { useEffect, useState } from "react";
import { toast } from "../components/Toast";
import { SkeletonTable } from "../components/Skeleton";

function money(n) {
  const num = Number.isFinite(Number(n)) ? Number(n) : 0;
  const abs = Math.abs(num);
  const [int, dec] = abs.toFixed(2).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === "00" ? intFmt : `${intFmt},${dec}`;
}
function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fmtTime(dt) { if (!dt) return "-"; const d = new Date(dt); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

const MEDIOS_PAGO = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "BILLETERA", label: "Billetera Virtual" },
  { value: "TARJETA_BANCO", label: "Tarjeta Banco" },
];

const TIPO_LABELS = { VENTA: "Venta", GASTO: "Gasto", PAGO_PROVEEDOR: "Pago proveedor", AJUSTE: "Ajuste" };

export default function CajaDiariaPage() {
  const [fecha, setFecha] = useState(todayISO());
  const [caja, setCaja] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteConcepto, setAjusteConcepto] = useState("");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteMedioPago, setAjusteMedioPago] = useState("EFECTIVO");
  const [ajusteSaving, setAjusteSaving] = useState(false);

  async function load(f) {
    setLoading(true);
    try {
      const result = f === todayISO()
        ? await window.api.getCajaDiariaHoy()
        : await window.api.getCajaDiariaPorFecha(f);
      setCaja(result);
    } catch (e) { toast.error(e?.message || "Error cargando caja"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(fecha); }, [fecha]);

  const totalIngresos = caja?.movimientos?.filter(m => m.monto > 0).reduce((a, m) => a + m.monto, 0) ?? 0;
  const totalEgresos  = caja?.movimientos?.filter(m => m.monto < 0).reduce((a, m) => a + m.monto, 0) ?? 0;

  async function saveAjuste() {
    const monto = Number(String(ajusteMonto).replace(",", ".").replace(/[^\d.-]/g, ""));
    if (!ajusteConcepto.trim()) { toast.warn("Falta concepto"); return; }
    if (!monto || !Number.isFinite(monto)) { toast.warn("Monto inválido"); return; }
    setAjusteSaving(true);
    try {
      await window.api.agregarMovimientoCaja({ concepto: ajusteConcepto.trim(), monto, medioPago: ajusteMedioPago });
      setAjusteOpen(false); setAjusteConcepto(""); setAjusteMonto(""); setAjusteMedioPago("EFECTIVO");
      await load(fecha);
      toast.success("Ajuste registrado.");
    } catch (e) { toast.error(e?.message || "Error"); }
    finally { setAjusteSaving(false); }
  }

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Caja Diaria</h1>
          <div className="pageHint">Movimientos del día.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14 }} />
          {fecha !== todayISO() && (
            <button className="btn" type="button" onClick={() => setFecha(todayISO())}>Hoy</button>
          )}
          <button className="btn primary" type="button" onClick={() => setAjusteOpen(true)}>+ Ajuste</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24 }}><SkeletonTable rows={5} cols={4} /></div>
      ) : !caja ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}><div className="empty">Sin movimientos para este día.</div></div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Saldo inicial</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>${money(caja.saldoInicial)}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Ingresos</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0b7a55" }}>+${money(totalIngresos)}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Egresos</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#d9363e" }}>-${money(Math.abs(totalEgresos))}</div>
            </div>
            <div className="card" style={{ padding: 16, border: `1px solid ${caja.saldoActual >= 0 ? "rgba(85,201,154,0.45)" : "rgba(255,77,77,0.35)"}` }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Saldo actual</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: caja.saldoActual >= 0 ? "#0b7a55" : "#d9363e" }}>${money(caja.saldoActual)}</div>
            </div>
          </div>

          {/* Movements table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {!caja.movimientos?.length ? (
              <div className="empty" style={{ padding: 32 }}>Sin movimientos este día.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="provTable">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Concepto</th>
                      <th>Tipo</th>
                      <th>Cuenta</th>
                      <th>Medio de pago</th>
                      <th style={{ textAlign: "right" }}>Monto</th>
                      <th style={{ textAlign: "right" }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caja.movimientos.map(m => (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: "nowrap", opacity: 0.7, fontSize: 13 }}>{fmtTime(m.createdAt)}</td>
                        <td style={{ fontWeight: 800 }}>{m.concepto}</td>
                        <td style={{ fontSize: 12, opacity: 0.75 }}>{TIPO_LABELS[m.tipo] ?? m.tipo}</td>
                        <td style={{ fontSize: 13 }}>{m.cuenta?.nombre ?? <span style={{ opacity: 0.4 }}>Sin cuenta</span>}</td>
                        <td style={{ fontSize: 12, opacity: 0.7 }}>{MEDIOS_PAGO.find(mp => mp.value === m.medioPago)?.label ?? m.medioPago}</td>
                        <td style={{ textAlign: "right", fontWeight: 900, color: m.monto >= 0 ? "#0b7a55" : "#d9363e" }}>
                          {m.monto >= 0 ? "+" : "-"}${money(Math.abs(m.monto))}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 900, fontSize: 13, color: m.saldoAcumulado >= 0 ? "var(--text)" : "#d9363e" }}>
                          ${money(m.saldoAcumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Ajuste modal */}
      {ajusteOpen && (
        <div className="modalOverlay" onMouseDown={() => setAjusteOpen(false)}>
          <div className="modalCard" onMouseDown={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Agregar ajuste</div>
              <button className="modalClose" type="button" onClick={() => setAjusteOpen(false)}>✕</button>
            </div>
            <div className="form">
              <div className="field">
                <label>Concepto</label>
                <input className="input" value={ajusteConcepto} onChange={e => setAjusteConcepto(e.target.value)} placeholder="Ej: Fondo de caja" />
              </div>
              <div className="field">
                <label>Monto (positivo = ingreso, negativo = egreso)</label>
                <input className="input" value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} placeholder="Ej: 5000 o -1500" />
              </div>
              <div className="field">
                <label>Medio de pago</label>
                <select className="input" value={ajusteMedioPago} onChange={e => setAjusteMedioPago(e.target.value)}>
                  {MEDIOS_PAGO.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setAjusteOpen(false)}>Cancelar</button>
              <button className="btn primary" type="button" onClick={saveAjuste} disabled={ajusteSaving}>
                {ajusteSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
