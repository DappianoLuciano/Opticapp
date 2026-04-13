// ipc/turnos.js
const { prisma }     = require("../db");
const { safeHandle } = require("./helpers");

function registerTurnos() {
  // Turnos del mes (para los dots del calendario)
  safeHandle("turnos:listByMonth", async (_evt, { year, month }) => {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);
    return prisma.turno.findMany({
      where: { fecha: { gte: start, lt: end } },
      include: { paciente: { select: { nombre: true } } },
      orderBy: { fecha: "asc" },
    });
  });

  // Turnos de un día específico
  safeHandle("turnos:listByDate", async (_evt, iso) => {
    const d     = new Date(`${iso}T00:00:00`);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return prisma.turno.findMany({
      where: { fecha: { gte: start, lt: end } },
      include: { paciente: { select: { nombre: true, telefono: true } } },
      orderBy: { fecha: "asc" },
    });
  });

  safeHandle("turnos:create", async (_evt, payload) => {
    return prisma.turno.create({
      data: {
        fecha:          new Date(payload.fecha),
        duracion:       Number(payload.duracion ?? 30),
        pacienteId:     payload.pacienteId ? Number(payload.pacienteId) : null,
        nombrePaciente: payload.nombrePaciente?.trim() || null,
        telefono:       payload.telefono?.trim()       || null,
        motivo:         payload.motivo?.trim()          || null,
        notas:          payload.notas?.trim()           || null,
        estado:         payload.estado                  ?? "pendiente",
      },
    });
  });

  safeHandle("turnos:update", async (_evt, payload) => {
    const id = Number(payload.id);
    if (!id) throw new Error("Falta id");
    return prisma.turno.update({
      where: { id },
      data: {
        fecha:          new Date(payload.fecha),
        duracion:       Number(payload.duracion ?? 30),
        pacienteId:     payload.pacienteId ? Number(payload.pacienteId) : null,
        nombrePaciente: payload.nombrePaciente?.trim() || null,
        telefono:       payload.telefono?.trim()       || null,
        motivo:         payload.motivo?.trim()          || null,
        notas:          payload.notas?.trim()           || null,
        estado:         payload.estado                  ?? "pendiente",
      },
    });
  });

  safeHandle("turnos:updateEstado", async (_evt, { id, estado }) => {
    return prisma.turno.update({ where: { id: Number(id) }, data: { estado } });
  });

  safeHandle("turnos:delete", async (_evt, id) => {
    await prisma.turno.delete({ where: { id: Number(id) } });
    return true;
  });
}

module.exports = { registerTurnos };
