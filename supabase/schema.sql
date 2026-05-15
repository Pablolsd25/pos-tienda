-- ============================================================
-- POS TIENDA - Schema Supabase
-- ============================================================

-- CATALOGO: Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
  id          SERIAL       PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       VARCHAR(255) NOT NULL,
  descripcion  TEXT,
  categoria_id INTEGER     REFERENCES categorias(id) ON DELETE SET NULL,
  precio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo        NUMERIC(10,2) DEFAULT 0,
  stock_actual NUMERIC(10,2) DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 0,
  codigo_barra VARCHAR(50),
  tipo         VARCHAR(20) NOT NULL DEFAULT 'producto' CHECK (tipo IN ('producto', 'servicio')),
  activo       BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- USUARIOS / CAJEROS ( extiende auth.users )
CREATE TABLE IF NOT EXISTS perfiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     VARCHAR(100) NOT NULL,
  rol        VARCHAR(20)  NOT NULL DEFAULT 'cajero' CHECK (rol IN ('admin', 'cajero')),
  activo     BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SESIONES DE CAJA
CREATE TABLE IF NOT EXISTS sesiones_caja (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  saldo_inicial   NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_final     NUMERIC(14,2),
  estado          VARCHAR(20)  NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  fecha_apertura  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fecha_cierre    TIMESTAMPTZ,
  diferencia      NUMERIC(14,2),
  notas           TEXT
);

-- VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id      UUID        REFERENCES sesiones_caja(id) ON DELETE SET NULL,
  usuario_id     UUID        NOT NULL REFERENCES perfiles(id) ON DELETE SET NULL,
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento      NUMERIC(14,2) DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  efectivo       NUMERIC(14,2) DEFAULT 0,
  cambio         NUMERIC(14,2) DEFAULT 0,
  metodo_pago     VARCHAR(20) NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'mixto')),
  estado         VARCHAR(20) NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'cancelada', 'devolucion')),
  nota           TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS venta_detalles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id    UUID        NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID        REFERENCES productos(id) ON DELETE SET NULL,
  cantidad    NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID        NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'venta')),
  cantidad    NUMERIC(10,2) NOT NULL,
  motivo      TEXT,
  usuario_id  UUID        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria   ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo     ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_codigo     ON productos(codigo_barra);
CREATE INDEX IF NOT EXISTS idx_ventas_sesion         ON ventas(sesion_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha         ON ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha    ON inventario_movimientos(created_at);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados
CREATE POLICY "auth_all" ON categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON perfiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON sesiones_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON venta_detalles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON inventario_movimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO categorias (nombre, descripcion) VALUES
  ('General', 'Categoría general'),
  ('Bebidas', 'Bebidas y líquidos'),
  ('Alimentos', 'Comestibles'),
  ('Limpieza', 'Productos de limpieza'),
  ('Otros', 'Otros productos');