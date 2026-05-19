-- ============================================================
-- MIGRACIÓN: Renombrar categorías y reasignar productos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Renombrar categorías existentes
UPDATE categorias SET nombre = 'Galletas y Botanas' WHERE id = 1;
UPDATE categorias SET nombre = 'Bebidas'            WHERE id = 2;
UPDATE categorias SET nombre = 'Dulces y Chicles'   WHERE id = 3;
UPDATE categorias SET nombre = 'Limpieza e Higiene' WHERE id = 4;
UPDATE categorias SET nombre = 'Varios'             WHERE id = 5;

-- 2. Agregar categoría Abarrotes (nueva)
INSERT INTO categorias (nombre) VALUES ('Abarrotes')
ON CONFLICT DO NOTHING;

-- (guarda el ID que Supabase le asigne; generalmente será 6 si la BD está limpia)

-- 3. Botanas → Galletas y Botanas (cat 1)
--    Estaban mal en cat 3 (Alimentos)
UPDATE productos SET categoria_id = 1 WHERE nombre IN (
  'NorSuiza',
  'Rico Pollo',
  'NorTomate',
  'Salfina',
  'Fritura Sol',
  'Palomitas',
  'Chicharrones'
);

-- 4. Sopas → Abarrotes (cat 6)
UPDATE productos
SET categoria_id = (SELECT id FROM categorias WHERE nombre = 'Abarrotes')
WHERE nombre IN (
  'Sopas La Moderna Surtida',
  'Sopas La Moderna Maruchas'
);

-- 5. Vasos desechables → Varios (cat 5)
--    Encendedor → Varios también
UPDATE productos SET categoria_id = 5 WHERE nombre IN (
  'Vasos desechables No 8',
  'Encendedor Tokio'
);

-- 6. Alimentos mal puestos en Limpieza → Abarrotes
UPDATE productos
SET categoria_id = (SELECT id FROM categorias WHERE nombre = 'Abarrotes')
WHERE nombre IN (
  'Gelatinas Surtida',
  'Botanera Salsa',
  'Salsa Valentina',
  'Maicena de Sabores',
  'Tes Surtido',
  'Crema 1/4',
  'Chiles Jalap. Ent 220g',
  'Chile Jalap Rajas 105g',
  'Mayonesa 190g',
  'Frijol Isadora Sob',
  'Chiles Chipotles 220g',
  'Chiles Chipotles 58g',
  'Salsa Capts',
  'Vinagre',
  'Atun de Aceite',
  'Atun de Agua',
  'Aceite Lt',
  'Aceite 1/2',
  'Aceite de Olive mini 45ml',
  'La Costeña Verduras',
  'Costeña Elotes'
);

-- 7. Veladora → Varios (no es limpieza)
UPDATE productos SET categoria_id = 5 WHERE nombre = 'Veladora';

-- 8. Abarrotes desde cat 5
UPDATE productos
SET categoria_id = (SELECT id FROM categorias WHERE nombre = 'Abarrotes')
WHERE nombre IN (
  'Frijol kilo bolsa',
  'Frijol suelto',
  'Frijol de lata',
  'Huevo San Juan',
  'Azucar',
  'Vainilla 45ml',
  'Vuala'
);

-- 9. Higiene/cuidado personal → Limpieza e Higiene (cat 4)
--    Estaban en cat 5 (Otros/Varios)
UPDATE productos SET categoria_id = 4 WHERE nombre IN (
  'Head & Shoulders',
  'Pañales 2 años',
  'Pañales 3 años',
  'Pañales Tony XXG',
  'Papel de baño',
  'Papel Higienico A'
);

-- 10. Pilas → Varios (cat 5)
UPDATE productos SET categoria_id = 5 WHERE nombre IN (
  'Pilas Duracel AA',
  'Pilas Duracel AAA'
);

-- ============================================================
-- VERIFICACIÓN (opcional)
-- Descomenta para revisar el resultado:
-- ============================================================
-- SELECT c.nombre AS categoria, COUNT(p.id) AS total_productos
-- FROM categorias c
-- LEFT JOIN productos p ON p.categoria_id = c.id
-- GROUP BY c.id, c.nombre
-- ORDER BY c.id;
