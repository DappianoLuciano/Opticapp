const fs = require("fs");
const path = require("path");
const { app, ipcMain } = require("electron");

// Códigos de activación válidos (puedo agregar más acá sin tocar la lógica)
const VALID_CODES = ["optica2027", "prueba2026"];
// Extendido: vence el 31/12/2027
const EXPIRY_DATE = new Date("2028-01-01T00:00:00");

function getLicensePath() {
  return path.join(app.getPath("userData"), "license.json");
}

function readLicense() {
  try {
    const p = getLicensePath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeLicense(data) {
  fs.writeFileSync(getLicensePath(), JSON.stringify(data, null, 2), "utf-8");
}

function checkLicense() {
  const lic = readLicense();
  if (!lic || !lic.activated) return { status: "inactive" };
  if (new Date() >= EXPIRY_DATE) return { status: "expired" };
  return { status: "active", expiresAt: EXPIRY_DATE.toISOString() };
}

function registerLicenseHandlers() {
  ipcMain.handle("license:check", () => checkLicense());

  ipcMain.handle("license:activate", (_, code) => {
    if (!VALID_CODES.includes(String(code || "").trim())) {
      return { success: false, message: "Código incorrecto" };
    }
    if (new Date() >= EXPIRY_DATE) {
      return { success: false, message: "El período de prueba ha vencido" };
    }
    writeLicense({ activated: true, activatedAt: new Date().toISOString() });
    return { success: true };
  });
}

module.exports = { registerLicenseHandlers, checkLicense };
