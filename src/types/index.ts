export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  created_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number | null;
  precio: number;
  costo: number;
  stock_actual: number;
  stock_minimo: number;
  codigo_barra: string | null;
  tipo: 'producto' | 'servicio';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Perfil {
  id: string;
  nombre: string;
  rol: 'admin' | 'cajero';
  activo: boolean;
  created_at: string;
}

export interface SesionCaja {
  id: string;
  usuario_id: string;
  saldo_inicial: number;
  saldo_final: number | null;
  estado: 'abierta' | 'cerrada';
  fecha_apertura: string;
  fecha_cierre: string | null;
  diferencia: number | null;
  notas: string | null;
}

export interface Venta {
  id: string;
  sesion_id: string | null;
  usuario_id: string;
  subtotal: number;
  descuento: number;
  total: number;
  efectivo: number;
  cambio: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'mixto';
  estado: 'completada' | 'cancelada' | 'devolucion';
  nota: string | null;
  created_at: string;
}

export interface VentaDetalle {
  id: string;
  venta_id: string;
  producto_id: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
  productos?: Producto;
}

export interface CarritoItem {
  producto: Producto;
  cantidad: number;
  precioCustom?: number; // precio editado manualmente en el carrito
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  NuevaVenta: undefined;
  Productos: undefined;
  ProductoDetalle: { productoId?: string };
  Inventario: undefined;
  CortesCaja: undefined;
  ResumenVentas: undefined;
};

export type MainTabParamList = {
  POS: undefined;
  Productos: undefined;
  Inventario: undefined;
  Resumen: undefined;
  Ajustes: undefined;
};