import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl as RNRefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Venta, VentaDetalle, Producto } from '../types';

type ResumenDia = {
  fecha: string;
  total: number;
  ventas: number;
  efectivo: number;
  tarjeta: number;
};

export default function ResumenVentasScreen() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [detalles, setDetalles] = useState<VentaDetalle[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');

  const loadData = useCallback(async () => {
    try {
      let fechaInicio: Date;
      const ahora = new Date();

      if (periodo === 'hoy') {
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      } else if (periodo === 'semana') {
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else {
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      }

      const { data: ventasData } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', fechaInicio.toISOString())
        .eq('estado', 'completada')
        .order('created_at', { ascending: false });

      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .order('nombre');

      setVentas(ventasData || []);
      setProductos(productosData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadDetalles = async () => {
      if (ventas.length === 0) {
        setDetalles([]);
        return;
      }

      const ventaIds = ventas.map(v => v.id);
      const { data } = await supabase
        .from('venta_detalles')
        .select('*')
        .in('venta_id', ventaIds);

      setDetalles(data || []);
    };

    loadDetalles();
  }, [ventas]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calcular KPIs
  const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0);
  const numVentas = ventas.length;
  const ticketPromedio = numVentas > 0 ? totalVentas / numVentas : 0;
  const efectivoTotal = ventas.filter(v => v.metodo_pago === 'efectivo').reduce((acc, v) => acc + v.efectivo, 0);
  const tarjetaTotal = totalVentas - efectivoTotal;

  // Valor del inventario actual (solo productos físicos activos)
  const valorInventarioVenta = productos
    .filter(p => p.activo && p.tipo === 'producto')
    .reduce((acc, p) => acc + p.stock_actual * p.precio, 0);
  const valorInventarioCosto = productos
    .filter(p => p.activo && p.tipo === 'producto')
    .reduce((acc, p) => acc + p.stock_actual * p.costo, 0);

  // Productos más vendidos
  const productosVendidos: Record<string, { cantidad: number; total: number; nombre: string }> = {};
  detalles.forEach(d => {
    if (d.producto_id) {
      if (!productosVendidos[d.producto_id]) {
        const prod = productos.find(p => p.id === d.producto_id);
        productosVendidos[d.producto_id] = {
          cantidad: 0,
          total: 0,
          nombre: prod?.nombre || 'Producto',
        };
      }
      productosVendidos[d.producto_id].cantidad += d.cantidad;
      productosVendidos[d.producto_id].total += d.subtotal;
    }
  });

  const topProductos = Object.values(productosVendidos)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  // Ventas por día
  const ventasPorDia: Record<string, ResumenDia> = {};
  ventas.forEach(v => {
    const fecha = new Date(v.created_at).toLocaleDateString('es-MX');
    if (!ventasPorDia[fecha]) {
      ventasPorDia[fecha] = { fecha, total: 0, ventas: 0, efectivo: 0, tarjeta: 0 };
    }
    ventasPorDia[fecha].total += v.total;
    ventasPorDia[fecha].ventas += 1;
    if (v.metodo_pago === 'efectivo') {
      ventasPorDia[fecha].efectivo += v.efectivo;
    } else {
      ventasPorDia[fecha].tarjeta += v.total;
    }
  });

  const diasOrdenados = Object.values(ventasPorDia).reverse();

  const formatPeriodo = () => {
    if (periodo === 'hoy') return 'Hoy';
    if (periodo === 'semana') return 'Últimos 7 días';
    return 'Este mes';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Resumen de Ventas</Text>
      </View>

      {/* Filtros de período */}
      <View style={styles.filtros}>
        {(['hoy', 'semana', 'mes'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.filtroBtn, periodo === p && styles.filtroBtnActive]}
            onPress={() => setPeriodo(p)}
          >
            <Text style={[styles.filtroBtnText, periodo === p && styles.filtroBtnTextActive]}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RNRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValor}>${totalVentas.toFixed(2)}</Text>
            <Text style={styles.kpiLabel}>Total ventas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValor}>{numVentas}</Text>
            <Text style={styles.kpiLabel}>Transacciones</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValor}>${ticketPromedio.toFixed(2)}</Text>
            <Text style={styles.kpiLabel}>Ticket promedio</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValor}>${efectivoTotal.toFixed(2)}</Text>
            <Text style={styles.kpiLabel}>Efectivo</Text>
          </View>
        </View>

        {/* Métodos de pago */}
        <View style={styles.metodosPago}>
          <Text style={styles.sectionTitle}>Métodos de pago</Text>
          <View style={styles.metodosGrid}>
            <View style={styles.metodoCard}>
              <Text style={styles.metodoIcono}>💵</Text>
              <Text style={styles.metodoMonto}>${efectivoTotal.toFixed(2)}</Text>
              <Text style={styles.metodoLabel}>Efectivo</Text>
            </View>
            <View style={styles.metodoCard}>
              <Text style={styles.metodoIcono}>💳</Text>
              <Text style={styles.metodoMonto}>${tarjetaTotal.toFixed(2)}</Text>
              <Text style={styles.metodoLabel}>Tarjeta</Text>
            </View>
          </View>
        </View>

        {/* Valor del inventario */}
        <View style={styles.inventarioSection}>
          <Text style={styles.sectionTitle}>Valor del inventario actual</Text>
          <View style={styles.inventarioGrid}>
            <View style={styles.inventarioCard}>
              <Text style={styles.inventarioValor}>${valorInventarioVenta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.inventarioLabel}>A precio de venta</Text>
            </View>
            <View style={styles.inventarioCard}>
              <Text style={[styles.inventarioValor, { color: '#dc2626' }]}>${valorInventarioCosto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.inventarioLabel}>A precio de costo</Text>
            </View>
          </View>
          <View style={styles.utilidadBar}>
            <Text style={styles.utilidadLabel}>Utilidad potencial del stock</Text>
            <Text style={styles.utilidadValor}>
              ${(valorInventarioVenta - valorInventarioCosto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Top productos */}
        {topProductos.length > 0 && (
          <View style={styles.topProductos}>
            <Text style={styles.sectionTitle}>Productos más vendidos</Text>
            {topProductos.map((p, i) => (
              <View key={i} style={styles.topProductoRow}>
                <Text style={styles.topProductoPos}>{i + 1}</Text>
                <Text style={styles.topProductoNombre}>{p.nombre}</Text>
                <Text style={styles.topProductoCant}>{p.cantidad} und</Text>
                <Text style={styles.topProductoTotal}>${p.total.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Ventas por día */}
        {diasOrdenados.length > 0 && (
          <View style={styles.ventasDia}>
            <Text style={styles.sectionTitle}>Ventas por día</Text>
            {diasOrdenados.map((d, i) => (
              <View key={i} style={styles.diaRow}>
                <View>
                  <Text style={styles.diaFecha}>{d.fecha}</Text>
                  <Text style={styles.diaVentas}>{d.ventas} ventas</Text>
                </View>
                <Text style={styles.diaTotal}>${d.total.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  filtros: { flexDirection: 'row', padding: 12, gap: 8 },
  filtroBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  filtroBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filtroBtnText: { fontWeight: '700', fontSize: 15, color: '#6b7280' },
  filtroBtnTextActive: { color: '#fff' },
  content: { padding: 12, paddingBottom: 40 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiValor: { fontSize: 26, fontWeight: 'bold', color: '#2563eb' },
  kpiLabel: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, color: '#1f2937' },
  metodosPago: { marginBottom: 16 },
  metodosGrid: { flexDirection: 'row', gap: 10 },
  metodoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  metodoIcono: { fontSize: 28 },
  metodoMonto: { fontSize: 20, fontWeight: 'bold', marginTop: 6, color: '#1f2937' },
  metodoLabel: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  topProductos: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  topProductoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  topProductoPos: { width: 28, fontWeight: 'bold', color: '#2563eb', fontSize: 16 },
  topProductoNombre: { flex: 1, fontSize: 16, color: '#1f2937' },
  topProductoCant: { fontSize: 14, color: '#6b7280', marginRight: 10 },
  topProductoTotal: { fontWeight: '700', color: '#16a34a', fontSize: 15 },
  ventasDia: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  diaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  diaFecha: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  diaVentas: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  diaTotal: { fontSize: 18, fontWeight: 'bold', color: '#2563eb' },
  inventarioSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  inventarioGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inventarioCard: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  inventarioValor: { fontSize: 22, fontWeight: 'bold', color: '#16a34a' },
  inventarioLabel: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  utilidadBar: {
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utilidadLabel: { fontSize: 14, color: '#1e40af', fontWeight: '700' },
  utilidadValor: { fontSize: 20, fontWeight: 'bold', color: '#1e40af' },
});