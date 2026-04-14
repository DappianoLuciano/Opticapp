// main/google-drive.js — Backup automático a Google Drive
//
// ── SETUP (una sola vez) ──────────────────────────────────────────────────────
// 1. Ir a https://console.cloud.google.com/
// 2. Crear proyecto → APIs & Services → Enable APIs → "Google Drive API"
// 3. APIs & Services → Credentials → "+ Create Credentials" → OAuth client ID
//    • Application type: "Desktop app"
//    • Name: OpticApp Backup
//    → Copiar Client ID y Client secret aquí abajo
// 4. En OAuth consent screen: agregar tu Gmail como "Test user" (mientras es en prueba)
// ─────────────────────────────────────────────────────────────────────────────

const { app, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs   = require("fs");
const url  = require("url");

// ── Credenciales OAuth2 (guardadas en gdrive-credentials.js, fuera del repo) ──
const { CLIENT_ID, CLIENT_SECRET } = require("./gdrive-credentials");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// ─────────────────────────────────────────────────────────────────────────────

function getTokenPath() {
  return path.join(app.getPath("userData"), "gdrive-tokens.json");
}

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(getTokenPath(), "utf8")); }
  catch { return null; }
}

function saveTokens(tokens) {
  fs.writeFileSync(getTokenPath(), JSON.stringify(tokens, null, 2), "utf8");
}

function clearTokens() {
  try { fs.unlinkSync(getTokenPath()); } catch (_) {}
}

function isConnected() {
  return !!loadTokens();
}

// ── OAuth: abre el browser y espera el código en localhost ────────────────────
async function startOAuthFlow() {
  const { google } = require("googleapis");
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const redirectUri = `http://localhost:${port}`;
      const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
      });

      shell.openExternal(authUrl);

      let handled = false;

      server.on("request", async (req, res) => {
        if (handled || req.url === "/favicon.ico") return;
        const parsed = url.parse(req.url, true);

        if (!parsed.query.code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<html><body>No se recibió el código. Intentá de nuevo.</body></html>");
          return;
        }

        handled = true;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#f0fdf4">
          <div style="font-size:52px;margin-bottom:20px">✅</div>
          <h2 style="color:#0b7a55;margin-bottom:12px">¡Conectado con Google Drive!</h2>
          <p style="color:#555;font-size:16px">Podés cerrar esta ventana y volver a OpticApp.</p>
        </body></html>`);

        server.close();

        try {
          const { tokens } = await oauth2Client.getToken(parsed.query.code);
          saveTokens(tokens);
          resolve({ ok: true });
        } catch (e) {
          reject(e);
        }
      });

      server.on("error", reject);

      // Timeout de 5 minutos
      setTimeout(() => {
        if (!handled) {
          handled = true;
          server.close();
          reject(new Error("Tiempo de espera agotado. Cerrá el navegador e intentá de nuevo."));
        }
      }, 5 * 60 * 1000);
    });
  });
}

// ── Cliente autenticado (renueva tokens automáticamente) ──────────────────────
async function getAuthClient() {
  const { google } = require("googleapis");
  const tokens = loadTokens();
  if (!tokens) throw new Error("No autenticado con Google Drive. Conectate primero.");

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", (newTokens) => {
    saveTokens({ ...tokens, ...newTokens });
  });
  return oauth2Client;
}

// ── Subir archivo a Drive ─────────────────────────────────────────────────────
async function uploadBackupToDrive(filePath) {
  const { google } = require("googleapis");
  const auth  = await getAuthClient();
  const drive = google.drive({ version: "v3", auth });

  // Buscar o crear carpeta "OpticApp Backups"
  let folderId;
  const search = await drive.files.list({
    q: "name='OpticApp Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id)",
    spaces: "drive",
  });

  if (search.data.files.length > 0) {
    folderId = search.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: "OpticApp Backups",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    folderId = folder.data.id;
  }

  // Subir el archivo
  const uploaded = await drive.files.create({
    requestBody: {
      name: path.basename(filePath),
      parents: [folderId],
    },
    media: {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(filePath),
    },
    fields: "id, name",
  });

  // Mantener solo los últimos 12 backups en Drive (eliminar los más viejos)
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, createdTime)",
    orderBy: "createdTime desc",
    spaces: "drive",
  });

  for (const f of list.data.files.slice(12)) {
    try { await drive.files.delete({ fileId: f.id }); } catch (_) {}
  }

  return { id: uploaded.data.id, name: uploaded.data.name };
}

module.exports = { isConnected, startOAuthFlow, uploadBackupToDrive, clearTokens, loadTokens };
