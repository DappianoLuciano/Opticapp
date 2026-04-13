// main/scheduler.js — verifica cada minuto si hay turnos que necesiten recordatorio
const { prisma }      = require("./db");
const { sendMessage, getStatus } = require("./whatsapp");

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtHora(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

// Ventana de ±5 min alrededor del momento objetivo
const WINDOW_MS = 5 * 60 * 1000;

async function checkReminders() {
  const { status } = getStatus();
  if (status !== "ready") return;

  const now = Date.now();

  try {
    // ── Recordatorio 24 horas antes ────────────────────────────────────────
    const start24 = new Date(now + 24 * 60 * 60 * 1000 - WINDOW_MS).toISOString();
    const end24   = new Date(now + 24 * 60 * 60 * 1000 + WINDOW_MS).toISOString();

    const turnos24 = await prisma.$queryRawUnsafe(`
      SELECT id, fecha, nombrePaciente, telefono, motivo
      FROM "Turno"
      WHERE fecha >= ? AND fecha <= ?
        AND recordatorio24h = 0
        AND estado != 'cancelado'
        AND telefono IS NOT NULL
        AND telefono != ''
    `, start24, end24);

    for (const t of turnos24) {
      const nombre = t.nombrePaciente || "Paciente";
      const hora   = fmtHora(new Date(t.fecha));
      const tipo   = t.motivo ? ` (${t.motivo})` : "";
      const msg =
        `Hola ${nombre}! 👋\n` +
        `Te recordamos que *mañana* tenés turno en la óptica a las *${hora} hs*${tipo}.\n` +
        `¡Te esperamos! 😊`;

      try {
        await sendMessage(t.telefono, msg);
        await prisma.$executeRawUnsafe(
          `UPDATE "Turno" SET recordatorio24h = 1 WHERE id = ?`, t.id
        );
        console.log(`[scheduler] Recordatorio 24h enviado → ${t.nombrePaciente} (${t.telefono})`);
      } catch (e) {
        console.error(`[scheduler] Error recordatorio 24h (id=${t.id}):`, e.message);
      }
    }

    // ── Recordatorio 2 horas antes ─────────────────────────────────────────
    const start2 = new Date(now + 2 * 60 * 60 * 1000 - WINDOW_MS).toISOString();
    const end2   = new Date(now + 2 * 60 * 60 * 1000 + WINDOW_MS).toISOString();

    const turnos2 = await prisma.$queryRawUnsafe(`
      SELECT id, fecha, nombrePaciente, telefono, motivo
      FROM "Turno"
      WHERE fecha >= ? AND fecha <= ?
        AND recordatorio2h = 0
        AND estado != 'cancelado'
        AND telefono IS NOT NULL
        AND telefono != ''
    `, start2, end2);

    for (const t of turnos2) {
      const nombre = t.nombrePaciente || "Paciente";
      const hora   = fmtHora(new Date(t.fecha));
      const tipo   = t.motivo ? ` (${t.motivo})` : "";
      const msg =
        `Hola ${nombre}! 👋\n` +
        `Te recordamos que en *2 horas* tenés turno en la óptica a las *${hora} hs*${tipo}.\n` +
        `¡Hasta pronto! 😊`;

      try {
        await sendMessage(t.telefono, msg);
        await prisma.$executeRawUnsafe(
          `UPDATE "Turno" SET recordatorio2h = 1 WHERE id = ?`, t.id
        );
        console.log(`[scheduler] Recordatorio 2h enviado → ${t.nombrePaciente} (${t.telefono})`);
      } catch (e) {
        console.error(`[scheduler] Error recordatorio 2h (id=${t.id}):`, e.message);
      }
    }
  } catch (e) {
    console.error("[scheduler] Error consultando turnos:", e.message);
  }
}

function startScheduler() {
  // Primera corrida 15 segundos después de arrancar (deja tiempo al DB y WA)
  setTimeout(checkReminders, 15_000);
  // Luego cada 60 segundos
  setInterval(checkReminders, 60_000);
  console.log("[scheduler] Iniciado — revisa recordatorios cada 60 s");
}

module.exports = { startScheduler };
