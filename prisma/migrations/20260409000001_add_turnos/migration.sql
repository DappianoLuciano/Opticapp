CREATE TABLE IF NOT EXISTS "Turno" (
    "id"             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha"          DATETIME NOT NULL,
    "duracion"       INTEGER NOT NULL DEFAULT 30,
    "pacienteId"     INTEGER,
    "nombrePaciente" TEXT,
    "telefono"       TEXT,
    "motivo"         TEXT,
    "notas"          TEXT,
    "estado"         TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turno_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Turno_fecha_idx" ON "Turno"("fecha");
