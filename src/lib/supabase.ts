import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: number;
          nombre: string;
          descripcion: string | null;
          created_at: string;
        };
        Insert: {
          nombre: string;
          descripcion?: string | null;
        };
        Update: {
          nombre?: string;
          descripcion?: string | null;
        };
      };
      productos: {
        Row: {
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
        };
        Insert: {
          nombre: string;
          descripcion?: string | null;
          categoria_id?: number | null;
          precio?: number;
          costo?: number;
          stock_actual?: number;
          stock_minimo?: number;
          codigo_barra?: string | null;
          tipo?: 'producto' | 'servicio';
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          descripcion?: string | null;
          categoria_id?: number | null;
          precio?: number;
          costo?: number;
          stock_actual?: number;
          stock_minimo?: number;
          codigo_barra?: string | null;
          tipo?: 'producto' | 'servicio';
          activo?: boolean;
        };
      };
      perfiles: {
        Row: {
          id: string;
          nombre: string;
          rol: 'admin' | 'cajero';
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          nombre: string;
          rol?: 'admin' | 'cajero';
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          rol?: 'admin' | 'cajero';
          activo?: boolean;
        };
      };
      sesiones_caja: {
        Row: {
          id: string;
          usuario_id: string;
          saldo_inicial: number;
          saldo_final: number | null;
          estado: 'abierta' | 'cerrada';
          fecha_apertura: string;
          fecha_cierre: string | null;
          diferencia: number | null;
          notas: string | null;
        };
        Insert: {
          usuario_id: string;
          saldo_inicial?: number;
        };
        Update: {
          saldo_final?: number | null;
          estado?: 'abierta' | 'cerrada';
          fecha_cierre?: string | null;
          diferencia?: number | null;
          notas?: string | null;
        };
      };
      ventas: {
        Row: {
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
        };
        Insert: {
          sesion_id?: string | null;
          usuario_id: string;
          subtotal: number;
          descuento?: number;
          total: number;
          efectivo?: number;
          cambio?: number;
          metodo_pago?: 'efectivo' | 'tarjeta' | 'mixto';
          nota?: string | null;
        };
        Update: {
          estado?: 'completada' | 'cancelada' | 'devolucion';
          nota?: string | null;
        };
      };
      venta_detalles: {
        Row: {
          id: string;
          venta_id: string;
          producto_id: string | null;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          venta_id: string;
          producto_id?: string | null;
          cantidad: number;
          precio_unitario: number;
          subtotal: number;
        };
        Update: {
          cantidad?: number;
          precio_unitario?: number;
          subtotal?: number;
        };
      };
    };
  };
};