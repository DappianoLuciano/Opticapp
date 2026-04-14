// ipc/backup-cloud.js — Handlers IPC para backup a Google Drive
const { app } = require("electron");
const path    = require("path");
const fs      = require("fs");
const { safeHandle } = require("./helpers");
const { isConnected, startOAuthFlow, uploadBackupToDrive, clearTokens } = require("../google-drive");

function getDbPath() {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "optica.db");
  }
  return path.join(__dirname, "..", "..", "optica.db");
}

function buildBackupName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `optica_${date}_${time}.db`;
}

function registerBackupCloud() {
  // Estado de conexión con Google Drive
  safeHandle("gdrive:status", async () => {
    return { connected: isConnected() };
  });

  // Iniciar flujo OAuth (abre el browser) → al conectar, sube el primer backup
  safeHandle("gdrive:connect", async () => {
    await startOAuthFlow();

    // Primer backup inmediato al conectar
    try {
      const src = getDbPath();
      if (fs.existsSync(src)) {
        const tmpPath = path.join(app.getPath("temp"), buildBackupName());
        fs.copyFileSync(src, tmpPath);
        try {
          await uploadBackupToDrive(tmpPath);
        } finally {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn("[gdrive] Primer backup falló:", e.message);
    }

    return { ok: true };
  });

  // Desconectar (elimina los tokens)
  safeHandle("gdrive:disconnect", async () => {
    clearTokens();
    return { ok: true };
  });

  // Backup manual ahora → copia DB a temp y sube
  safeHandle("gdrive:backup", async () => {
    const src = getDbPath();
    if (!fs.existsSync(src)) throw new Error("No se encontró la base de datos");

    const tmpPath = path.join(app.getPath("temp"), buildBackupName());
    fs.copyFileSync(src, tmpPath);

    try {
      const result = await uploadBackupToDrive(tmpPath);
      return { ok: true, name: result.name };
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  });
}

module.exports = { registerBackupCloud };
