// main/license.js — Sistema de licencias por cliente con módulos configurables
const fs = require("fs");
const path = require("path");
const { app, ipcMain } = require("electron");
const { verifyCode } = require("./license-utils");

const ALLOWED_MODULES = ["panel", "turnos", "pacientes", "recetas", "inventario", "finanzas", "backup_cloud"];

function getLicensePath() {
  return path.join(app.getPath("userData"), "license.json");
}

function readLicense() {
  try {
    const p = getLicensePath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch { return null; }
}

function writeLicense(data) {
  fs.writeFileSync(getLicensePath(), JSON.stringify(data, null, 2), "utf-8");
}

function checkLicense() {
  const lic = readLicense();

  // Sin archivo → inactivo
  if (!lic) return { status: "inactive", expiresAt: null, modules: [], client: null };

  // Formato viejo (sin payload) → pedir reactivación con código nuevo
  if (!lic.payload || typeof lic.payload !== "object") {
    return { status: "inactive", expiresAt: null, modules: [], client: null };
  }

  const { expiresAt, modules, client } = lic.payload;

  // Vencida
  if (!expiresAt || new Date() >= new Date(expiresAt)) {
    return { status: "expired", expiresAt: expiresAt ?? null, modules: [], client: client ?? null };
  }

  // Activa
  return {
    status: "active",
    expiresAt,
    modules: Array.isArray(modules) ? modules : [],
    client:  client ?? null,
  };
}

function registerLicenseHandlers() {
  ipcMain.handle("license:check", () => checkLicense());

  ipcMain.handle("license:activate", (_, code) => {
    const trimmed = String(code || "").trim();
    const payload = verifyCode(trimmed);

    if (!payload) {
      return { success: false, message: "Código inválido o mal formado" };
    }

    if (new Date() >= new Date(payload.expiresAt)) {
      return { success: false, message: "Este código de licencia ya venció" };
    }

    const modules = (payload.modules || []).filter((m) => ALLOWED_MODULES.includes(m));
    const sanitized = { ...payload, modules };

    writeLicense({
      code: trimmed,
      payload: sanitized,
      activatedAt: new Date().toISOString(),
    });

    return {
      success:   true,
      client:    payload.client,
      expiresAt: payload.expiresAt,
      modules,
    };
  });
}

module.exports = { registerLicenseHandlers, checkLicense };
