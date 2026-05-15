import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import type { Producto, CarritoItem, SesionCaja, Perfil } from '../types';

export default function POSScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sesionActual, setSesionActual] = useState<SesionCaja | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);

  const loadProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  const loadSesionCaja = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .single();

      setSesionActual(data || null);

      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setPerfil(perfilData || null);
    } catch (error) {
      console.log('No hay sesión de caja abierta');
    }
  }, []);

  useEffect(() => {
    loadProductos();
    loadSesionCaja();
  }, [loadProductos, loadSesionCaja]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProductos();
    loadSesionCaja();
  };

  const handleBarcodeScan = async (codigo: string) => {
    setMostrarEscaner(false);
    const codigoLimpio = codigo.trim();

    // 1. Buscar primero en la lista ya cargada en memoria (rápido)
    const enMemoria = productos.find(p => p.codigo_barra?.trim() === codigoLimpio);
    if (enMemoria) {
      agregarAlCarrito(enMemoria);
      Alert.alert('Producto agregado', enMemoria.nombre);
      return;
    }

    // 2. Si no está en memoria, buscar directo en Supabase
    //    (cubre el caso donde se guardó el producto después de cargar la pantalla)
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo_barra', codigoLimpio)
        .eq('activo', true)
        .maybeSingle();

      if (data) {
        // Actualizar la lista en memoria para futuros escaneos
        setProductos(prev => {
          const yaExiste = prev.find(p => p.id === data.id);
          return yaExiste ? prev : [...prev, data];
        });
        agregarAlCarrito(data);
        Alert.alert('Producto agregado', data.nombre);
      } else {
        setBusqueda(codigoLimpio);
        Alert.alert(
          'Código no encontrado',
          `No hay producto con código:\n${codigoLimpio}\n\nVerifica que el producto esté guardado con ese código en la pantalla Productos.`
        );
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo consultar la base de datos.');
    }
  };

  const productosFiltrados = productos.filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_barra?.includes(busqueda);
    const coincideCategoria = categoriaSeleccionada ? p.categoria_id === categoriaSeleccionada : true;
    return coincideBusqueda && coincideCategoria;
  });

  const agregarAlCarrito = (producto: Producto) => {
    const existente = carrito.find(item => item.producto.id === producto.id);
    if (existente) {
      setCarrito(carrito.map(item =>
        item.producto.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCarrito([...carrito, { producto, cantidad: 1 }]);
    }
  };

  const actualizarCantidad = (productoId: string, delta: number) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id === productoId) {
        const nuevaCantidad = Math.max(0, item.cantidad + delta);
        return { ...item, cantidad: nuevaCantidad };
      }
      return item;
    }).filter(item => item.cantidad > 0));
  };

  const quitarDelCarrito = (productoId: string) => {
    setCarrito(carrito.filter(item => item.producto.id !== productoId));
  };

  const subtotal = carrito.reduce((acc, item) => acc + (item.producto.precio * item.cantidad), 0);
  const total = subtotal;

  const realizarVenta = async () => {
    if (carrito.length === 0) {
      Alert.alert('Error', 'El carrito está vacío');
      return;
    }

    if (!sesionActual) {
      Alert.alert('Error', 'No hay una sesión de caja abierta');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      // Crear venta
      const efectivo = parseFloat(efectivoRecibido) || 0;
      const cambio = Math.max(0, efectivo - total);

      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          sesion_id: sesionActual.id,
          usuario_id: user.id,
          subtotal: total,
          descuento: 0,
          total: total,
          efectivo: efectivo,
          cambio: cambio,
          metodo_pago: efectivo > 0 ? 'efectivo' : 'tarjeta',
          estado: 'completada',
        })
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Crear detalles y actualizar inventario
      for (const item of carrito) {
        await supabase.from('venta_detalles').insert({
          venta_id: venta.id,
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          precio_unitario: item.producto.precio,
          subtotal: item.producto.precio * item.cantidad,
        });

        // Actualizar stock si es producto (no servicio)
        if (item.producto.tipo === 'producto') {
          await supabase
            .from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);

          // Registrar movimiento
          await supabase.from('inventario_movimientos').insert({
            producto_id: item.producto.id,
            tipo: 'venta',
            cantidad: -item.cantidad,
            motivo: `Venta #${venta.id.slice(0, 8)}`,
            usuario_id: user.id,
          });
        }
      }

      Alert.alert('Éxito', `Venta completada. Cambio: $${cambio.toFixed(2)}`);
      setCarrito([]);
      setMostrarPago(false);
      setEfectivoRecibido('');
      loadProductos(); // Recargar para ver stock actualizado
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al registrar venta');
    }
  };

  const abrirCaja = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const { data, error } = await supabase
        .from('sesiones_caja')
        .insert({
          usuario_id: user.id,
          saldo_inicial: 0,
          estado: 'abierta',
        })
        .select()
        .single();

      if (error) throw error;
      setSesionActual(data);
      Alert.alert('Éxito', 'Caja abierta');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al abrir caja');
    }
  };

  const renderProducto = ({ item }: { item: Producto }) => (
    <TouchableOpacity
      style={styles.productoCard}
      onPress={() => agregarAlCarrito(item)}
    >
      <Text style={styles.productoNombre}>{item.nombre}</Text>
      <Text style={styles.productoPrecio}>${item.precio.toFixed(2)}</Text>
      {item.tipo === 'producto' && (
        <Text style={[styles.productoStock, item.stock_actual <= item.stock_minimo && styles.stockBajo]}>
          Stock: {item.stock_actual}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderCarritoItem = ({ item }: { item: CarritoItem }) => (
    <View style={styles.carritoItem}>
      <View style={styles.carritoInfo}>
        <Text style={styles.carritoNombre}>{item.producto.nombre}</Text>
        <Text style={styles.carritoPrecio}>${item.producto.precio.toFixed(2)} c/u</Text>
      </View>
      <View style={styles.carritoCantidad}>
        <TouchableOpacity onPress={() => actualizarCantidad(item.producto.id, -1)} style={styles.btnCantidad}>
          <Text style={styles.btnCantidadText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.cantidadText}>{item.cantidad}</Text>
        <TouchableOpacity onPress={() => actualizarCantidad(item.producto.id, 1)} style={styles.btnCantidad}>
          <Text style={styles.btnCantidadText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.carritoSubtotal}>${(item.producto.precio * item.cantidad).toFixed(2)}</Text>
      <TouchableOpacity onPress={() => quitarDelCarrito(item.producto.id)}>
        <Text style={styles.btnQuitar}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Punto de Venta</Text>
        <View style={styles.headerStatus}>
          <Text style={styles.headerStatusText}>
            {sesionActual ? '✓ Caja abierta' : '✕ Caja cerrada'}
          </Text>
          {!sesionActual && (
            <TouchableOpacity style={styles.btnAbrirCaja} onPress={abrirCaja}>
              <Text style={styles.btnAbrirCajaText}>Abrir Caja</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto o código..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity
          style={styles.btnEscanear}
          onPress={() => setMostrarEscaner(true)}
        >
          <Text style={styles.btnEscanearText}>Escanear</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de productos */}
      <FlatList
        data={productosFiltrados}
        renderItem={renderProducto}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.productosGrid}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {cargando ? 'Cargando productos...' : 'No hay productos'}
          </Text>
        }
      />

      {/* Carrito */}
      {carrito.length > 0 && (
        <View style={styles.carritoContainer}>
          <View style={styles.carritoHeader}>
            <Text style={styles.carritoTitle}>Carrito ({carrito.length} items)</Text>
            <Text style={styles.carritoTotal}>Total: ${total.toFixed(2)}</Text>
          </View>
          <FlatList
            data={carrito}
            renderItem={renderCarritoItem}
            keyExtractor={item => item.producto.id}
            style={styles.carritoList}
          />
          <TouchableOpacity
            style={styles.btnCobrar}
            onPress={() => setMostrarPago(true)}
          >
            <Text style={styles.btnCobrarText}>Cobrar ${total.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de pago */}
      <Modal visible={mostrarPago} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Venta</Text>
            <Text style={styles.modalTotal}>Total: ${total.toFixed(2)}</Text>

            <Text style={styles.modalLabel}>Efectivo recibido:</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={efectivoRecibido}
              onChangeText={setEfectivoRecibido}
              placeholder="0.00"
            />

            {efectivoRecibido && (
              <Text style={styles.modalCambio}>
                Cambio: ${(Math.max(0, parseFloat(efectivoRecibido) - total)).toFixed(2)}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancelar]}
                onPress={() => {
                  setMostrarPago(false);
                  setEfectivoRecibido('');
                }}
              >
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnAceptar]}
                onPress={realizarVenta}
              >
                <Text style={styles.modalBtnAceptarText}>Completar Venta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Escaner de codigo de barras */}
      <BarcodeScanner
        visible={mostrarEscaner}
        onScan={handleBarcodeScan}
        onClose={() => setMostrarEscaner(false)}
        titulo="Escanear producto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    paddingTop: 48,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  headerStatusText: {
    color: '#fff',
    fontSize: 14,
  },
  btnAbrirCaja: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  btnAbrirCajaText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 12,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  btnEscanear: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnEscanearText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  productosGrid: {
    padding: 8,
  },
  productoCard: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 4,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  productoPrecio: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginTop: 4,
  },
  productoStock: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  stockBajo: {
    color: '#dc2626',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  carritoContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    maxHeight: 300,
  },
  carritoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  carritoTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  carritoTotal: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#2563eb',
  },
  carritoList: {
    maxHeight: 150,
  },
  carritoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  carritoInfo: {
    flex: 1,
  },
  carritoNombre: {
    fontSize: 14,
    fontWeight: '500',
  },
  carritoPrecio: {
    fontSize: 12,
    color: '#666',
  },
  carritoCantidad: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnCantidad: {
    width: 28,
    height: 28,
    backgroundColor: '#e5e5e5',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCantidadText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cantidadText: {
    marginHorizontal: 8,
    fontSize: 14,
  },
  carritoSubtotal: {
    marginHorizontal: 12,
    fontWeight: '600',
    fontSize: 14,
  },
  btnQuitar: {
    color: '#dc2626',
    fontSize: 16,
    padding: 4,
  },
  btnCobrar: {
    backgroundColor: '#16a34a',
    margin: 12,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCobrarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2563eb',
    marginVertical: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    textAlign: 'center',
  },
  modalCambio: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalBtnCancelar: {
    backgroundColor: '#f5f5f5',
  },
  modalBtnCancelarText: {
    color: '#666',
    fontWeight: '600',
  },
  modalBtnAceptar: {
    backgroundColor: '#16a34a',
  },
  modalBtnAceptarText: {
    color: '#fff',
    fontWeight: '600',
  },
});