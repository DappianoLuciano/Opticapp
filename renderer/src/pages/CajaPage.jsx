// src/pages/CajaPage.jsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "../components/Toast";
import { SkeletonTable, SkeletonCard } from "../components/Skeleton";
import { ConfirmDialog } from "../components/ConfirmDialog";

function money(n) {
  const num = Number.isFinite(Number(n)) ? Number(n) : 0;
  const abs = Math.abs(num);
  const [int, dec] = abs.toFixed(2).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === "00" ? intFmt : `${intFmt},${dec}`;
}
function parseMoney(s) {
  const str = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number(str) || 0;
}
function handleMoneyInput(raw, allowNegative = false) {
  let clean = String(raw).replace(/[^\d-]/g, "");
  if (!allowNegative) clean = clean.replace(/-/g, "");
  const neg = allowNegative && clean.startsWith("-");
  const digits = clean.replace(/-/g, "");
  if (!digits) return neg ? "-" : "";
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg ? "-" + formatted : formatted;
}
function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fmtTime(dt) { if (!dt) return "-"; const d = new Date(dt); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

const MEDIOS_PAGO = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia / Billetera Virtual" },
  { value: "TARJETA_BANCO", label: "Déb./Cré. Bancarios" },
];

const TIPO_LABELS = {
  VENTA: "Venta",
  GASTO: "Gasto",
  PAGO_PROVEEDOR: "Proveedor",
  AJUSTE: "Ajuste",
};

const TIPO_COLORS = {
  VENTA: { bg: "rgba(11,122,85,0.12)", color: "#0b7a55" },
  GASTO: { bg: "rgba(217,54,62,0.12)", color: "#d9363e" },
  PAGO_PROVEEDOR: { bg: "rgba(234,179,8,0.12)", color: "#b45309" },
  AJUSTE: { bg: "rgba(99,102,241,0.12)", color: "#6366f1" },
};

const EMPTY_FORM = { nombre: "", medioPago: "EFECTIVO", saldoInicial: "0" };

export default function CajaPage() {
  // ── Cuentas ──────────────────────────────────────────────
  const [cuentas, setCuentas]           = useState([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formErr, setFormErr]           = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(null); // id de cuenta a desactivar

  // ── Flujo de caja ────────────────────────────────────────
  const [fecha, setFecha]               = useState(todayISO());
  const [caja, setCaja]                 = useState(null);
  const [loadingCaja, setLoadingCaja]   = useState(false);
  const [movTab, setMovTab]             = useState("todos");
  const [ajusteOpen, setAjusteOpen]     = useState(false);
  const [ajusteConcepto, setAjusteConcepto] = useState("");
  const [ajusteMonto, setAjusteMonto]   = useState("");
  const [ajusteMedioPago, setAjusteMedioPago] = useState("EFECTIVO");
  const [ajusteSaving, setAjusteSaving] = useState(false);

  async function loadCuentas() {
    setLoadingCuentas(true);
    try { setCuentas(await window.api.getCajaSaldos()); }
    catch (e) { toast.error(e?.message || "Error cargando cuentas"); }
    finally { setLoadingCuentas(false); }
  }

  async function loadCaja(f) {
    setLoadingCaja(true);
    try {
      const result = f === todayISO()
        ? await window.api.getCajaDiariaHoy()
        : await window.api.getCajaDiariaPorFecha(f);
      setCaja(result);
    } catch (e) { toast.error(e?.message || "Error cargando flujo"); }
    finally { setLoadingCaja(false); }
  }

  useEffect(() => { loadCuentas(); }, []);
  useEffect(() => { loadCaja(fecha); }, [fecha]);

  // ── Cuentas computed ─────────────────────────────────────
  const totalSaldo = cuentas.reduce((a, c) => a + Number(c.saldoActual ?? 0), 0);

  // ── Flujo computed ───────────────────────────────────────
  const countByTipo = useMemo(() => {
    const movs = caja?.movimientos ?? [];
    return {
      gastos:      movs.filter(m => m.tipo === "GASTO").length,
      ventas:      movs.filter(m => m.tipo === "VENTA").length,
      proveedores: movs.filter(m => m.tipo === "PAGO_PROVEEDOR").length,
    };
  }, [caja]);

  const movFiltrados = useMemo(() => {
    const movs = caja?.movimientos ?? [];
    if (movTab === "gastos")      return movs.filter(m => m.tipo === "GASTO");
    if (movTab === "ventas")      return movs.filter(m => m.tipo === "VENTA");
    if (movTab === "proveedores") return movs.filter(m => m.tipo === "PAGO_PROVEEDOR");
    return movs;
  }, [caja, movTab]);

  // ── Account modal ─────────────────────────────────────────
  function openNew() { setEditingId(null); setForm(EMPTY_FORM); setFormErr(""); setModalOpen(true); }
  function openEdit(c) {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, medioPago: c.medioPago, saldoInicial: money(c.saldoInicial ?? 0) });
    setFormErr(""); setModalOpen(true);
  }

  async function onSave() {
    if (!form.nombre.trim()) { setFormErr("Falta el nombre."); return; }
    const saldoInicial = parseMoney(form.saldoInicial);
    setSaving(true); setFormErr("");
    try {
      if (editingId) {
        await window.api.updateCuenta({ id: editingId, nombre: form.nombre.trim(), medioPago: form.medioPago, saldoInicial });
      } else {
        await window.api.createCuenta({ nombre: form.nombre.trim(), medioPago: form.medioPago, saldoInicial });
      }
      setModalOpen(false);
      await loadCuentas();
      toast.success(editingId ? "Cuenta actualizada." : "Cuenta creada.");
    } catch (e) { setFormErr(e?.message || "Error"); }
    finally { setSaving(false); }
  }

  async function onDelete(id) {
    setConfirmDeactivate(id);
  }

  async function doDeactivate() {
    const id = confirmDeactivate;
    setConfirmDeactivate(null);
    try { await window.api.deleteCuenta(id); await loadCuentas(); toast.success("Cuenta desactivada."); }
    catch (e) { toast.error(e?.message || "Error"); }
  }

  // ── Ajuste modal ──────────────────────────────────────────
  async function saveAjuste() {
    const monto = parseMoney(ajusteMonto);
    if (!ajusteConcepto.trim()) { toast.warn("Falta concepto"); return; }
    if (!monto || !Number.isFinite(monto)) { toast.warn("Monto inválido"); return; }
    setAjusteSaving(true);
    try {
      await window.api.agregarMovimientoCaja({ concepto: ajusteConcepto.trim(), monto, medioPago: ajusteMedioPago });
      setAjusteOpen(false);
      setAjusteConcepto(""); setAjusteMonto(""); setAjusteMedioPago("EFECTIVO");
      await Promise.all([loadCaja(fecha), loadCuentas()]);
      toast.success("Ajuste registrado.");
    } catch (e) { toast.error(e?.message || "Error"); }
    finally { setAjusteSaving(false); }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Caja</h1>
          <div className="pageHint">Saldo por cuenta y flujo diario.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btnGhost" type="button"
            onClick={() => Promise.all([loadCuentas(), loadCaja(fecha)])}
            style={{ fontSize: 12, padding: "4px 12px" }}>
            ↻ Actualizar
          </button>
          <button className="btnGhost" type="button" onClick={openNew}
            style={{ fontSize: 12, padding: "4px 12px" }}>
            + Nueva cuenta
          </button>
        </div>
      </div>

      {/* ── Cuentas ── */}
      {loadingCuentas ? (
        <div className="card" style={{ padding: 24 }}><SkeletonTable rows={3} cols={4} /></div>
      ) : cuentas.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="empty">No hay cuentas configuradas. Creá una para empezar.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          {cuentas.map((c, i) => {
            const saldo = Number(c.saldoActual ?? 0);
            const medio = MEDIOS_PAGO.find(m => m.value === c.medioPago)?.label ?? c.medioPago;
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: i < cuentas.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{medio}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: saldo < 0 ? "#d9363e" : "#0b7a55", marginRight: 16 }}>
                  {saldo < 0 ? "-" : ""}${money(Math.abs(saldo))}
                </div>
                <button className="btnGhost" type="button" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => openEdit(c)}>Editar</button>
              </div>
            );
          })}
          {/* Total destacado */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            background: totalSaldo >= 0 ? "rgba(85,201,154,0.10)" : "rgba(255,77,77,0.08)",
            borderTop: "2px solid var(--border)",
          }}>
            <div style={{ fontWeight: 900, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Total en caja</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: totalSaldo < 0 ? "#d9363e" : "#0b7a55" }}>
              {totalSaldo < 0 ? "-" : ""}${money(Math.abs(totalSaldo))}
            </div>
          </div>
        </div>
      )}

      {/* ── Flujo de Caja header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Flujo de Caja</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14 }}
          />
          {fecha !== todayISO() && (
            <button className="btn" type="button" onClick={() => setFecha(todayISO())}>Hoy</button>
          )}
          <button className="btn" type="button" onClick={() => setAjusteOpen(true)}
            style={{ padding: "6px 10px", fontSize: 14 }}>
            + Ajuste
          </button>
        </div>
      </div>

      {/* ── Flujo content ── */}
      {loadingCaja ? (
        <div className="card" style={{ padding: 24 }}><SkeletonTable rows={6} cols={4} /></div>
      ) : !caja ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="empty">Sin movimientos para este día.</div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[
              { key: "todos",       label: `Todos (${caja.movimientos.length})` },
              { key: "gastos",      label: `Gastos (${countByTipo.gastos})` },
              { key: "ventas",      label: `Ventas (${countByTipo.ventas})` },
              { key: "proveedores", label: `Proveedores (${countByTipo.proveedores})` },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                className={movTab === t.key ? "btn primary" : "btn"}
                style={{ fontSize: 13, padding: "5px 14px" }}
                onClick={() => setMovTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tabla movimientos */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="provTable">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Cuenta</th>
                    <th style={{ textAlign: "right" }}>Monto</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Fila saldo inicial — siempre visible */}
                  <tr style={{ background: "var(--green-soft)" }}>
                    <td style={{ opacity: 0.5, fontSize: 13 }}>—</td>
                    <td style={{ fontWeight: 800, color: "var(--text)" }}>Saldo inicial</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 900, fontSize: 15 }}>
                      ${money(caja.saldoInicial)}
                    </td>
                  </tr>
                  {movFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>
                        Sin movimientos{movTab !== "todos" ? " en esta categoría" : ""} este día.
                      </td>
                    </tr>
                  ) : movFiltrados.map(m => {
                    const tipoStyle = TIPO_COLORS[m.tipo] ?? { bg: "var(--border)", color: "var(--muted)" };
                    return (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: "nowrap", opacity: 0.65, fontSize: 13 }}>{fmtTime(m.createdAt)}</td>
                        <td style={{ fontWeight: 700 }}>{m.concepto}</td>
                        <td>
                          <span style={{
                            background: tipoStyle.bg,
                            color: tipoStyle.color,
                            padding: "2px 9px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}>
                            {TIPO_LABELS[m.tipo] ?? m.tipo}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--muted)" }}>{m.cuenta?.nombre ?? "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 900, color: m.monto >= 0 ? "#0b7a55" : "#d9363e" }}>
                          {m.monto >= 0 ? "+" : "-"}${money(Math.abs(m.monto))}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 900, color: m.saldoAcumulado >= 0 ? "var(--text)" : "#d9363e" }}>
                          ${money(m.saldoAcumulado)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila saldo final */}
                  {movFiltrados.length > 0 && (
                    <tr style={{ background: caja.saldoActual >= 0 ? "rgba(85,201,154,0.10)" : "rgba(255,77,77,0.08)", borderTop: "2px solid var(--border)" }}>
                      <td style={{ opacity: 0.5, fontSize: 13 }}>—</td>
                      <td style={{ fontWeight: 800 }}>Saldo final</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "right", fontWeight: 900, fontSize: 15, color: caja.saldoActual >= 0 ? "#0b7a55" : "#d9363e" }}>
                        ${money(caja.saldoActual)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modal nueva/editar cuenta ── */}
      {modalOpen && (
        <div className="modalOverlay" onMouseDown={() => setModalOpen(false)}>
          <div className="modalCard" onMouseDown={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">{editingId ? "Editar cuenta" : "Nueva cuenta"}</div>
              <button className="modalClose" type="button" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="form">
              <div className="field">
                <label>Nombre</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Efectivo mostrador" />
              </div>
              <div className="field">
                <label>Medio de pago asociado</label>
                <select className="input" value={form.medioPago} onChange={e => setForm(f => ({ ...f, medioPago: e.target.value }))}>
                  {MEDIOS_PAGO.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Saldo inicial</label>
                <input className="input" value={form.saldoInicial}
                  onChange={e => setForm(f => ({ ...f, saldoInicial: handleMoneyInput(e.target.value) }))}
                  placeholder="0" />
              </div>
              {formErr && <div style={{ color: "#d9363e", fontSize: 13 }}>{formErr}</div>}
            </div>
            <div className="modalActions">
              {editingId && (
                <button type="button" onClick={() => onDelete(editingId)}
                  className="btn" style={{ background: "rgba(255,77,77,0.10)", borderColor: "rgba(255,77,77,0.35)", color: "#b91c1c" }}>
                  Desactivar cuenta
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn primary" type="button" onClick={onSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajuste ── */}
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
                <input className="input" value={ajusteMonto}
                  onChange={e => setAjusteMonto(handleMoneyInput(e.target.value, true))}
                  placeholder="Ej: 5.000 o -1.500" />
              </div>
              <div className="field">
                <label>Medio de pago</label>
                <select className="input" value={ajusteMedioPago} onChange={e => setAjusteMedioPago(e.target.value)}>
                  {MEDIOS_PAGO.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modalActions" style={{ flexDirection: "column", gap: 8 }}>
              <button className="btn primary" type="button" onClick={saveAjuste} disabled={ajusteSaving}
                style={{ width: "100%", padding: "10px 0", fontSize: 15 }}>
                {ajusteSaving ? "Guardando..." : "Guardar ajuste"}
              </button>
              <button className="btn" type="button" onClick={() => setAjusteOpen(false)}
                style={{ width: "100%", textAlign: "center" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeactivate}
        title="¿Desactivar cuenta?"
        message="La cuenta quedará inactiva. Los movimientos existentes no se eliminan."
        confirmLabel="Desactivar"
        danger
        onConfirm={doDeactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
