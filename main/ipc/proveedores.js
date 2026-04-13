// ipc/proveedores.js
const { prisma } = require("../db");
const { safeHandle, toIntOrNull, getSupplierCurrentBalance } = require("./helpers");
const { crearMovimientoCaja } = require("./caja");

function registerProveedores() {
  safeHandle("suppliers:list", async (_e, tipo) => {
    const t = String(tipo || "").toUpperCase();
    if (t !== "ARMAZONES" && t !== "VIDRIOS") return [];
    const rows = await prisma.proveedor.findMany({
      where: { tipo: t },
      include: { movimientos: { orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 1 } },
      orderBy: { nombre: "asc" },
    });
    return rows.map((p) => ({ ...p, saldoActual: p.movimientos?.[0]?.saldo ?? 0, movimientos: undefined }));
  });

  safeHandle("suppliers:create", async (_e, payload) => {
    const p    = payload || {};
    const tipo = String(p.tipo || "").toUpperCase();
    if (tipo !== "ARMAZONES" && tipo !== "VIDRIOS") throw new Error("Tipo de proveedor inválido.");
    const nombre = String(p.nombre || "").trim();
    if (!nombre) throw new Error("Falta el nombre del proveedor.");
    const telefono = String(p.telefono || "").trim() || null;
    const email    = String(p.email    || "").trim() || null;
    if (!telefono && !email) throw new Error("Ingresá teléfono y/o mail.");
    return prisma.proveedor.create({
      data: {
        tipo, nombre, telefono, email,
        productos:         String(p.productos         || "").trim() || null,
        contactoPreferido: String(p.contactoPreferido || "wpp"),
        formasPago:        String(p.formasPago        || "").trim() || null,
        frecuenciaEntrega: String(p.frecuenciaEntrega || "").trim() || null,
        observaciones:     String(p.observaciones     || "").trim() || null,
        banco:    String(p.banco    || "").trim() || null,
        cbu:      String(p.cbu      || "").trim() || null,
        alias:    String(p.alias    || "").trim() || null,
        titular:  String(p.titular  || "").trim() || null,
      },
    });
  });

  safeHandle("suppliers:update", async (_e, payload) => {
    const p  = payload || {};
    const id = Number(p.id);
    if (!Number.isFinite(id)) throw new Error("ID inválido.");
    const nombre = String(p.nombre || "").trim();
    if (!nombre) throw new Error("Falta el nombre del proveedor.");
    const telefono = String(p.telefono || "").trim() || null;
    const email    = String(p.email    || "").trim() || null;
    if (!telefono && !email) throw new Error("Ingresá teléfono y/o mail.");
    return prisma.proveedor.update({
      where: { id },
      data: {
        nombre, telefono, email,
        productos:         String(p.productos         || "").trim() || null,
        contactoPreferido: String(p.contactoPreferido || "wpp"),
        formasPago:        String(p.formasPago        || "").trim() || null,
        frecuenciaEntrega: String(p.frecuenciaEntrega || "").trim() || null,
        observaciones:     String(p.observaciones     || "").trim() || null,
        banco:    String(p.banco    || "").trim() || null,
        cbu:      String(p.cbu      || "").trim() || null,
        alias:    String(p.alias    || "").trim() || null,
        titular:  String(p.titular  || "").trim() || null,
      },
    });
  });

  safeHandle("suppliers:delete", async (_e, id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) throw new Error("ID inválido.");
    await prisma.movimientoProveedor.deleteMany({ where: { proveedorId: n } });
    await prisma.proveedor.delete({ where: { id: n } });
    return { ok: true };
  });

  safeHandle("suppliers:movements", async (_e, payload) => {
    const isObj      = payload !== null && typeof payload === "object" && !Array.isArray(payload);
    const proveedorId = Number(isObj ? payload.proveedorId : payload);
    const page       = Math.max(0, Number((isObj ? payload.page     : 0) ?? 0));
    const pageSize   = Math.min(200, Math.max(1, Number((isObj ? payload.pageSize : 50) ?? 50)));
    if (!Number.isFinite(proveedorId)) throw new Error("ID inválido");
    const [total, rows] = await Promise.all([
      prisma.movimientoProveedor.count({ where: { proveedorId } }),
      prisma.movimientoProveedor.findMany({
        where: { proveedorId },
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
        skip: page * pageSize,
        take: pageSize,
      }),
    ]);
    return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });

  safeHandle("suppliers:addPayment", async (_e, payload) => {
    const proveedorId = Number(payload?.proveedorId);
    const monto       = toIntOrNull(payload?.monto);
    const concepto    = String(payload?.concepto || "Pago").trim();
    if (!Number.isFinite(proveedorId)) throw new Error("Proveedor inválido.");
    if (monto === null || Number.isNaN(monto) || monto <= 0) throw new Error("Monto inválido.");
    const saldoPrevio = await getSupplierCurrentBalance(proveedorId);
    const result = await prisma.movimientoProveedor.create({
      data: { proveedorId, concepto, haber: monto, debe: null, saldo: saldoPrevio + monto },
    });

    const detalles = Array.isArray(payload?.detallesPago) && payload.detallesPago.length > 0
      ? payload.detallesPago
      : [{ medioPago: payload?.medioPago || "TRANSFERENCIA", monto }];

    for (const d of detalles) {
      const montoDetalle = Number(d.monto);
      if (!montoDetalle || !d.medioPago) continue;
      await prisma.detallePago.create({ data: { refId: result.id, refTipo: "PAGO_PROVEEDOR", medioPago: d.medioPago, monto: montoDetalle } });
      await crearMovimientoCaja({
        tipo: "PAGO_PROVEEDOR",
        concepto: concepto,
        monto: -Math.abs(montoDetalle),
        medioPago: d.medioPago,
        refId: result.id,
        refTipo: "PAGO_PROVEEDOR",
      });
    }

    return result;
  });

  safeHandle("suppliers:addPurchase", async (_e, payload) => {
    const proveedorId = Number(payload?.proveedorId);
    const monto       = toIntOrNull(payload?.monto);
    const concepto    = String(payload?.concepto || "Nuevo pedido").trim();
    if (!Number.isFinite(proveedorId)) throw new Error("Proveedor inválido.");
    if (monto === null || Number.isNaN(monto) || monto <= 0) throw new Error("Monto inválido.");
    const saldoPrevio = await getSupplierCurrentBalance(proveedorId);
    return prisma.movimientoProveedor.create({
      data: { proveedorId, concepto, debe: monto, haber: null, saldo: saldoPrevio - monto },
    });
  });

  // ── Pagos (resumen) ──────────────────────────────────────────────────────
  safeHandle("pagos:resumen", async () => {
    return prisma.movimientoProveedor.findMany({
      where: { haber: { not: null } },
      include: { proveedor: true },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 300,
    });
  });

  safeHandle("pagos:totalesPorProveedor", async () => {
    const proveedores = await prisma.proveedor.findMany({
      include: { movimientos: { orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 1 } },
      orderBy: { nombre: "asc" },
    });
    return proveedores.map((p) => ({
      id: p.id, nombre: p.nombre, tipo: p.tipo,
      saldoActual: p.movimientos?.[0]?.saldo ?? 0,
    }));
  });

  safeHandle("pagos:registrar", async (_e, payload) => {
    const proveedorId = Number(payload?.proveedorId);
    const monto       = toIntOrNull(payload?.monto);
    const concepto    = String(payload?.concepto || "Pago").trim();
    if (!Number.isFinite(proveedorId)) throw new Error("Proveedor inválido.");
    if (monto === null || Number.isNaN(monto) || monto <= 0) throw new Error("Monto inválido.");
    const saldoPrevio = await getSupplierCurrentBalance(proveedorId);
    const result = await prisma.movimientoProveedor.create({
      data: { proveedorId, concepto, haber: monto, debe: null, saldo: saldoPrevio + monto },
      include: { proveedor: true },
    });

    const detalles = Array.isArray(payload?.detallesPago) && payload.detallesPago.length > 0
      ? payload.detallesPago
      : [{ medioPago: payload?.medioPago || "TRANSFERENCIA", monto }];

    for (const d of detalles) {
      const montoDetalle = Number(d.monto);
      if (!montoDetalle || !d.medioPago) continue;
      await prisma.detallePago.create({ data: { refId: result.id, refTipo: "PAGO_PROVEEDOR", medioPago: d.medioPago, monto: montoDetalle } });
      await crearMovimientoCaja({
        tipo: "PAGO_PROVEEDOR",
        concepto: concepto,
        monto: -Math.abs(montoDetalle),
        medioPago: d.medioPago,
        refId: result.id,
        refTipo: "PAGO_PROVEEDOR",
      });
    }

    return result;
  });
}

module.exports = { registerProveedores };
