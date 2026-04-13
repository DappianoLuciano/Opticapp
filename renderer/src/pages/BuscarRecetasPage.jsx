import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import { usePagination } from "../hooks/usePagination";
import { SkeletonTable } from "../components/Skeleton";
import { toast } from "../components/Toast";

function money(n) {
  const x = Number(n ?? 0);
  const safe = Number.isFinite(x) ? x : 0;
  return safe.toLocaleString("es-AR");
}

function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-AR");
}

function fmtDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function formatThousandsInput(v) {
  const digits = onlyDigits(v);
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}

function normalizeSearchTerm(v) {
  const raw = String(v ?? "").trim();
  const digits = onlyDigits(raw);
  if (digits && digits.length === raw.replace(/\s/g, "").replace(/\./g, "").length) {
    return digits;
  }
  return raw;
}

function formatIntLikeArgNumber(v) {
  const digits = onlyDigits(v);
  if (!digits) return "-";
  return Number(digits).toLocaleString("es-AR");
}

const MEDIOS_PAGO = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "BILLETERA",     label: "T. Créd./Déb. Billetera Virtual" },
  { value: "TARJETA_BANCO", label: "T. Créd./Déb. Banco" },
  // legados para registros anteriores
  { value: "DEBITO",        label: "Débito" },
  { value: "CREDITO",       label: "Tarjeta de crédito" },
];

const ESTADOS_PAGO = {
  PENDIENTE: { label: "Pendiente", bg: "rgba(255,183,77,0.15)", color: "#8a4b00", border: "rgba(255,183,77,0.45)" },
  PARCIAL:   { label: "Parcial",   bg: "rgba(99,102,241,0.12)", color: "#3730a3", border: "rgba(99,102,241,0.35)" },
  PAGADO:    { label: "Pagado",    bg: "rgba(122,216,176,0.18)", color: "#0b7a55", border: "rgba(85,201,154,0.45)" },
};

function EstadoPagoBadge({ estado }) {
  const info = ESTADOS_PAGO[estado] ?? ESTADOS_PAGO.PENDIENTE;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 900, whiteSpace: "nowrap",
      background: info.bg, color: info.color, border: `1px solid ${info.border}`,
    }}>
      {info.label}
    </span>
  );
}

function makeOrdenMsg(r) {
  const p = r?.paciente;
  const a = r?.armazon;
  const v = r?.vidrio;
  const armazonTxt = a ? `${a.marca} ${a.modelo}${a.codigo ? ` (Cod ${a.codigo})` : ""}` : "-";
  const vidrioTxt = r?.tratamiento || v?.nombre || "-";
  const medioLabel = MEDIOS_PAGO.find((m) => m.value === r?.metodoPago)?.label || r?.metodoPago || "-";

  return (
    `ORDEN DE LABORATORIO\n` +
    `Paciente: ${p?.nombre || "-"}${p?.dni ? ` (DNI ${formatIntLikeArgNumber(p.dni)})` : ""}\n` +
    `Fecha de receta: ${r?.fechaReceta ? fmtDate(r.fechaReceta) : "-"}\n` +
    `Armazón: ${armazonTxt}\n` +
    `Vidrio/Color: ${vidrioTxt}\n` +
    `Montaje: ${r?.montaje || "-"}\n` +
    `Formato: ${r?.formato || "-"}\n` +
    `Uso: ${r?.distancia || "-"}\n\n` +
    `OD: ESF ${r?.odEsf ?? "-"}  CIL ${r?.odCil ?? "-"}  EJE ${r?.odEje ?? "-"}\n` +
    `OI: ESF ${r?.oiEsf ?? "-"}  CIL ${r?.oiCil ?? "-"}  EJE ${r?.oiEje ?? "-"}\n` +
    `DIP: ${r?.dip ?? "-"}\n\n` +
    `Obs: ${r?.obs || "-"}\n\n` +
    `Laboratorio: ${r?.laboratorio || "-"}\n` +
    `Entrega: ${r?.entregaFecha ? fmtDate(r.entregaFecha) : "-"}\n\n` +
    `Precio Armazón: $${money(r?.precioArmazon)}\n` +
    `Precio Vidrio: $${money(r?.precioVidrio)}\n` +
    `TOTAL: $${money(r?.total)}\n` +
    `Medio de pago: ${medioLabel}\n` +
    `Seña: ${r?.sena != null ? `$${money(r.sena)}` : "-"}\n`
  );
}

export default function BuscarRecetasPage() {
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");
  const [recetas, setRecetas] = useState([]);
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // receta a eliminar

  async function load(termValue) {
    setLoading(true);
    try {
      const cleanTerm = normalizeSearchTerm(termValue);
      const list = await window.api.searchRecipes(cleanTerm);
      setRecetas(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e?.message || "Error buscando recetas");
      setRecetas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of recetas) {
      const pid = r?.paciente?.id ?? r?.pacienteId ?? `x-${r.id}`;
      if (!map.has(pid)) map.set(pid, { paciente: r.paciente, recetas: [] });
      map.get(pid).recetas.push(r);
    }
    return Array.from(map.values());
  }, [recetas]);

  const { page: groupedPage, setPage: setGroupedPage, totalPages: groupedTotalPages, pageItems: groupedPageItems } = usePagination(grouped, 10);

  function recetaKey(r) {
    const a = r?.armazon;
    const v = r?.vidrio;
    const ar = a ? `${a.marca} ${a.modelo}` : "Sin armazón";
    const vid = r?.tratamiento || v?.nombre || "Sin vidrio";
    return `${fmtDate(r?.createdAt)} · ${ar} · ${vid} · $${money(r?.total)}`;
  }

  async function openDetalle(r) {
    try {
      const full = await window.api.getRecipe(r.id);
      setDetalle(full);
      setOpen(true);
    } catch (e) {
      toast.error(e?.message || "No se pudo abrir la receta");
    }
  }

  async function copyText(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      toast.info("Copiado.");
    } catch { toast.error("No se pudo copiar"); }
  }

  async function openWhatsApp(txt) {
    try {
      if (window.api?.openExternal) {
        await window.api.openExternal(`https://web.whatsapp.com/send?text=${encodeURIComponent(txt)}`);
      } else {
        window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(txt)}`, "_blank");
      }
    } catch { toast.error("No se pudo abrir WhatsApp"); }
  }

  async function deleteReceta(id) {
    try {
      await window.api.deleteRecipe(id);
      toast.success("Receta eliminada.");
      setOpen(false);
      setDetalle(null);
      setConfirmDelete(null);
      load(term);
    } catch (e) {
      toast.error(e?.message || "Error eliminando receta");
    }
  }

  function handleTermChange(value) {
    const raw = String(value ?? "");
    const digits = onlyDigits(raw);
    const stripped = raw.replace(/[.\s]/g, "");
    if (digits && digits.length === stripped.length) {
      setTerm(formatThousandsInput(raw));
      return;
    }
    setTerm(raw);
  }

  return (
    <div className="page">
      <h2>Buscar recetas</h2>

      <section className="card">
        <div className="rowBetween">
          <h3 style={{ margin: 0 }}>Búsqueda</h3>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
            {loading ? "Buscando..." : "\u00A0"}
          </div>
        </div>

        <div className="form" style={{ marginTop: 10 }}>
          <label className="field">
            <span>Paciente o DNI</span>
            <input
              value={term}
              placeholder="Escribí nombre o DNI..."
              onChange={(e) => handleTermChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); load(term); } }}
            />
            <div className="fieldErrorSlot">{"\u00A0"}</div>
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => { setTerm(""); load(""); }}>Limpiar</button>
            <button className="btn primary" type="button" onClick={() => load(term)}>Buscar</button>
          </div>
        </div>

        <div className="hint">
          Tip: podés buscar por <b>nombre</b> o por <b>DNI</b>.
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="rowBetween">
          <h3 style={{ margin: 0 }}>Resultados</h3>
          <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.75 }}>
            {recetas.length} receta{recetas.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="provList" style={{ marginTop: 12 }}>
          {loading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : grouped.length === 0 ? (
            <div className="empty">Sin resultados</div>
          ) : (
            groupedPageItems.map((g, index) => (
              <div className="card" key={g?.paciente?.id ?? `grupo-${index}`} style={{ padding: 14 }}>
                <div className="provRowTop">
                  <div>
                    <div className="provName">{g?.paciente?.nombre || "Paciente"}</div>
                    <div className="provSub">
                      <div>{g?.paciente?.dni ? `DNI ${formatIntLikeArgNumber(g.paciente.dni)}` : "Sin DNI"}</div>
                      <div>{g?.recetas?.length || 0} receta{(g?.recetas?.length || 0) === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {g.recetas.map((r) => (
                    <div key={r.id} className="btnGhost"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 900 }}>{recetaKey(r)}</span>
                          <EstadoPagoBadge estado={r?.estadoPago ?? "PENDIENTE"} />
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                          Creada: {fmtDateTime(r.createdAt)}{r?.fechaReceta ? ` · Fecha receta: ${fmtDate(r.fechaReceta)}` : ""} · Uso: {r?.distancia || "-"} · Montaje: {r?.montaje || "-"}
                          {r?.metodoPago ? ` · ${MEDIOS_PAGO.find((m) => m.value === r.metodoPago)?.label ?? r.metodoPago}` : ""}
                        </div>
                      </div>
                      <button type="button" className="btn"
                        style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        onClick={() => openDetalle(r)}>
                        Acceder receta
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <Pagination page={groupedPage} totalPages={groupedTotalPages} onPage={setGroupedPage} />
        </div>
      </section>

      {open && detalle && (
        <div className="modalOverlay noPrint" onMouseDown={() => setOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Detalle de receta</div>
              <button className="modalClose" type="button" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="grid2" style={{ alignItems: "start" }}>
              <div className="card">
                <div className="detailLabel">Paciente</div>
                <div className="detailValue">{detalle?.paciente?.nombre || "-"}</div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
                  {detalle?.paciente?.dni ? `DNI ${formatIntLikeArgNumber(detalle.paciente.dni)}` : "Sin DNI"}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="detailLabel">Creada</div>
                  <div className="detailValue">{fmtDateTime(detalle?.createdAt)}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="detailLabel">Fecha de la receta</div>
                  <div className="detailValue">{detalle?.fechaReceta ? fmtDate(detalle.fechaReceta) : "-"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="detailLabel">Armazón</div>
                  <div className="detailValue">
                    {detalle?.armazon
                      ? `${detalle.armazon.marca} ${detalle.armazon.modelo}${detalle.armazon.codigo ? ` (Cod ${detalle.armazon.codigo})` : ""}`
                      : "-"}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="detailLabel">Vidrio / Color</div>
                  <div className="detailValue">{detalle?.tratamiento || detalle?.vidrio?.nombre || "-"}</div>
                </div>

                <div style={{ marginTop: 12 }} className="detailGrid">
                  <div className="detailItem">
                    <div className="detailLabel">Montaje</div>
                    <div className="detailValue">{detalle?.montaje || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Formato</div>
                    <div className="detailValue">{detalle?.formato || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Uso</div>
                    <div className="detailValue">{detalle?.distancia || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">DIP</div>
                    <div className="detailValue">{detalle?.dip ?? "-"}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ margin: "0 0 10px" }}>Graduación</h4>
                <div className="detailGrid">
                  <div className="detailItem">
                    <div className="detailLabel">OD (derecho)</div>
                    <div className="detailValue">ESF {detalle?.odEsf ?? "-"} · CIL {detalle?.odCil ?? "-"} · EJE {detalle?.odEje ?? "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">OI (izquierdo)</div>
                    <div className="detailValue">ESF {detalle?.oiEsf ?? "-"} · CIL {detalle?.oiCil ?? "-"} · EJE {detalle?.oiEje ?? "-"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }} className="detailGrid">
                  <div className="detailItem">
                    <div className="detailLabel">Doctor</div>
                    <div className="detailValue">{detalle?.doctor || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Patología</div>
                    <div className="detailValue">{detalle?.patologia || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Observaciones</div>
                    <div className="detailValue">{detalle?.obs || "-"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }} className="detailGrid">
                  <div className="detailItem">
                    <div className="detailLabel">Laboratorio</div>
                    <div className="detailValue">{detalle?.laboratorio || "-"}</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Entrega</div>
                    <div className="detailValue">{detalle?.entregaFecha ? fmtDate(detalle.entregaFecha) : "-"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }} className="detailGrid">
                  <div className="detailItem">
                    <div className="detailLabel">Estado entrega</div>
                    <div className="detailValue">
                      {detalle?.retirada ? "Retirada" : detalle?.avisoRetiroEnviado ? "Avisado" : detalle?.entregada ? "Entregada" : "Pendiente"}
                    </div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Actualizada</div>
                    <div className="detailValue">{fmtDateTime(detalle?.updatedAt)}</div>
                  </div>
                </div>

                {/* IMPORTES + PAGO */}
                <div style={{ marginTop: 12 }} className="card">
                  <h4 style={{ margin: "0 0 10px" }}>Importes y pago</h4>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ opacity: 0.85 }}>Precio armazón</div>
                      <div style={{ fontWeight: 900 }}>${money(detalle?.precioArmazon)}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ opacity: 0.85 }}>Precio vidrio</div>
                      <div style={{ fontWeight: 900 }}>${money(detalle?.precioVidrio)}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 8, borderTop: "1px dashed rgba(0,0,0,.18)" }}>
                      <div style={{ fontWeight: 900 }}>TOTAL</div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>${money(detalle?.total)}</div>
                    </div>

                    {/* Medio de pago */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ opacity: 0.85 }}>Medio de pago</div>
                      <div style={{ fontWeight: 900 }}>
                        {MEDIOS_PAGO.find((m) => m.value === detalle?.metodoPago)?.label ?? detalle?.metodoPago ?? "-"}
                      </div>
                    </div>

                    {/* Seña */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ opacity: 0.85 }}>Seña</div>
                      <div style={{ fontWeight: 900 }}>
                        {detalle?.sena != null ? `$${money(detalle.sena)}` : "-"}
                      </div>
                    </div>

                    {/* Saldo si es parcial */}
                    {detalle?.estadoPago === "PARCIAL" && detalle?.sena != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ opacity: 0.85 }}>Saldo restante</div>
                        <div style={{ fontWeight: 900, color: "#8a4b00" }}>
                          ${money((detalle.total ?? 0) - (detalle.sena ?? 0))}
                        </div>
                      </div>
                    )}

                    {/* Estado de pago */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 8, borderTop: "1px dashed rgba(0,0,0,.10)" }}>
                      <div style={{ fontWeight: 900 }}>Estado de pago</div>
                      <EstadoPagoBadge estado={detalle?.estadoPago ?? "PENDIENTE"} />
                    </div>
                  </div>
                </div>

                <div className="modalActions" style={{ marginTop: 12 }}>
                  <button className="btn" type="button" onClick={() => copyText(makeOrdenMsg(detalle))}>Copiar orden</button>
                  <button className="btn" type="button" onClick={() => openWhatsApp(makeOrdenMsg(detalle))}>WhatsApp</button>
                  <button className="btn primary" type="button" onClick={() => {
                    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
                    const nombre = detalle?.paciente?.nombre || "Receta";
                    const html = document.getElementById("printArea")?.innerHTML || "";
                    window.api.printToPdf({ defaultName: `${nombre} - ${fecha}`, html });
                  }}>Imprimir</button>
                  <button className="btnDangerSmall" type="button" onClick={() => setConfirmDelete(detalle)}>Eliminar</button>
                </div>
              </div>
            </div>

            <div className="hint" style={{ marginTop: 10 }}>
              *Esto muestra lo guardado en la DB: vidrio, montaje, laboratorio, entrega, estado, precios, total y seña.
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <div className="modalOverlay" onMouseDown={() => setConfirmDelete(null)}>
          <div className="modalCard" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Eliminar receta</div>
              <button className="modalClose" type="button" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              ¿Seguro que querés eliminar la receta de <b>{confirmDelete?.paciente?.nombre || "este paciente"}</b>?
              Esta acción no se puede deshacer y restaurará el stock del armazón.
            </p>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn danger" type="button" onClick={() => deleteReceta(confirmDelete.id)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT AREA ── */}
      {detalle && (
        <div id="printArea" style={{ display: "none" }}>
          <h2 style={{ margin: "0 0 8px" }}>Orden de Laboratorio</h2>
          <div style={{ marginBottom: 8 }}>
            <div><b>Paciente:</b> {detalle.paciente?.nombre || "-"}{detalle.paciente?.dni ? ` (DNI ${formatIntLikeArgNumber(detalle.paciente.dni)})` : ""}</div>
            <div><b>Creada:</b> {fmtDateTime(detalle.createdAt)}</div>
            {detalle.fechaReceta && <div><b>Fecha de la receta:</b> {fmtDate(detalle.fechaReceta)}</div>}
            <div><b>Armazón:</b> {detalle.armazon ? `${detalle.armazon.marca} ${detalle.armazon.modelo}${detalle.armazon.codigo ? ` (Cod ${detalle.armazon.codigo})` : ""}` : "-"}</div>
            <div><b>Vidrio/Color:</b> {detalle.tratamiento || detalle.vidrio?.nombre || "-"}</div>
            <div><b>Montaje:</b> {detalle.montaje || "-"}</div>
            <div><b>Formato:</b> {detalle.formato || "-"}</div>
            <div><b>Uso:</b> {detalle.distancia || "-"}</div>
            <div><b>Laboratorio:</b> {detalle.laboratorio || "-"}</div>
            <div><b>Entrega:</b> {detalle.entregaFecha ? fmtDate(detalle.entregaFecha) : "-"}</div>
          </div>
          <hr />
          <div style={{ marginTop: 8 }}>
            <div><b>OD:</b> ESF {detalle.odEsf ?? "-"} / CIL {detalle.odCil ?? "-"} / EJE {detalle.odEje ?? "-"}</div>
            <div><b>OI:</b> ESF {detalle.oiEsf ?? "-"} / CIL {detalle.oiCil ?? "-"} / EJE {detalle.oiEje ?? "-"}</div>
            <div><b>DIP:</b> {detalle.dip ?? "-"}</div>
            {detalle.doctor && <div><b>Doctor:</b> {detalle.doctor}</div>}
            {detalle.patologia && <div><b>Patología:</b> {detalle.patologia}</div>}
            <div><b>Observaciones:</b> {detalle.obs || "-"}</div>
          </div>
        </div>
      )}

      {/* toasts manejados globalmente por ToastContainer en App.jsx */}
    </div>
  );
}