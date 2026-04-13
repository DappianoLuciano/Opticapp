// ipc/whatsapp-ipc.js
const { safeHandle }                              = require("./helpers");
const { initWhatsApp, getStatus, disconnect, sendMessage } = require("../whatsapp");

function registerWhatsapp() {
  // Inicia la conexión (abre Puppeteer/Chrome headless)
  safeHandle("whatsapp:init", async () => {
    await initWhatsApp();
    return getStatus();
  });

  // Estado actual (status + qrDataUrl)
  safeHandle("whatsapp:getStatus", async () => {
    return getStatus();
  });

  // Desconectar y borrar sesión
  safeHandle("whatsapp:disconnect", async () => {
    await disconnect();
    return getStatus();
  });

  // Enviar mensaje manual (para pruebas o envíos desde UI)
  safeHandle("whatsapp:sendMessage", async (_, { phone, text }) => {
    if (!phone || !text) throw new Error("Teléfono y mensaje son requeridos");
    await sendMessage(phone, text);
    return { ok: true };
  });
}

module.exports = { registerWhatsapp };
