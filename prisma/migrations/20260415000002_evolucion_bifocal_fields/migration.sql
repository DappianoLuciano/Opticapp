-- AlterTable: agregar campos de segunda refracción (bifocal/multifocal) a EvolucionRefraccion
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "distancia2" TEXT;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "od2Esf" REAL;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "od2Cil" REAL;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "od2Eje" INTEGER;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "oi2Esf" REAL;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "oi2Cil" REAL;
ALTER TABLE "EvolucionRefraccion" ADD COLUMN "oi2Eje" INTEGER;
