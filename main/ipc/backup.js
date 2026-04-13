// ipc/backup.js — Copias de seguridad de la base de datos SQLite
//
// Estrategia de "nube": el usuario elige una carpeta que ya esté sincronizada
// con Google Drive, Dropbox, OneDrive, etc. El backup va ahí y la nube lo sube sola.
// Sin OAuth, sin API keys, sin complejidad adicional.

const fs   = require("fs");
const path = require("path");
const { app, dialog } = require("electron");
const { safeHandle } = require("./helpers");

// ─── Settings ────────────────────────────────────────────────────────────────
// Guardamos la carpeta elegida en userData/opticapp-settings.json
function getSettingsPath() {
  return path.join(app.getPath("userData"), "opticapp-settings.json");
}

function readSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    return JSON.parse(raw);
  } catch { return {}; }
}

function writeSettings(patch) {
  const current = readSettings();
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ ...current, ...patch }, null, 2), "utf8");
}

// ─── Rutas ───────────────────────────────────────────────────────────────────
function getDbPath() {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "optica.db");
  }
  return path.join(__dirname, "..", "..", "optica.db");
}

// Carpeta de backups: usa la configurada, o el fallback local
function getBackupFolder() {
  const saved = readSettings().backupFolder;
  if (saved && fs.existsSync(saved)) return saved;
  const fallback = path.join(app.getPath("userData"), "backups");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

// Nombre: optica_2025-12-31_14-30-00.db
function buildBackupName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `optica_${date}_${time}.db`;
}

// Mantener solo los N backups automáticos más recientes (no toca archivos de usuario)
function pruneOldBackups(dir, keep = 15) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("optica_") && f.endsWith(".db"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const f of files.slice(keep)) {
      try { fs.unlinkSync(path.join(dir, f.name)); } catch (_) {}
    }
  } catch (_) {}
}

function copyDb(dest) {
  const src = getDbPath();
  if (!fs.existsSync(src)) throw new Error("No se encontró la base de datos.");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// ─── IPC handlers ────────────────────────────────────────────────────────────
function registerBackup() {
  // Info: carpeta actual + lista de backups automáticos
  safeHandle("backup:info", async () => {
    const folder = getBackupFolder();
    const settings = readSettings();
    const isCloud = !!(settings.backupFolder && fs.existsSync(settings.backupFolder));

    let files = [];
    try {
      files = fs
        .readdirSync(folder)
        .filter((f) => f.startsWith("optica_") && f.endsWith(".db"))
        .map((f) => {
          const full = path.join(folder, f);
          const stat = fs.statSync(full);
          return { name: f, size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    } catch (_) {}

    return { folder, isCloud, files };
  });

  // Elegir carpeta de destino (Google Drive / OneDrive / Dropbox / cualquier carpeta)
  safeHandle("backup:pickFolder", async (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Elegir carpeta de copia de seguridad",
      buttonLabel: "Usar esta carpeta",
    });
    if (canceled || !filePaths.length) return { canceled: true };
    const chosen = filePaths[0];
    writeSettings({ backupFolder: chosen });
    return { ok: true, folder: chosen };
  });

  // Limpiar carpeta configurada (volver al default local)
  safeHandle("backup:clearFolder", async () => {
    writeSettings({ backupFolder: null });
    return { ok: true };
  });

  // Backup manual → abre "Guardar como..."
  safeHandle("backup:save", async (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: buildBackupName(),
      filters: [{ name: "Base de datos SQLite", extensions: ["db"] }],
      title: "Guardar copia de seguridad",
    });
    if (canceled || !filePath) return { canceled: true };
    copyDb(filePath);
    return { ok: true, path: filePath };
  });
}

// ─── Backup automático (llamado al iniciar la app) ────────────────────────────
async function runAutoBackup() {
  try {
    const folder = getBackupFolder();
    const dest   = path.join(folder, buildBackupName());
    copyDb(dest);
    pruneOldBackups(folder, 15);
    console.log("[backup] Auto-backup OK →", dest);
  } catch (e) {
    console.error("[backup] Auto-backup falló:", e.message);
  }
}

module.exports = { registerBackup, runAutoBackup };
