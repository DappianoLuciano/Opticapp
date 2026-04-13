// src/pages/InventarioPage.jsx
import { useEffect, useMemo, useState } from "react";
import trashIcon from "../assets/trash.png";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../components/Toast";
import { SkeletonTable } from "../components/Skeleton";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatThousands(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}
function toIntOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
}
function money(n) {
  if (n === null || n === undefined || n === "") return "-";
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("es-AR");
}
function clampInt(v) {
  const clean = String(v ?? "").replace(/\D/g, "");
  const n = Number(clean);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.floor(n));
}
function formatMiles(v) {
  const s = String(v ?? "").replace(/\./g, "").replace(/\D/g, "");
  if (!s) return "";
  return Number(s).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}
function handlePrecioChange(e, setter) {
  const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
  setter(raw);
}

// Multiplicadores fijos — igual que StockPage
const MULTIPLICADORES = [2.1, 2.2, 2.3, 2.4, 2.5];

function aplicarMult(mult, costoRaw, setPF) {
  const c = Number(String(costoRaw ?? "").replace(/\./g, ""));
  if (!c || !Number.isFinite(c)) return;
  setPF(String(Math.round(c * mult)));
}

// ─────────────────────────────────────────────
// ARMAZONES
// ─────────────────────────────────────────────
function ArmazonesTab({ showToast }) {
  const [loading, setLoading]         = useState(false);
  const [frames, setFrames]           = useState([]);
  const [marca, setMarca]             = useState("");
  const [modelo, setModelo]           = useState("");
  const [codigo, setCodigo]           = useState("");
  const [costo, setCosto]             = useState("");
  const [precioFinal, setPrecioFinal] = useState("");
  const [stockInit, setStockInit]     = useState(0);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [addErrs,     setAddErrs]     = useState({ marca: "", modelo: "" });
  const [editErrs,    setEditErrs]    = useState({ marca: "", modelo: "" });

  // ── Estado modal editar ────────────────────────────────────────────────────
  const [editOpen, setEditOpen]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [eMarca, setEMarca]           = useState("");
  const [eModelo, setEModelo]         = useState("");
  const [eCodigo, setECodigo]         = useState("");
  const [eCosto, setECosto]           = useState("");
  const [ePrecioFinal, setEPrecioFinal] = useState("");
  const [eStock, setEStock]           = useState(0);

  function openEdit(f) {
    setEditId(f.id);
    setEMarca(f.marca || "");
    setEModelo(f.modelo || "");
    setECodigo(f.codigo || "");
    setECosto(f.costo ? String(Math.round(f.costo)) : "");
    setEPrecioFinal(f.precioFinal ? String(Math.round(f.precioFinal)) : "");
    setEStock(Number(f.stock ?? 0));
    setEditErrs({ marca: "", modelo: "" });
    setEditOpen(true);
  }

  async function onSaveEdit() {
    const errs = { marca: "", modelo: "" };
    if (!eMarca.trim()) errs.marca = "La marca es requerida.";
    if (!eModelo.trim()) errs.modelo = "El modelo es requerido.";
    if (errs.marca || errs.modelo) { setEditErrs(errs); return; }
    setEditErrs({ marca: "", modelo: "" });
    try {
      setLoading(true);
      await window.api.updateFrame({
        id:          editId,
        marca:       eMarca.trim(),
        modelo:      eModelo.trim(),
        codigo:      eCodigo.trim(),
        costo:       eCosto,
        precioFinal: ePrecioFinal || null,
        stock:       eStock,
      });
      showToast("Armazón actualizado");
      setEditOpen(false);
      await load();
    } catch { showToast("Error actualizando armazón"); }
    finally { setLoading(false); }
  }

  async function load() {
    try {
      setLoading(true);
      const data = await window.api.listFrames();
      setFrames(Array.isArray(data) ? data : []);
    } catch { showToast("Error cargando armazones"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault();
    const errs = { marca: "", modelo: "" };
    if (!marca.trim()) errs.marca = "La marca es requerida.";
    if (!modelo.trim()) errs.modelo = "El modelo es requerido.";
    if (errs.marca || errs.modelo) { setAddErrs(errs); return; }
    setAddErrs({ marca: "", modelo: "" });
    try {
      await window.api.createFrame({
        marca: marca.trim(), modelo: modelo.trim(), codigo: codigo.trim(),
        costo, precioFinal: precioFinal || null, stock: clampInt(stockInit),
      });
      setMarca(""); setModelo(""); setCodigo(""); setCosto(""); setPrecioFinal(""); setStockInit(0);
      await load();
      showToast("Armazón guardado");
    } catch { showToast("Error creando armazón"); }
  }

  async function changeStock(id, delta) {
    try { await window.api.updateFrameStock({ armazonId: id, delta }); await load(); }
    catch { showToast("No se pudo actualizar stock"); }
  }

  async function doDelete() {
    if (!rowToDelete) return;
    try {
      setLoading(true);
      await window.api.deleteFrame(rowToDelete.id);
      showToast("Armazón eliminado");
      setRowToDelete(null);
      await load();
    } catch { showToast("Error eliminando armazón"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <section className="card">
        <h3>Agregar armazón</h3>
        <form className="form" onSubmit={onCreate}>
          <div className="grid2">
            <div className="field">
              <span>Marca *</span>
              <input
                className={addErrs.marca ? "inputError" : ""}
                value={marca}
                onChange={(e) => { setMarca(e.target.value); if (addErrs.marca) setAddErrs((p) => ({ ...p, marca: "" })); }}
              />
              <div className="fieldErrorSlot">{addErrs.marca}</div>
            </div>
            <div className="field">
              <span>Modelo *</span>
              <input
                className={addErrs.modelo ? "inputError" : ""}
                value={modelo}
                onChange={(e) => { setModelo(e.target.value); if (addErrs.modelo) setAddErrs((p) => ({ ...p, modelo: "" })); }}
              />
              <div className="fieldErrorSlot">{addErrs.modelo}</div>
            </div>
          </div>
          <div className="grid2">
            <label className="field"><span>Código</span>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
            <label className="field">
              <span>Stock inicial</span>
              <div className="stepper" style={{ gridTemplateColumns: "38px 1fr 38px", maxWidth: 220 }}>
                <button type="button" className="stepBtn" onClick={() => setStockInit((v) => Math.max(0, clampInt(v) - 1))}>-</button>
                <input value={formatThousands(String(stockInit))} onChange={(e) => setStockInit(clampInt(e.target.value))} inputMode="numeric" style={{ textAlign: "center" }} />
                <button type="button" className="stepBtn" onClick={() => setStockInit((v) => clampInt(v) + 1)}>+</button>
              </div>
            </label>
          </div>

          {/* Costo + botones multiplicadores + Precio Final */}
          <div className="grid2">
            <div className="field">
              <span>Costo ($)</span>
              <input value={formatMiles(costo)} onChange={(e) => handlePrecioChange(e, setCosto)} inputMode="numeric" placeholder="Ej: 25.000" />
              <div className="multRow">
                {MULTIPLICADORES.map((m) => (
                  <button key={m} type="button" className="multBtn" onClick={() => aplicarMult(m, costo, setPrecioFinal)}>×{m}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Precio final ($)</span>
              <input value={formatMiles(precioFinal)} onChange={(e) => handlePrecioChange(e, setPrecioFinal)} inputMode="numeric" placeholder="Se calcula con ×" />
            </label>
          </div>

          {/* Preview total en stock */}
          {(() => {
            const pf = Number(precioFinal) || 0;
            const st = clampInt(stockInit);
            if (!pf || !st) return null;
            return (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(85,201,154,0.10)", border: "1px solid rgba(85,201,154,0.30)", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase" }}>Total en stock:</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#0b7a55" }}>${money(pf * st)}</span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>(${money(pf)} × {st} u.)</span>
              </div>
            );
          })()}

          <button className="btn primary" disabled={loading}>Guardar armazón</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Inventario</h3>
        <table className="provTable" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Código</th>
              <th>Costo</th>
              <th>P. Final</th>
              <th style={{ textAlign: "center" }}>Stock</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={7} style={{ padding: 16 }}><SkeletonTable rows={5} cols={7} /></td></tr>
              : frames.length === 0
              ? <tr><td colSpan={7} className="empty">No hay armazones</td></tr>
              : frames.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 900 }}>{f.marca}</td>
                  <td style={{ fontWeight: 900 }}>{f.modelo}</td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{f.codigo || "-"}</td>
                  <td>{f.costo ? `$${money(f.costo)}` : "-"}</td>
                  <td style={{ fontWeight: 900, color: "#0b7a55" }}>{f.precioFinal ? `$${money(f.precioFinal)}` : "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 13, fontWeight: 900, padding: "3px 10px", borderRadius: 999,
                      background: Number(f.stock) === 0
                        ? "rgba(217,54,62,0.12)"
                        : Number(f.stock) <= 3
                        ? "rgba(251,146,60,0.12)"
                        : "transparent",
                      color: Number(f.stock) === 0
                        ? "#b91c1c"
                        : Number(f.stock) <= 3
                        ? "#b45309"
                        : "inherit",
                      border: Number(f.stock) === 0
                        ? "1px solid rgba(217,54,62,0.30)"
                        : Number(f.stock) <= 3
                        ? "1px solid rgba(251,146,60,0.30)"
                        : "1px solid transparent",
                    }}>
                      {Number(f.stock ?? 0).toLocaleString("es-AR")}
                      {Number(f.stock) === 0 && <span style={{ fontSize: 10, fontWeight: 700 }}>Sin stock</span>}
                      {Number(f.stock) > 0 && Number(f.stock) <= 3 && <span style={{ fontSize: 10, fontWeight: 700 }}>Bajo</span>}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="stepBtn" onClick={() => changeStock(f.id, -1)}>-</button>
                      <button type="button" className="stepBtn" onClick={() => changeStock(f.id, +1)}>+</button>
                      <button type="button" className="btnSmall" onClick={() => openEdit(f)}>Editar</button>
                      <button type="button" className="iconBtn dangerIcon" onClick={() => setRowToDelete(f)}>
                        <img src={trashIcon} alt="Eliminar" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </section>

      {rowToDelete && (
        <div className="modalOverlay" onMouseDown={() => setRowToDelete(null)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button className="modalClose" type="button" onClick={() => setRowToDelete(null)}>✕</button>
            </div>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>¿Eliminar "{rowToDelete.marca} {rowToDelete.modelo}"?</div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setRowToDelete(null)} disabled={loading}>Cancelar</button>
              <button className="btn danger" type="button" onClick={doDelete} disabled={loading}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar armazón ── */}
      {editOpen && (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modalHeader">
              <div className="modalTitle">Editar armazón</div>
              <button className="modalClose" type="button" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <div className="form">
              <div className="grid2">
                <div className="field">
                  <span>Marca *</span>
                  <input
                    className={editErrs.marca ? "inputError" : ""}
                    value={eMarca}
                    onChange={(e) => { setEMarca(e.target.value); if (editErrs.marca) setEditErrs((p) => ({ ...p, marca: "" })); }}
                  />
                  <div className="fieldErrorSlot">{editErrs.marca}</div>
                </div>
                <div className="field">
                  <span>Modelo *</span>
                  <input
                    className={editErrs.modelo ? "inputError" : ""}
                    value={eModelo}
                    onChange={(e) => { setEModelo(e.target.value); if (editErrs.modelo) setEditErrs((p) => ({ ...p, modelo: "" })); }}
                  />
                  <div className="fieldErrorSlot">{editErrs.modelo}</div>
                </div>
              </div>
              <div className="grid2">
                <label className="field"><span>Código</span>
                  <input value={eCodigo} onChange={(e) => setECodigo(e.target.value)} />
                </label>
                <label className="field">
                  <span>Stock</span>
                  <div className="stepper" style={{ gridTemplateColumns: "38px 1fr 38px", maxWidth: 220 }}>
                    <button type="button" className="stepBtn" onClick={() => setEStock((v) => Math.max(0, v - 1))}>-</button>
                    <input value={formatThousands(String(eStock))} onChange={(e) => setEStock(clampInt(e.target.value))} inputMode="numeric" style={{ textAlign: "center" }} />
                    <button type="button" className="stepBtn" onClick={() => setEStock((v) => v + 1)}>+</button>
                  </div>
                </label>
              </div>
              <div className="grid2">
                <div className="field">
                  <span>Costo ($)</span>
                  <input value={formatMiles(eCosto)} onChange={(e) => handlePrecioChange(e, setECosto)} inputMode="numeric" placeholder="Ej: 25.000" />
                  <div className="multRow">
                    {MULTIPLICADORES.map((m) => (
                      <button key={m} type="button" className="multBtn" onClick={() => aplicarMult(m, eCosto, setEPrecioFinal)}>×{m}</button>
                    ))}
                  </div>
                </div>
                <label className="field">
                  <span>Precio final ($)</span>
                  <input value={formatMiles(ePrecioFinal)} onChange={(e) => handlePrecioChange(e, setEPrecioFinal)} inputMode="numeric" placeholder="Se calcula con ×" />
                </label>
              </div>
            </div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setEditOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btn primary" type="button" onClick={onSaveEdit} disabled={loading} style={{ width: "auto", padding: "10px 24px" }}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// VIDRIOS
// ─────────────────────────────────────────────
function FilaPrecio({ labelCosto, labelFinal, costoVal, setCosto, finalVal, setFinal }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
      <div className="field">
        <span>{labelCosto}</span>
        <input value={formatMiles(costoVal)} onChange={(e) => handlePrecioChange(e, setCosto)} inputMode="numeric" placeholder="Ej: 4.400" />
        <div className="multRow">
          {MULTIPLICADORES.map((m) => (
            <button key={m} type="button" className="multBtn" onClick={() => aplicarMult(m, costoVal, setFinal)}>×{m}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{labelFinal}</span>
        <input value={formatMiles(finalVal)} onChange={(e) => handlePrecioChange(e, setFinal)} inputMode="numeric" placeholder="Se calcula con ×" />
      </div>
    </div>
  );
}

function VidriosTab({ showToast }) {
  const [loading, setLoading] = useState(false);
  const [vidrios, setVidrios] = useState([]);
  const [q, setQ]             = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [nombre, setNombre]           = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioCal, setPrecioCal]                   = useState("");
  const [precioRanura, setPrecioRanura]             = useState("");
  const [precioPerforado, setPrecioPerforado]       = useState("");
  const [precioCalFinal, setPrecioCalFinal]                   = useState("");
  const [precioRanuraFinal, setPrecioRanuraFinal]             = useState("");
  const [precioPerforadoFinal, setPrecioPerforadoFinal]       = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [eNombre, setENombre]           = useState("");
  const [eDescripcion, setEDescripcion] = useState("");
  const [ePrecioCal, setEPrecioCal]                   = useState("");
  const [ePrecioRanura, setEPrecioRanura]             = useState("");
  const [ePrecioPerforado, setEPrecioPerforado]       = useState("");
  const [ePrecioCalFinal, setEPrecioCalFinal]                   = useState("");
  const [ePrecioRanuraFinal, setEPrecioRanuraFinal]             = useState("");
  const [ePrecioPerforadoFinal, setEPrecioPerforadoFinal]       = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const list = await window.api.listVidrios();
      setVidrios(Array.isArray(list) ? list : []);
    } catch (e) { showToast(e?.message || "Error cargando vidrios"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return vidrios;
    return vidrios.filter((v) =>
      (v.nombre || "").toLowerCase().includes(term) ||
      (v.descripcion || "").toLowerCase().includes(term)
    );
  }, [debouncedQ, vidrios]);

  async function onCreate(e) {
    e.preventDefault();
    if (!nombre.trim()) return showToast("Nombre requerido");
    try {
      setLoading(true);
      await window.api.createVidrio({
        nombre: nombre.trim(), descripcion: descripcion.trim() || null,
        precioCal:       toIntOrNull(precioCal),
        precioRanura:    toIntOrNull(precioRanura),
        precioPerforado: toIntOrNull(precioPerforado),
        precioCalFinal:       toIntOrNull(precioCalFinal),
        precioRanuraFinal:    toIntOrNull(precioRanuraFinal),
        precioPerforadoFinal: toIntOrNull(precioPerforadoFinal),
      });
      showToast("Vidrio creado");
      setNombre(""); setDescripcion("");
      setPrecioCal(""); setPrecioRanura(""); setPrecioPerforado("");
      setPrecioCalFinal(""); setPrecioRanuraFinal(""); setPrecioPerforadoFinal("");
      await load();
    } catch (e) { showToast(e?.message || "Error creando vidrio"); }
    finally { setLoading(false); }
  }

  function openEdit(v) {
    setEditId(v.id);
    setENombre(v.nombre || ""); setEDescripcion(v.descripcion || "");
    setEPrecioCal(v.precioCal == null ? "" : String(v.precioCal));
    setEPrecioRanura(v.precioRanura == null ? "" : String(v.precioRanura));
    setEPrecioPerforado(v.precioPerforado == null ? "" : String(v.precioPerforado));
    setEPrecioCalFinal(v.precioCalFinal == null ? "" : String(v.precioCalFinal));
    setEPrecioRanuraFinal(v.precioRanuraFinal == null ? "" : String(v.precioRanuraFinal));
    setEPrecioPerforadoFinal(v.precioPerforadoFinal == null ? "" : String(v.precioPerforadoFinal));
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!String(eNombre || "").trim()) return showToast("Nombre requerido");
    try {
      setLoading(true);
      await window.api.updateVidrio({
        id: Number(editId),
        nombre: String(eNombre || "").trim(), descripcion: String(eDescripcion || "").trim() || null,
        precioCal:       toIntOrNull(ePrecioCal),
        precioRanura:    toIntOrNull(ePrecioRanura),
        precioPerforado: toIntOrNull(ePrecioPerforado),
        precioCalFinal:       toIntOrNull(ePrecioCalFinal),
        precioRanuraFinal:    toIntOrNull(ePrecioRanuraFinal),
        precioPerforadoFinal: toIntOrNull(ePrecioPerforadoFinal),
      });
      showToast("Vidrio actualizado");
      setEditOpen(false); setEditId(null);
      await load();
    } catch (e) { showToast(e?.message || "Error actualizando vidrio"); }
    finally { setLoading(false); }
  }

  async function doDelete() {
    if (!confirmItem) return;
    try {
      setLoading(true);
      await window.api.deleteVidrio(Number(confirmItem.id));
      showToast("Vidrio eliminado");
      setConfirmOpen(false); setConfirmItem(null);
      await load();
    } catch (e) { showToast(e?.message || "Error eliminando vidrio"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <section className="card">
        <h3>Agregar vidrio</h3>
        <form onSubmit={onCreate} className="form" style={{ marginTop: 10 }}>
          <div className="grid2">
            <label className="field"><span>Nombre *</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder='Ej: "Orgánico blanco"...' />
            </label>
            <label className="field"><span>Descripción (opcional)</span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Ej: "-400 a +400 / cil ±4"...' />
            </label>
          </div>
          <FilaPrecio labelCosto="Costo Calibrado Común ($)" labelFinal="Precio final Calibrado Común ($)" costoVal={precioCal} setCosto={setPrecioCal} finalVal={precioCalFinal} setFinal={setPrecioCalFinal} />
          <FilaPrecio labelCosto="Costo RANURA ($)" labelFinal="Precio final RANURA ($)" costoVal={precioRanura} setCosto={setPrecioRanura} finalVal={precioRanuraFinal} setFinal={setPrecioRanuraFinal} />
          <FilaPrecio labelCosto="Costo PERFORADO ($)" labelFinal="Precio final PERFORADO ($)" costoVal={precioPerforado} setCosto={setPrecioPerforado} finalVal={precioPerforadoFinal} setFinal={setPrecioPerforadoFinal} />
          <button className="btn primary" type="submit" disabled={loading}>Agregar vidrio</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween">
          <h3>Lista de precios</h3>
          <button className="btn" onClick={load} disabled={loading} type="button">{loading ? "Cargando..." : "Refrescar"}</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="field"><span>Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o descripción..." />
          </label>
        </div>
        <div className="table" style={{ marginTop: 10 }}>
          <div className="thead" style={{ gridTemplateColumns: "1.8fr 2fr 1.1fr 1.1fr 1.1fr 1fr" }}>
            <div>Nombre</div><div>Descripción</div>
            <div>CALIB. COMÚN</div><div>RANURA</div><div>PERF.</div>
            <div>Acciones</div>
          </div>
          {filtered.length === 0
            ? <div className="empty">No hay vidrios</div>
            : filtered.map((v) => (
              <div key={v.id} className="trow" style={{ gridTemplateColumns: "1.8fr 2fr 1.1fr 1.1fr 1.1fr 1fr", alignItems: "start" }}>
                <div style={{ fontWeight: 900 }}>{v.nombre}</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>{v.descripcion || "—"}</div>
                {/* CAL */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>{v.precioCal ? `$${money(v.precioCal)}` : "-"}</div>
                  {v.precioCalFinal ? <div style={{ fontWeight: 900, color: "#0b7a55" }}>${money(v.precioCalFinal)}</div> : null}
                </div>
                {/* RANURA */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>{v.precioRanura ? `$${money(v.precioRanura)}` : "-"}</div>
                  {v.precioRanuraFinal ? <div style={{ fontWeight: 900, color: "#0b7a55" }}>${money(v.precioRanuraFinal)}</div> : null}
                </div>
                {/* PERFORADO */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>{v.precioPerforado ? `$${money(v.precioPerforado)}` : "-"}</div>
                  {v.precioPerforadoFinal ? <div style={{ fontWeight: 900, color: "#0b7a55" }}>${money(v.precioPerforadoFinal)}</div> : null}
                </div>
                <div className="actions">
                  <button className="btn" type="button" onClick={() => openEdit(v)} disabled={loading}>Editar</button>
                  <button className="iconBtn dangerIcon" type="button" onClick={() => { setConfirmItem(v); setConfirmOpen(true); }} disabled={loading}>
                    <img src={trashIcon} alt="Eliminar" />
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </section>

      {confirmOpen && confirmItem && (
        <div className="modalOverlay" onMouseDown={() => setConfirmOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button className="modalClose" type="button" onClick={() => setConfirmOpen(false)}>✕</button>
            </div>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>¿Eliminar "{confirmItem.nombre}"?</div>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setConfirmOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btn danger" type="button" onClick={doDelete} disabled={loading}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modalHeader">
              <div className="modalTitle">Editar vidrio</div>
              <button className="modalClose" type="button" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <div className="form">
              <div className="grid2">
                <label className="field"><span>Nombre *</span>
                  <input value={eNombre} onChange={(e) => setENombre(e.target.value)} />
                </label>
                <label className="field"><span>Descripción</span>
                  <input value={eDescripcion} onChange={(e) => setEDescripcion(e.target.value)} />
                </label>
              </div>
              {[
                { lc: "Costo Calibrado Común ($)", lf: "Precio final Calibrado Común ($)", cv: ePrecioCal, sc: setEPrecioCal, fv: ePrecioCalFinal, sf: setEPrecioCalFinal },
                { lc: "Costo RANURA ($)", lf: "Precio final RANURA ($)", cv: ePrecioRanura, sc: setEPrecioRanura, fv: ePrecioRanuraFinal, sf: setEPrecioRanuraFinal },
                { lc: "Costo PERFORADO ($)", lf: "Precio final PERFORADO ($)", cv: ePrecioPerforado, sc: setEPrecioPerforado, fv: ePrecioPerforadoFinal, sf: setEPrecioPerforadoFinal },
              ].map(({ lc, lf, cv, sc, fv, sf }) => (
                <div key={lc} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
                  <div className="field">
                    <span>{lc}</span>
                    <input value={formatMiles(cv)} onChange={(e) => handlePrecioChange(e, sc)} inputMode="numeric" placeholder="Ej: 4.400" />
                    <div className="multRow">
                      {MULTIPLICADORES.map((m) => (
                        <button key={m} type="button" className="multBtn" onClick={() => aplicarMult(m, cv, sf)}>×{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span>{lf}</span>
                    <input value={formatMiles(fv)} onChange={(e) => handlePrecioChange(e, sf)} inputMode="numeric" placeholder="Se calcula con ×" />
                  </div>
                </div>
              ))}
            </div>
            <div className="modalActions" style={{ marginTop: 12 }}>
              <button className="btn" type="button" onClick={() => setEditOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btn primary" type="button" onClick={onSaveEdit} disabled={loading}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// PÁGINA CONTENEDORA
// ─────────────────────────────────────────────
function showToast(msg, type = "info") {
  if (type === "success") toast.success(msg);
  else if (type === "error") toast.error(msg);
  else toast.info(msg);
}

export default function InventarioPage() {
  const [tab, setTab] = useState("armazones");

  return (
    <div className="page">
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Inventario</h1>
          <div className="pageHint">Administrá armazones y vidrios desde un solo lugar.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button type="button" className={`pillBtn${tab === "armazones" ? " active" : ""}`}
          style={{ fontSize: 15, padding: "8px 22px", fontWeight: 900 }} onClick={() => setTab("armazones")}>
          Armazones
        </button>
        <button type="button" className={`pillBtn${tab === "vidrios" ? " active" : ""}`}
          style={{ fontSize: 15, padding: "8px 22px", fontWeight: 900 }} onClick={() => setTab("vidrios")}>
          Vidrios
        </button>
      </div>
      {tab === "armazones" ? <ArmazonesTab showToast={showToast} /> : <VidriosTab showToast={showToast} />}
    </div>
  );
}