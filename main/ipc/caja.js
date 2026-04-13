// ipc/caja.js
const { prisma } = require("../db");
const { safeHandle } = require("./helpers");

// Helper: get or create today's CajaDiaria
async function getOrCreateCajaHoy() {
  const hoy = todayISO();
  let caja = await prisma.cajaDiaria.findUnique({ where: { fecha: hoy } });
  if (!caja) {
    // Compute saldoInicial from yesterday's closing balance
    // = sum of all MovimientoCaja before today across all cuentas
    const agg = await prisma.movimientoCaja.aggregate({
      where: { cajaDiaria: { fecha: { lt: hoy } } },
      _sum: { monto: true },
    });
    const movimientosTotales = Number(agg._sum.monto ?? 0);
    // Sum all cuentas saldoInicial
    const cuentas = await prisma.cuenta.findMany({ where: { activo: true } });
    const totalSaldosIniciales = cuentas.reduce((a, c) => a + Number(c.saldoInicial), 0);
    const saldoInicial = totalSaldosIniciales + movimientosTotales;
    try {
      caja = await prisma.cajaDiaria.create({
        data: { fecha: hoy, saldoInicial: Math.round(saldoInicial * 100) / 100 },
      });
    } catch (e) {
      // Another concurrent call already created it — just fetch it
      if (e?.code === "P2002") {
        caja = await prisma.cajaDiaria.findUnique({ where: { fecha: hoy } });
      } else {
        throw e;
      }
    }
  }
  return caja;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper: create a MovimientoCaja record (called from other IPC handlers too)
async function crearMovimientoCaja({ tipo, concepto, monto, medioPago, refId, refTipo }) {
  const caja = await getOrCreateCajaHoy();
  // TRANSFERENCIA y BILLETERA comparten la misma cuenta
  const mediosBusqueda = (medioPago === "BILLETERA" || medioPago === "TRANSFERENCIA")
    ? ["TRANSFERENCIA", "BILLETERA"]
    : [medioPago];
  let cuenta = null;
  for (const m of mediosBusqueda) {
    cuenta = await prisma.cuenta.findFirst({ where: { medioPago: m, activo: true } });
    if (cuenta) break;
  }
  await prisma.movimientoCaja.create({
    data: {
      cajaDiariaId: caja.id,
      cuentaId: cuenta?.id ?? null,
      tipo,
      concepto,
      monto,
      medioPago,
      refId: refId ?? null,
      refTipo: refTipo ?? null,
    },
  });
}

function registerCaja() {
  // ── Cuentas CRUD ─────────────────────────────────────────────────────────

  safeHandle("cuentas:list", async () => {
    const cuentas = await prisma.cuenta.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
    // Compute balance for each cuenta
    const result = await Promise.all(cuentas.map(async (c) => {
      const agg = await prisma.movimientoCaja.aggregate({
        where: { cuentaId: c.id },
        _sum: { monto: true },
      });
      const saldoMovimientos = Number(agg._sum.monto ?? 0);
      return { ...c, saldoActual: c.saldoInicial + saldoMovimientos };
    }));
    return result;
  });

  safeHandle("cuentas:create", async (_e, payload) => {
    const nombre = String(payload?.nombre || "").trim();
    if (!nombre) throw new Error("Falta el nombre de la cuenta.");
    const medioPago = String(payload?.medioPago || "").trim();
    const VALIDOS = ["EFECTIVO", "TRANSFERENCIA", "BILLETERA", "TARJETA_BANCO"];
    if (!VALIDOS.includes(medioPago)) throw new Error("Medio de pago inválido.");
    const saldoInicial = Number(payload?.saldoInicial ?? 0);
    const orden = Number(payload?.orden ?? 0);
    return prisma.cuenta.create({ data: { nombre, medioPago, saldoInicial, orden } });
  });

  safeHandle("cuentas:update", async (_e, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("ID inválido.");
    const nombre = String(payload?.nombre || "").trim();
    if (!nombre) throw new Error("Falta el nombre de la cuenta.");
    const medioPago = String(payload?.medioPago || "").trim();
    const VALIDOS = ["EFECTIVO", "TRANSFERENCIA", "BILLETERA", "TARJETA_BANCO"];
    if (!VALIDOS.includes(medioPago)) throw new Error("Medio de pago inválido.");
    const saldoInicial = Number(payload?.saldoInicial ?? 0);
    const activo = payload?.activo !== false;
    const orden = Number(payload?.orden ?? 0);
    return prisma.cuenta.update({ where: { id }, data: { nombre, medioPago, saldoInicial, activo, orden } });
  });

  safeHandle("cuentas:delete", async (_e, id) => {
    const n = Number(id);
    if (!n) throw new Error("ID inválido.");
    // Soft delete: just deactivate
    return prisma.cuenta.update({ where: { id: n }, data: { activo: false } });
  });

  // ── Caja diaria ─────────────────────────────────────────────────────────

  safeHandle("cajaDiaria:hoy", async () => {
    const caja = await getOrCreateCajaHoy();

    // Traer cuentas y sus movimientos para calcular saldoActual de cada una
    const cuentas = await prisma.cuenta.findMany({ where: { activo: true } });
    const saldosCuentas = await Promise.all(
      cuentas.map(async (c) => {
        const agg = await prisma.movimientoCaja.aggregate({
          where: { cuentaId: c.id },
          _sum: { monto: true },
        });
        return Number(c.saldoInicial) + Number(agg._sum.monto ?? 0);
      })
    );
    const totalCuentasActual = saldosCuentas.reduce((a, b) => a + b, 0);

    // Movimientos de HOY
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { cajaDiariaId: caja.id },
      include: { cuenta: true },
      orderBy: { createdAt: "asc" },
    });
    const totalHoy = movimientos.reduce((a, m) => a + m.monto, 0);

    // Saldo inicial del día = total actual de cuentas − lo que entró/salió hoy
    const saldoInicial = Math.round((totalCuentasActual - totalHoy) * 100) / 100;

    let saldo = saldoInicial;
    const movimientosConSaldo = movimientos.map((m) => {
      saldo += m.monto;
      return { ...m, saldoAcumulado: Math.round(saldo * 100) / 100 };
    });
    return { ...caja, saldoInicial, movimientos: movimientosConSaldo, saldoActual: Math.round(saldo * 100) / 100 };
  });

  safeHandle("cajaDiaria:porFecha", async (_e, fecha) => {
    if (!fecha) throw new Error("Falta fecha.");
    const caja = await prisma.cajaDiaria.findUnique({ where: { fecha } });
    if (!caja) return null;
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { cajaDiariaId: caja.id },
      include: { cuenta: true },
      orderBy: { createdAt: "asc" },
    });
    let saldo = caja.saldoInicial;
    const movimientosConSaldo = movimientos.map((m) => {
      saldo += m.monto;
      return { ...m, saldoAcumulado: Math.round(saldo * 100) / 100 };
    });
    return { ...caja, movimientos: movimientosConSaldo, saldoActual: Math.round(saldo * 100) / 100 };
  });

  // ── Saldos por cuenta (para la vista Caja general) ───────────────────────

  safeHandle("caja:saldos", async () => {
    const cuentas = await prisma.cuenta.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });
    const result = await Promise.all(cuentas.map(async (c) => {
      const agg = await prisma.movimientoCaja.aggregate({
        where: { cuentaId: c.id },
        _sum: { monto: true },
      });
      const saldoMovimientos = Number(agg._sum.monto ?? 0);
      return { ...c, saldoActual: Math.round((c.saldoInicial + saldoMovimientos) * 100) / 100 };
    }));
    return result;
  });

  // ── Movimiento manual (ajuste) ───────────────────────────────────────────

  safeHandle("cajaDiaria:agregarMovimiento", async (_e, payload) => {
    const concepto = String(payload?.concepto || "").trim();
    if (!concepto) throw new Error("Falta concepto.");
    const monto = Number(payload?.monto);
    if (!Number.isFinite(monto) || monto === 0) throw new Error("Monto inválido.");
    const medioPago = String(payload?.medioPago || "EFECTIVO");
    await crearMovimientoCaja({ tipo: "AJUSTE", concepto, monto, medioPago });
    return { ok: true };
  });
}

async function borrarMovimientosCajaDeReceta(recetaId) {
  await prisma.movimientoCaja.deleteMany({
    where: { refId: recetaId, refTipo: "RECETA" },
  });
}

async function borrarMovimientosCajaDeGasto(gastoId) {
  await prisma.movimientoCaja.deleteMany({
    where: { refId: gastoId, refTipo: "GASTO" },
  });
}

module.exports = { registerCaja, crearMovimientoCaja, getOrCreateCajaHoy, borrarMovimientosCajaDeReceta, borrarMovimientosCajaDeGasto };
