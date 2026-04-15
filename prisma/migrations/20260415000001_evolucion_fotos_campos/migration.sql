-- AlterTable: agregar campos faltantes a EvolucionRefraccion
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "montaje" TEXT;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "doctor" TEXT;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "patologia" TEXT;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "obs" TEXT;

-- CreateTable: FotoEvolucion
CREATE TABLE "FotoEvolucion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "evolucionId" INTEGER NOT NULL,
    "foto" TEXT NOT NULL,
    "observaciones" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoEvolucion_evolucionId_fkey" FOREIGN KEY ("evolucionId") REFERENCES "EvolucionRefraccion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
