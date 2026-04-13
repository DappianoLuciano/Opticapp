// ipc/inventario.js
const { prisma }    = require("../db");
const { safeHandle } = require("./helpers");

function toIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(String(v).replace(/\./g, "").replace(",", ".")));
  return Number.isFinite(n) ? n : null;
}

function registerInventario() {
  // ── Armazones ────────────────────────────────────────────────────────────
  safeHandle("frames:list", async () => {
    return prisma.armazon.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  });

  safeHandle("frames:create", async (_evt, payload) => {
    return prisma.armazon.create({
      data: {
        marca:       payload.marca,
        modelo:      payload.modelo,
        codigo:      payload.codigo ?? null,
        stock:       Number(payload.stock ?? payload.stockInit ?? 0),
        costo:       Number(payload.costo ?? 0),
        // ── NUEVO ──────────────────────────────
        precioFinal: toIntOrNull(payload.precioFinal),
      },
    });
  });

  safeHandle("frames:updateStock", async (_evt, payload) => {
    const id    = Number(payload?.id ?? payload?.armazonId);
    const delta = payload?.delta;
    if (!id) throw new Error("Datos inválidos");

    if (delta !== undefined) {
      return prisma.armazon.update({ where: { id }, data: { stock: { increment: Number(delta) } } });
    }
    const stock = Number(payload?.stock);
    if (!Number.isFinite(stock)) throw new Error("Datos inválidos");
    return prisma.armazon.update({ where: { id }, data: { stock } });
  });

  safeHandle("frames:update", async (_evt, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("Falta id");
    return prisma.armazon.update({
      where: { id },
      data: {
        marca:       payload.marca,
        modelo:      payload.modelo,
        codigo:      payload.codigo ?? null,
        costo:       Number(payload.costo ?? 0),
        stock:       Number(payload.stock ?? 0),
        // ── NUEVO ──────────────────────────────
        precioFinal: toIntOrNull(payload.precioFinal),
      },
    });
  });

  safeHandle("frames:delete", async (_evt, payload) => {
    const id = Number(payload?.id ?? payload);
    if (!id) throw new Error("Falta id");
    await prisma.armazon.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  });

  safeHandle("frames:stockBajo", async (_evt, payload) => {
    const umbral = Number(payload?.umbral ?? 3);
    return prisma.armazon.findMany({
      where: { deletedAt: null, stock: { lte: umbral } },
      orderBy: { stock: "asc" },
    });
  });

  // ── Vidrios ──────────────────────────────────────────────────────────────
  safeHandle("vidrios:list", async () => {
    return prisma.vidrio.findMany({ orderBy: { createdAt: "desc" } });
  });

  safeHandle("vidrios:create", async (_evt, payload) => {
    return prisma.vidrio.create({
      data: {
        nombre:          payload.nombre,
        descripcion:     payload.descripcion          ?? null,
        precioCal:       payload.precioCal            ?? null,
        precioRanura:    payload.precioRanura          ?? null,
        precioPerforado: payload.precioPerforado       ?? null,
        // ── NUEVO ──────────────────────────────
        precioCalFinal:       toIntOrNull(payload.precioCalFinal),
        precioRanuraFinal:    toIntOrNull(payload.precioRanuraFinal),
        precioPerforadoFinal: toIntOrNull(payload.precioPerforadoFinal),
        activo:          payload.activo               ?? true,
      },
    });
  });

  safeHandle("vidrios:update", async (_evt, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("Falta id");
    return prisma.vidrio.update({
      where: { id },
      data: {
        nombre:          payload.nombre,
        descripcion:     payload.descripcion          ?? null,
        precioCal:       payload.precioCal            ?? null,
        precioRanura:    payload.precioRanura          ?? null,
        precioPerforado: payload.precioPerforado       ?? null,
        // ── NUEVO ──────────────────────────────
        precioCalFinal:       toIntOrNull(payload.precioCalFinal),
        precioRanuraFinal:    toIntOrNull(payload.precioRanuraFinal),
        precioPerforadoFinal: toIntOrNull(payload.precioPerforadoFinal),
        activo:          payload.activo               ?? true,
      },
    });
  });

  safeHandle("vidrios:delete", async (_evt, id) => {
    const vid = Number(id);
    if (!vid) throw new Error("Falta id");
    await prisma.vidrio.delete({ where: { id: vid } });
    return true;
  });

  // ── Servicios ────────────────────────────────────────────────────────────
  safeHandle("servicios:list", async () => {
    return prisma.servicioOptica.findMany({ orderBy: { createdAt: "desc" } });
  });

  safeHandle("servicios:create", async (_evt, payload) => {
    return prisma.servicioOptica.create({
      data: { nombre: payload.nombre, precio: Number(payload.precio ?? 0), activo: payload.activo ?? true },
    });
  });

  safeHandle("servicios:update", async (_evt, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("Falta id");
    return prisma.servicioOptica.update({
      where: { id },
      data: { nombre: payload.nombre, precio: Number(payload.precio ?? 0), activo: payload.activo ?? true },
    });
  });

  safeHandle("servicios:delete", async (_evt, id) => {
    const sid = Number(id);
    if (!sid) throw new Error("Falta id");
    await prisma.servicioOptica.delete({ where: { id: sid } });
    return true;
  });
}

module.exports = { registerInventario };