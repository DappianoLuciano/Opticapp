// electron/configStore.js
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = {
  // porcentaje (0-100)
  seniaPorcentaje: 30,
};

function getConfigPath() {
  const dir = app.getPath("userData");
  return path.join(dir, "config.json");
}

function readConfig() {
  const p = getConfigPath();
  try {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(DEFAULTS, null, 2), "utf-8");
      return { ...DEFAULTS };
    }
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    return { ...DEFAULTS, ...(parsed || {}) };
  } catch (e) {
    // si se rompe el archivo, volvemos a defaults
    try {
      fs.writeFileSync(p, JSON.stringify(DEFAULTS, null, 2), "utf-8");
    } catch {}
    return { ...DEFAULTS };
  }
}

function writeConfig(next) {
  const p = getConfigPath();
  const current = readConfig();
  const merged = { ...current, ...(next || {}) };

  fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

module.exports = { readConfig, writeConfig, DEFAULTS };