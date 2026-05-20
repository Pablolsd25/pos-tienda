import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, Modal, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import type { Producto, Categoria } from '../types';

const AZUL  = '#2563eb';
const VERDE = '#16a34a';
const ROJO  = '#dc2626';
const GRIS  = '#6b7280';
const BG    = '#f0f4f8';

export default function ProductosScreen() {
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda]     = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando]     = useState<Producto | null>(null);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);

  // Formulario
  const [nombre, setNombre]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio]           = useState('');
  const [costo, setCosto]             = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [codigoBarra, setCodigoBarra] = useState('');
  const [tipo, setTipo]               = useState<'producto' | 'servicio'>('producto');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);

  // ─── Carga ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [productosRes, categoriasRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
      ]);
      setProductos(productosRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ─── Formulario ────────────────────────────────────────────
  const resetForm = () => {
    setNombre(''); setDescripcion(''); setPrecio(''); setCosto('');
    setStockActual(''); setStockMinimo(''); setCodigoBarra('');
    setTipo('producto'); setCategoriaId(null); setEditando(null);
  };

  const abrirModal = (producto?: Producto) => {
    if (producto) {
      setEditando(producto);
      setNombre(producto.nombre);
      setDescripcion(producto.descripcion || '');
      setPrecio(producto.precio.toString());
      setCosto(producto.costo.toString());
      setStockActual(producto.stock_actual.toString());
      setStockMinimo(producto.stock_minimo.toString());
      setCodigoBarra(producto.codigo_barra || '');
      setTipo(producto.tipo);
      setCategoriaId(producto.categoria_id);
    } else {
      resetForm();
    }
    setMostrarModal(true);
  };

  const guardarProducto = async () => {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es requerido'); return; }
    try {
      const data = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: parseFloat(precio) || 0,
        costo: parseFloat(costo) || 0,
        stock_actual: tipo === 'producto' ? (parseFloat(stockActual) || 0) : 0,
        stock_minimo: tipo === 'producto' ? (parseFloat(stockMinimo) || 0) : 0,
        codigo_barra: codigoBarra.trim() || null,
        tipo,
        categoria_id: categoriaId,
        activo: true,
      };
      if (editando) {
        await supabase.from('productos').update(data).eq('id', editando.id);
        Alert.alert('Guardado', 'Producto actualizado correctamente');
      } else {
        await supabase.from('productos').insert(data);
        Alert.alert('Listo', 'Producto creado correctamente');
      }
      setMostrarModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleActivo = async (producto: Producto) => {
    try {
      await supabase.from('productos').update({ activo: !producto.activo }).eq('id', producto.id);
      loadData();
    } catch { Alert.alert('Error', 'No se pudo actualizar'); }
  };

  const duplicarProducto = async (producto: Producto) => {
    try {
      const { id, created_at, updated_at, ...resto } = producto as any;
      const { error } = await supabase.from('productos').insert({ ...resto, nombre: `Copia de ${producto.nombre}`, codigo_barra: null });
      if (error) throw error;
      loadData();
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert('Error al duplicar: ' + error.message);
      else Alert.alert('Error', error.message || 'No se pudo duplicar');
    }
  };

  const eliminarProducto = (producto: Producto) => {
    const ejecutar = async () => {
      try {
        const { error } = await supabase.from('productos').delete().eq('id', producto.id);
        if (error) throw error;
        setMostrarModal(false);
        resetForm();
        loadData();
      } catch (error: any) {
        if (Platform.OS === 'web') window.alert('Error: ' + error.message);
        else Alert.alert('Error', error.message || 'No se pudo eliminar');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`)) ejecutar();
    } else {
      Alert.alert('Eliminar', `¿Eliminar "${producto.nombre}"?\nEsta acción no se puede deshacer.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: ejecutar },
      ]);
    }
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigo_barra ?? '').includes(busqueda)
  );

  // ─── Render fila ───────────────────────────────────────────
  const renderProducto = ({ item }: { item: Producto }) => (
    <TouchableOpacity
      style={[styles.productoCard, !item.activo && styles.productoInactivo]}
      onPress={() => abrirModal(item)}
      activeOpacity={0.75}
    >
      <View style={styles.productoInfo}>
        <Text style={styles.productoNombre}>{item.nombre}</Text>
        <Text style={styles.productoDetalle}>
          ${item.precio.toFixed(2)}  ·  {item.tipo === 'producto' ? `Stock: ${item.stock_actual}` : 'Servicio'}
        </Text>
        {item.codigo_barra ? (
          <Text style={styles.codigoBarra}>#{item.codigo_barra}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.toggleBtn, item.activo ? styles.toggleActivo : styles.toggleInactivo]}
        onPress={() => toggleActivo(item)}
      >
        <Text style={item.activo ? styles.toggleActivoText : styles.toggleInactivoText}>
          {item.activo ? 'Activo' : 'Inactivo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconBtn} onPress={() => duplicarProducto(item)}>
        <Text style={styles.iconBtnText}>⧉</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => eliminarProducto(item)}>
        <Text style={styles.iconBtnText}>🗑</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ─── UI ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Productos</Text>
        <TouchableOpacity style={styles.btnAgregar} onPress={() => abrirModal()} activeOpacity={0.8}>
          <Text style={styles.btnAgregarText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* Búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto o código..."
          placeholderTextColor="#999"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Lista */}
      <FlatList
        data={productosFiltrados}
        renderItem={renderProducto}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{cargando ? 'Cargando...' : 'No hay productos'}</Text>
        }
      />

      {/* ── Modal Producto ── */}
      <Modal visible={mostrarModal} animationType="slide">
        <ScrollView style={styles.modalContainer} keyboardShouldPersistTaps="handled">
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Producto' : 'Nuevo Producto'}</Text>
            <TouchableOpacity onPress={() => { setMostrarModal(false); resetForm(); }} style={styles.btnClose}>
              <Text style={styles.btnCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Nombre */}
            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del producto" />

            {/* Tipo */}
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.tipoRow}>
              {(['producto', 'servicio'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tipoBtn, tipo === t && styles.tipoBtnActive]}
                  onPress={() => setTipo(t)}
                >
                  <Text style={[styles.tipoBtnText, tipo === t && styles.tipoBtnTextActive]}>
                    {t === 'producto' ? '📦 Producto' : '🛠 Servicio'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Precio / Costo */}
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio *</Text>
                <TextInput style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.label}>Costo</Text>
                <TextInput style={styles.input} value={costo} onChangeText={setCosto} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
            </View>

            {/* Stock */}
            {tipo === 'producto' && (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Stock actual</Text>
                  <TextInput style={styles.input} value={stockActual} onChangeText={setStockActual} keyboardType="decimal-pad" placeholder="0" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.label}>Stock mínimo</Text>
                  <TextInput style={styles.input} value={stockMinimo} onChangeText={setStockMinimo} keyboardType="decimal-pad" placeholder="0" />
                </View>
              </View>
            )}

            {/* Código de barras */}
            <Text style={styles.label}>Código de barras</Text>
            <View style={styles.codigoRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={codigoBarra}
                onChangeText={setCodigoBarra}
                placeholder="Ingresa o escanea"
              />
              <TouchableOpacity style={styles.btnScanInline} onPress={() => setMostrarEscaner(true)}>
                <Text style={styles.btnScanInlineText}>📷 Escanear</Text>
              </TouchableOpacity>
            </View>

            {/* Descripción */}
            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={2}
              placeholder="Descripción breve..."
            />

            {/* Categoría */}
            <Text style={styles.label}>Categoría</Text>
            <View style={styles.catGrid}>
              {categorias.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, categoriaId === cat.id && styles.catChipActive]}
                  onPress={() => setCategoriaId(categoriaId === cat.id ? null : cat.id)}
                >
                  <Text style={[styles.catChipText, categoriaId === cat.id && styles.catChipTextActive]}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Guardar */}
            <TouchableOpacity style={styles.btnGuardar} onPress={guardarProducto} activeOpacity={0.8}>
              <Text style={styles.btnGuardarText}>{editando ? 'Guardar cambios' : 'Crear producto'}</Text>
            </TouchableOpacity>

            {/* Eliminar */}
            {editando && (
              <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminarProducto(editando)} activeOpacity={0.8}>
                <Text style={styles.btnEliminarText}>Eliminar este producto</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </Modal>

      {/* Escáner */}
      <BarcodeScanner
        visible={mostrarEscaner}
        onScan={codigo => { setCodigoBarra(codigo); setMostrarEscaner(false); }}
        onClose={() => setMostrarEscaner(false)}
        titulo="Escanear código de barras"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: AZUL,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  btnAgregar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnAgregarText: { color: AZUL, fontWeight: '700', fontSize: 16 },

  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#111',
  },

  list: { padding: 10 },
  productoCard: {
    backgroundColor: '#fff',
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  productoInactivo: { opacity: 0.45 },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  productoDetalle: { fontSize: 15, color: GRIS, marginTop: 3 },
  codigoBarra: { fontSize: 13, color: '#9ca3af', marginTop: 2 },

  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginLeft: 6 },
  toggleActivo: { backgroundColor: '#dcfce7' },
  toggleInactivo: { backgroundColor: '#fee2e2' },
  toggleActivoText: { color: VERDE, fontSize: 13, fontWeight: '700' },
  toggleInactivoText: { color: ROJO, fontSize: 13, fontWeight: '700' },

  iconBtn: {
    marginLeft: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
  },
  iconBtnDanger: { backgroundColor: '#fee2e2' },
  iconBtnText: { fontSize: 18 },

  emptyText: { textAlign: 'center', color: GRIS, marginTop: 40, fontSize: 17 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  btnClose: { padding: 6 },
  btnCloseText: { fontSize: 22, color: GRIS },

  form: { padding: 16 },
  label: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  row2: { flexDirection: 'row' },

  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  tipoBtnActive: { backgroundColor: AZUL, borderColor: AZUL },
  tipoBtnText: { fontSize: 15, fontWeight: '700', color: GRIS },
  tipoBtnTextActive: { color: '#fff' },

  codigoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btnScanInline: {
    backgroundColor: AZUL,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnScanInlineText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  catChipActive: { backgroundColor: AZUL, borderColor: AZUL },
  catChipText: { fontSize: 15, fontWeight: '600', color: GRIS },
  catChipTextActive: { color: '#fff' },

  btnGuardar: {
    backgroundColor: VERDE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  btnGuardarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  btnEliminar: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: ROJO,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnEliminarText: { color: ROJO, fontSize: 17, fontWeight: '700' },
});
