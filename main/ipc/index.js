// ipc/index.js  — punto de entrada único
const { ipcMain, shell, dialog } = require("electron");
const fs = require("fs");
const { safeHandle }     = require("./helpers");

const { registerConfig }     = require("./config");
const { registerPacientes }  = require("./pacientes");
const { registerRecetas }    = require("./recetas");
const { registerInventario } = require("./inventario");
const { registerProveedores }= require("./proveedores");
const { registerGastos }     = require("./gastos");
const { registerVentas }     = require("./ventas");
const { registerCaja }       = require("./caja");
const { registerTurnos }     = require("./turnos");
const { registerWhatsapp }   = require("./whatsapp-ipc");
const { registerBackupCloud } = require("./backup-cloud");

function registerIpcHandlers() {
  registerConfig();
  registerPacientes();
  registerRecetas();
  registerInventario();
  registerProveedores();
  registerGastos();
  registerVentas();
  registerCaja();
  registerTurnos();
  registerWhatsapp();
  registerBackupCloud();

  // ── Sistema ──────────────────────────────────────────────────────────────
  safeHandle("system:openExternal", async (_evt, url) => {
    if (!url) throw new Error("URL inválida");
    await shell.openExternal(String(url));
    return true;
  });

  // ── Imprimir PDF ─────────────────────────────────────────────────────────
  ipcMain.handle("print:pdf", async (event, { defaultName, html }) => {
    const { BrowserWindow: BW } = require("electron");
    const win = event.sender.getOwnerBrowserWindow();

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: `${defaultName}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { canceled: true };

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #000; margin: 0; }
      h2 { margin: 0 0 10px; font-size: 16px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
      div { margin-bottom: 4px; line-height: 1.4; }
    </style></head><body>${html}</body></html>`;

    const printWin = new BW({ show: false, webPreferences: { offscreen: true } });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    const data = await printWin.webContents.printToPDF({ pageSize: "A4" });
    printWin.destroy();

    fs.writeFileSync(filePath, data);
    return { filePath };
  });
}

module.exports = { registerIpcHandlers };
