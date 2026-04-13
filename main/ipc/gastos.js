// ipc/gastos.js
const { prisma }    = require("../db");
const { safeHandle, toIntOrNull } = require("./helpers");
const { crearMovimientoCaja, borrarMovimientosCajaDeGasto } = require("./caja");

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function registerGastos() {
  // ── Categorías ───────────────────────────────────────────────────────────
  safeHandle("gastos:categorias:list", async () => {
    return prisma.categoriaGasto.findMany({ orderBy: { nombre: "asc" } });
  });

  safeHandle("gastos:categorias:create", async (_e, payload) => {
    const nombre = String(payload?.nombre || "").trim();
    if (!nombre) throw new Error("Falta el nombre de la categoría.");
    return prisma.categoriaGasto.create({
      data: { nombre, color: String(payload?.color || "#7ad8b0").trim(), activo: payload?.activo ?? true },
    });
  });

  safeHandle("gastos:categorias:update", async (_e, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("Falta id.");
    return prisma.categoriaGasto.update({
      where: { id },
      data: {
        nombre: String(payload?.nombre || "").trim(),
        color:  String(payload?.color  || "#7ad8b0").trim(),
        activo: payload?.activo ?? true,
      },
    });
  });

  safeHandle("gastos:categorias:delete", async (_e, id) => {
    const n = Number(id);
    if (!n) throw new Error("Falta id.");
    await prisma.gasto.updateMany({ where: { categoriaId: n }, data: { categoriaId: null } });
    await prisma.categoriaGasto.delete({ where: { id: n } });
    return { ok: true };
  });

  // ── Gastos ───────────────────────────────────────────────────────────────
  safeHandle("gastos:list", async (_e, payload) => {
    const soloVencimientos = payload?.soloVencimientos === true;
    const soloNoPagados    = payload?.soloNoPagados    === true;
    const where = {};
    if (soloNoPagados)    where.pagado    = false;
    if (soloVencimientos) where.fechaVenc = { not: null };
    return prisma.gasto.findMany({
      where,
      include: { categoria: true },
      orderBy: [{ pagado: "asc" }, { fechaVenc: "asc" }, { createdAt: "desc" }],
    });
  });

  safeHandle("gastos:upcoming", async (_e, days) => {
    const n      = Number(days ?? 30);
    const window = Number.isFinite(n) ? Math.max(1, Math.min(n, 365)) : 30;
    const from   = new Date(); from.setHours(0, 0, 0, 0);
    const to     = new Date(from); to.setDate(to.getDate() + window);
    return prisma.gasto.findMany({
      where: { pagado: false, fechaVenc: { not: null, gte: from, lte: to } },
      include: { categoria: true },
      orderBy: { fechaVenc: "asc" },
    });
  });

  safeHandle("gastos:create", async (_e, payload) => {
    const desc  = String(payload?.descripcion || "").trim();
    if (!desc) throw new Error("Falta la descripción del gasto.");
    const monto = toIntOrNull(payload?.monto);
    if (monto === null || Number.isNaN(monto) || monto <= 0) throw new Error("Monto inválido.");
    return prisma.gasto.create({
      data: {
        descripcion: desc, monto,
        categoriaId:     payload?.categoriaId  ? Number(payload.categoriaId) : null,
        recurrente:      payload?.recurrente   ?? false,
        frecuenciaMeses: payload?.recurrente ? (Number(payload?.frecuenciaMeses) || 1) : null,
        fechaVenc:       payload?.fechaVenc     ? new Date(payload.fechaVenc)  : null,
        pagado: false,
        obs:           String(payload?.obs           || "").trim() || null,
        codigoCliente: String(payload?.codigoCliente || "").trim() || null,
        numeroPago:    String(payload?.numeroPago    || "").trim() || null,
      },
      include: { categoria: true },
    });
  });

  safeHandle("gastos:update", async (_e, payload) => {
    const id   = Number(payload?.id);
    if (!id) throw new Error("Falta id.");
    const desc = String(payload?.descripcion || "").trim();
    if (!desc) throw new Error("Falta la descripción.");
    const monto = toIntOrNull(payload?.monto);
    if (monto === null || Number.isNaN(monto) || monto <= 0) throw new Error("Monto inválido.");

    // Obtener el gasto original para saber la descripción previa (para actualizar recurrente)
    const original = await prisma.gasto.findUnique({ where: { id } });

    const updateData = {
      descripcion: desc, monto,
      categoriaId:     payload?.categoriaId  ? Number(payload.categoriaId) : null,
      recurrente:      payload?.recurrente   ?? false,
      frecuenciaMeses: payload?.recurrente ? (Number(payload?.frecuenciaMeses) || 1) : null,
      fechaVenc:       payload?.fechaVenc     ? new Date(payload.fechaVenc)  : null,
      obs:           String(payload?.obs           || "").trim() || null,
      codigoCliente: String(payload?.codigoCliente || "").trim() || null,
      numeroPago:    String(payload?.numeroPago    || "").trim() || null,
    };

    const updated = await prisma.gasto.update({
      where: { id },
      data: updateData,
      include: { categoria: true },
    });

    // Si es recurrente, actualizar también el próximo gasto no pagado con la misma descripción original
    if (original?.recurrente && original?.descripcion) {
      const proximos = await prisma.gasto.findMany({
        where: {
          id:          { not: id },
          descripcion: original.descripcion,
          recurrente:  true,
          pagado:      false,
        },
      });
      if (proximos.length > 0) {
        await prisma.gasto.updateMany({
          where: {
            id: { in: proximos.map((g) => g.id) },
          },
          data: {
            descripcion:     desc,
            monto,
            categoriaId:     payload?.categoriaId  ? Number(payload.categoriaId) : null,
            frecuenciaMeses: payload?.recurrente ? (Number(payload?.frecuenciaMeses) || 1) : null,
            obs:           String(payload?.obs           || "").trim() || null,
            codigoCliente: String(payload?.codigoCliente || "").trim() || null,
            numeroPago:    String(payload?.numeroPago    || "").trim() || null,
          },
        });
      }
    }

    return updated;
  });

  // ── Marcar pagado — genera próximo si es recurrente ──────────────────────
  safeHandle("gastos:markPagado", async (_e, payload) => {
    // Acepta tanto un id directo como { id, montoProximo }
    const id    = Number(typeof payload === "object" ? payload?.id : payload);
    const montoProximo = payload?.montoProximo ? toIntOrNull(payload.montoProximo) : null;
    if (!id) throw new Error("Falta id.");

    const gasto = await prisma.gasto.findUnique({ where: { id }, include: { categoria: true } });
    if (!gasto) throw new Error("Gasto no encontrado.");

    // Marcar como pagado
    const updated = await prisma.gasto.update({
      where: { id },
      data: { pagado: true, pagadoAt: new Date() },
      include: { categoria: true },
    });

    // Si es recurrente y tiene fecha de vencimiento, crear el próximo
    if (gasto.recurrente && gasto.fechaVenc) {
      const meses     = Number(gasto.frecuenciaMeses) || 1;
      const proxFecha = addMonths(gasto.fechaVenc, meses);
      const proxMonto = (montoProximo && montoProximo > 0) ? montoProximo : gasto.monto;

      await prisma.gasto.create({
        data: {
          descripcion:     gasto.descripcion,
          monto:           proxMonto,
          categoriaId:     gasto.categoriaId,
          recurrente:      true,
          frecuenciaMeses: meses,
          fechaVenc:       proxFecha,
          pagado:          false,
          obs:             gasto.obs,
          codigoCliente:   gasto.codigoCliente,
          numeroPago:      gasto.numeroPago,
        },
      });
    }

    // Create DetallePago and MovimientoCaja entries
    const detalles = Array.isArray(payload?.detallesPago) && payload.detallesPago.length > 0
      ? payload.detallesPago
      : [{ medioPago: payload?.medioPago || "EFECTIVO", monto: gasto.monto }];

    for (const d of detalles) {
      const montoDetalle = Number(d.monto);
      if (!montoDetalle || !d.medioPago) continue;
      await prisma.detallePago.create({ data: { refId: id, refTipo: "GASTO", medioPago: d.medioPago, monto: montoDetalle } });
      await crearMovimientoCaja({
        tipo: "GASTO",
        concepto: gasto.descripcion,
        monto: -Math.abs(montoDetalle),
        medioPago: d.medioPago,
        refId: id,
        refTipo: "GASTO",
      });
    }

    return updated;
  });

  // ── Volver a pendiente ───────────────────────────────────────────────────
  safeHandle("gastos:markPendiente", async (_e, id) => {
    const n = Number(id);
    if (!n) throw new Error("Falta id.");
    return prisma.gasto.update({
      where: { id: n },
      data: { pagado: false, pagadoAt: null },
      include: { categoria: true },
    });
  });

  safeHandle("gastos:delete", async (_e, id) => {
    const n = Number(id);
    if (!n) throw new Error("Falta id.");
    await borrarMovimientosCajaDeGasto(n);
    await prisma.gasto.delete({ where: { id: n } });
    return { ok: true };
  });
}

module.exports = { registerGastos };