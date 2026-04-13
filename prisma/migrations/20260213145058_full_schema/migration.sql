-- Add missing columns to Paciente
ALTER TABLE "Paciente" ADD COLUMN "dni" TEXT;
ALTER TABLE "Paciente" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Paciente" ADD COLUMN "fechaNac" DATETIME;
ALTER TABLE "Paciente" ADD COLUMN "obraSocial" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Paciente_dni_key" ON "Paciente"("dni");

-- Add missing columns to Armazon
ALTER TABLE "Armazon" ADD COLUMN "costo" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Armazon" ADD COLUMN "precioFinal" REAL;
ALTER TABLE "Armazon" ADD COLUMN "deletedAt" DATETIME;

-- Create Vidrio table
CREATE TABLE IF NOT EXISTS "Vidrio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioCal" INTEGER,
    "precioRanura" INTEGER,
    "precioPerforado" INTEGER,
    "precioCalFinal" INTEGER,
    "precioRanuraFinal" INTEGER,
    "precioPerforadoFinal" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to Receta
ALTER TABLE "Receta" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Receta" ADD COLUMN "vidrioId" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "distancia" TEXT;
ALTER TABLE "Receta" ADD COLUMN "odEsf" REAL;
ALTER TABLE "Receta" ADD COLUMN "odCil" REAL;
ALTER TABLE "Receta" ADD COLUMN "odEje" REAL;
ALTER TABLE "Receta" ADD COLUMN "oiEsf" REAL;
ALTER TABLE "Receta" ADD COLUMN "oiCil" REAL;
ALTER TABLE "Receta" ADD COLUMN "oiEje" REAL;
ALTER TABLE "Receta" ADD COLUMN "tratamiento" TEXT;
ALTER TABLE "Receta" ADD COLUMN "formato" TEXT;
ALTER TABLE "Receta" ADD COLUMN "dip" REAL;
ALTER TABLE "Receta" ADD COLUMN "montaje" TEXT;
ALTER TABLE "Receta" ADD COLUMN "sena" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "laboratorio" TEXT;
ALTER TABLE "Receta" ADD COLUMN "precioArmazon" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "precioVidrio" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "total" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "Receta" ADD COLUMN "montoPagado" INTEGER;
ALTER TABLE "Receta" ADD COLUMN "metodoPago" TEXT;
ALTER TABLE "Receta" ADD COLUMN "entregaFecha" DATETIME;
ALTER TABLE "Receta" ADD COLUMN "entregada" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Receta" ADD COLUMN "entregadaAt" DATETIME;
ALTER TABLE "Receta" ADD COLUMN "avisoRetiroEnviado" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Receta" ADD COLUMN "avisoRetiroEnviadoAt" DATETIME;
ALTER TABLE "Receta" ADD COLUMN "retirada" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Receta" ADD COLUMN "retiradaAt" DATETIME;
ALTER TABLE "Receta" ADD COLUMN "deletedAt" DATETIME;

-- Create EvolucionRefraccion table
CREATE TABLE IF NOT EXISTS "EvolucionRefraccion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pacienteId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distancia" TEXT,
    "odEsf" REAL,
    "odCil" REAL,
    "odEje" INTEGER,
    "oiEsf" REAL,
    "oiCil" REAL,
    "oiEje" INTEGER,
    "tratamiento" TEXT,
    "formato" TEXT,
    "dip" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "EvolucionRefraccion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EvolucionRefraccion_pacienteId_idx" ON "EvolucionRefraccion"("pacienteId");
CREATE INDEX IF NOT EXISTS "EvolucionRefraccion_fecha_idx" ON "EvolucionRefraccion"("fecha");

-- Create ServicioOptica table
CREATE TABLE IF NOT EXISTS "ServicioOptica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Configuracion table
CREATE TABLE IF NOT EXISTS "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seniaPorcentaje" REAL NOT NULL DEFAULT 30,
    "descuentoEfectivo" REAL NOT NULL DEFAULT 0,
    "descuentoDebito" REAL NOT NULL DEFAULT 0,
    "descuentoTransferencia" REAL NOT NULL DEFAULT 0,
    "cuotasCreditoJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Proveedor table
CREATE TABLE IF NOT EXISTS "Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "productos" TEXT,
    "contactoPreferido" TEXT,
    "formasPago" TEXT,
    "frecuenciaEntrega" TEXT,
    "observaciones" TEXT,
    "banco" TEXT,
    "cbu" TEXT,
    "alias" TEXT,
    "titular" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Proveedor_tipo_nombre_idx" ON "Proveedor"("tipo", "nombre");

-- Create MovimientoProveedor table
CREATE TABLE IF NOT EXISTS "MovimientoProveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proveedorId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "debe" INTEGER,
    "haber" INTEGER,
    "saldo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MovimientoProveedor_proveedorId_fecha_idx" ON "MovimientoProveedor"("proveedorId", "fecha");

-- Create CategoriaGasto table
CREATE TABLE IF NOT EXISTS "CategoriaGasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "color" TEXT DEFAULT '#7ad8b0',
    "activo" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Gasto table
CREATE TABLE IF NOT EXISTS "Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoriaId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "recurrente" BOOLEAN NOT NULL DEFAULT 0,
    "frecuenciaMeses" INTEGER,
    "fechaVenc" DATETIME,
    "pagado" BOOLEAN NOT NULL DEFAULT 0,
    "pagadoAt" DATETIME,
    "obs" TEXT,
    "codigoCliente" TEXT,
    "numeroPago" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Gasto_fechaVenc_idx" ON "Gasto"("fechaVenc");
CREATE INDEX IF NOT EXISTS "Gasto_categoriaId_idx" ON "Gasto"("categoriaId");

-- Create Cuenta table
CREATE TABLE IF NOT EXISTS "Cuenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "medioPago" TEXT NOT NULL,
    "saldoInicial" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create CajaDiaria table
CREATE TABLE IF NOT EXISTS "CajaDiaria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" TEXT NOT NULL,
    "saldoInicial" REAL NOT NULL DEFAULT 0,
    "cerrada" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CajaDiaria_fecha_key" ON "CajaDiaria"("fecha");

-- Create MovimientoCaja table
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
    CONSTRAINT "MovimientoCaja_cajaDiariaId_fkey" FOREIGN KEY ("cajaDiariaId") REFERENCES "CajaDiaria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCaja_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create DetallePago table
CREATE TABLE IF NOT EXISTS "DetallePago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "refId" INTEGER NOT NULL,
    "refTipo" TEXT NOT NULL,
    "medioPago" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
