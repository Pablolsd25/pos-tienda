import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, Modal, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import type { Producto, CarritoItem, SesionCaja, Categoria, Cliente } from '../types';

// ─── Paleta ────────────────────────────────────────────────────────────────────
const VERDE   = '#16a34a';
const ROJO    = '#dc2626';
const OSCURO  = '#0f172a';
const GRIS    = '#64748b';
const BG      = '#f1f5f9';

// Un color diferente por cada categoría cargada
const CAT_COLORS = [
  '#f59e0b', // amber   – Galletas y Botanas
  '#3b82f6', // blue    – Bebidas
  '#ec4899', // pink    – Dulces y Chicles
  '#10b981', // emerald – Abarrotes
  '#06b6d4', // cyan    – Limpieza e Higiene
  '#8b5cf6', // violet  – Varios
  '#ef4444', // red
  '#f97316', // orange
];

export default function POSScreen() {
  const [productos, setProductos]               = useState<Producto[]>([]);
  const [categorias, setCategorias]             = useState<Categoria[]>([]);
  const [carrito, setCarrito]                   = useState<CarritoItem[]>([]);
  const [busqueda, setBusqueda]                 = useState('');
  const [cargando, setCargando]                 = useState(true);
  const [sesionActual, setSesionActual]         = useState<SesionCaja | null>(null);
  const [mostrarPago, setMostrarPago]           = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [errorVenta, setErrorVenta]             = useState('');
  const [categoriaFiltro, setCategoriaFiltro]   = useState<number | null>(null);
  const [mostrarEscaner, setMostrarEscaner]     = useState(false);
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
  const [precioEditando, setPrecioEditando]     = useState('');
  const [carritoAbierto, setCarritoAbierto]     = useState(false);

  // ── Fiado ──
  const [modoPago, setModoPago]                 = useState<'efectivo' | 'fiado'>('efectivo');
  const [clientes, setClientes]                 = useState<Cliente[]>([]);
  const [clienteFiado, setClienteFiado]         = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente]   = useState('');
  const [mostrarSelector, setMostrarSelector]   = useState(false);

  // ─── Color por categoría ────────────────────────────────────────────────────
  const getCatColor = (catId: number | null): string => {
    if (!catId) return '#94a3b8';
    const idx = categorias.findIndex(c => c.id === catId);
    return CAT_COLORS[idx >= 0 ? idx % CAT_COLORS.length : 0];
  };

  // ─── Carga ──────────────────────────────────────────────────────────────────
  const loadProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('productos').select('*').eq('activo', true).order('nombre');
      if (error) throw error;
      setProductos(data || []);
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  }, []);

  const loadCategorias = useCallback(async () => {
    const { data } = await supabase.from('categorias').select('*').order('nombre');
    setCategorias(data || []);
  }, []);

  const loadSesion = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('sesiones_caja').select('*')
        .eq('usuario_id', user.id).eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false }).limit(1).single();
      setSesionActual(data || null);
    } catch { setSesionActual(null); }
  }, []);

  useEffect(() => {
    loadClientes();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProductos(); loadCategorias(); loadSesion();
    }, [loadProductos, loadCategorias, loadSesion])
  );

  const loadClientes = async () => {
    const { data } = await supabase
      .from('clientes').select('*').eq('activo', true).order('nombre');
    setClientes(data || []);
  };

  // ─── Filtros ────────────────────────────────────────────────────────────────
  const productosFiltrados = productos.filter(p => {
    const textoOk = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.codigo_barra ?? '').includes(busqueda);
    const catOk = categoriaFiltro ? p.categoria_id === categoriaFiltro : true;
    return textoOk && catOk;
  });

  // ─── Escáner ─────────────────────────────────────────────────────────────────
  const handleBarcodeScan = async (codigo: string) => {
    setMostrarEscaner(false);
    const c = codigo.trim();
    const local = productos.find(p => p.codigo_barra?.trim() === c);
    if (local) { agregarAlCarrito(local); Alert.alert('Agregado', local.nombre); return; }
    try {
      const { data } = await supabase
        .from('productos').select('*').eq('codigo_barra', c).eq('activo', true).maybeSingle();
      if (data) {
        setProductos(prev => prev.find(p => p.id === data.id) ? prev : [...prev, data]);
        agregarAlCarrito(data);
        Alert.alert('Agregado', data.nombre);
      } else {
        setBusqueda(c);
        Alert.alert('No encontrado', `Código: ${c}`);
      }
    } catch { Alert.alert('Error', 'No se pudo consultar la base de datos.'); }
  };

  // ─── Carrito ─────────────────────────────────────────────────────────────────
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.producto.id === producto.id);
      if (ex) return prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { producto, cantidad: 1 }];
    });
    setCarritoAbierto(true); // abre el carrito al agregar
  };

  const actualizarCantidad = (id: string, delta: number) => {
    setCarrito(prev =>
      prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)
          .filter(i => i.cantidad > 0)
    );
  };

  const quitarItem = (id: string) => setCarrito(prev => prev.filter(i => i.producto.id !== id));

  const aplicarPrecioCustom = (id: string) => {
    const n = parseFloat(precioEditando);
    if (!isNaN(n) && n >= 0)
      setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, precioCustom: n } : i));
    setEditandoPrecioId(null); setPrecioEditando('');
  };

  const total = carrito.reduce((s, i) => s + (i.precioCustom ?? i.producto.precio) * i.cantidad, 0);

  // ─── Venta ───────────────────────────────────────────────────────────────────
  const realizarVenta = async () => {
    setErrorVenta('');
    if (carrito.length === 0) { setErrorVenta('El carrito está vacío'); return; }
    if (!sesionActual) { setErrorVenta('No hay caja abierta. Ve a la pestaña Caja.'); return; }
    if (modoPago === 'fiado' && !clienteFiado) { setErrorVenta('Selecciona un cliente para el fiado'); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin usuario autenticado');
      const esFiado  = modoPago === 'fiado';
      const efectivo = esFiado ? 0 : (parseFloat(efectivoRecibido) || 0);
      const cambio   = esFiado ? 0 : Math.max(0, efectivo - total);
      const { data: venta, error: ve } = await supabase
        .from('ventas').insert({
          sesion_id: sesionActual.id, usuario_id: user.id,
          subtotal: total, descuento: 0, total, efectivo, cambio,
          metodo_pago: esFiado ? 'mixto' : (efectivo > 0 ? 'efectivo' : 'tarjeta'),
          estado: 'completada',
          nota: esFiado ? `Fiado: ${clienteFiado?.nombre}` : null,
        }).select().single();
      if (ve) throw ve;
      for (const item of carrito) {
        const pu = item.precioCustom ?? item.producto.precio;
        await supabase.from('venta_detalles').insert({
          venta_id: venta.id, producto_id: item.producto.id,
          cantidad: item.cantidad, precio_unitario: pu, subtotal: pu * item.cantidad,
        });
        if (item.producto.tipo === 'producto') {
          await supabase.from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);
          await supabase.from('inventario_movimientos').insert({
            producto_id: item.producto.id, tipo: 'venta',
            cantidad: -item.cantidad, motivo: `Venta #${venta.id.slice(0, 8)}`, usuario_id: user.id,
          });
        }
      }
      // Si es fiado → crear registro en tabla fiados
      if (esFiado && clienteFiado) {
        const descripcion = carrito
          .map(i => `${i.cantidad > 1 ? i.cantidad + 'x ' : ''}${i.producto.nombre}`)
          .join(', ');
        await supabase.from('fiados').insert({
          cliente_id: clienteFiado.id,
          venta_id: venta.id,
          monto: total,
          abonado: 0,
          estado: 'pendiente',
          nota: descripcion,
        });
      }
      // Reset
      setCarrito([]); setMostrarPago(false); setEfectivoRecibido('');
      setCarritoAbierto(false); setModoPago('efectivo');
      setClienteFiado(null); setBusquedaCliente('');
      loadProductos();
      const msg = esFiado
        ? `Fiado registrado a ${clienteFiado?.nombre}\nTotal: $${total.toFixed(2)}`
        : `Venta completada\nCambio: $${cambio.toFixed(2)}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Listo', msg);
    } catch (err: any) {
      setErrorVenta(err?.message || JSON.stringify(err) || 'Error desconocido');
    }
  };

  // ─── Render producto (3 columnas, compacto) ───────────────────────────────────
  const renderProducto = ({ item }: { item: Producto }) => {
    const sinStock   = item.tipo === 'producto' && item.stock_actual === 0;
    const sinPrecio  = item.precio === 0;
    const catColor   = getCatColor(item.categoria_id);

    return (
      <TouchableOpacity
        style={[styles.card, { borderTopColor: catColor, borderTopWidth: 3 }]}
        onPress={() => agregarAlCarrito(item)}
        activeOpacity={0.65}
      >
        {sinStock && (
          <View style={styles.agotadoBadge}>
            <Text style={styles.agotadoText}>Agotado</Text>
          </View>
        )}
        <Text style={styles.cardNombre} numberOfLines={2}>
          {item.nombre}
        </Text>
        <Text style={[
          styles.cardPrecio,
          sinPrecio && styles.cardPrecioLibre,
        ]}>
          {sinPrecio ? 'Precio libre' : `$${item.precio.toFixed(2)}`}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Render item carrito ──────────────────────────────────────────────────────
  const renderCarritoItem = ({ item }: { item: CarritoItem }) => {
    const precio   = item.precioCustom ?? item.producto.precio;
    const editando = editandoPrecioId === item.producto.id;
    return (
      <View style={styles.ciRow}>
        <TouchableOpacity style={styles.ciQuitar} onPress={() => quitarItem(item.producto.id)}>
          <Text style={styles.ciQuitarText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.ciInfo}>
          <Text style={styles.ciNombre} numberOfLines={1}>{item.producto.nombre}</Text>
          {editando ? (
            <TextInput
              style={styles.ciPrecioInput}
              value={precioEditando} onChangeText={setPrecioEditando}
              keyboardType="decimal-pad" autoFocus selectTextOnFocus
              onBlur={() => aplicarPrecioCustom(item.producto.id)}
              onSubmitEditing={() => aplicarPrecioCustom(item.producto.id)}
            />
          ) : (
            <TouchableOpacity onPress={() => { setEditandoPrecioId(item.producto.id); setPrecioEditando(precio.toString()); }}>
              <Text style={[styles.ciPrecio, item.precioCustom !== undefined && styles.ciPrecioEditado]}>
                ${precio.toFixed(2)}{item.precioCustom !== undefined ? ' ✎' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.ciControles}>
          <TouchableOpacity style={styles.ciBtn} onPress={() => actualizarCantidad(item.producto.id, -1)}>
            <Text style={styles.ciBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.ciCant}>{item.cantidad}</Text>
          <TouchableOpacity style={styles.ciBtn} onPress={() => actualizarCantidad(item.producto.id, 1)}>
            <Text style={styles.ciBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.ciSub}>${(precio * item.cantidad).toFixed(2)}</Text>
      </View>
    );
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Punto de Venta</Text>
        <View style={[styles.cajaBadge, sesionActual ? styles.cajaBadgeOpen : styles.cajaBadgeClosed]}>
          <Text style={styles.cajaBadgeText}>{sesionActual ? '● Caja abierta' : '● Caja cerrada'}</Text>
        </View>
      </View>

      {/* BÚSQUEDA */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto..."
          placeholderTextColor="#94a3b8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity style={styles.btnScan} onPress={() => setMostrarEscaner(true)}>
          <Text style={styles.btnScanIcon}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* CATEGORÍAS */}
      {categorias.length > 0 && (
        <View style={styles.catBarWrapper}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.catBar} contentContainerStyle={styles.catBarContent}
          >
          {/* Todos */}
          <TouchableOpacity
            style={[styles.catPill, categoriaFiltro === null && styles.catPillActive]}
            onPress={() => setCategoriaFiltro(null)}
          >
            <Text style={[styles.catPillText, categoriaFiltro === null && styles.catPillTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {categorias.map((cat, idx) => {
            const color = CAT_COLORS[idx % CAT_COLORS.length];
            const active = categoriaFiltro === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catPill, active ? { backgroundColor: color, borderColor: color } : { borderColor: color }]}
                onPress={() => setCategoriaFiltro(active ? null : cat.id)}
              >
                <Text style={[styles.catPillText, active ? styles.catPillTextActive : { color }]}>
                  {cat.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
      )}

      {/* GRID DE PRODUCTOS — 3 columnas */}
      <FlatList
        data={productosFiltrados}
        renderItem={renderProducto}
        keyExtractor={item => item.id}
        numColumns={3}
        key="3col"
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{cargando ? 'Cargando...' : 'No hay productos'}</Text>
        }
      />

      {/* CARRITO (barra fija + lista desplegable) */}
      {carrito.length > 0 && (
        <View style={styles.carritoWrapper}>
          {/* Items del carrito — desplegable */}
          {carritoAbierto && (
            <View style={styles.carritoLista}>
              <FlatList
                data={carrito}
                renderItem={renderCarritoItem}
                keyExtractor={i => i.producto.id}
                style={{ maxHeight: 220 }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {/* Barra inferior fija */}
          <View style={styles.carritoBarra}>
            <TouchableOpacity
              style={styles.carritoToggle}
              onPress={() => setCarritoAbierto(p => !p)}
            >
              <Text style={styles.carritoToggleIcon}>{carritoAbierto ? '▼' : '▲'}</Text>
              <Text style={styles.carritoToggleLabel}>
                {carrito.length} {carrito.length === 1 ? 'artículo' : 'artículos'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnCobrar, !sesionActual && styles.btnCobrarOff]}
              onPress={() => {
                if (!sesionActual) { Alert.alert('Caja cerrada', 'Ve a la pestaña Caja y ábrela.'); return; }
                setMostrarPago(true);
              }}
            >
              <Text style={styles.btnCobrarText}>Cobrar  ${total.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL PAGO */}
      <Modal visible={mostrarPago} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Finalizar Venta</Text>

            {/* Total */}
            <View style={styles.modalTotalBox}>
              <Text style={styles.modalTotalLabel}>Total a cobrar</Text>
              <Text style={styles.modalTotalValor}>${total.toFixed(2)}</Text>
            </View>

            {/* Toggle Efectivo / Fiado */}
            <View style={styles.modoPagoRow}>
              <TouchableOpacity
                style={[styles.modoPagoBtn, modoPago === 'efectivo' && styles.modoPagoBtnActive]}
                onPress={() => setModoPago('efectivo')}
              >
                <Text style={[styles.modoPagoBtnText, modoPago === 'efectivo' && styles.modoPagoBtnTextActive]}>
                  Efectivo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modoPagoBtn, modoPago === 'fiado' && { ...styles.modoPagoBtnActive, backgroundColor: ROJO, borderColor: ROJO }]}
                onPress={() => setModoPago('fiado')}
              >
                <Text style={[styles.modoPagoBtnText, modoPago === 'fiado' && styles.modoPagoBtnTextActive]}>
                  Fiado
                </Text>
              </TouchableOpacity>
            </View>

            {/* Efectivo: campo de monto */}
            {modoPago === 'efectivo' && (
              <>
                <Text style={styles.modalLabel}>Efectivo recibido</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="decimal-pad"
                  value={efectivoRecibido}
                  onChangeText={setEfectivoRecibido}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                />
                {efectivoRecibido !== '' && (
                  <View style={styles.modalCambioBox}>
                    <Text style={styles.modalCambioLabel}>Cambio</Text>
                    <Text style={styles.modalCambioValor}>
                      ${Math.max(0, parseFloat(efectivoRecibido || '0') - total).toFixed(2)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Fiado: selector de cliente */}
            {modoPago === 'fiado' && (
              <>
                <Text style={styles.modalLabel}>Cliente que fía</Text>
                <TouchableOpacity
                  style={[styles.modalInput, { justifyContent: 'center' }]}
                  onPress={() => setMostrarSelector(true)}
                >
                  <Text style={{ color: clienteFiado ? '#0f172a' : '#94a3b8', fontSize: 15 }}>
                    {clienteFiado ? clienteFiado.nombre : 'Seleccionar cliente...'}
                  </Text>
                </TouchableOpacity>
                {!clienteFiado && (
                  <Text style={styles.fiadoHint}>
                    Si es cliente nuevo, agrégalo primero en la pestaña Fiados.
                  </Text>
                )}
              </>
            )}

            {/* Error */}
            {errorVenta !== '' && (
              <Text style={styles.modalError}>{errorVenta}</Text>
            )}

            {/* Botones */}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => {
                  setMostrarPago(false); setEfectivoRecibido(''); setErrorVenta('');
                  setModoPago('efectivo'); setClienteFiado(null); setBusquedaCliente('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: GRIS }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: modoPago === 'fiado' ? ROJO : VERDE }]}
                onPress={realizarVenta}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {modoPago === 'fiado' ? 'Registrar fiado' : 'Completar venta'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SELECTOR DE CLIENTE (fiado) */}
      <Modal visible={mostrarSelector} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <Text style={styles.modalTitulo}>Seleccionar cliente</Text>
            <TextInput
              style={[styles.modalInput, { marginBottom: 10 }]}
              placeholder="Buscar..."
              placeholderTextColor="#94a3b8"
              value={busquedaCliente}
              onChangeText={setBusquedaCliente}
              autoFocus
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {clientes
                .filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
                .map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.clienteOpcion}
                    onPress={() => {
                      setClienteFiado(c);
                      setBusquedaCliente('');
                      setMostrarSelector(false);
                    }}
                  >
                    <Text style={styles.clienteOpcionNombre}>{c.nombre}</Text>
                    {c.telefono ? (
                      <Text style={styles.clienteOpcionTel}>{c.telefono}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              {clientes.filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())).length === 0 && (
                <Text style={styles.modalError}>No se encontró el cliente.</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#f1f5f9', marginTop: 10 }]}
              onPress={() => { setMostrarSelector(false); setBusquedaCliente(''); }}
            >
              <Text style={[styles.modalBtnText, { color: GRIS }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ESCÁNER */}
      <BarcodeScanner
        visible={mostrarEscaner}
        onScan={handleBarcodeScan}
        onClose={() => setMostrarEscaner(false)}
        titulo="Escanear producto"
      />
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Header ──
  header: {
    backgroundColor: '#1e40af',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  cajaBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cajaBadgeOpen:   { backgroundColor: '#16a34a' },
  cajaBadgeClosed: { backgroundColor: '#dc2626' },
  cajaBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Búsqueda ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    color: OSCURO,
  },
  btnScan: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnScanIcon: { fontSize: 22 },

  // ── Categorías ──
  catBarWrapper: {
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  catBar: { flex: 1 },
  catBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  catPillActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  catPillText: { fontSize: 13, fontWeight: '600', color: GRIS },
  catPillTextActive: { color: '#fff' },

  // ── Grid 3 columnas ──
  grid: { padding: 6, paddingBottom: 10 },
  card: {
    flex: 1,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    justifyContent: 'space-between',
    // sombra sutil
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  cardNombre: {
    fontSize: 13,
    fontWeight: '700',
    color: OSCURO,
    lineHeight: 17,
    flexShrink: 1,
  },
  cardPrecio: {
    fontSize: 17,
    fontWeight: '900',
    color: VERDE,
    marginTop: 4,
  },
  cardPrecioLibre: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '700',
  },
  agotadoBadge: {
    position: 'absolute',
    top: 4, right: 4,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  agotadoText: { fontSize: 10, fontWeight: '700', color: ROJO },
  emptyText: { textAlign: 'center', color: GRIS, marginTop: 40, fontSize: 16 },

  // ── Carrito wrapper ──
  carritoWrapper: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    // sombra hacia arriba
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 10,
  },

  // Lista items (desplegable)
  carritoLista: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ciRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 8,
  },
  ciQuitar: { padding: 4 },
  ciQuitarText: { color: ROJO, fontSize: 15, fontWeight: '700' },
  ciInfo: { flex: 1 },
  ciNombre: { fontSize: 14, fontWeight: '600', color: OSCURO },
  ciPrecio: { fontSize: 12, color: GRIS, marginTop: 1 },
  ciPrecioEditado: { color: '#f59e0b', fontWeight: '700' },
  ciPrecioInput: {
    fontSize: 14, fontWeight: '700', color: '#1e40af',
    borderBottomWidth: 2, borderBottomColor: '#1e40af',
    minWidth: 70, paddingVertical: 1,
  },
  ciControles: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ciBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  ciBtnText: { fontSize: 18, fontWeight: '700', color: OSCURO, lineHeight: 20 },
  ciCant: { fontSize: 16, fontWeight: '700', color: OSCURO, minWidth: 24, textAlign: 'center' },
  ciSub: { fontSize: 14, fontWeight: '700', color: OSCURO, minWidth: 52, textAlign: 'right' },

  // Barra inferior
  carritoBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    gap: 10,
  },
  carritoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  carritoToggleIcon: { fontSize: 13, color: GRIS },
  carritoToggleLabel: { fontSize: 14, fontWeight: '700', color: OSCURO },
  btnCobrar: {
    flex: 1,
    backgroundColor: VERDE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCobrarOff: { backgroundColor: '#94a3b8' },
  btnCobrarText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

  // ── Modal pago ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalTitulo: { fontSize: 22, fontWeight: '800', color: OSCURO, textAlign: 'center', marginBottom: 16 },
  modalTotalBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTotalLabel: { fontSize: 13, color: GRIS, fontWeight: '600', marginBottom: 4 },
  modalTotalValor: { fontSize: 44, fontWeight: '900', color: '#1e40af' },
  modalLabel: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 8 },
  modalInput: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 28,
    textAlign: 'center',
    color: OSCURO,
    marginBottom: 12,
    backgroundColor: BG,
  },
  modalCambioBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCambioLabel: { fontSize: 13, color: VERDE, fontWeight: '700', marginBottom: 2 },
  modalCambioValor: { fontSize: 34, fontWeight: '900', color: VERDE },
  modalError: {
    backgroundColor: '#fef2f2',
    color: ROJO,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 16, fontWeight: '800' },

  // ── Toggle modo pago ──
  modoPagoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modoPagoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modoPagoBtnActive: {
    backgroundColor: VERDE,
    borderColor: VERDE,
  },
  modoPagoBtnText: { fontSize: 15, fontWeight: '700', color: GRIS },
  modoPagoBtnTextActive: { color: '#fff' },

  fiadoHint: {
    fontSize: 12,
    color: GRIS,
    marginBottom: 10,
    textAlign: 'center',
  },

  // ── Selector cliente ──
  clienteOpcion: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  clienteOpcionNombre: { fontSize: 15, fontWeight: '700', color: OSCURO },
  clienteOpcionTel:    { fontSize: 12, color: GRIS, marginTop: 2 },
});
