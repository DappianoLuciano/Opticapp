// main/license-utils.js — Utilidades criptográficas para licencias
// Usa HMAC-SHA256 de Node.js crypto (sin dependencias externas).
//
// Formato del código: <base64url_payload>.<primeros_16_chars_del_hmac>
// El payload es un JSON con: { client, expiresAt, modules, createdAt }

const crypto = require("crypto");

// ⚠️  Clave secreta — la misma en la app y en tools/generar-licencia.js
// Cambiá esto por una cadena larga y aleatoria única tuya.
const SECRET = "opticapp-lic-secret-xZ9mQpLwRt-2025-DL";

function hmac16(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex").slice(0, 16);
}

/**
 * Genera un código de licencia firmado.
 * @param {{ client: string, expiresAt: string, modules: string[], createdAt: string }} payload
 * @returns {string}
 */
function generateCode(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = hmac16(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verifica un código y devuelve el payload decodificado, o null si es inválido.
 * @param {string} code
 * @returns {{ client: string, expiresAt: string, modules: string[], createdAt: string } | null}
 */
function verifyCode(code) {
  try {
    const dot = code.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = code.slice(0, dot);
    const sig     = code.slice(dot + 1);
    if (hmac16(encoded) !== sig) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (
      typeof payload.client     !== "string" ||
      typeof payload.expiresAt  !== "string" ||
      !Array.isArray(payload.modules)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { generateCode, verifyCode };
