-- Paso 1: agregar invite_code como nullable (para no romper las filas existentes)
ALTER TABLE "guilds" ADD COLUMN "invite_code" text;--> statement-breakpoint

-- Paso 2: backfill — asignar código único a cada guild ya existente
-- Se usa MD5 del id truncado a 8 chars (suficiente para las pocas filas actuales)
-- La generación en producción usa un alfabeto sin ambigüedades via Node crypto
UPDATE "guilds"
SET "invite_code" = UPPER(SUBSTRING(MD5(id), 1, 8))
WHERE "invite_code" IS NULL;--> statement-breakpoint

-- Paso 3: aplicar NOT NULL y constraint UNIQUE ahora que todas las filas tienen valor
ALTER TABLE "guilds" ALTER COLUMN "invite_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_invite_code_unique" UNIQUE("invite_code");
