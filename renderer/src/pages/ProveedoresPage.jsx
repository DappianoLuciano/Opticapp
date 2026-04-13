import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { toast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";

function onlyDigits(v) { return String(v ?? "").replace(/\D/g, ""); }
function formatMonto(v) {
  const raw = String(v ?? "").replace(/\./g, "").replace(/\D/g, "");
  if (!raw) return "";
  return Number(raw).toLocaleString("es-AR");
}
function formatPhoneInput(v) {
  const d = onlyDigits(v).slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0,2)} ${d.slice(2)}`;
  return `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6)}`;
}
function normalizePhoneForWa(phone) {
  const d = onlyDigits(phone);
  if (!d) return "";
  return d.startsWith("54") ? d : `54${d}`;
}
function money(n) {
  const x = Number(n ?? 0);
  return (Number.isFinite(x) ? x : 0).toLocaleString("es-AR");
}
function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-AR");
}
function balanceClass(n) {
  if (n < 0) return "negative";
  if (n > 0) return "positive";
  return "neutral";
}


const TIPO_OPTS = [
  { value: "TODOS",     label: "Todos" },
  { value: "ARMAZONES", label: "Armazones" },
  { value: "VIDRIOS",   label: "Vidrios" },
];

const EMPTY_FORM = {
  nombre: "", telefono: "", email: "", productos: "",
  contactoPreferido: "wpp", formasPago: "", frecuenciaEntrega: "",
  observaciones: "", banco: "", cbu: "", alias: "", titular: "",
};

function ProvForm({ f, setF, err: fErr, fieldErrs = {}, onClearErr }) {
  return (
    <>
      {fErr ? <div className="formError" style={{ marginBottom: 10 }}>{fErr}</div> : null}
      <div className="provFormGrid">
        {[
          ["Nombre *",              "nombre"],
          ["Teléfono",             "telefono"],
          ["Mail",                 "email"],
          ["Productos que provee", "productos"],
          ["Formas de pago",       "formasPago"],
          ["Frecuencia de entrega","frecuenciaEntrega"],
          ["Banco",                "banco"],
          ["CBU",                  "cbu"],
          ["Alias",                "alias"],
          ["Titular",              "titular"],
        ].map(([label, key]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              className={`input${fieldErrs[key] ? " inputError" : ""}`}
              value={f[key]}
              onChange={(e) => {
                const val =
                  key === "telefono" ? formatPhoneInput(e.target.value)
                  : key === "cbu"    ? onlyDigits(e.target.value)
                  : e.target.value;
                setF((p) => ({ ...p, [key]: val }));
                if (fieldErrs[key]) onClearErr?.(key);
              }}
            />
            {fieldErrs[key] && <div className="fieldErrorSlot">{fieldErrs[key]}</div>}
          </div>
        ))}
        <div className="field">
          <label>Contacto directo</label>
          <div className="provToggleRow">
            {["wpp","mail","ambos"].map((v) => (
              <button key={v} type="button"
                className={`pillBtn ${f.contactoPreferido === v ? "active" : ""}`}
                onClick={() => setF((p) => ({ ...p, contactoPreferido: v }))}>
                {v === "wpp" ? "WhatsApp" : v === "mail" ? "Mail" : "Ambos"}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ gridColumn: "1/-1" }}>
          <label>Observaciones</label>
          <input className="input" value={f.observaciones}
            onChange={(e) => setF((p) => ({ ...p, observaciones: e.target.value }))} />
        </div>
      </div>
    </>
  );
}

const MOV_PAGE_SIZE = 50;

export default function ProveedoresPage() {
  const api = window.api;

  const [loading,    setLoading]    = useState(false);
  const [items,      setItems]      = useState([]);
  const [q,          setQ]          = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const debouncedQ = useDebounce(q, 300);

  const [selectedId,  setSelectedId]  = useState(null);
  const [selectedTab, setSelectedTab] = useState("cuenta");
  const [err,         setErr]         = useState("");

  const [movements,     setMovements]     = useState([]);
  const [movPage,       setMovPage]       = useState(0);
  const [movTotal,      setMovTotal]      = useState(0);
  const [movTotalPages, setMovTotalPages] = useState(0);

  const [openCreate,       setOpenCreate]       = useState(false);
  const [form,             setForm]             = useState(EMPTY_FORM);
  const [tipoNuevo,        setTipoNuevo]        = useState("ARMAZONES");
  const [createFieldErrs,  setCreateFieldErrs]  = useState({ nombre: "", telefono: "", email: "" });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // id del proveedor a eliminar

  const [editOpen,     setEditOpen]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [editForm,     setEditForm]     = useState(EMPTY_FORM);
  const [editErr,      setEditErr]      = useState("");
  const [editFieldErrs,setEditFieldErrs]= useState({ nombre: "", telefono: "", email: "" });

  const [paymentOpen,        setPaymentOpen]        = useState(false);
  const [paymentProvId,      setPaymentProvId]      = useState("");
  const [paymentProvQuery,   setPaymentProvQuery]   = useState("");
  const [paymentProvOpen,    setPaymentProvOpen]    = useState(false);
  const [paymentMonto,       setPaymentMonto]       = useState("");
  const [paymentConcepto,    setPaymentConcepto]    = useState("Pago - Transferencia");
  const [paymentDetalles,    setPaymentDetalles]    = useState([{ medioPago: "TRANSFERENCIA", monto: "" }]);
  const [paymentErr,         setPaymentErr]         = useState("");

  const [purchaseOpen,     setPurchaseOpen]     = useState(false);
  const [purchaseMonto,    setPurchaseMonto]    = useState("");
  const [purchaseConcepto, setPurchaseConcepto] = useState("Pedido Armazones");
  const [purchaseErr,      setPurchaseErr]      = useState("");

  async function loadAll(keepSelected = true) {
    setLoading(true); setErr("");
    try {
      const [ar, vi] = await Promise.all([
        api.listSuppliers("ARMAZONES"),
        api.listSuppliers("VIDRIOS"),
      ]);
      const combined = [
        ...(Array.isArray(ar) ? ar : []),
        ...(Array.isArray(vi) ? vi : []),
      ];
      setItems(combined);
      if (keepSelected && selectedId) {
        if (!combined.find((x) => x.id === selectedId)) {
          setSelectedId(null);
          setMovements([]); setMovTotal(0); setMovTotalPages(0); setMovPage(0);
        }
      }
    } catch(e) {
      toast.error(String(e?.message || e || "Error cargando proveedores")); setItems([]);
    } finally { setLoading(false); }
  }

  async function loadMovements(id, page = 0) {
    try {
      const res = await api.listSupplierMovements({ proveedorId: id, page, pageSize: MOV_PAGE_SIZE });
      setMovements(Array.isArray(res?.rows) ? res.rows : []);
      setMovTotal(res?.total ?? 0);
      setMovTotalPages(res?.totalPages ?? 0);
      setMovPage(res?.page ?? 0);
    } catch(e) {
      setErr(String(e?.message || e));
      setMovements([]); setMovTotal(0); setMovTotalPages(0); setMovPage(0);
    }
  }

  useEffect(() => { loadAll(false); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (tipoFiltro !== "TODOS") list = list.filter((p) => p.tipo === tipoFiltro);
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((p) =>
      `${p.nombre} ${p.telefono ?? ""} ${p.email ?? ""} ${p.productos ?? ""} ${p.observaciones ?? ""}`
        .toLowerCase().includes(needle)
    );
  }, [items, debouncedQ, tipoFiltro]);

  const selected = useMemo(() => items.find((p) => p.id === selectedId) || null, [items, selectedId]);

  const saldoTotal = useMemo(() => items.reduce((acc, p) => acc + Number(p.saldoActual ?? 0), 0), [items]);


  async function onCreate() {
    const errs = { nombre: "", telefono: "", email: "" };
    if (!form.nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (!form.telefono.trim() && !form.email.trim()) {
      errs.telefono = "Ingresá teléfono y/o mail.";
      errs.email    = "Ingresá teléfono y/o mail.";
    }
    if (errs.nombre || errs.telefono || errs.email) { setCreateFieldErrs(errs); return; }
    setCreateFieldErrs({ nombre: "", telefono: "", email: "" });
    setLoading(true);
    try {
      const created = await api.createSupplier({ tipo: tipoNuevo, ...form });
      toast.success("Proveedor creado");
      setForm(EMPTY_FORM); setOpenCreate(false);
      await loadAll(false);
      setSelectedId(created.id); setSelectedTab("cuenta");
      await loadMovements(created.id, 0);
    } catch(e) { toast.error(String(e?.message || e || "Error creando proveedor")); }
    finally { setLoading(false); }
  }

  function openEdit(p) {
    setEditErr(""); setEditId(p.id);
    setEditForm({
      nombre: p.nombre ?? "", telefono: p.telefono ?? "", email: p.email ?? "",
      productos: p.productos ?? "", contactoPreferido: p.contactoPreferido ?? "wpp",
      formasPago: p.formasPago ?? "", frecuenciaEntrega: p.frecuenciaEntrega ?? "",
      observaciones: p.observaciones ?? "", banco: p.banco ?? "",
      cbu: p.cbu ?? "", alias: p.alias ?? "", titular: p.titular ?? "",
    });
    setEditOpen(true);
  }

  async function onUpdate() {
    const errs = { nombre: "", telefono: "", email: "" };
    if (!editForm.nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (!editForm.telefono.trim() && !editForm.email.trim()) {
      errs.telefono = "Ingresá teléfono y/o mail.";
      errs.email    = "Ingresá teléfono y/o mail.";
    }
    if (errs.nombre || errs.telefono || errs.email) { setEditFieldErrs(errs); return; }
    setEditFieldErrs({ nombre: "", telefono: "", email: "" }); setEditErr("");
    setLoading(true);
    try {
      await api.updateSupplier({ id: editId, ...editForm });
      toast.success("Proveedor actualizado");
      setEditOpen(false); setEditId(null);
      await loadAll(true);
      if (selectedId) await loadMovements(selectedId, movPage);
    } catch(e) { toast.error(String(e?.message || e || "Error actualizando proveedor")); }
    finally { setLoading(false); }
  }

  async function onDelete(id) {
    setConfirmDeleteId(id);
  }

  async function doDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setLoading(true);
    try {
      await api.deleteSupplier(id);
      toast.success("Proveedor eliminado");
      if (selectedId === id) {
        setSelectedId(null);
        setMovements([]); setMovTotal(0); setMovTotalPages(0); setMovPage(0);
      }
      await loadAll(true);
    } catch(e) { toast.error(String(e?.message || e || "Error eliminando proveedor")); }
    finally { setLoading(false); }
  }

  // ── Abrir modal de pago — puede venir con proveedor preseleccionado o no ──
  function openPaymentModal(proveedorId = "") {
    setPaymentErr("");
    setPaymentMonto("");
    setPaymentConcepto("Pago - Transferencia");
    setPaymentProvId(String(proveedorId));
    // Si viene con proveedor preseleccionado, mostrar su nombre en el input
    if (proveedorId) {
      const prov = items.find((p) => p.id === Number(proveedorId));
      setPaymentProvQuery(prov ? `${prov.nombre} (${prov.tipo === "ARMAZONES" ? "Armazones" : "Vidrios"})` : "");
    } else {
      setPaymentProvQuery("");
    }
    setPaymentProvOpen(false);
    setPaymentOpen(true);
  }

  async function onAddPayment() {
    setPaymentErr("");
    const n = Number(String(paymentMonto).replace(/\./g,"").replace(",","."));
    if (!paymentProvId) return setPaymentErr("Seleccioná un proveedor.");
    if (!Number.isFinite(n) || n <= 0) return setPaymentErr("Monto inválido.");
    const detallesPago = paymentDetalles
      .map(d => ({ medioPago: d.medioPago, monto: Math.round(Number(String(d.monto).replace(/\./g,"").replace(",",".")) || 0) }))
      .filter(d => d.monto > 0 && d.medioPago);
    setLoading(true);
    try {
      await api.addSupplierPayment({
        proveedorId: Number(paymentProvId),
        monto: Math.round(n),
        concepto: paymentConcepto || "Pago",
        detallesPago,
      });
      toast.success("Pago registrado");
      setPaymentOpen(false);
      setPaymentDetalles([{ medioPago: "TRANSFERENCIA", monto: "" }]);
      await loadAll(true);
      if (selectedId) await loadMovements(selectedId, 0);
    } catch(e) { toast.error(String(e?.message || e || "Error registrando pago")); }
    finally { setLoading(false); }
  }

  async function onAddPurchase() {
    setPurchaseErr("");
    const n = Number(String(purchaseMonto).replace(/\./g,"").replace(",","."));
    if (!Number.isFinite(n) || n <= 0) return setPurchaseErr("Monto inválido.");
    setLoading(true);
    try {
      await api.addSupplierPurchase({
        proveedorId: selected.id,
        monto: Math.round(n),
        concepto: purchaseConcepto || "Pedido",
      });
      toast.success("Compra registrada");
      setPurchaseOpen(false); setPurchaseMonto("");
      setPurchaseConcepto(selected?.tipo === "VIDRIOS" ? "Compra de Vidrios" : "Pedido Armazones");
      await loadAll(true);
      await loadMovements(selected.id, 0);
    } catch(e) { toast.error(String(e?.message || e || "Error registrando compra")); }
    finally { setLoading(false); }
  }

  const thStyle = (align = "left") => ({
    padding: "6px 10px", fontSize: 12, fontWeight: 900, color: "var(--muted)",
    textAlign: align, borderBottom: "2px solid var(--border)", whiteSpace: "nowrap",
  });
  const tdStyle = (align = "left", extra = {}) => ({
    padding: "6px 10px", fontSize: 13, textAlign: align,
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", ...extra,
  });

  return (
    <>
    <div className="page">
      {/* ── Header ── */}
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Proveedores</h1>
          <div className="pageHint">Todos tus proveedores de armazones y vidrios en un solo lugar.</div>
        </div>
        {/* ── CAMBIO: botón Registrar Pago al lado de Agregar proveedor ── */}
        <div className="provHeaderActions" style={{ display: "flex", gap: 10 }}>
          <button className="btnGhost" onClick={() => openPaymentModal()} disabled={loading}>
            Registrar Pago
          </button>
          <button className="btnPrimary"
            onClick={() => { setOpenCreate((v) => !v); setEditOpen(false); }}
            disabled={loading}>
            {openCreate ? "Cerrar" : "Agregar proveedor"}
          </button>
        </div>
      </div>

      {/* búsqueda + filtro */}
      <div className="card provCard" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono, mail, productos..." />
          <div style={{ display: "flex", gap: 6 }}>
            {TIPO_OPTS.map((o) => (
              <button key={o.value} type="button"
                className={`pillBtn ${tipoFiltro === o.value ? "active" : ""}`}
                onClick={() => setTipoFiltro(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="provCount">{loading ? "Cargando..." : `${filtered.length} proveedor(es)`}</div>
        </div>
        {err ? <div className="formError" style={{ marginTop: 10 }}>{err}</div> : null}
      </div>

      {/* form alta */}
      {openCreate && (
        <div className="card provCard" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="provCardTitle" style={{ margin: 0 }}>Nuevo proveedor</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["ARMAZONES","VIDRIOS"].map((t) => (
                <button key={t} type="button"
                  className={`pillBtn ${tipoNuevo === t ? "active" : ""}`}
                  onClick={() => setTipoNuevo(t)}>
                  {t === "ARMAZONES" ? "Armazones" : "Vidrios"}
                </button>
              ))}
            </div>
          </div>
          <ProvForm f={form} setF={setForm} err={null}
            fieldErrs={createFieldErrs}
            onClearErr={(k) => setCreateFieldErrs((p) => ({ ...p, [k]: "" }))}
          />
          <div className="provFormActions">
            <button className="btnGhost" onClick={() => { setForm(EMPTY_FORM); setOpenCreate(false); setCreateFieldErrs({ nombre: "", telefono: "", email: "" }); }} disabled={loading}>Cancelar</button>
            <button className="btnPrimary" onClick={onCreate} disabled={loading}>Guardar</button>
          </div>
        </div>
      )}

      {/* modal editar */}
      {editOpen && (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Editar proveedor</div>
              <button className="modalClose" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <ProvForm f={editForm} setF={setEditForm} err={editErr}
              fieldErrs={editFieldErrs}
              onClearErr={(k) => setEditFieldErrs((p) => ({ ...p, [k]: "" }))}
            />
            <div className="provFormActions">
              <button className="btnGhost" onClick={() => setEditOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btnPrimary" onClick={onUpdate} disabled={loading}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CAMBIO: modal pago con selector de proveedor + vencimiento opcional ── */}
      {paymentOpen && (
        <div className="modalOverlay" onMouseDown={() => setPaymentOpen(false)}>
          <div className="modalCard" style={{ maxWidth: 480, width: "92vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Registrar Pago</div>
              <button className="modalClose" onClick={() => setPaymentOpen(false)}>✕</button>
            </div>
            {paymentErr ? <div className="formError" style={{ marginBottom: 10 }}>{paymentErr}</div> : null}
            <div className="provFormGrid" style={{ gridTemplateColumns: "1fr" }}>
              {/* Proveedor — combo con búsqueda */}
              <div className="field" style={{ position: "relative" }}>
                <label>Proveedor</label>
                <input
                  className="input"
                  value={paymentProvQuery}
                  placeholder="Escribí para buscar proveedor..."
                  onFocus={() => setPaymentProvOpen(true)}
                  onChange={(e) => { setPaymentProvQuery(e.target.value); setPaymentProvId(""); setPaymentProvOpen(true); }}
                  onBlur={() => setTimeout(() => setPaymentProvOpen(false), 120)}
                />
                {paymentProvOpen && (
                  <div className="comboDropdown" style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
                    maxHeight: 200, overflowY: "auto",
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    marginTop: 4,
                  }}>
                    {items
                      .filter((p) => {
                        const term = paymentProvQuery.trim().toLowerCase();
                        if (!term) return true;
                        return `${p.nombre} ${p.tipo}`.toLowerCase().includes(term);
                      })
                      .map((p) => (
                        <button type="button" key={p.id} className="comboItem"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPaymentProvId(String(p.id));
                            setPaymentProvQuery(`${p.nombre} (${p.tipo === "ARMAZONES" ? "Armazones" : "Vidrios"})`);
                            setPaymentProvOpen(false);
                          }}>
                          <div style={{ fontWeight: 900 }}>{p.nombre}</div>
                          <div style={{ opacity: 0.65, fontSize: 12 }}>
                            {p.tipo === "ARMAZONES" ? "Armazones" : "Vidrios"}
                            {" · Saldo: "}
                            <span style={{ color: (p.saldoActual ?? 0) < 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                              {(p.saldoActual ?? 0) < 0 ? `-$${money(Math.abs(p.saldoActual))}` : `$${money(p.saldoActual ?? 0)}`}
                            </span>
                          </div>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              {/* Concepto */}
              <div className="field">
                <label>Concepto</label>
                <input className="input" value={paymentConcepto}
                  onChange={(e) => setPaymentConcepto(e.target.value)} />
              </div>
              {/* Monto */}
              <div className="field">
                <label>Monto total</label>
                <input className="input" value={paymentMonto}
                  onChange={(e) => setPaymentMonto(formatMonto(e.target.value))}
                  placeholder="Ej: 80.000" />
              </div>
              {/* Medios de pago */}
              <div className="field">
                <label style={{ marginBottom: 8, display: "block" }}>¿Cómo se pagó? <span style={{ fontWeight: 400, opacity: 0.65 }}>(opcional)</span></label>
                {paymentDetalles.map((d, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <select className="input" value={d.medioPago}
                      onChange={(e) => { const arr = [...paymentDetalles]; arr[i] = { ...arr[i], medioPago: e.target.value }; setPaymentDetalles(arr); }}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia / Billetera Virtual</option>
                      <option value="TARJETA_BANCO">Déb./Cré. Bancarios</option>
                    </select>
                    <input className="input" value={d.monto} placeholder="Monto"
                      onChange={(e) => { const arr = [...paymentDetalles]; arr[i] = { ...arr[i], monto: e.target.value }; setPaymentDetalles(arr); }} />
                    {paymentDetalles.length > 1 && (
                      <button type="button" onClick={() => setPaymentDetalles(paymentDetalles.filter((_, j) => j !== i))}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "#d9363e", fontWeight: 900 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btnGhost" style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setPaymentDetalles([...paymentDetalles, { medioPago: "TRANSFERENCIA", monto: "" }])}>
                  + Agregar medio de pago
                </button>
              </div>
            </div>
            <div className="provFormActions">
              <button className="btnGhost" onClick={() => setPaymentOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btnPrimary" onClick={onAddPayment} disabled={loading}>Guardar pago</button>
            </div>
          </div>
        </div>
      )}

      {/* modal pedido */}
      {purchaseOpen && selected && (
        <div className="modalOverlay" onMouseDown={() => setPurchaseOpen(false)}>
          <div className="modalCard" style={{ maxWidth: 420, width: "92vw" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Nuevo pedido — {selected.nombre}</div>
              <button className="modalClose" onClick={() => setPurchaseOpen(false)}>✕</button>
            </div>
            {purchaseErr ? <div className="formError" style={{ marginBottom: 10 }}>{purchaseErr}</div> : null}
            <div className="provFormGrid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="field">
                <label>Concepto</label>
                <input className="input" value={purchaseConcepto}
                  onChange={(e) => setPurchaseConcepto(e.target.value)} />
              </div>
              <div className="field">
                <label>Monto</label>
                <input className="input" value={purchaseMonto}
                  onChange={(e) => setPurchaseMonto(formatMonto(e.target.value))}
                  placeholder="Ej: 120.000" />
              </div>
            </div>
            <div className="provFormActions">
              <button className="btnGhost" onClick={() => setPurchaseOpen(false)} disabled={loading}>Cancelar</button>
              <button className="btnPrimary" onClick={onAddPurchase} disabled={loading}>Guardar pedido</button>
            </div>
          </div>
        </div>
      )}

      {/* split: lista + detalle */}
      <div className="provSplitLayout">

        {/* columna izquierda */}
        <div className="provLeftCol">
          <div className="provList">
            {filtered.length === 0 ? (
              <div className="card provCard"><div className="empty">No hay proveedores.</div></div>
            ) : (
              filtered.map((p) => {
                const saldo = Number(p.saldoActual ?? 0);
                return (
                  <button type="button" key={p.id}
                    className={`card provCard provListCard ${selectedId === p.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedId(p.id);
                      setSelectedTab("cuenta");
                      loadMovements(p.id, 0);
                    }}>
                    <div className="provListCardTop">
                      <div>
                        <div className="provName">{p.nombre}</div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2, fontWeight: 700 }}>
                          {p.tipo === "ARMAZONES" ? "Armazones" : "Vidrios"}
                        </div>
                      </div>
                      <div className={`provBalanceBadge ${balanceClass(saldo)}`}>
                        {saldo < 0 ? `-$${money(Math.abs(saldo))}` : `$${money(saldo)}`}
                      </div>
                    </div>
                    <div className="provListCardSub">
                      <span>{p.telefono || "-"}</span>
                      <span>{p.productos || ""}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="card provCard" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Saldo total proveedores</div>
              <div className={`provBalanceBadge ${balanceClass(saldoTotal)}`} style={{ fontSize: 15 }}>
                {saldoTotal < 0 ? `-$${money(Math.abs(saldoTotal))}` : `$${money(saldoTotal)}`}
              </div>
            </div>
          )}
        </div>

        {/* columna derecha */}
        <div className="provRightCol">
          {!selected ? (
            <div className="card provCard provDetailEmpty">
              <div className="empty">Seleccioná un proveedor para ver el detalle.</div>
            </div>
          ) : (
            <>
              <div className="card provCard provDetailHeaderCard">
                <div className="provDetailHeaderTop">
                  <div>
                    <div className="provDetailTitle">Proveedor: <b>{selected.nombre}</b>
                      <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 8, opacity: 0.6 }}>
                        ({selected.tipo === "ARMAZONES" ? "Armazones" : "Vidrios"})
                      </span>
                    </div>
                    <div className={`provDetailSaldo ${balanceClass(Number(selected.saldoActual ?? 0))}`}>
                      Saldo:{" "}
                      {Number(selected.saldoActual ?? 0) < 0
                        ? `-$${money(Math.abs(Number(selected.saldoActual ?? 0)))}`
                        : `$${money(Number(selected.saldoActual ?? 0))}`}
                    </div>
                  </div>
                  <div className="provRowActions">
                    {selected.cbu && (
                      <button className="btnSmall" onClick={() => navigator.clipboard.writeText(selected.cbu)}>Copiar CBU</button>
                    )}
                    {selected.telefono && (
                      <a className="btnSmall" href={`https://web.whatsapp.com/send?phone=${normalizePhoneForWa(selected.telefono)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                    )}
                    {selected.email && (
                      <a className="btnSmall" href={`mailto:${selected.email}`} target="_blank" rel="noreferrer">Mail</a>
                    )}
                    <button className="btnSmall" onClick={() => openEdit(selected)} disabled={loading}>Editar</button>
                    <button className="btnDangerSmall" onClick={() => onDelete(selected.id)} disabled={loading}>Eliminar</button>
                  </div>
                </div>
                <div className="provBankBox">
                  <div className="provBankLine"><b>Banco:</b> {selected.banco || "-"}</div>
                  <div className="provBankLine"><b>CBU:</b> {selected.cbu || "-"}</div>
                  <div className="provBankLine"><b>Alias:</b> {selected.alias || "-"}</div>
                  <div className="provBankLine"><b>Titular:</b> {selected.titular || "-"}</div>
                </div>
              </div>

              <div className="provTabsRow">
                <button className={`provTabBtn ${selectedTab === "cuenta" ? "active" : ""}`}
                  onClick={() => setSelectedTab("cuenta")}>Cuenta Corriente</button>
                <button className={`provTabBtn ${selectedTab === "datos" ? "active" : ""}`}
                  onClick={() => setSelectedTab("datos")}>Datos</button>
              </div>

              {selectedTab === "cuenta" ? (
                <div className="card provCard" style={{ padding: 0, borderRadius: "0 16px 16px 16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "34%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ padding: "6px 10px", paddingLeft: 16, fontSize: 12, fontWeight: 900, color: "var(--muted)", textAlign: "left", borderBottom: "2px solid var(--border)" }}>Fecha</th>
                        <th style={{ padding: "6px 10px", fontSize: 12, fontWeight: 900, color: "var(--muted)", textAlign: "left", borderBottom: "2px solid var(--border)" }}>Concepto</th>
                        <th style={{ padding: "6px 10px", fontSize: 12, fontWeight: 900, color: "var(--muted)", textAlign: "right", borderBottom: "2px solid var(--border)" }}>Debe</th>
                        <th style={{ padding: "6px 10px", fontSize: 12, fontWeight: 900, color: "var(--muted)", textAlign: "right", borderBottom: "2px solid var(--border)" }}>Haber</th>
                        <th style={{ padding: "6px 10px", paddingRight: 16, fontSize: 12, fontWeight: 900, color: "var(--muted)", textAlign: "right", borderBottom: "2px solid var(--border)" }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.length === 0 ? (
                        <tr><td colSpan="5"><div className="empty" style={{ padding: "16px 0" }}>Sin movimientos.</div></td></tr>
                      ) : movements.map((m) => (
                        <tr key={m.id}>
                          <td style={{ padding: "6px 10px", paddingLeft: 16, fontSize: 13, borderBottom: "1px solid var(--border)" }}>{fmtDate(m.fecha)}</td>
                          <td style={{ padding: "6px 10px", fontSize: 13, borderBottom: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto || "-"}</td>
                          <td style={{ padding: "6px 10px", fontSize: 13, textAlign: "right", borderBottom: "1px solid var(--border)", fontWeight: 800, color: m.debe ? "#d9363e" : "var(--muted)" }}>
                            {m.debe ? `$${money(m.debe)}` : "-"}
                          </td>
                          <td style={{ padding: "6px 10px", fontSize: 13, textAlign: "right", borderBottom: "1px solid var(--border)", fontWeight: 800, color: m.haber ? "#0b7a55" : "var(--muted)" }}>
                            {m.haber ? `$${money(m.haber)}` : "-"}
                          </td>
                          <td style={{ padding: "6px 10px", paddingRight: 16, fontSize: 13, textAlign: "right", borderBottom: "1px solid var(--border)", fontWeight: 900 }}
                            className={`provSaldoCell ${balanceClass(Number(m.saldo ?? 0))}`}>
                            {Number(m.saldo ?? 0) < 0 ? `-$${money(Math.abs(Number(m.saldo ?? 0)))}` : `$${money(Number(m.saldo ?? 0))}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {movTotalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
                        {movTotal} movimientos · Pág. {movPage + 1} / {movTotalPages}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={movPage === 0} onClick={() => loadMovements(selectedId, 0)}>«</button>
                        <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={movPage === 0} onClick={() => loadMovements(selectedId, movPage - 1)}>‹ Ant</button>
                        <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={movPage >= movTotalPages - 1} onClick={() => loadMovements(selectedId, movPage + 1)}>Sig ›</button>
                        <button className="btnGhost" style={{ padding: "5px 9px", fontSize: 13 }} disabled={movPage >= movTotalPages - 1} onClick={() => loadMovements(selectedId, movTotalPages - 1)}>»</button>
                      </div>
                    </div>
                  )}

                  {/* ── Acciones al pie de la cuenta — se mantiene Nuevo Pedido, se quita Registrar Pago ── */}
                  <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <div className="provCuentaSaldoActual" style={{ flex: 1 }}>
                      Saldo Actual:{" "}
                      <span className={balanceClass(Number(selected.saldoActual ?? 0))}>
                        {Number(selected.saldoActual ?? 0) < 0
                          ? `-$${money(Math.abs(Number(selected.saldoActual ?? 0)))}`
                          : `$${money(Number(selected.saldoActual ?? 0))}`}
                      </span>
                    </div>
                    <button className="btnGhost" onClick={() => {
                      setPurchaseErr(""); setPurchaseMonto("");
                      setPurchaseConcepto(selected.tipo === "VIDRIOS" ? "Compra de Vidrios" : "Pedido Armazones");
                      setPurchaseOpen(true);
                    }}>Nuevo Pedido</button>
                  </div>
                </div>
              ) : (
                <div className="card provCard" style={{ borderRadius: "0 16px 16px 16px" }}>
                  <div className="provInfoGrid">
                    {[
                      ["Productos que provee",   selected.productos],
                      ["Contacto directo",        selected.contactoPreferido === "wpp" ? "WhatsApp" : selected.contactoPreferido === "mail" ? "Mail" : "Ambos"],
                      ["Formas de pago",          selected.formasPago],
                      ["Frecuencia de entrega",   selected.frecuenciaEntrega],
                      ["Teléfono",                selected.telefono],
                      ["Mail",                    selected.email],
                    ].map(([label, val]) => (
                      <div key={label} className="provInfoItem">
                        <div className="provInfoLabel">{label}</div>
                        <div className="provInfoValue">{val || "-"}</div>
                      </div>
                    ))}
                    <div className="provInfoItem" style={{ gridColumn: "1/-1" }}>
                      <div className="provInfoLabel">Observaciones</div>
                      <div className="provInfoValue">{selected.observaciones || "-"}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    <ConfirmDialog
      open={!!confirmDeleteId}
      title="¿Eliminar proveedor?"
      message="Se eliminarán el proveedor y todos sus movimientos. Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      danger
      onConfirm={doDelete}
      onCancel={() => setConfirmDeleteId(null)}
    />
    </>
  );
}