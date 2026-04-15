// ipc/pacientes.js
const { prisma }      = require("../db");
const { safeHandle, prettyError } = require("./helpers");

// Valida duplicados de dni, email y telefono con findFirst
// para controlar todos los errores antes de llegar a Prisma.
// Devuelve un objeto { campo: "mensaje" } o null si no hay conflictos.
async function checkDuplicates(payload, excludeId) {
  const errors = {};
  const excl = excludeId ? { not: Number(excludeId) } : undefined;

  // DNI — aunque es @unique en Prisma, lo validamos acá primero
  // para poder devolver un mensaje limpio sin depender de P2002
  if (payload.dni && String(payload.dni).trim()) {
    const where = { dni: String(payload.dni).trim() };
    if (excl) where.id = excl;
    const found = await prisma.paciente.findFirst({ where });
    if (found) errors.dni = "Ya existe un paciente con ese DNI";
  }

  if (payload.email && payload.email.trim()) {
    const where = { email: payload.email.trim() };
    if (excl) where.id = excl;
    const found = await prisma.paciente.findFirst({ where });
    if (found) errors.email = "Ya existe un paciente con ese email";
  }

  if (payload.telefono && payload.telefono.trim()) {
    const where = { telefono: payload.telefono.trim() };
    if (excl) where.id = excl;
    const found = await prisma.paciente.findFirst({ where });
    if (found) errors.telefono = "Ya existe un paciente con ese teléfono";
  }

  return Object.keys(errors).length ? errors : null;
}

function registerPacientes() {
  safeHandle("patients:list", async () => {
    return prisma.paciente.findMany({ orderBy: { createdAt: "desc" } });
  });

  safeHandle("patients:create", async (_evt, payload) => {
    // Validar duplicados manuales (email, telefono)
    const dupes = await checkDuplicates(payload, null);
    if (dupes) {
      // Mandamos el objeto de errores como JSON en el mensaje
      throw new Error("VALIDATION:" + JSON.stringify(dupes));
    }

    try {
      return await prisma.paciente.create({
        data: {
          nombre:     payload.nombre,
          dni:        String(payload.dni ?? ""),
          direccion:  payload.direccion  ?? null,
          telefono:   payload.telefono   ?? null,
          email:      payload.email      ?? null,
          fechaNac:   payload.fechaNac   ? new Date(payload.fechaNac) : null,
          obraSocial: payload.obraSocial ?? null,
        },
      });
    } catch (e) {
      throw new Error(prettyError(e, "No se pudo crear el paciente"));
    }
  });

  safeHandle("patients:update", async (_evt, payload) => {
    if (!payload?.id) throw new Error("Falta id");

    // Validar duplicados manuales (email, telefono) excluyendo el propio paciente
    const dupes = await checkDuplicates(payload, payload.id);
    if (dupes) {
      throw new Error("VALIDATION:" + JSON.stringify(dupes));
    }

    try {
      return await prisma.paciente.update({
        where: { id: Number(payload.id) },
        data: {
          nombre:     payload.nombre,
          dni:        String(payload.dni ?? ""),
          direccion:  payload.direccion  ?? null,
          telefono:   payload.telefono   ?? null,
          email:      payload.email      ?? null,
          fechaNac:   payload.fechaNac   ? new Date(payload.fechaNac) : null,
          obraSocial: payload.obraSocial ?? null,
        },
      });
    } catch (e) {
      throw new Error(prettyError(e, "No se pudo actualizar el paciente"));
    }
  });

  // ── Evoluciones ──────────────────────────────────────────────────────────
  safeHandle("patients:evoluciones:list", async (_evt, pacienteId) => {
    const pid = Number(pacienteId);
    if (!pid) return [];
    return prisma.evolucionRefraccion.findMany({
      where: { pacienteId: pid, deletedAt: null },
      orderBy: { fecha: "desc" },
      include: { fotos: true },
    });
  });

  safeHandle("patients:evoluciones:add", async (_evt, payload) => {
    const fotos = Array.isArray(payload.fotos) ? payload.fotos : [];
    return prisma.evolucionRefraccion.create({
      data: {
        pacienteId:  Number(payload.pacienteId),
        fecha:       payload.fecha ? new Date(payload.fecha + "T00:00:00") : new Date(),
        distancia:   payload.distancia   ?? null,
        odEsf:       payload.odEsf === "" ? null : (payload.odEsf != null ? Number(payload.odEsf) : null),
        odCil:       payload.odCil === "" ? null : (payload.odCil != null ? Number(payload.odCil) : null),
        odEje:       payload.odEje === "" ? null : (payload.odEje != null ? Number(payload.odEje) : null),
        oiEsf:       payload.oiEsf === "" ? null : (payload.oiEsf != null ? Number(payload.oiEsf) : null),
        oiCil:       payload.oiCil === "" ? null : (payload.oiCil != null ? Number(payload.oiCil) : null),
        oiEje:       payload.oiEje === "" ? null : (payload.oiEje != null ? Number(payload.oiEje) : null),
        tratamiento: payload.tratamiento ?? null,
        formato:     payload.formato     ?? null,
        dip:         payload.dip === ""  ? null : (payload.dip != null ? Number(payload.dip) : null),
        montaje:     payload.montaje     ?? null,
        doctor:      payload.doctor      ?? null,
        patologia:   payload.patologia   ?? null,
        obs:         payload.obs         ?? null,
        fotos: fotos.length > 0 ? {
          create: fotos.map((f) => ({
            foto:          f.foto,
            observaciones: f.observaciones || "",
          })),
        } : undefined,
      },
      include: { fotos: true },
    });
  });

  safeHandle("patients:evoluciones:update", async (_evt, payload) => {
    if (!payload?.id) throw new Error("Falta id");
    const fotos = Array.isArray(payload.fotos) ? payload.fotos : [];
    return prisma.evolucionRefraccion.update({
      where: { id: Number(payload.id) },
      data: {
        fecha:       payload.fecha ? new Date(payload.fecha + "T00:00:00") : undefined,
        distancia:   payload.distancia   ?? null,
        odEsf:       payload.odEsf === "" ? null : (payload.odEsf != null ? Number(payload.odEsf) : null),
        odCil:       payload.odCil === "" ? null : (payload.odCil != null ? Number(payload.odCil) : null),
        odEje:       payload.odEje === "" ? null : (payload.odEje != null ? Number(payload.odEje) : null),
        oiEsf:       payload.oiEsf === "" ? null : (payload.oiEsf != null ? Number(payload.oiEsf) : null),
        oiCil:       payload.oiCil === "" ? null : (payload.oiCil != null ? Number(payload.oiCil) : null),
        oiEje:       payload.oiEje === "" ? null : (payload.oiEje != null ? Number(payload.oiEje) : null),
        tratamiento: payload.tratamiento ?? null,
        formato:     payload.formato     ?? null,
        dip:         payload.dip === ""  ? null : (payload.dip != null ? Number(payload.dip) : null),
        montaje:     payload.montaje     ?? null,
        doctor:      payload.doctor      ?? null,
        patologia:   payload.patologia   ?? null,
        obs:         payload.obs         ?? null,
        fotos: fotos.length > 0 ? {
          deleteMany: {},
          create: fotos.map((f) => ({
            foto:          f.foto,
            observaciones: f.observaciones || "",
          })),
        } : undefined,
      },
      include: { fotos: true },
    });
  });

  safeHandle("patients:evoluciones:softDelete", async (_evt, id) => {
    if (!id) throw new Error("Falta id");
    await prisma.evolucionRefraccion.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
    return true;
  });

  safeHandle("patients:evoluciones:restore", async (_evt, id) => {
    if (!id) throw new Error("Falta id");
    await prisma.evolucionRefraccion.update({ where: { id: Number(id) }, data: { deletedAt: null } });
    return true;
  });
}

module.exports = { registerPacientes };