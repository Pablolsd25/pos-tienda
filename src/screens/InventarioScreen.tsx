import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, TextInput, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Producto, Categoria } from '../types';

export default function InventarioScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroStock, setFiltroStock] = useState<'todos' | 'bajo' | 'existente'>('todos');
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidadMovimiento, setCantidadMovimiento] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [motivo, setMotivo] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [productosRes, categoriasRes] = await Promise.all([
        supabase.from('productos').select('*').eq('tipo', 'producto').order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
      ]);

      setProductos(productosRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const productosFiltrados = productos.filter(p => {
    if (filtroStock === 'bajo') return p.stock_actual <= p.stock_minimo;
    if (filtroStock === 'existente') return p.stock_actual > 0;
    return true;
  });

  const abrirMovimiento = (producto: Producto) => {
    setProductoSeleccionado(producto);
    setCantidadMovimiento('');
    setMotivo('');
    setTipoMovimiento('entrada');
    setMostrarMovimiento(true);
  };

  const registrarMovimiento = async () => {
    if (!productoSeleccionado || !cantidadMovimiento) {
      Alert.alert('Error', 'Ingresa la cantidad');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cantidad = parseFloat(cantidadMovimiento);
      let nuevoStock = productoSeleccionado.stock_actual;

      if (tipoMovimiento === 'entrada') {
        nuevoStock += cantidad;
      } else if (tipoMovimiento === 'salida') {
        nuevoStock -= cantidad;
      } else if (tipoMovimiento === 'ajuste') {
        nuevoStock = cantidad;
      }

      // Actualizar stock
      await supabase
        .from('productos')
        .update({ stock_actual: nuevoStock })
        .eq('id', productoSeleccionado.id);

      // Registrar movimiento
      await supabase.from('inventario_movimientos').insert({
        producto_id: productoSeleccionado.id,
        tipo: tipoMovimiento,
        cantidad: tipoMovimiento === 'ajuste' ? cantidad - productoSeleccionado.stock_actual : (tipoMovimiento === 'entrada' ? cantidad : -cantidad),
        motivo: motivo || null,
        usuario_id: user?.id || null,
      });

      Alert.alert('Éxito', `Stock actualizado a ${nuevoStock}`);
      setMostrarMovimiento(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getCategoriaNombre = (id: number | null) => {
    if (!id) return 'Sin categoría';
    const cat = categorias.find(c => c.id === id);
    return cat?.nombre || 'Sin categoría';
  };

  const stockBajoCount = productos.filter(p => p.stock_actual <= p.stock_minimo).length;

  const renderProducto = ({ item }: { item: Producto }) => {
    const stockBajo = item.stock_actual <= item.stock_minimo;
    const sinStock = item.stock_actual === 0;

    return (
      <TouchableOpacity
        style={[styles.productoCard, sinStock && styles.sinStock]}
        onPress={() => abrirMovimiento(item)}
      >
        <View style={styles.productoInfo}>
          <Text style={styles.productoNombre}>{item.nombre}</Text>
          <Text style={styles.productoDetalle}>{getCategoriaNombre(item.categoria_id)}</Text>
        </View>
        <View style={styles.productoStock}>
          <Text style={[styles.stockNumero, stockBajo && styles.stockBajo]}>
            {item.stock_actual}
          </Text>
          <Text style={styles.stockLabel}>Stock</Text>
          <Text style={styles.stockMinimo}>Mín: {item.stock_minimo}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // KPIs
  const totalProductos = productos.length;
  const productosConStock = productos.filter(p => p.stock_actual > 0).length;
  const productosSinStock = productos.filter(p => p.stock_actual === 0).length;
  const valorInventario = productos.reduce((acc, p) => acc + (p.stock_actual * p.costo), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventario</Text>
      </View>

      {/* KPIs */}
      <View style={styles.kpis}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValor}>{totalProductos}</Text>
          <Text style={styles.kpiLabel}>Total</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValor}>{productosConStock}</Text>
          <Text style={styles.kpiLabel}>Con Stock</Text>
        </View>
        <View style={[styles.kpiCard, stockBajoCount > 0 && styles.kpiAlerta]}>
          <Text style={[styles.kpiValor, stockBajoCount > 0 && styles.kpiAlertaTexto]}>{stockBajoCount}</Text>
          <Text style={styles.kpiLabel}>Bajo Stock</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValor}>${valorInventario.toFixed(0)}</Text>
          <Text style={styles.kpiLabel}>Valor</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        <TouchableOpacity
          style={[styles.filtroBtn, filtroStock === 'todos' && styles.filtroBtnActive]}
          onPress={() => setFiltroStock('todos')}
        >
          <Text style={[styles.filtroBtnText, filtroStock === 'todos' && styles.filtroBtnTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroBtn, filtroStock === 'existente' && styles.filtroBtnActive]}
          onPress={() => setFiltroStock('existente')}
        >
          <Text style={[styles.filtroBtnText, filtroStock === 'existente' && styles.filtroBtnTextActive]}>
            Con Stock
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroBtn, filtroStock === 'bajo' && styles.filtroBtnActive]}
          onPress={() => setFiltroStock('bajo')}
        >
          <Text style={[styles.filtroBtnText, filtroStock === 'bajo' && styles.filtroBtnTextActive]}>
            Bajo Stock
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={productosFiltrados}
        renderItem={renderProducto}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {cargando ? 'Cargando...' : 'No hay productos'}
          </Text>
        }
      />

      {/* Modal de movimiento */}
      <Modal visible={mostrarMovimiento} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajuste de Inventario</Text>
            {productoSeleccionado && (
              <Text style={styles.modalProducto}>{productoSeleccionado.nombre}</Text>
            )}
            <Text style={styles.modalStock}>
              Stock actual: {productoSeleccionado?.stock_actual || 0}
            </Text>

            <Text style={styles.label}>Tipo de movimiento</Text>
            <View style={styles.tipoButtons}>
              {(['entrada', 'salida', 'ajuste'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tipoBtn, tipoMovimiento === t && styles.tipoBtnActive]}
                  onPress={() => setTipoMovimiento(t)}
                >
                  <Text style={[styles.tipoBtnText, tipoMovimiento === t && styles.tipoBtnTextActive]}>
                    {t === 'entrada' ? 'Entrada' : t === 'salida' ? 'Salida' : 'Ajuste'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Cantidad</Text>
            <TextInput
              style={styles.input}
              value={cantidadMovimiento}
              onChangeText={setCantidadMovimiento}
              keyboardType="numeric"
              placeholder={tipoMovimiento === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
            />

            <Text style={styles.label}>Motivo (opcional)</Text>
            <TextInput
              style={styles.input}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej: Compra, pérdida, corrección..."
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancelar]}
                onPress={() => setMostrarMovimiento(false)}
              >
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnAceptar]}
                onPress={registrarMovimiento}
              >
                <Text style={styles.modalBtnAceptarText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#2563eb', padding: 16, paddingTop: 48 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  kpis: { flexDirection: 'row', padding: 12, gap: 8 },
  kpiCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, alignItems: 'center' },
  kpiValor: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  kpiLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  kpiAlerta: { backgroundColor: '#fee2e2' },
  kpiAlertaTexto: { color: '#dc2626' },
  filtros: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  filtroBtn: { flex: 1, padding: 8, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center' },
  filtroBtnActive: { backgroundColor: '#2563eb' },
  filtroBtnText: { fontSize: 14, color: '#666' },
  filtroBtnTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 8 },
  productoCard: { backgroundColor: '#fff', marginVertical: 4, padding: 12, borderRadius: 8, flexDirection: 'row' },
  sinStock: { backgroundColor: '#fee2e2' },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 16, fontWeight: '600' },
  productoDetalle: { fontSize: 14, color: '#666' },
  productoStock: { alignItems: 'center', minWidth: 60 },
  stockNumero: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  stockBajo: { color: '#dc2626' },
  stockLabel: { fontSize: 12, color: '#666' },
  stockMinimo: { fontSize: 10, color: '#999' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  modalProducto: { fontSize: 16, color: '#2563eb', textAlign: 'center', marginTop: 8 },
  modalStock: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  tipoButtons: { flexDirection: 'row', gap: 8 },
  tipoBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center' },
  tipoBtnActive: { backgroundColor: '#2563eb' },
  tipoBtnText: { fontWeight: '600', color: '#666' },
  tipoBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 20 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  modalBtnCancelar: { backgroundColor: '#f5f5f5' },
  modalBtnCancelarText: { color: '#666', fontWeight: '600' },
  modalBtnAceptar: { backgroundColor: '#16a34a' },
  modalBtnAceptarText: { color: '#fff', fontWeight: '600' },
});