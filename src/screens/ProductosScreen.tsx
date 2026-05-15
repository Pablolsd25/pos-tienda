import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import type { Producto, Categoria } from '../types';

export default function ProductosScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [codigoBarra, setCodigoBarra] = useState('');
  const [tipo, setTipo] = useState<'producto' | 'servicio'>('producto');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [productosRes, categoriasRes] = await Promise.all([
        supabase.from('productos').select('*').order('nombre'),
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

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setCosto('');
    setStockActual('');
    setStockMinimo('');
    setCodigoBarra('');
    setTipo('producto');
    setCategoriaId(null);
    setEditando(null);
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
    if (!nombre.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

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
        Alert.alert('Éxito', 'Producto actualizado');
      } else {
        await supabase.from('productos').insert(data);
        Alert.alert('Éxito', 'Producto creado');
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
      await supabase
        .from('productos')
        .update({ activo: !producto.activo })
        .eq('id', producto.id);
      loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar');
    }
  };

  const duplicarProducto = async (producto: Producto) => {
    try {
      const { id, created_at, updated_at, ...resto } = producto as any;
      const copia = {
        ...resto,
        nombre: `Copia de ${producto.nombre}`,
        codigo_barra: null, // evitar colisión de unique constraint
      };
      const { error } = await supabase.from('productos').insert(copia);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert('Error al duplicar: ' + (error.message || 'Inténtalo de nuevo'));
      } else {
        Alert.alert('Error', error.message || 'No se pudo duplicar el producto');
      }
    }
  };

  const eliminarProducto = (producto: Producto) => {
    const ejecutarEliminar = async () => {
      try {
        const { error } = await supabase
          .from('productos')
          .delete()
          .eq('id', producto.id);
        if (error) throw error;
        setMostrarModal(false);
        resetForm();
        loadData();
      } catch (error: any) {
        if (Platform.OS === 'web') {
          window.alert('Error: ' + (error.message || 'No se pudo eliminar'));
        } else {
          Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
        }
      }
    };

    if (Platform.OS === 'web') {
      // En web, Alert.alert no funciona — usamos window.confirm nativo del navegador
      const confirmado = window.confirm(`¿Eliminar "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`);
      if (confirmado) ejecutarEliminar();
    } else {
      Alert.alert(
        'Eliminar producto',
        `¿Estás seguro de eliminar "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: ejecutarEliminar },
        ]
      );
    }
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo_barra?.includes(busqueda)
  );

  const renderProducto = ({ item }: { item: Producto }) => (
    <TouchableOpacity
      style={[styles.productoCard, !item.activo && styles.productoInactivo]}
      onPress={() => abrirModal(item)}
    >
      <View style={styles.productoInfo}>
        <Text style={styles.productoNombre}>{item.nombre}</Text>
        <Text style={styles.productoDetalle}>
          ${item.precio.toFixed(2)} • {item.tipo === 'producto' ? `Stock: ${item.stock_actual}` : 'Servicio'}
        </Text>
        {item.codigo_barra && (
          <Text style={styles.codigoBarra}>{item.codigo_barra}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.toggleBtn, item.activo ? styles.toggleActivo : styles.toggleInactivo]}
        onPress={() => toggleActivo(item)}
      >
        <Text style={item.activo ? styles.toggleActivoText : styles.toggleInactivoText}>
          {item.activo ? 'Activo' : 'Inactivo'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btnDuplicar}
        onPress={() => duplicarProducto(item)}
      >
        <Text style={styles.btnDuplicarText}>⧉</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btnBorrar}
        onPress={() => eliminarProducto(item)}
      >
        <Text style={styles.btnBorrarText}>🗑</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Productos</Text>
        <TouchableOpacity style={styles.btnAgregar} onPress={() => abrirModal()}>
          <Text style={styles.btnAgregarText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
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

      {/* Modal de producto */}
      <Modal visible={mostrarModal} animationType="slide">
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editando ? 'Editar Producto' : 'Nuevo Producto'}
            </Text>
            <TouchableOpacity onPress={() => setMostrarModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

            <Text style={styles.label}>Descripción</Text>
            <TextInput style={styles.input} value={descripcion} onChangeText={setDescripcion} multiline />

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.tipoButtons}>
              <TouchableOpacity
                style={[styles.tipoBtn, tipo === 'producto' && styles.tipoBtnActive]}
                onPress={() => setTipo('producto')}
              >
                <Text style={[styles.tipoBtnText, tipo === 'producto' && styles.tipoBtnTextActive]}>
                  Producto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoBtn, tipo === 'servicio' && styles.tipoBtnActive]}
                onPress={() => setTipo('servicio')}
              >
                <Text style={[styles.tipoBtnText, tipo === 'servicio' && styles.tipoBtnTextActive]}>
                  Servicio
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Precio *</Text>
            <TextInput
              style={styles.input}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Costo</Text>
            <TextInput
              style={styles.input}
              value={costo}
              onChangeText={setCosto}
              keyboardType="numeric"
            />

            {tipo === 'producto' && (
              <>
                <Text style={styles.label}>Stock Actual</Text>
                <TextInput
                  style={styles.input}
                  value={stockActual}
                  onChangeText={setStockActual}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Stock Mínimo</Text>
                <TextInput
                  style={styles.input}
                  value={stockMinimo}
                  onChangeText={setStockMinimo}
                  keyboardType="numeric"
                />
              </>
            )}

            <Text style={styles.label}>Código de Barras</Text>
            <View style={styles.codigoBarraRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={codigoBarra}
                onChangeText={setCodigoBarra}
                placeholder="Ingresa o escanea"
              />
              <TouchableOpacity
                style={styles.btnEscanearCodigo}
                onPress={() => setMostrarEscaner(true)}
              >
                <Text style={styles.btnEscanearCodigoText}>Escanear</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.categoriaButtons}>
              {categorias.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catBtn, categoriaId === cat.id && styles.catBtnActive]}
                  onPress={() => setCategoriaId(cat.id)}
                >
                  <Text style={[styles.catBtnText, categoriaId === cat.id && styles.catBtnTextActive]}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.btnGuardar} onPress={guardarProducto}>
              <Text style={styles.btnGuardarText}>
                {editando ? 'Actualizar' : 'Crear'} Producto
              </Text>
            </TouchableOpacity>

            {editando && (
              <TouchableOpacity
                style={styles.btnEliminar}
                onPress={() => eliminarProducto(editando)}
              >
                <Text style={styles.btnEliminarText}>Eliminar producto</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Modal>

      {/* Escaner de codigo de barras */}
      <BarcodeScanner
        visible={mostrarEscaner}
        onScan={(codigo) => {
          setCodigoBarra(codigo);
          setMostrarEscaner(false);
        }}
        onClose={() => setMostrarEscaner(false)}
        titulo="Escanear código de barras"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  btnAgregar: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnAgregarText: { color: '#2563eb', fontWeight: '600' },
  searchContainer: { padding: 12, backgroundColor: '#fff' },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 },
  list: { padding: 8 },
  productoCard: {
    backgroundColor: '#fff',
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productoInactivo: { opacity: 0.5 },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 16, fontWeight: '600' },
  productoDetalle: { fontSize: 14, color: '#666', marginTop: 2 },
  codigoBarra: { fontSize: 12, color: '#999', marginTop: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  toggleActivo: { backgroundColor: '#dcfce7' },
  toggleInactivo: { backgroundColor: '#fee2e2' },
  toggleActivoText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  toggleInactivoText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  btnDuplicar: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  btnDuplicarText: {
    fontSize: 16,
  },
  btnBorrar: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  btnBorrarText: {
    fontSize: 16,
  },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalClose: { fontSize: 20, color: '#666' },
  form: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  tipoButtons: { flexDirection: 'row', gap: 8 },
  tipoBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center' },
  tipoBtnActive: { backgroundColor: '#2563eb' },
  tipoBtnText: { fontWeight: '600', color: '#666' },
  tipoBtnTextActive: { color: '#fff' },
  categoriaButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5' },
  catBtnActive: { backgroundColor: '#2563eb' },
  catBtnText: { fontSize: 14, color: '#666' },
  catBtnTextActive: { color: '#fff' },
  btnGuardar: { backgroundColor: '#16a34a', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnGuardarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  codigoBarraRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  btnEscanearCodigo: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  btnEscanearCodigoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnEliminar: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  btnEliminarText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
});