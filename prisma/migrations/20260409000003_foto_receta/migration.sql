-- CreateTable: FotoReceta
CREATE TABLE IF NOT EXISTS "FotoReceta" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recetaId"      INTEGER  NOT NULL,
    "foto"          TEXT     NOT NULL,
    "observaciones" TEXT     NOT NULL DEFAULT '',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoReceta_recetaId_fkey"
        FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FotoReceta_recetaId_idx" ON "FotoReceta"("recetaId");
