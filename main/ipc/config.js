// ipc/config.js
const { prisma } = require("../db");
const { safeHandle, clamp, toNumOrNull, normalizeCuotas, getOrCreateConfig } = require("./helpers");

function registerConfig() {
  safeHandle("config:get", async () => {
    const cfg = await getOrCreateConfig();
    let cuotasCredito = [];
    try { cuotasCredito = JSON.parse(cfg.cuotasCreditoJson || "[]"); } catch { cuotasCredito = []; }
    return {
      id: cfg.id,
      seniaPorcentaje: cfg.seniaPorcentaje,
      descuentoEfectivo: cfg.descuentoEfectivo,
      descuentoDebito: cfg.descuentoDebito,
      descuentoTransferencia: cfg.descuentoTransferencia,
      cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
      updatedAt: cfg.updatedAt,
    };
  });

  safeHandle("config:set", async (_evt, payload) => {
    const cfg = await getOrCreateConfig();
    const senia = toNumOrNull(payload?.seniaPorcentaje);
    const de    = toNumOrNull(payload?.descuentoEfectivo);
    const dd    = toNumOrNull(payload?.descuentoDebito);
    const dt    = toNumOrNull(payload?.descuentoTransferencia);

    const next = {
      seniaPorcentaje:        senia === null ? cfg.seniaPorcentaje        : clamp(Number.isNaN(senia) ? cfg.seniaPorcentaje        : senia, 0, 100),
      descuentoEfectivo:      de    === null ? cfg.descuentoEfectivo      : clamp(Number.isNaN(de)    ? cfg.descuentoEfectivo      : de,    0, 100),
      descuentoDebito:        dd    === null ? cfg.descuentoDebito        : clamp(Number.isNaN(dd)    ? cfg.descuentoDebito        : dd,    0, 100),
      descuentoTransferencia: dt    === null ? cfg.descuentoTransferencia : clamp(Number.isNaN(dt)    ? cfg.descuentoTransferencia : dt,    0, 100),
    };

    const cuotasNorm = normalizeCuotas(payload?.cuotasCredito);
    const updated = await prisma.configuracion.update({
      where: { id: cfg.id },
      data: { ...next, cuotasCreditoJson: JSON.stringify(cuotasNorm) },
    });

    let cuotasCredito = [];
    try { cuotasCredito = JSON.parse(updated.cuotasCreditoJson || "[]"); } catch { cuotasCredito = []; }
    return {
      id: updated.id,
      seniaPorcentaje: updated.seniaPorcentaje,
      descuentoEfectivo: updated.descuentoEfectivo,
      descuentoDebito: updated.descuentoDebito,
      descuentoTransferencia: updated.descuentoTransferencia,
      cuotasCredito,
      updatedAt: updated.updatedAt,
    };
  });

  safeHandle("config:setSeniaPorcentaje", async (_evt, n) => {
    const cfg  = await getOrCreateConfig();
    const num  = toNumOrNull(n);
    const safe = num === null || Number.isNaN(num) ? cfg.seniaPorcentaje : clamp(num, 0, 100);
    const updated = await prisma.configuracion.update({
      where: { id: cfg.id },
      data: { seniaPorcentaje: safe },
    });
    let cuotasCredito = [];
    try { cuotasCredito = JSON.parse(updated.cuotasCreditoJson || "[]"); } catch { cuotasCredito = []; }
    return {
      id: updated.id,
      seniaPorcentaje: updated.seniaPorcentaje,
      descuentoEfectivo: updated.descuentoEfectivo,
      descuentoDebito: updated.descuentoDebito,
      descuentoTransferencia: updated.descuentoTransferencia,
      cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
      updatedAt: updated.updatedAt,
    };
  });
}

module.exports = { registerConfig };
