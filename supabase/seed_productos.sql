-- ============================================================
-- SEED: Productos del inventario
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Galletas (categoría 1)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Galletas Saladitas', 22, 3, 5, 1, 'producto'),
('Galletas Marianitas', 13, 4, 5, 1, 'producto'),
('Galletas Emperador', 19, 12, 5, 1, 'producto'),
('Galletas Arcoiris', 19, 4, 5, 1, 'producto'),
('Galletas Ricanelas', 20, 1, 5, 1, 'producto'),
('Galletas Maria paq Naranja', 18, 6, 5, 1, 'producto'),
('Galletas Marias Azul', 18, 4, 5, 1, 'producto'),
('Galletas Oreo', 14, 1, 5, 1, 'producto'),
('Galletas Crackes', 15, 1, 5, 1, 'producto'),
('Galletas Cremosa', 20, 5, 5, 1, 'producto');

-- Sopas (categoría 3)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Sopas La Moderna Surtida', 9, 22, 10, 3, 'producto'),
('Sopas La Moderna Maruchas', 18, 11, 10, 3, 'producto');

-- Botanas (categoría 3)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('NorSuiza', 5, 56, 10, 3, 'producto'),
('Rico Pollo', 5, 20, 10, 3, 'producto'),
('NorTomate', 0, 24, 10, 3, 'producto'),
('Salfina', 22, 2, 5, 3, 'producto'),
('Fritura Sol', 19, 14, 10, 3, 'producto'),
('Palomitas', 12, 8, 10, 3, 'producto'),
('Chicharrones', 12, 7, 10, 3, 'producto'),
('Vasos desechables No 8', 1, 1, 10, 3, 'producto');

-- DULCES Y CHICLES (categoría 3)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Alca serZet', 8, 100, 20, 3, 'producto'),
('Sal di Uvas Pico', 5, 50, 20, 3, 'producto'),
('Pastillas Refrescante', 3, 0, 10, 3, 'producto'),
('Chupones', 5, 12, 20, 3, 'producto'),
('Dulces Halls', 10, 12, 20, 3, 'producto'),
('Paletas Bubalo', 6, 30, 20, 3, 'producto'),
('Chicle Orbi', 3, 67, 30, 3, 'producto'),
('Chicle Tredent', 3, 66, 30, 3, 'producto'),
('Canels', 1, 30, 30, 3, 'producto'),
('Chicle Bubalo', 2, 33, 30, 3, 'producto'),
('Paleta Sandia', 3, 5, 20, 3, 'producto'),
('Encendedor Tokio', 8, 23, 10, 3, 'producto');

-- LIMPIEZA (categoría 4)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Pasta de dientes', 24, 1, 5, 4, 'producto'),
('Champo', 4, 24, 10, 4, 'producto'),
('Veladora', 23, 17, 5, 4, 'producto'),
('Gelatinas Surtida', 15, 4, 5, 4, 'producto'),
('Botanera Salsa', 17.5, 1, 5, 4, 'producto'),
('Salsa Valentina', 18, 2, 5, 4, 'producto'),
('Maicena de Sabores', 15, 8, 5, 4, 'producto'),
('Tes Surtido', 2, 0, 5, 4, 'producto'),
('Suavitel', 22, 1, 5, 4, 'producto'),
('Roma 1/2', 22, 4, 5, 4, 'producto'),
('Roma 1/4', 12, 3, 5, 4, 'producto'),
('Zote Chico', 15, 2, 5, 4, 'producto'),
('Fabuloso Pato', 22, 3, 5, 4, 'producto'),
('Cloro', 15, 3, 5, 4, 'producto'),
('Crema 1/4', 23, 1, 5, 4, 'producto'),
('Chiles Jalap. Ent 220g', 18, 2, 5, 4, 'producto'),
('Chile Jalap Rajas 105g', 12, 7, 5, 4, 'producto'),
('Mayonesa 190g', 30, 3, 5, 4, 'producto'),
('Frijol Isadora Sob', 22, 3, 5, 4, 'producto'),
('Chiles Chipotles 220g', 36, 5, 5, 4, 'producto'),
('Chiles Chipotles 58g', 16, 10, 5, 4, 'producto'),
('Salsa Capts', 18, 3, 5, 4, 'producto'),
('Vinagre', 17, 5, 5, 4, 'producto'),
('Atun de Aceite', 24, 1, 5, 4, 'producto'),
('Atun de Agua', 22, 1, 5, 4, 'producto'),
('Servilletas', 22, 1, 5, 4, 'producto'),
('Aceite Lt', 45, 2, 5, 4, 'producto'),
('Aceite 1/2', 28, 2, 5, 4, 'producto'),
('Aceite de Olive mini 45ml', 12, 1, 5, 4, 'producto'),
('Bolsas basura gde', 15, 0, 5, 4, 'producto'),
('Bolsa basura 60cm', 5, 0, 5, 4, 'producto'),
('La Costeña Verduras', 16, 4, 5, 4, 'producto'),
('Costeña Elotes', 15, 1, 5, 4, 'producto');

-- BEBIDAS (categoría 2)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Cafe de olla', 10, 10, 5, 2, 'producto'),
('Cafe Canela Legal', 12, 10, 5, 2, 'producto'),
('Nescafe Clasico Pequeno', 17, 13, 5, 2, 'producto'),
('Nescafe Clasico Grande', 37, 2, 5, 2, 'producto'),
('Nescafe Capuchino', 13, 1, 5, 2, 'producto'),
('Leche Nutri', 22, 3, 5, 2, 'producto'),
('Leche Alpura', 31, 3, 5, 2, 'producto'),
('Leche Sta Clara', 30, 3, 5, 2, 'producto'),
('Leche de bolsa', 16, 24, 10, 2, 'producto'),
('Lechera Gde', 33, 4, 5, 2, 'producto'),
('Carnetion', 23, 3, 5, 2, 'producto'),
('Jugo de Frutas', 12, 7, 5, 2, 'producto'),
('Bong Lt', 34, 3, 5, 2, 'producto'),
('Bong 1/2', 18, 2, 5, 2, 'producto'),
('Bong 1/4', 13, 5, 5, 2, 'producto');

-- Refrescos (categoría 2)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Red Cola 600', 0, 28, 10, 2, 'producto'),
('Red Cola 2Lt', 0, 13, 10, 2, 'producto'),
('Red Cola 3Lt', 0, 6, 10, 2, 'producto'),
('Jarrito 600', 0, 11, 10, 2, 'producto'),
('Jarrito 2LT', 0, 12, 10, 2, 'producto'),
('Pepsi 355', 0, 1, 10, 2, 'producto'),
('Pepsi 1.5', 0, 5, 10, 2, 'producto'),
('Pepsi 3LT', 0, 17, 10, 2, 'producto'),
('Cerveza Vicky', 0, 3, 10, 2, 'producto'),
('Suerox', 0, 2, 10, 2, 'producto'),
('Moster', 0, 10, 10, 2, 'producto'),
('Coca Lata 355', 0, 7, 10, 2, 'producto'),
('Coca 400', 0, 8, 10, 2, 'producto'),
('Coca 600', 0, 6, 10, 2, 'producto'),
('Coca 1.35', 0, 7, 10, 2, 'producto'),
('Coca 1.75', 0, 8, 10, 2, 'producto'),
('Coca 3Lt', 0, 10, 10, 2, 'producto'),
('Coca V 1 1/4', 0, 35, 10, 2, 'producto'),
('Coca V Medio', 0, 37, 10, 2, 'producto'),
('Senzao 600', 0, 4, 10, 2, 'producto'),
('Sprait', 0, 1, 10, 2, 'producto'),
('Ciel Agua Lt', 0, 2, 10, 2, 'producto'),
('Topo Chico', 0, 10, 10, 2, 'producto'),
('Manzanita Mundet 600', 0, 4, 10, 2, 'producto'),
('Manzanito 2Lt', 0, 1, 10, 2, 'producto'),
('Subba 600', 0, 7, 10, 2, 'producto'),
('Subba 1 LT', 0, 1, 10, 2, 'producto'),
('Senzao 2T', 0, 1, 10, 2, 'producto'),
('LuLu 3LT', 0, 1, 10, 2, 'producto'),
('Skarch 1.5 Natural', 0, 22, 10, 2, 'producto'),
('Skarch 1.5 Sabor', 0, 13, 10, 2, 'producto'),
('Delawere 600', 0, 6, 10, 2, 'producto'),
('Ameyal 600', 0, 1, 10, 2, 'producto'),
('Mineral 0.500', 0, 12, 10, 2, 'producto'),
('Mineralita de 2 LTS', 0, 1, 10, 2, 'producto'),
('Skarch Agua 1 LT', 0, 8, 10, 2, 'producto'),
('Skarch 0.500', 0, 10, 10, 2, 'producto'),
('Skarch 10 Lts', 0, 4, 10, 2, 'producto');

-- OTROS (categoría 5)
INSERT INTO productos (nombre, precio, stock_actual, stock_minimo, categoria_id, tipo) VALUES
('Frijol kilo bolsa', 32, 1, 5, 5, 'producto'),
('Frijol suelto', 36, 3, 5, 5, 'producto'),
('Vuala', 20, 5, 5, 5, 'producto'),
('Papel de baño', 13, 16, 10, 5, 'producto'),
('Papel Higienico A', 0, 0, 5, 5, 'producto'),
('Huevo San Juan', 0, 0, 10, 5, 'producto'),
('Azucar', 0, 0, 10, 5, 'producto'),
('Vainilla 45ml', 0, 2, 5, 5, 'producto'),
('Frijol de lata', 0, 4, 5, 5, 'producto'),
('Pañales 2 años', 0, 1, 5, 5, 'producto'),
('Pañales 3 años', 0, 1, 5, 5, 'producto'),
('Pañales Tony XXG', 0, 1, 5, 5, 'producto'),
('Pilas Duracel AA', 0, 5, 10, 5, 'producto'),
('Pilas Duracel AAA', 0, 4, 10, 5, 'producto'),
('Head & Shoulders', 0, 32, 10, 5, 'producto');