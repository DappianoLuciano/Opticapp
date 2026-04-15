// main/whatsapp.js — servicio WhatsApp usando whatsapp-web.js
const path   = require("path");
const fs     = require("fs");
const { app } = require("electron");

// Busca Chrome instalado en rutas comunes de Windows
function findChrome() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let Client, LocalAuth, QRCode;
try {
  ({ Client, LocalAuth } = require("whatsapp-web.js"));
  QRCode = require("qrcode");
} catch (e) {
  console.warn("[whatsapp] Paquetes no instalados:", e.message);
}

// ── estado ────────────────────────────────────────────────────────────────────
let waClient   = null;
let waStatus   = "disconnected"; // disconnected | connecting | qr | ready
let waQRUrl    = null;            // data URL de la imagen QR
let mainWin    = null;

function setWindow(win) { mainWin = win; }

function getStatus() { return { status: waStatus, qrDataUrl: waQRUrl }; }

function push(event, data) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(event, data);
  }
}

// ── formatear número argentino para WhatsApp ──────────────────────────────────
// WhatsApp requiere: 549XXXXXXXXXX@c.us (con 9 para móviles en Argentina)
function formatPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");

  if (!d) throw new Error("Teléfono vacío");

  // Ya tiene prefijo completo 549...
  if (d.startsWith("549") && d.length >= 12) return `${d}@c.us`;

  // Tiene 54 pero falta el 9
  if (d.startsWith("54")) { d = "549" + d.slice(2); return `${d}@c.us`; }

  // Formato nacional: empieza en 0 (ej: 011..., 0341...)
  if (d.startsWith("0")) d = d.slice(1);

  // Prefijo: 549 + número sin el 0 inicial
  d = "549" + d;
  return `${d}@c.us`;
}

// ── inicializar cliente ────────────────────────────────────────────────────────
async function initWhatsApp() {
  if (!Client) throw new Error("whatsapp-web.js no está instalado. Ejecutá: npm install whatsapp-web.js qrcode");
  if (waClient) return;

  const sessionPath = app.isPackaged
    ? path.join(app.getPath("userData"), "wwebjs_auth")
    : path.join(__dirname, "..", ".wwebjs_auth");

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      "No se encontró Google Chrome ni Microsoft Edge instalado.\n" +
      "Por favor instalá Chrome desde https://www.google.com/chrome/ e intentá de nuevo."
    );
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      executablePath: chromePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
      ],
    },
  });

  waClient.on("qr", async (qr) => {
    waStatus = "qr";
    waQRUrl  = await QRCode.toDataURL(qr, { scale: 6 });
    push("whatsapp:statusUpdate", getStatus());
    console.log("[whatsapp] Escaneá el QR en Configuración → WhatsApp");
  });

  waClient.on("authenticated", () => {
    waStatus = "connecting";
    waQRUrl  = null;
    push("whatsapp:statusUpdate", getStatus());
  });

  waClient.on("ready", () => {
    waStatus = "ready";
    waQRUrl  = null;
    push("whatsapp:statusUpdate", getStatus());
    console.log("[whatsapp] Conectado y listo");
  });

  waClient.on("auth_failure", (msg) => {
    console.error("[whatsapp] Fallo de autenticación:", msg);
    waClient  = null;
    waStatus  = "disconnected";
    push("whatsapp:statusUpdate", getStatus());
  });

  waClient.on("disconnected", (reason) => {
    console.log("[whatsapp] Desconectado:", reason);
    waClient = null;
    waStatus = "disconnected";
    push("whatsapp:statusUpdate", getStatus());
  });

  waStatus = "connecting";
  push("whatsapp:statusUpdate", getStatus());

  try {
    await waClient.initialize();
  } catch (e) {
    console.error("[whatsapp] Error al inicializar:", e.message);
    waClient = null;
    waStatus = "disconnected";
    push("whatsapp:statusUpdate", getStatus());
    throw e;
  }
}

// ── enviar mensaje ─────────────────────────────────────────────────────────────
async function sendMessage(phone, text) {
  if (!waClient || waStatus !== "ready") {
    throw new Error("WhatsApp no está conectado");
  }
  const chatId = formatPhone(phone);
  await waClient.sendMessage(chatId, text);
}

// ── desconectar ────────────────────────────────────────────────────────────────
async function disconnect() {
  if (waClient) {
    try { await waClient.destroy(); } catch (_) {}
    waClient = null;
  }
  waStatus = "disconnected";
  waQRUrl  = null;
  push("whatsapp:statusUpdate", getStatus());
}

module.exports = { initWhatsApp, sendMessage, getStatus, disconnect, setWindow };
