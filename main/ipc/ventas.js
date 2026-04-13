// ipc/ventas.js
const { prisma }    = require("../db");
const { safeHandle, toIntOrNull } = require("./helpers");
const { crearMovimientoCaja, borrarMovimientosCajaDeReceta } = require("./caja");

const INCLUDE_VENTA = { paciente: true, armazon: true, vidrio: true };

const ESTADOS_VALIDOS  = ["PENDIENTE", "PARCIAL", "PAGADO"];
const METODOS_VALIDOS  = ["EFECTIVO", "TRANSFERENCIA", "BILLETERA", "TARJETA_BANCO", "DEBITO", "CREDITO", null];
const NOT_DELETED      = { deletedAt: null };

function buildWhereVentas({ desde, hasta, pacienteId, estadoPago }) {
  const where = { ...NOT_DELETED };

  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(`${desde}T00:00:00`);
    if (hasta) where.createdAt.lte = new Date(`${hasta}T23:59:59`);
  }

  if (pacienteId) where.pacienteId = Number(pacienteId);

  if (estadoPago && ESTADOS_VALIDOS.includes(estadoPago)) {
    where.estadoPago = estadoPago;
  }

  return where;
}

function registerVentas() {
  // ── Lista de ventas con filtros ──────────────────────────────────────────
  safeHandle("ventas:list", async (_evt, payload) => {
    const { desde, hasta, pacienteId, estadoPago, page = 0, pageSize = 50 } = payload || {};
    const where    = buildWhereVentas({ desde, hasta, pacienteId, estadoPago });
    const safePage = Math.max(0, Number(page));
    const safeSize = Math.min(200, Math.max(1, Number(pageSize)));

    const [total, rows] = await Promise.all([
      prisma.receta.count({ where }),
      prisma.receta.findMany({
        where,
        include: INCLUDE_VENTA,
        orderBy: { createdAt: "desc" },
        skip: safePage * safeSize,
        take: safeSize,
      }),
    ]);

    return { rows, total, page: safePage, pageSize: safeSize, totalPages: Math.ceil(total / safeSize) };
  });

  // ── Soft delete de venta/receta ──────────────────────────────────────────
  safeHandle("ventas:delete", async (_evt, id) => {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new Error("ID inválido");

    const receta = await prisma.receta.findUnique({ where: { id: rid } });
    if (!receta) throw new Error("Venta no encontrada");
    if (receta.deletedAt) throw new Error("La venta ya fue eliminada");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.receta.update({
        where: { id: rid },
        data:  { deletedAt: new Date() },
        include: INCLUDE_VENTA,
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

  // ── Estadísticas: hoy / semana / mes ────────────────────────────────────
  safeHandle("ventas:stats", async () => {
    const now   = new Date();
    const hoy0  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const hoy23 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const diaSemana = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const inicioSemana = new Date(hoy0);
    inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

    const inicioMes    = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesSig = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [ventasHoy, ventasSemana, ventasMes, ventasMesAnt] = await Promise.all([
      prisma.receta.findMany({ where: { ...NOT_DELETED, createdAt: { gte: hoy0, lte: hoy23 }, total: { not: null } }, select: { total: true, estadoPago: true, montoPagado: true } }),
      prisma.receta.findMany({ where: { ...NOT_DELETED, createdAt: { gte: inicioSemana, lte: hoy23 }, total: { not: null } }, select: { total: true, estadoPago: true, montoPagado: true } }),
      prisma.receta.findMany({ where: { ...NOT_DELETED, createdAt: { gte: inicioMes, lt: inicioMesSig }, total: { not: null } }, select: { total: true, estadoPago: true, montoPagado: true } }),
      prisma.receta.findMany({ where: { ...NOT_DELETED, createdAt: { gte: inicioMesAnt, lt: inicioMes }, total: { not: null } }, select: { total: true, estadoPago: true, montoPagado: true } }),
    ]);

    function sumarVentas(list) {
      return {
        cantidad:       list.length,
        totalBruto:     list.reduce((a, r) => a + (r.total ?? 0), 0),
        totalCobrado:   list.reduce((a, r) => {
          if (r.estadoPago === "PAGADO")  return a + (r.total ?? 0);
          if (r.estadoPago === "PARCIAL") return a + (r.montoPagado ?? 0);
          return a;
        }, 0),
        pendienteCount: list.filter((r) => r.estadoPago === "PENDIENTE").length,
        parcialCount:   list.filter((r) => r.estadoPago === "PARCIAL").length,
        pagadoCount:    list.filter((r) => r.estadoPago === "PAGADO").length,
      };
    }

    return {
      hoy:    sumarVentas(ventasHoy),
      semana: sumarVentas(ventasSemana),
      mes:    sumarVentas(ventasMes),
      mesAnt: sumarVentas(ventasMesAnt),
    };
  });

  // ── Actualizar estado de pago ────────────────────────────────────────────
  safeHandle("ventas:updateEstadoPago", async (_evt, payload) => {
    const id = Number(payload?.id);
    if (!Number.isFinite(id)) throw new Error("ID inválido.");

    const estado = String(payload?.estadoPago || "").toUpperCase();
    if (!ESTADOS_VALIDOS.includes(estado)) throw new Error("Estado de pago inválido.");

    const metodo = payload?.metodoPago ? String(payload.metodoPago).toUpperCase() : null;

    // Traer receta actual para saber estado previo, total y método ya registrado
    const recetaActual = await prisma.receta.findUnique({
      where: { id },
      select: { total: true, estadoPago: true, metodoPago: true, montoPagado: true },
    });

    let montoPagado = null;
    if (estado === "PARCIAL") {
      const n = toIntOrNull(payload?.montoPagado);
      if (n === null || Number.isNaN(n) || n <= 0) throw new Error("Monto pagado inválido para estado PARCIAL.");
      montoPagado = n;
    }
    if (estado === "PAGADO") {
      montoPagado = toIntOrNull(payload?.montoPagado) ?? recetaActual?.total ?? null;
    }

    const updated = await prisma.receta.update({
      where: { id },
      data: { estadoPago: estado, montoPagado, metodoPago: metodo },
      include: INCLUDE_VENTA,
    });

    if (estado !== "PENDIENTE") {
      const prevPagado  = Number(recetaActual?.montoPagado ?? 0);
      const totalActual = estado === "PARCIAL"
        ? (montoPagado || 0)
        : (recetaActual?.total || 0);
      const nuevoMonto  = totalActual - prevPagado;

      if (nuevoMonto > 0) {
        const estadoPrevio    = recetaActual?.estadoPago ?? "PENDIENTE";
        const medioPagoFinal  = metodo || recetaActual?.metodoPago || "EFECTIVO";
        let concepto;
        if (estado === "PARCIAL")            concepto = `Seña venta #${id}`;
        else if (estadoPrevio === "PARCIAL") concepto = `Saldo venta #${id}`;
        else                                  concepto = `Venta #${id}`;

        await crearMovimientoCaja({
          tipo: "VENTA",
          concepto,
          monto: nuevoMonto,
          medioPago: medioPagoFinal,
          refId: id,
          refTipo: "RECETA",
        });
      }
    }

    return updated;
  });

  // ── Totales por período (para Home / dashboard) ──────────────────────────
  safeHandle("ventas:totalMes", async () => {
    const now          = new Date();
    const inicioMes    = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesSig = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [mes, mesAnt] = await Promise.all([
      prisma.receta.aggregate({ where: { ...NOT_DELETED, createdAt: { gte: inicioMes, lt: inicioMesSig }, total: { not: null } }, _sum: { total: true }, _count: { id: true } }),
      prisma.receta.aggregate({ where: { ...NOT_DELETED, createdAt: { gte: inicioMesAnt, lt: inicioMes }, total: { not: null } }, _sum: { total: true }, _count: { id: true } }),
    ]);

    return {
      mes:    { total: mes._sum.total    ?? 0, cantidad: mes._count.id    ?? 0 },
      mesAnt: { total: mesAnt._sum.total ?? 0, cantidad: mesAnt._count.id ?? 0 },
    };
  });
}

// ── Balance general ──────────────────────────────────────────────────────
safeHandle("balance:get", async (_evt, payload) => {
  const { desde, hasta } = payload || {};

  const whereVentas = { ...NOT_DELETED };
  const whereGastos = {};

  if (desde || hasta) {
    whereVentas.createdAt = {};
    whereGastos.pagadoAt  = {};
    if (desde) { whereVentas.createdAt.gte = new Date(`${desde}T00:00:00`); whereGastos.pagadoAt.gte = new Date(`${desde}T00:00:00`); }
    if (hasta) { whereVentas.createdAt.lte = new Date(`${hasta}T23:59:59`); whereGastos.pagadoAt.lte = new Date(`${hasta}T23:59:59`); }
  }

  const recetas = await prisma.receta.findMany({
    where: { ...whereVentas, total: { not: null } },
    select: { total: true, estadoPago: true, montoPagado: true, createdAt: true },
  });

  const gastos = await prisma.gasto.findMany({
    where: { ...whereGastos, pagado: true },
    include: { categoria: true },
    orderBy: { pagadoAt: "desc" },
  });

  const totalVentasBruto   = recetas.reduce((a, r) => a + (r.total ?? 0), 0);
  const totalVentasCobrado = recetas.reduce((a, r) => {
    if (r.estadoPago === "PAGADO")  return a + (r.total ?? 0);
    if (r.estadoPago === "PARCIAL") return a + (r.montoPagado ?? 0);
    return a;
  }, 0);
  const totalGastos  = gastos.reduce((a, g) => a + g.monto, 0);
  const gananciaNeta = totalVentasCobrado - totalGastos;

  const porCategoria = new Map();
  for (const g of gastos) {
    const key   = g.categoriaId ?? "sin";
    const label = g.categoria?.nombre ?? "Sin categoría";
    const color = g.categoria?.color  ?? "#d1d5db";
    if (!porCategoria.has(key)) porCategoria.set(key, { label, color, total: 0 });
    porCategoria.get(key).total += g.monto;
  }
  const gastosPorCategoria = Array.from(porCategoria.values()).sort((a, b) => b.total - a.total);

  const now  = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const ini = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = ini.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });

    const [vMes, gMes] = await Promise.all([
      prisma.receta.findMany({
        where: { ...NOT_DELETED, createdAt: { gte: ini, lt: fin }, total: { not: null } },
        select: { total: true, estadoPago: true, montoPagado: true },
      }),
      prisma.gasto.aggregate({
        where: { pagado: true, pagadoAt: { gte: ini, lt: fin } },
        _sum: { monto: true },
      }),
    ]);

    const ventasMes = vMes.reduce((a, r) => {
      if (r.estadoPago === "PAGADO")  return a + (r.total ?? 0);
      if (r.estadoPago === "PARCIAL") return a + (r.montoPagado ?? 0);
      return a;
    }, 0);
    meses.push({ label, ventasCobradas: ventasMes, gastos: gMes._sum.monto ?? 0, ganancia: ventasMes - (gMes._sum.monto ?? 0) });
  }

  return {
    totalVentasBruto, totalVentasCobrado, totalGastos, gananciaNeta,
    cantidadVentas: recetas.length, cantidadGastos: gastos.length,
    gastosPorCategoria, gastos, meses,
  };
});

module.exports = { registerVentas };