const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Applying caja migration...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Cuenta" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "nombre" TEXT NOT NULL,
      "medioPago" TEXT NOT NULL,
      "saldoInicial" REAL NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT 1,
      "orden" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CajaDiaria" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "fecha" TEXT NOT NULL UNIQUE,
      "saldoInicial" REAL NOT NULL DEFAULT 0,
      "cerrada" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MovimientoCaja" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "cajaDiariaId" INTEGER NOT NULL,
      "cuentaId" INTEGER,
      "tipo" TEXT NOT NULL,
      "concepto" TEXT NOT NULL,
      "monto" REAL NOT NULL,
      "medioPago" TEXT NOT NULL,
      "refId" INTEGER,
      "refTipo" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("cajaDiariaId") REFERENCES "CajaDiaria" ("id") ON DELETE RESTRICT,
      FOREIGN KEY ("cuentaId") REFERENCES "Cuenta" ("id") ON DELETE SET NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DetallePago" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "refId" INTEGER NOT NULL,
      "refTipo" TEXT NOT NULL,
      "medioPago" TEXT NOT NULL,
      "monto" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Migration applied successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
