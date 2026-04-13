// ipc/recetas.js
const { prisma }    = require("../db");
const { safeHandle, toIntOrNull, prettyError, clamp } = require("./helpers");
const { crearMovimientoCaja, borrarMovimientosCajaDeReceta } = require("./caja");

const INCLUDE_FULL = { paciente: true, armazon: true, vidrio: true };
const NOT_DELETED  = { deletedAt: null };

// Convierte un string "yyyy-mm-dd" a Date local (evita desfase UTC → día anterior en AR)
function localDate(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr + "T00:00:00");
}

function registerRecetas() {
  safeHandle("recipes:create", async (_evt, payload) => {
    try {
      const receta = await prisma.$transaction(async (tx) => {
        const safeInt = (v) => { const n = toIntOrNull(v); return (n === null || Number.isNaN(n)) ? null : Math.max(0, n); };

        const estadoPago = ["PAGADO","PARCIAL","PENDIENTE"].includes(payload.estadoPago)
          ? payload.estadoPago
          : "PAGADO";

        const created = await tx.receta.create({
          data: {
            pacienteId:   Number(payload.pacienteId),
            armazonId:    Number(payload.armazonId),
            distancia:    payload.distancia,
            odEsf:        payload.odEsf === "" ? null : Number(payload.odEsf),
            odCil:        payload.odCil === "" ? null : Number(payload.odCil),
            odEje:        payload.odEje === "" ? null : Number(payload.odEje),
            oiEsf:        payload.oiEsf === "" ? null : Number(payload.oiEsf),
            oiCil:        payload.oiCil === "" ? null : Number(payload.oiCil),
            oiEje:        payload.oiEje === "" ? null : Number(payload.oiEje),
            distancia2:   payload.distancia2   ?? null,
            od2Esf:       payload.od2Esf === "" ? null : (payload.od2Esf != null ? Number(payload.od2Esf) : null),
            od2Cil:       payload.od2Cil === "" ? null : (payload.od2Cil != null ? Number(payload.od2Cil) : null),
            od2Eje:       payload.od2Eje === "" ? null : (payload.od2Eje != null ? Number(payload.od2Eje) : null),
            oi2Esf:       payload.oi2Esf === "" ? null : (payload.oi2Esf != null ? Number(payload.oi2Esf) : null),
            oi2Cil:       payload.oi2Cil === "" ? null : (payload.oi2Cil != null ? Number(payload.oi2Cil) : null),
            oi2Eje:       payload.oi2Eje === "" ? null : (payload.oi2Eje != null ? Number(payload.oi2Eje) : null),
            tratamiento:  payload.tratamiento  ?? null,
            formato:      payload.formato      ?? null,
            dip:          payload.dip === ""   ? null : Number(payload.dip),
            fechaReceta:  localDate(payload.fechaReceta),
            doctor:       payload.doctor       ?? null,
            patologia:    payload.patologia    ?? null,
            obs:          payload.obs          ?? null,
            vidrioId:     payload.vidrioId     ? Number(payload.vidrioId) : null,
            montaje:      payload.montaje      ?? null,
            sena:         safeInt(payload.sena),
            laboratorio:  payload.laboratorio  ?? null,
            precioArmazon: safeInt(payload.precioArmazon),
            precioVidrio:  safeInt(payload.precioVidrio),
            total:         safeInt(payload.total),
            // ── FIX zona horaria: T00:00:00 fuerza hora local ────────────────
            entregaFecha:  localDate(payload.entregaFecha),
            estadoPago,
            metodoPago:   payload.metodoPago   ?? null,
            montoPagado:  estadoPago === "PARCIAL" ? safeInt(payload.montoPagado) : null,
            entregada: payload.entregada === true, avisoRetiroEnviado: false, retirada: false,
            entregadaAt: payload.entregada === true ? new Date() : null,
          },
        });

        await tx.armazon.update({ where: { id: Number(payload.armazonId) }, data: { stock: { decrement: 1 } } });

        if (Array.isArray(payload.fotos) && payload.fotos.length > 0) {
          await tx.fotoReceta.createMany({
            data: payload.fotos.map((f) => ({
              recetaId:     created.id,
              foto:         f.foto,
              observaciones: f.observaciones || "",
            })),
          });
        }

        await tx.evolucionRefraccion.create({
          data: {
            pacienteId:  Number(payload.pacienteId),
            fecha:       new Date(),
            distancia:   payload.distancia,
            odEsf:       payload.odEsf === "" ? null : Number(payload.odEsf),
            odCil:       payload.odCil === "" ? null : Number(payload.odCil),
            odEje:       payload.odEje === "" ? null : Number(payload.odEje),
            oiEsf:       payload.oiEsf === "" ? null : Number(payload.oiEsf),
            oiCil:       payload.oiCil === "" ? null : Number(payload.oiCil),
            oiEje:       payload.oiEje === "" ? null : Number(payload.oiEje),
            tratamiento: payload.tratamiento  ?? null,
            formato:     payload.formato      ?? null,
            dip:         payload.dip === ""   ? null : Number(payload.dip),
          },
        });

        return created;
      });

      // After transaction completes, create MovimientoCaja
      if (receta.metodoPago && receta.estadoPago !== "PENDIENTE") {
        const montoRecibido = receta.estadoPago === "PARCIAL" ? (receta.sena || 0) : (receta.total || 0);
        if (montoRecibido > 0) {
          try {
            await crearMovimientoCaja({
              tipo: "VENTA",
              concepto: `Receta #${receta.id}`,
              monto: montoRecibido,
              medioPago: receta.metodoPago,
              refId: receta.id,
              refTipo: "RECETA",
            });
          } catch (e) {
            // Don't fail the recipe creation if caja fails
            console.error("Error creando movimiento caja:", e);
          }
        }
      }

      return receta;
    } catch (e) { throw new Error(prettyError(e, "Error guardando receta")); }
  });

  safeHandle("recipes:search", async (_evt, query) => {
    const q = String(query || "").trim();
    const base = { ...NOT_DELETED };

    if (!q) return prisma.receta.findMany({
      where: base,
      include: INCLUDE_FULL,
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    return prisma.receta.findMany({
      where: {
        ...base,
        OR: [
          { doctor:      { contains: q } },
          { laboratorio: { contains: q } },
          { paciente: { OR: [{ nombre: { contains: q } }, { dni: { contains: q } }] } },
        ],
      },
      include: INCLUDE_FULL,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  safeHandle("recipes:get", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");
    const receta = await prisma.receta.findUnique({ where: { id: rid }, include: INCLUDE_FULL });
    if (!receta) throw new Error("Receta no encontrada");
    return receta;
  });

  // ── SOFT DELETE receta (también restaura 1 de stock del armazón) ──────────
  safeHandle("recipes:delete", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");

    const receta = await prisma.receta.findUnique({ where: { id: rid } });
    if (!receta) throw new Error("Receta no encontrada");
    if (receta.deletedAt) throw new Error("La receta ya fue eliminada");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.receta.update({
        where: { id: rid },
        data:  { deletedAt: new Date() },
        include: INCLUDE_FULL,
      });
      await tx.armazon.update({
        where: { id: receta.armazonId },
        data:  { stock: { increment: 1 } },
      });
      return result;
    });

    await borrarMovimientosCajaDeReceta(rid);

    return updated;
  });

  safeHandle("recipes:countByMonth", async () => {
    const now = new Date();
    const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesSig    = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inicioMesAnt    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [mesActual, mesAnterior] = await Promise.all([
      prisma.receta.count({ where: { ...NOT_DELETED, createdAt: { gte: inicioMesActual, lt: inicioMesSig } } }),
      prisma.receta.count({ where: { ...NOT_DELETED, createdAt: { gte: inicioMesAnt,    lt: inicioMesActual } } }),
    ]);
    return { mesActual, mesAnterior };
  });

  safeHandle("recipes:deliveriesUpcoming", async (_evt, days) => {
    const n = Number(days ?? 60);
    const windowDays = Number.isFinite(n) ? clamp(n, 1, 365) : 60;
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + windowDays);
    return prisma.receta.findMany({
      where: { ...NOT_DELETED, entregaFecha: { not: null, gte: from, lt: to }, retirada: false, entregada: false },
      include: INCLUDE_FULL,
      orderBy: { entregaFecha: "asc" },
    });
  });

  safeHandle("recipes:deliveriesByDate", async (_evt, isoDate) => {
    const s = String(isoDate || "").trim();
    if (!s) return [];
    // ── FIX zona horaria ─────────────────────────────────────────────────────
    const from = localDate(s);
    const to   = new Date(from); to.setHours(23, 59, 59, 999);
    return prisma.receta.findMany({
      where: { ...NOT_DELETED, entregaFecha: { not: null, gte: from, lte: to }, retirada: false, entregada: false },
      include: INCLUDE_FULL,
      orderBy: [{ avisoRetiroEnviado: "asc" }, { entregaFecha: "asc" }, { createdAt: "desc" }],
    });
  });

  safeHandle("recipes:pendingPickup", async () => {
    return prisma.receta.findMany({
      where: { ...NOT_DELETED, entregada: true, retirada: false },
      include: INCLUDE_FULL,
      orderBy: [{ avisoRetiroEnviado: "asc" }, { entregadaAt: "asc" }],
    });
  });

  safeHandle("recipes:markDelivered", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");
    const receta = await prisma.receta.findUnique({ where: { id: rid } });
    if (!receta) throw new Error("Receta no encontrada");
    if (receta.entregada) return prisma.receta.findUnique({ where: { id: rid }, include: INCLUDE_FULL });
    return prisma.receta.update({ where: { id: rid }, data: { entregada: true, entregadaAt: new Date() }, include: INCLUDE_FULL });
  });

  safeHandle("recipes:markNoticeSent", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");
    const receta = await prisma.receta.findUnique({ where: { id: rid } });
    if (!receta) throw new Error("Receta no encontrada");
    if (!receta.entregada) throw new Error("Primero debés marcar la receta como entregada");
    return prisma.receta.update({ where: { id: rid }, data: { avisoRetiroEnviado: true, avisoRetiroEnviadoAt: new Date() }, include: INCLUDE_FULL });
  });

  safeHandle("recipes:markPickedUp", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");
    const receta = await prisma.receta.findUnique({ where: { id: rid } });
    if (!receta) throw new Error("Receta no encontrada");
    if (!receta.avisoRetiroEnviado) throw new Error("Primero debés avisar al paciente por WhatsApp");
    return prisma.receta.update({ where: { id: rid }, data: { retirada: true, retiradaAt: new Date() }, include: INCLUDE_FULL });
  });
}

module.exports = { registerRecetas };