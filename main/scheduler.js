// main/scheduler.js — verifica cada minuto si hay turnos que necesiten recordatorio
//                   — verifica semanalmente el backup a Google Drive
const { prisma }      = require("./db");
const { sendMessage, getStatus } = require("./whatsapp");
const { checkLicense }           = require("./license");
const { isConnected, uploadBackupToDrive } = require("./google-drive");
const { app } = require("electron");
const path    = require("path");
const fs      = require("fs");

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

// ── Backup semanal a Google Drive ─────────────────────────────────────────────
function getSettingsPath() {
  return path.join(app.getPath("userData"), "opticapp-settings.json");
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(getSettingsPath(), "utf8")); }
  catch { return {}; }
}

function writeSettings(patch) {
  const cur = readSettings();
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ ...cur, ...patch }, null, 2), "utf8");
}

function getDbPath() {
  if (app.isPackaged) return path.join(app.getPath("userData"), "optica.db");
  return path.join(__dirname, "..", "optica.db");
}

function buildBackupName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `optica_${date}_${time}.db`;
}

async function checkGdriveWeeklyBackup() {
  try {
    // Solo si el módulo backup_cloud está en la licencia activa
    const lic = checkLicense();
    if (lic.status !== "active" || !lic.modules.includes("backup_cloud")) return;

    // Solo si hay tokens de Drive guardados
    if (!isConnected()) return;

    // Verificar si pasaron 7 días desde el último backup a Drive
    const settings = readSettings();
    const lastBackup = settings.lastGdriveBackup ? new Date(settings.lastGdriveBackup) : null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (lastBackup && lastBackup > sevenDaysAgo) return; // no es momento aún

    const src = getDbPath();
    if (!fs.existsSync(src)) return;

    const tmpPath = path.join(app.getPath("temp"), buildBackupName());
    fs.copyFileSync(src, tmpPath);

    try {
      const result = await uploadBackupToDrive(tmpPath);
      writeSettings({ lastGdriveBackup: new Date().toISOString() });
      console.log("[scheduler] Backup semanal a Google Drive OK →", result.name);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (e) {
    console.error("[scheduler] Error backup semanal a Drive:", e.message);
  }
}

function startScheduler() {
  // Primera corrida 15 segundos después de arrancar (deja tiempo al DB y WA)
  setTimeout(checkReminders, 15_000);
  // Luego cada 60 segundos
  setInterval(checkReminders, 60_000);

  // Backup a Drive: primer chequeo 60 s después del arranque, luego cada 6 horas
  setTimeout(checkGdriveWeeklyBackup, 60_000);
  setInterval(checkGdriveWeeklyBackup, 6 * 60 * 60 * 1000);

  console.log("[scheduler] Iniciado — recordatorios cada 60 s, backup Drive cada 6 h");
}

module.exports = { startScheduler };
