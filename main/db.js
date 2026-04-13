const fs   = require("fs");
const path = require("path");
const { app } = require("electron");
const { PrismaClient } = require("./prisma-client");

function buildDbUrl() {
  let dbPath;

  if (app.isPackaged) {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });        // asegurar que el directorio existe
    dbPath = path.join(dir, "optica.db");
  } else {
    dbPath = path.join(__dirname, "..", "optica.db");
  }

  // Prisma SQLite requiere forward-slashes incluso en Windows
  return "file:" + dbPath.replace(/\\/g, "/");
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildDbUrl() } },
});

module.exports = { prisma };
