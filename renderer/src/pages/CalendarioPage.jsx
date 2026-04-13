import { useEffect, useMemo, useState } from "react";
import { toast } from "../components/Toast";
import { SkeletonCard } from "../components/Skeleton";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1);
}

function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function addMonths(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function money(n) {
  const x = Number(n ?? 0);
  const safe = Number.isFinite(x) ? x : 0;
  return safe.toLocaleString("es-AR");
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

export default function CalendarioPage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [ym, setYm] = useState(() => ({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  }));

  const [loading, setLoading] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [upcoming, setUpcoming] = useState([]);
  const [upcomingGastos, setUpcomingGastos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toISODate(today));
  const [dayList, setDayList] = useState([]);

  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [deliverTarget, setDeliverTarget] = useState(null);

  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupTarget, setPickupTarget] = useState(null);

  async function loadUpcoming() {
    setLoading(true);
    try {
      const [rows, gastos] = await Promise.all([
        window.api.listUpcomingDeliveries(60),
        window.api.listGastos({ soloVencimientos: true }),
      ]);
      setUpcoming(Array.isArray(rows) ? rows : []);
      setUpcomingGastos(Array.isArray(gastos) ? gastos : []);
    } catch (e) {
      toast.error(e?.message || "Error cargando entregas");
      setUpcoming([]);
      setUpcomingGastos([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDay(iso) {
    setLoadingDay(true);
    try {
      const rows = await window.api.listDeliveriesByDate(iso);
      setDayList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e?.message || "Error cargando entregas del día");
      setDayList([]);
    } finally {
      setLoadingDay(false);
    }
  }

  async function refreshAll(iso = selectedDate) {
    await Promise.all([loadUpcoming(), loadDay(iso)]);
  }

  useEffect(() => {
    refreshAll(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const monthStart = useMemo(() => startOfMonth(ym.year, ym.monthIndex), [ym]);
  const monthEnd = useMemo(() => endOfMonth(ym.year, ym.monthIndex), [ym]);

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
    for (const g of upcomingGastos) {
      const dt = g?.fechaVenc ? new Date(g.fechaVenc) : null;
      if (!dt || Number.isNaN(dt.getTime())) continue;
      dt.setHours(0, 0, 0, 0);
      const key = toISODate(dt);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [upcomingGastos]);

  const dayGastos = useMemo(() => {
    return upcomingGastos.filter((g) => {
      const dt = g?.fechaVenc ? new Date(g.fechaVenc) : null;
      if (!dt || Number.isNaN(dt.getTime())) return false;
      dt.setHours(0, 0, 0, 0);
      return toISODate(dt) === selectedDate;
    });
  }, [upcomingGastos, selectedDate]);

  const gridDays = useMemo(() => {
    const days = [];

    const first = new Date(monthStart);
    const jsDay = first.getDay();
    const weekday = jsDay === 0 ? 7 : jsDay;
    const leading = weekday - 1;

    for (let i = leading; i > 0; i--) {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - i);
      days.push({ date: d, inMonth: false });
    }

    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const d = new Date(ym.year, ym.monthIndex, day);
      days.push({ date: d, inMonth: true });
    }

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      days.push({ date: next, inMonth: false });
    }

    return days;
  }, [monthStart, monthEnd, ym]);

  const monthLabel = useMemo(() => {
    const names = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    return `${names[ym.monthIndex]} ${ym.year}`;
  }, [ym]);

  function prevMonth() {
    setYm((p) => addMonths(p.year, p.monthIndex, -1));
  }

  function nextMonth() {
    setYm((p) => addMonths(p.year, p.monthIndex, +1));
  }

  function openDeliverModal(receta) {
    setDeliverTarget(receta);
    setDeliverModalOpen(true);
  }

  function closeDeliverModal() {
    if (actionLoadingId) return;
    setDeliverModalOpen(false);
    setDeliverTarget(null);
  }

  function openPickupModal(receta) {
    setPickupTarget(receta);
    setPickupModalOpen(true);
  }

  function closePickupModal() {
    if (actionLoadingId) return;
    setPickupModalOpen(false);
    setPickupTarget(null);
  }

  async function confirmDeliver() {
    if (!deliverTarget?.id) return;

    try {
      setActionLoadingId(deliverTarget.id);
      await window.api.markRecipeDelivered(deliverTarget.id);
      await refreshAll(selectedDate);
      closeDeliverModal();
      toast.success("Receta marcada como entregada");
    } catch (e) {
      toast.error(e?.message || "No se pudo registrar la entrega.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleWhatsApp(receta) {
    const paciente = receta?.paciente;
    const tel = normalizePhone(paciente?.telefono);

    if (!tel) {
      toast.warn("Este paciente no tiene teléfono cargado.");
      return;
    }

    const nombre = paciente?.nombre || "tu lente";
    const texto = `Hola ${nombre}, tu lente ya está listo para retirar.`;
    const url = `https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`;

    try {
      setActionLoadingId(receta.id);
      await window.api.openExternal(url);
      await window.api.markRecipeNoticeSent(receta.id);
      await refreshAll(selectedDate);
    } catch (e) {
      toast.error(e?.message || "No se pudo avisar por WhatsApp.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function confirmPickedUp() {
    if (!pickupTarget?.id) return;

    try {
      setActionLoadingId(pickupTarget.id);
      await window.api.markRecipePickedUp(pickupTarget.id);
      await refreshAll(selectedDate);
      closePickupModal();
      toast.success("Receta marcada como retirada");
    } catch (e) {
      toast.error(e?.message || "No se pudo marcar como retirada.");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="page">
      <h2>Calendario</h2>

      <div className="grid2">
        <section className="card">
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{monthLabel}</div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" type="button" onClick={prevMonth}>
                ◀
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setYm({ year: today.getFullYear(), monthIndex: today.getMonth() });
                  setSelectedDate(toISODate(today));
                }}
              >
                Hoy
              </button>
              <button className="btn" type="button" onClick={nextMonth}>
                ▶
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div
                key={d}
                style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, textAlign: "center" }}
              >
                {d}
              </div>
            ))}

            {gridDays.map(({ date, inMonth }) => {
              const iso = toISODate(date);
              const isToday = iso === toISODate(today);
              const isSelected = iso === selectedDate;
              const count = deliveryCountByDay.get(iso) || 0;
              const vcount = vencimientoCountByDay.get(iso) || 0;

              return (
                <button
                  key={iso}
                  className="btn"
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  style={{
                    padding: "10px 8px",
                    minHeight: 46,
                    textAlign: "center",
                    fontWeight: 900,
                    opacity: inMonth ? 1 : 0.45,
                    background: isSelected
                      ? "rgba(122, 216, 176, 0.28)"
                      : isToday
                      ? "rgba(0,0,0,0.03)"
                      : undefined,
                    borderColor: isSelected ? "rgba(85, 201, 154, 0.55)" : undefined,
                    position: "relative",
                  }}
                >
                  {date.getDate()}

                  {count > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 6,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        background: "rgba(85, 201, 154, 0.28)",
                        border: "1px solid rgba(85, 201, 154, 0.45)",
                      }}
                      title={`${count} entrega${count === 1 ? "" : "s"}`}
                    >
                      {count}
                    </div>
                  )}

                  {vcount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 6,
                        bottom: 6,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        background: "rgba(251, 146, 60, 0.25)",
                        border: "1px solid rgba(251, 146, 60, 0.55)",
                      }}
                      title={`${vcount} vencimiento${vcount === 1 ? "" : "s"}`}
                    >
                      {vcount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hint" style={{ marginTop: 12 }}>
            {loading
              ? "Cargando..."
              : "Verde: entregas · Naranja: vencimientos. Elegí un día para ver el detalle."}
          </div>
        </section>

        <section className="card">
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
            Entregas del día: {selectedDate}
          </div>

          {loadingDay ? (
            <div style={{ display: "grid", gap: 10 }}>
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : dayList.length === 0 ? (
            <div className="empty">No hay entregas para este día.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {dayList.map((r) => {
                const tel = normalizePhone(r?.paciente?.telefono);
                const isBusy = actionLoadingId === r.id;

                return (
                  <div
                    key={r.id}
                    className="card"
                    style={{
                      padding: 12,
                      border: r.retirada
                        ? "1px solid rgba(0,0,0,0.10)"
                        : r.avisoRetiroEnviado
                        ? "1px solid rgba(85, 201, 154, 0.55)"
                        : r.entregada
                        ? "1px solid rgba(122, 216, 176, 0.45)"
                        : "1px solid rgba(0,0,0,0.08)",
                      background: r.avisoRetiroEnviado
                        ? "rgba(122, 216, 176, 0.10)"
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        {r.paciente?.nombre || "Paciente"}{" "}
                        {r.paciente?.dni ? `(DNI ${r.paciente.dni})` : ""}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: r.retirada
                            ? "rgba(0,0,0,0.08)"
                            : r.avisoRetiroEnviado
                            ? "rgba(85, 201, 154, 0.28)"
                            : r.entregada
                            ? "rgba(122, 216, 176, 0.22)"
                            : "rgba(0,0,0,0.06)",
                          border: r.retirada
                            ? "1px solid rgba(0,0,0,0.10)"
                            : "1px solid rgba(85, 201, 154, 0.45)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.retirada
                          ? "Retirada"
                          : r.avisoRetiroEnviado
                          ? "Avisado"
                          : r.entregada
                          ? "Entregada"
                          : "Pendiente"}
                      </div>
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Armazón:{" "}
                      {r.armazon
                        ? `${r.armazon.marca} ${r.armazon.modelo}${
                            r.armazon.codigo ? ` (Cod ${r.armazon.codigo})` : ""
                          }`
                        : "-"}
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Vidrio/Color: {r.vidrio?.nombre || r.tratamiento || "-"} · Montaje:{" "}
                      {r.montaje || "-"} · Uso: {r.distancia || "-"}
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Total: <b>${money(r.total ?? 0)}</b> · Seña: <b>${money(r.sena ?? 0)}</b> ·
                      Lab: {r.laboratorio || "-"}
                    </div>

                    {r.entregadaAt && (
                      <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                        Entregada el: {new Date(r.entregadaAt).toLocaleString("es-AR")}
                      </div>
                    )}

                    {r.avisoRetiroEnviadoAt && (
                      <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                        Avisado el: {new Date(r.avisoRetiroEnviadoAt).toLocaleString("es-AR")}
                      </div>
                    )}

                    {r.retiradaAt && (
                      <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                        Retirada el: {new Date(r.retiradaAt).toLocaleString("es-AR")}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      {!r.entregada ? (
                        <button
                          className="btn primary"
                          type="button"
                          disabled={isBusy}
                          onClick={() => openDeliverModal(r)}
                        >
                          {isBusy ? "Guardando..." : "Entregar"}
                        </button>
                      ) : !r.avisoRetiroEnviado ? (
                        <button
                          className="btn"
                          type="button"
                          disabled={!tel || isBusy}
                          onClick={() => handleWhatsApp(r)}
                        >
                          {!tel ? "Sin teléfono" : isBusy ? "Guardando..." : "Avisar por WhatsApp"}
                        </button>
                      ) : (
                        <button
                          className="btn primary"
                          type="button"
                          disabled={isBusy}
                          onClick={() => openPickupModal(r)}
                        >
                          {isBusy ? "Guardando..." : "Ya retiró"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {dayGastos.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "14px 0" }} />

              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
                Vencimientos del día
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {dayGastos.map((g) => (
                  <div
                    key={g.id}
                    className="card"
                    style={{
                      padding: 12,
                      border: g.pagado
                        ? "1px solid rgba(0,0,0,0.10)"
                        : "1px solid rgba(251, 146, 60, 0.55)",
                      background: g.pagado
                        ? undefined
                        : "rgba(251, 146, 60, 0.06)",
                      opacity: g.pagado ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{g.descripcion}</div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: g.pagado
                              ? "rgba(0,0,0,0.08)"
                              : "rgba(251, 146, 60, 0.18)",
                          border: g.pagado
                              ? "1px solid rgba(0,0,0,0.15)"
                              : "1px solid rgba(251, 146, 60, 0.45)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.pagado ? "Pagado" : "Pendiente"}
                      </div>
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Monto: <b>${money(g.monto ?? 0)}</b>
                      {g.categoria ? ` · ${g.categoria.nombre}` : ""}
                      {g.recurrente ? " · Recurrente" : ""}
                    </div>

                    {g.obs && (
                      <div style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>{g.obs}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid rgba(0,0,0,0.08)",
              margin: "14px 0",
            }}
          />

          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
            Próximas entregas (60 días)
          </div>

          {upcoming.length === 0 ? (
            <div className="empty">Todavía no hay entregas cargadas.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
                maxHeight: 420,
                overflow: "auto",
                paddingRight: 4,
              }}
            >
              {upcoming.slice(0, 30).map((r) => {
                const dt = r.entregaFecha ? new Date(r.entregaFecha) : null;
                const iso = dt ? toISODate(dt) : "-";

                return (
                  <button
                    key={r.id}
                    type="button"
                    className="btn"
                    onClick={() => setSelectedDate(iso)}
                    style={{ textAlign: "left", width: "100%" }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {iso} · {r.paciente?.nombre || "Paciente"}{" "}
                      {r.paciente?.dni ? `(DNI ${r.paciente.dni})` : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      {r.armazon ? `${r.armazon.marca} ${r.armazon.modelo}` : "-"} ·{" "}
                      {r.vidrio?.nombre || r.tratamiento || "-"} · ${money(r.total ?? 0)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {deliverModalOpen && deliverTarget && (
        <div className="modalOverlay" onClick={closeDeliverModal}>
          <div className="modalCard" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar entrega</div>
              <button className="modalClose" type="button" onClick={closeDeliverModal}>
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div className="detailItem">
                <div className="detailLabel">Paciente</div>
                <div className="detailValue">
                  {deliverTarget.paciente?.nombre || "Paciente"}{" "}
                  {deliverTarget.paciente?.dni ? `(DNI ${deliverTarget.paciente.dni})` : ""}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Armazón</div>
                <div className="detailValue">
                  {deliverTarget.armazon
                    ? `${deliverTarget.armazon.marca} ${deliverTarget.armazon.modelo}${
                        deliverTarget.armazon.codigo ? ` (Cod ${deliverTarget.armazon.codigo})` : ""
                      }`
                    : "-"}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Detalle</div>
                <div className="detailValue">
                  {deliverTarget.vidrio?.nombre || deliverTarget.tratamiento || "-"} ·{" "}
                  {deliverTarget.montaje || "-"} · {deliverTarget.distancia || "-"}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Importe</div>
                <div className="detailValue">
                  Total ${money(deliverTarget.total ?? 0)} · Seña ${money(deliverTarget.sena ?? 0)}
                </div>
              </div>

              <div className="hint" style={{ marginTop: 2 }}>
                Al confirmar, la receta se marcará como entregada.
              </div>
            </div>

            <div className="modalActions">
              <button
                className="btn"
                type="button"
                onClick={closeDeliverModal}
                disabled={!!actionLoadingId}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={confirmDeliver}
                disabled={actionLoadingId === deliverTarget.id}
                style={{ maxWidth: 180 }}
              >
                {actionLoadingId === deliverTarget.id ? "Guardando..." : "Confirmar entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pickupModalOpen && pickupTarget && (
        <div className="modalOverlay" onClick={closePickupModal}>
          <div className="modalCard" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar retiro</div>
              <button className="modalClose" type="button" onClick={closePickupModal}>
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div className="detailItem">
                <div className="detailLabel">Paciente</div>
                <div className="detailValue">
                  {pickupTarget.paciente?.nombre || "Paciente"}{" "}
                  {pickupTarget.paciente?.dni ? `(DNI ${pickupTarget.paciente.dni})` : ""}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Armazón</div>
                <div className="detailValue">
                  {pickupTarget.armazon
                    ? `${pickupTarget.armazon.marca} ${pickupTarget.armazon.modelo}${
                        pickupTarget.armazon.codigo ? ` (Cod ${pickupTarget.armazon.codigo})` : ""
                      }`
                    : "-"}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Estado actual</div>
                <div className="detailValue">
                  Ya fue avisado por WhatsApp y ahora se marcará como retirado.
                </div>
              </div>

              <div className="hint" style={{ marginTop: 2 }}>
                Al confirmar, esta entrega se ocultará del calendario operativo.
              </div>
            </div>

            <div className="modalActions">
              <button
                className="btn"
                type="button"
                onClick={closePickupModal}
                disabled={!!actionLoadingId}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={confirmPickedUp}
                disabled={actionLoadingId === pickupTarget.id}
                style={{ maxWidth: 180 }}
              >
                {actionLoadingId === pickupTarget.id ? "Guardando..." : "Confirmar retiro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}