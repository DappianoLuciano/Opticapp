const { app, BrowserWindow, session } = require("electron");
const path = require("path");

const { registerIpcHandlers }     = require("./ipc");
const { registerLicenseHandlers } = require("./license");
const { setupDatabase }           = require("./setup-db");
const { prisma }                  = require("./db");
const { setWindow, initWhatsApp } = require("./whatsapp");
const { startScheduler }          = require("./scheduler");
const { runAutoBackup }           = require("./ipc/backup");
const { setupUpdater }            = require("./updater");

let win;

async function createWindow() {
  await setupDatabase(prisma);

  registerIpcHandlers();
  registerLicenseHandlers();

  // Backup automático al iniciar (silencioso, guarda en userData/backups/)
  runAutoBackup();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../renderer/dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }

  // Pasar la ventana al servicio WhatsApp para poder enviar eventos al renderer
  setWindow(win);

  // Auto-update (solo en producción; silencioso al arrancar)
  setupUpdater(win);

  // Arrancar el scheduler de recordatorios
  startScheduler();

  // Auto-reconectar WhatsApp si ya existe sesión guardada (no lanza error si falla)
  initWhatsApp().catch((e) =>
    console.log("[main] WhatsApp no auto-conectado:", e.message)
  );
}

app.whenReady().then(createWindow);
