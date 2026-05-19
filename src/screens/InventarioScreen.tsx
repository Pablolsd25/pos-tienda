import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, TextInput, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

  const generarPDF = async () => {
    try {
      const fecha = new Date().toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      const productosConStock = productos.filter(p => p.activo !== false);

      const totalCosto = productosConStock.reduce((acc, p) => acc + p.stock_actual * p.costo, 0);
      const totalVenta = productosConStock.reduce((acc, p) => acc + p.stock_actual * p.precio, 0);
      const totalUnidades = productosConStock.reduce((acc, p) => acc + p.stock_actual, 0);

      const filas = productosConStock
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((p, i) => {
          const subtotalVenta = p.stock_actual * p.precio;
          const stockBajo = p.stock_actual <= p.stock_minimo;
          const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          const stockColor = stockBajo ? '#dc2626' : '#1a1a1a';
          return `
            <tr style="background:${rowBg}">
              <td style="padding:8px 10px;color:#666;font-size:12px;">${i + 1}</td>
              <td style="padding:8px 10px;font-weight:600;">${p.nombre}</td>
              <td style="padding:8px 10px;color:#555;font-size:13px;">${getCategoriaNombre(p.categoria_id)}</td>
              <td style="padding:8px 10px;text-align:center;font-weight:700;font-size:16px;color:${stockColor};">${p.stock_actual}</td>
              <td style="padding:8px 10px;text-align:right;">$${p.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              <td style="padding:8px 10px;text-align:right;color:#16a34a;font-weight:600;">$${subtotalVenta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>`;
        })
        .join('');

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte de Inventario</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
    .titulo { font-size: 26px; font-weight: 800; color: #2563eb; }
    .subtitulo { font-size: 13px; color: #666; margin-top: 4px; }
    .fecha { font-size: 13px; color: #666; text-align: right; }
    .kpis { display: flex; gap: 12px; margin-bottom: 24px; }
    .kpi { flex: 1; background: #f0f9ff; border-radius: 8px; padding: 14px 16px; border-left: 4px solid #2563eb; }
    .kpi.rojo { background: #fff5f5; border-left-color: #dc2626; }
    .kpi.verde { background: #f0fdf4; border-left-color: #16a34a; }
    .kpi-valor { font-size: 22px; font-weight: 800; color: #2563eb; }
    .kpi.rojo .kpi-valor { color: #dc2626; }
    .kpi.verde .kpi-valor { color: #16a34a; }
    .kpi-label { font-size: 11px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { background: #2563eb; color: white; }
    thead th { padding: 10px; text-align: left; font-weight: 600; white-space: nowrap; }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    tbody tr:hover { background: #eff6ff !important; }
    tfoot { background: #1e3a5f; color: white; }
    tfoot td { padding: 12px 10px; font-weight: 700; font-size: 14px; }
    tfoot td.right { text-align: right; }
    tfoot td.center { text-align: center; }
    .totales { background: #1e3a5f; color: white; border-radius: 0 0 6px 6px; page-break-inside: avoid; }
    .totales table { font-size: 14px; }
    .totales td { padding: 14px 10px; font-weight: 700; color: white; }
    .totales td.right { text-align: right; }
    .totales td.center { text-align: center; }
    .pie { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="titulo">Reporte de Inventario</div>
      <div class="subtitulo">Stock actual de todos los productos</div>
    </div>
    <div class="fecha">Generado el ${fecha}</div>
  </div>

    <div class="kpis">
    <div class="kpi">
      <div class="kpi-valor">${productosConStock.length}</div>
      <div class="kpi-label">Productos</div>
    </div>
    <div class="kpi">
      <div class="kpi-valor">${totalUnidades.toLocaleString('es-MX')}</div>
      <div class="kpi-label">Unidades totales</div>
    </div>
    <div class="kpi verde">
      <div class="kpi-valor">$${totalVenta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
      <div class="kpi-label">Valor a precio de venta</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Producto</th>
        <th>Categoría</th>
        <th class="center">Cantidad</th>
        <th class="right">P. Venta</th>
        <th class="right">Subtotal Venta</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>

  <div class="totales">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:auto;padding:14px 10px;font-weight:700;color:white;font-size:14px;" colspan="3">TOTALES</td>
        <td class="center" style="width:80px;">${totalUnidades.toLocaleString('es-MX')}</td>
        <td style="width:90px;"></td>
        <td class="right" style="width:130px;">$${totalVenta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>
  </div>

  <div class="pie">
    Reporte generado desde la app POS &bull; ${fecha}
  </div>
</body>
</html>`;

      if (Platform.OS === 'web') {
        // En web: abrir ventana de impresión nativa
        const ventana = window.open('', '_blank');
        if (ventana) {
          ventana.document.write(html);
          ventana.document.close();
          ventana.focus();
          ventana.print();
        }
        return;
      }

      // En iOS/Android: generar PDF y compartir
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const disponible = await Sharing.isAvailableAsync();
      if (disponible) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exportar reporte de inventario',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF generado', `Guardado en:\n${uri}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo generar el PDF');
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
        <TouchableOpacity style={styles.btnPDF} onPress={generarPDF}>
          <Text style={styles.btnPDFText}>Exportar PDF</Text>
        </TouchableOpacity>
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
              keyboardType="decimal-pad"
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
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  btnPDF: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPDFText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
  kpis: { flexDirection: 'row', padding: 12, gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiValor: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  kpiLabel: { fontSize: 12, color: '#6b7280', marginTop: 3, textAlign: 'center' },
  kpiAlerta: { backgroundColor: '#fee2e2' },
  kpiAlertaTexto: { color: '#dc2626' },
  filtros: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  filtroBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  filtroBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filtroBtnText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  filtroBtnTextActive: { color: '#fff' },
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
  sinStock: { backgroundColor: '#fff5f5', borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
  productoDetalle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  productoStock: { alignItems: 'center', minWidth: 64 },
  stockNumero: { fontSize: 30, fontWeight: 'bold', color: '#1f2937' },
  stockBajo: { color: '#dc2626' },
  stockLabel: { fontSize: 13, color: '#6b7280' },
  stockMinimo: { fontSize: 12, color: '#9ca3af' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40, fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: 4 },
  modalProducto: { fontSize: 18, color: '#2563eb', textAlign: 'center', marginTop: 6, fontWeight: '700' },
  modalStock: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 16, marginTop: 4 },
  label: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#111827',
  },
  tipoButtons: { flexDirection: 'row', gap: 8 },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  tipoBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tipoBtnText: { fontWeight: '700', fontSize: 15, color: '#6b7280' },
  tipoBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalBtnCancelar: { backgroundColor: '#f3f4f6' },
  modalBtnCancelarText: { color: '#6b7280', fontWeight: '700', fontSize: 17 },
  modalBtnAceptar: { backgroundColor: '#16a34a' },
  modalBtnAceptarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});