// ipc/helpers.js
const { ipcMain } = require("electron");
const { prisma }  = require("../db");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNumOrNull(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function toIntOrNull(v) {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
}

function normalizeCuotas(input) {
  const arr = Array.isArray(input) ? input : [];
  const normalized = arr
    .map((x) => ({
      cuotas: Number(x?.cuotas),
      recargoPct: Number(String(x?.recargoPct ?? x?.recargo ?? 0).replace(",", ".")),
    }))
    .filter((x) => Number.isInteger(x.cuotas) && x.cuotas > 0)
    .map((x) => ({
      cuotas: x.cuotas,
      recargoPct: Number.isFinite(x.recargoPct) ? clamp(x.recargoPct, 0, 300) : 0,
    }))
    .sort((a, b) => a.cuotas - b.cuotas);

  const map = new Map();
  for (const item of normalized) map.set(item.cuotas, item);
  const out = Array.from(map.values()).sort((a, b) => a.cuotas - b.cuotas);
  return out.length ? out : [{ cuotas: 1, recargoPct: 0 }];
}

async function getOrCreateConfig() {
  const existing = await prisma.configuracion.findFirst();
  if (existing) return existing;
  return prisma.configuracion.create({
    data: {
      seniaPorcentaje: 30,
      descuentoEfectivo: 0,
      descuentoDebito: 0,
      descuentoTransferencia: 0,
      cuotasCreditoJson: JSON.stringify([
        { cuotas: 1, recargoPct: 0 },
        { cuotas: 3, recargoPct: 10 },
        { cuotas: 6, recargoPct: 20 },
      ]),
    },
  });
}

function safeHandle(channel, handler) {
  try { ipcMain.removeHandler(channel); } catch (_) {}
  ipcMain.handle(channel, handler);
}

function prettyError(err, fallback) {
  if (fallback === undefined) fallback = "Ocurrió un error";

  // Prisma P2002 unique constraint — objeto intacto (main process)
  if (err && err.code === "P2002") {
    var fields = err.meta && err.meta.target;
    if (Array.isArray(fields) && fields.indexOf("dni") !== -1) {
      return "Ya existe un paciente con ese DNI";
    }
    return "Ya existe un registro con esos datos";
  }

  // Prisma P2002 unique constraint — por string (Electron serializa el error)
  // El mensaje de Prisma contiene: "Unique constraint failed on the fields: (`dni`)"
  var raw = String(err && err.message ? err.message : err || "").toLowerCase();
  if (raw.indexOf("unique constraint") !== -1) {
    if (raw.indexOf("dni") !== -1) return "Ya existe un paciente con ese DNI";
    return "Ya existe un registro con esos datos";
  }

  var msg = String(err && err.message ? err.message : err || "").trim();
  msg = msg.replace(/^Error invoking remote method '[^']*':\s*/i, "").trim();
  msg = msg.replace(/^Error:\s*/i, "").trim();
  return msg || fallback;
}

async function getSupplierCurrentBalance(proveedorId) {
  const last = await prisma.movimientoProveedor.findFirst({
    where: { proveedorId },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
  });
  return last ? last.saldo : 0;
}

module.exports = {
  clamp, toNumOrNull, toIntOrNull, normalizeCuotas,
  getOrCreateConfig, safeHandle, prettyError, getSupplierCurrentBalance,
};