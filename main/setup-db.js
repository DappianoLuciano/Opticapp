const fs   = require("fs");
const path = require("path");
const { app } = require("electron");

async function setupDatabase(prisma) {
  // Crear tabla de seguimiento de migraciones si no existe
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, "prisma", "migrations")
    : path.join(__dirname, "..", "prisma", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    console.error("[setup-db] No se encontró la carpeta de migraciones:", migrationsDir);
    return;
  }

  const folders = fs.readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    // Verificar si ya fue aplicada
    const rows = await prisma.$queryRawUnsafe(
      `SELECT name FROM "_migrations" WHERE name = ?`, folder
    );
    if (rows.length > 0) {
      console.log("[setup-db] Ya aplicada:", folder);
      continue;
    }

    console.log("[setup-db] Aplicando migración:", folder);

    const sql = fs.readFileSync(sqlPath, "utf-8");

    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt + ";");
      } catch (e) {
        const msg = e.message.toLowerCase();
        // Ignorar errores de "ya existe" o "columna duplicada"
        if (!msg.includes("already exists") && !msg.includes("duplicate column")) {
          console.error("[setup-db] Error:", e.message, "\nSQL:", stmt);
        }
      }
    }

    // Marcar como aplicada
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_migrations" (name) VALUES (?)`, folder
    );
    console.log("[setup-db] Migración aplicada:", folder);
  }

  console.log("[setup-db] Base de datos lista.");

  // ── Limpiar movimientos de caja huérfanos de gastos eliminados ────────────
  try {
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM "MovimientoCaja"
      WHERE refTipo = 'GASTO'
        AND refId IS NOT NULL
        AND refId NOT IN (SELECT id FROM "Gasto")
    `);
    if (result > 0) {
      console.log(`[setup-db] Limpieza: ${result} movimiento(s) de caja huérfano(s) de gastos eliminados.`);
    }
  } catch (e) {
    console.warn("[setup-db] No se pudo limpiar movimientos huérfanos:", e.message);
  }
}

module.exports = { setupDatabase };
