-- ─────────────────────────────────────────────────────────────────
-- Módulo de Fiados
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Clientes (personas a quienes se les fia)
CREATE TABLE IF NOT EXISTS clientes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(100) NOT NULL,
  telefono    VARCHAR(20),
  notas       TEXT,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fiados (cuentas pendientes por cliente)
CREATE TABLE IF NOT EXISTS fiados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  venta_id    UUID REFERENCES ventas(id) ON DELETE SET NULL,
  monto       NUMERIC(14,2) NOT NULL,      -- monto original fiado
  abonado     NUMERIC(14,2) DEFAULT 0,     -- cuánto ha pagado ya
  descripcion TEXT,                        -- qué se llevó (productos)
  estado      VARCHAR(20) DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'pagado')),
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS fiados_cliente_idx ON fiados(cliente_id);
CREATE INDEX IF NOT EXISTS fiados_estado_idx  ON fiados(estado);

-- ─────────────────────────────────────────────────────────────────
-- RLS: mismas políticas que el resto de tablas
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiados   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON fiados   FOR ALL TO authenticated USING (true) WITH CHECK (true);
