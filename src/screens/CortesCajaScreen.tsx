import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal,
  TextInput, ScrollView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { SesionCaja, Venta, Perfil, CajaMovimiento } from '../types';

type TimelineItem = {
  key: string;
  ts: string;
  hora: string;
  label: string;
  sublabel?: string;
  monto: number;
};

type VentaDetalleResumen = {
  venta_id: string;
  cantidad: number;
  productos: { nombre: string } | null;
};

export default function CortesCajaScreen() {
  const [sesionActual, setSesionActual] = useState<SesionCaja | null>(null);
  const [sesiones, setSesiones] = useState<SesionCaja[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [ventasHoy, setVentasHoy] = useState<Venta[]>([]);
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);
  const [ventaDetalles, setVentaDetalles] = useState<VentaDetalleResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [mostrarApertura, setMostrarApertura] = useState(false);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida'>('entrada');

  // Form fields
  const [montoInicial, setMontoInicial] = useState('');
  const [saldoDeclarado, setSaldoDeclarado] = useState('');
  const [notas, setNotas] = useState('');
  const [montoMov, setMontoMov] = useState('');
  const [motivoMov, setMotivoMov] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Computed totals
  const totalVentas = ventasHoy.reduce((s, v) => s + v.total, 0);
  const totalEntradas = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0);
  const totalSalidas = movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.monto, 0);
  const saldoActual = sesionActual
    ? sesionActual.saldo_inicial + totalVentas + totalEntradas - totalSalidas
    : 0;
  const saldoEsperado = sesionActual
    ? sesionActual.saldo_inicial + totalVentas + totalEntradas - totalSalidas
    : 0;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [sesionesRes, perfilesRes] = await Promise.all([
        supabase.from('sesiones_caja').select('*').order('fecha_apertura', { ascending: false }).limit(30),
        supabase.from('perfiles').select('*').order('nombre'),
      ]);

      setSesiones(sesionesRes.data || []);
      setPerfiles(perfilesRes.data || []);

      if (user) {
        const { data: abierta } = await supabase
          .from('sesiones_caja')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('estado', 'abierta')
          .single();

        setSesionActual(abierta || null);

        if (abierta) {
          const [ventasRes, movsRes] = await Promise.all([
            supabase.from('ventas').select('*').eq('sesion_id', abierta.id).eq('estado', 'completada').order('created_at', { ascending: false }),
            supabase.from('caja_movimientos').select('*').eq('sesion_id', abierta.id).order('created_at', { ascending: false }),
          ]);
          const ventasData = ventasRes.data || [];
          setVentasHoy(ventasData);
          setMovimientos(movsRes.data || []);

          // Cargar nombres de productos por venta
          if (ventasData.length > 0) {
            const ids = ventasData.map(v => v.id);
            const { data: detalles } = await supabase
              .from('venta_detalles')
              .select('venta_id, cantidad, productos(nombre)')
              .in('venta_id', ids);
            setVentaDetalles((detalles as any) || []);
          } else {
            setVentaDetalles([]);
          }
        } else {
          setVentasHoy([]);
          setMovimientos([]);
          setVentaDetalles([]);
        }
      }
    } catch (err) {
      console.error('Error cargando caja:', err);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const showAlert = (titulo: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
    else Alert.alert(titulo, msg);
  };

  const abrirCaja = async () => {
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay sesión activa');

      const saldo = parseFloat(montoInicial) || 0;
      const { error } = await supabase.from('sesiones_caja').insert({
        usuario_id: user.id,
        saldo_inicial: saldo,
        estado: 'abierta',
        fecha_apertura: new Date().toISOString(),
      });
      if (error) throw error;

      setMostrarApertura(false);
      setMontoInicial('');
      loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'No se pudo abrir la caja');
    }
  };

  const cerrarCaja = async () => {
    if (!sesionActual) return;
    setErrorMsg('');

    try {
      // Leer directo de BD (evitar race condition con estado de React)
      const [ventasRes, movsRes] = await Promise.all([
        supabase.from('ventas').select('total').eq('sesion_id', sesionActual.id).eq('estado', 'completada'),
        supabase.from('caja_movimientos').select('tipo,monto').eq('sesion_id', sesionActual.id),
      ]);

      const tvs = ventasRes.data || [];
      const mvs = movsRes.data || [];
      const tvTotal = tvs.reduce((s, v) => s + v.total, 0);
      const entradasTotal = mvs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0);
      const salidasTotal = mvs.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.monto, 0);
      const esperado = sesionActual.saldo_inicial + tvTotal + entradasTotal - salidasTotal;

      const declarado = parseFloat(saldoDeclarado) || 0;
      const diferencia = declarado - esperado;

      const { error } = await supabase.from('sesiones_caja').update({
        estado: 'cerrada',
        saldo_final: declarado,
        fecha_cierre: new Date().toISOString(),
        diferencia,
        notas: notas || null,
      }).eq('id', sesionActual.id);

      if (error) throw error;

      setMostrarCierre(false);
      setSaldoDeclarado('');
      setNotas('');
      setSesionActual(null);
      setVentasHoy([]);
      setMovimientos([]);
      loadData();

      showAlert(
        'Caja cerrada',
        `Esperado en caja: $${esperado.toFixed(2)}\nDeclarado: $${declarado.toFixed(2)}\nDiferencia: ${diferencia >= 0 ? '+' : ''}$${diferencia.toFixed(2)}`
      );
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const registrarMovimiento = async () => {
    if (!sesionActual) return;
    setErrorMsg('');
    const monto = parseFloat(montoMov);
    if (!monto || monto <= 0) {
      setErrorMsg('Escribe un monto mayor a cero');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('caja_movimientos').insert({
        sesion_id: sesionActual.id,
        tipo: tipoMovimiento,
        monto,
        motivo: motivoMov.trim() || null,
        usuario_id: user?.id || null,
      });
      if (error) throw error;
      setMostrarMovimiento(false);
      setMontoMov('');
      setMotivoMov('');
      loadData();
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const getPerfilNombre = (id: string) =>
    perfiles.find(p => p.id === id)?.nombre || '—';

  const formatHora = (ts: string) =>
    new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const formatFecha = (ts: string) =>
    new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const getProductosLabel = (ventaId: string): string => {
    const items = ventaDetalles.filter(d => d.venta_id === ventaId);
    if (items.length === 0) return '';
    const nombres = items.slice(0, 3).map(d => {
      const nombre = d.productos?.nombre || 'Producto';
      const cant = d.cantidad === Math.floor(d.cantidad)
        ? d.cantidad.toString()
        : d.cantidad.toFixed(2);
      return `${nombre} ×${cant}`;
    });
    if (items.length > 3) nombres.push(`+${items.length - 3} más`);
    return nombres.join('  ·  ');
  };

  // Timeline combinado: ventas + movimientos, más reciente primero
  const timeline: TimelineItem[] = [
    ...ventasHoy.map(v => ({
      key: v.id,
      ts: v.created_at,
      hora: formatHora(v.created_at),
      label: 'Venta',
      sublabel: getProductosLabel(v.id),
      monto: v.total,
    })),
    ...movimientos.map(m => ({
      key: m.id,
      ts: m.created_at,
      hora: formatHora(m.created_at),
      label: m.tipo === 'entrada'
        ? `Entrada${m.motivo ? `: ${m.motivo}` : ''}`
        : `Salida${m.motivo ? `: ${m.motivo}` : ''}`,
      monto: m.tipo === 'entrada' ? m.monto : -m.monto,
    })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.cargandoText}>Cargando caja...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Caja</Text>
        <Text style={styles.headerFecha}>
          {new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </View>

      {/* ---------- CAJA ABIERTA ---------- */}
      {sesionActual ? (
        <View style={styles.cajaAbiertaCard}>
          {/* Estado */}
          <View style={styles.cajaEstadoRow}>
            <View style={styles.cajaEstadoBadge}>
              <Text style={styles.cajaEstadoBadgeText}>CAJA ABIERTA</Text>
            </View>
            <Text style={styles.cajaHoraApertura}>
              desde {formatHora(sesionActual.fecha_apertura)}
            </Text>
          </View>

          {/* Monto grande */}
          <Text style={styles.cajaMontoLabel}>Efectivo en caja</Text>
          <Text style={styles.cajaMontoBig}>${saldoActual.toFixed(2)}</Text>

          {/* Desglose */}
          <View style={styles.desgloseContainer}>
            <View style={styles.desgloseRow}>
              <Text style={styles.desgloseLabel}>Saldo inicial</Text>
              <Text style={styles.desgloseValor}>${sesionActual.saldo_inicial.toFixed(2)}</Text>
            </View>
            <View style={styles.desgloseRow}>
              <Text style={styles.desgloseLabel}>Ventas ({ventasHoy.length})</Text>
              <Text style={[styles.desgloseValor, styles.colorVerde]}>+${totalVentas.toFixed(2)}</Text>
            </View>
            {totalEntradas > 0 && (
              <View style={styles.desgloseRow}>
                <Text style={styles.desgloseLabel}>Entradas</Text>
                <Text style={[styles.desgloseValor, styles.colorVerde]}>+${totalEntradas.toFixed(2)}</Text>
              </View>
            )}
            {totalSalidas > 0 && (
              <View style={styles.desgloseRow}>
                <Text style={styles.desgloseLabel}>Salidas</Text>
                <Text style={[styles.desgloseValor, styles.colorRojo]}>-${totalSalidas.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {/* Botones de movimiento */}
          <View style={styles.botonesMovRow}>
            <TouchableOpacity
              style={[styles.btnMov, styles.btnEntrada]}
              onPress={() => { setTipoMovimiento('entrada'); setErrorMsg(''); setMostrarMovimiento(true); }}
            >
              <Text style={styles.btnMovText}>+ Entrada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnMov, styles.btnSalida]}
              onPress={() => { setTipoMovimiento('salida'); setErrorMsg(''); setMostrarMovimiento(true); }}
            >
              <Text style={styles.btnMovText}>- Salida</Text>
            </TouchableOpacity>
          </View>

          {/* Cerrar caja */}
          <TouchableOpacity
            style={styles.btnCerrarCaja}
            onPress={() => { setErrorMsg(''); setMostrarCierre(true); }}
          >
            <Text style={styles.btnCerrarCajaText}>Cerrar Caja</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ---------- SIN CAJA ---------- */
        <View style={styles.sinCajaCard}>
          <Text style={styles.sinCajaIcon}>🔒</Text>
          <Text style={styles.sinCajaTexto}>Caja cerrada</Text>
          <Text style={styles.sinCajaSubtexto}>Abre la caja para registrar ventas</Text>
          <TouchableOpacity
            style={styles.btnAbrirCaja}
            onPress={() => { setErrorMsg(''); setMostrarApertura(true); }}
          >
            <Text style={styles.btnAbrirCajaText}>Abrir Caja</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- MOVIMIENTOS DEL DÍA ---------- */}
      {timeline.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Movimientos de hoy</Text>
          {timeline.map(item => (
            <View key={item.key} style={styles.timelineRow}>
              <View style={[styles.timelineDot, item.monto >= 0 ? styles.dotVerde : styles.dotRojo]} />
              <View style={styles.timelineInfo}>
                <Text style={styles.timelineHora}>{item.hora}</Text>
                <Text style={styles.timelineLabel}>{item.label}</Text>
                {item.sublabel ? (
                  <Text style={styles.timelineSublabel}>{item.sublabel}</Text>
                ) : null}
              </View>
              <Text style={[styles.timelineMonto, item.monto >= 0 ? styles.colorVerde : styles.colorRojo]}>
                {item.monto >= 0 ? '+' : ''}${Math.abs(item.monto).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ---------- BOTÓN HISTORIAL ---------- */}
      <TouchableOpacity
        style={styles.btnHistorial}
        onPress={() => setMostrarHistorial(true)}
      >
        <Text style={styles.btnHistorialText}>Ver historial de cajas</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* ============ MODAL: ABRIR CAJA ============ */}
      <Modal visible={mostrarApertura} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Abrir Caja</Text>
            <Text style={styles.modalSubtitulo}>¿Cuánto efectivo hay en la caja al empezar?</Text>

            <Text style={styles.modalLabel}>Monto inicial</Text>
            <TextInput
              style={styles.modalInput}
              value={montoInicial}
              onChangeText={setMontoInicial}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              autoFocus
            />
            <Text style={styles.modalHint}>Deja en 0 si no hay efectivo inicial.</Text>

            {errorMsg !== '' && <Text style={styles.errorText}>{errorMsg}</Text>}

            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancelar]}
                onPress={() => { setMostrarApertura(false); setMontoInicial(''); setErrorMsg(''); }}
              >
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirmar]} onPress={abrirCaja}>
                <Text style={styles.modalBtnConfirmarText}>Abrir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ MODAL: REGISTRAR MOVIMIENTO ============ */}
      <Modal visible={mostrarMovimiento} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>
              {tipoMovimiento === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
            </Text>
            <Text style={styles.modalSubtitulo}>
              {tipoMovimiento === 'entrada'
                ? 'Dinero que entra a la caja (ej. fondo extra, préstamo).'
                : 'Dinero que sale de la caja (ej. retiro, pago de proveedor).'}
            </Text>

            <Text style={styles.modalLabel}>Monto</Text>
            <TextInput
              style={styles.modalInput}
              value={montoMov}
              onChangeText={setMontoMov}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              autoFocus
            />

            <Text style={styles.modalLabel}>Motivo (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              value={motivoMov}
              onChangeText={setMotivoMov}
              placeholder="ej. retiro para gastos"
            />

            {errorMsg !== '' && <Text style={styles.errorText}>{errorMsg}</Text>}

            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancelar]}
                onPress={() => { setMostrarMovimiento(false); setMontoMov(''); setMotivoMov(''); setErrorMsg(''); }}
              >
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, tipoMovimiento === 'entrada' ? styles.modalBtnVerde : styles.modalBtnRojo]}
                onPress={registrarMovimiento}
              >
                <Text style={styles.modalBtnConfirmarText}>Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ MODAL: CERRAR CAJA ============ */}
      <Modal visible={mostrarCierre} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>Cerrar Caja</Text>

              {/* Resumen calculado */}
              <View style={styles.resumenCierre}>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Saldo inicial</Text>
                  <Text style={styles.resumenValor}>${sesionActual?.saldo_inicial.toFixed(2)}</Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Ventas ({ventasHoy.length})</Text>
                  <Text style={[styles.resumenValor, styles.colorVerde]}>+${totalVentas.toFixed(2)}</Text>
                </View>
                {totalEntradas > 0 && (
                  <View style={styles.resumenRow}>
                    <Text style={styles.resumenLabel}>Entradas</Text>
                    <Text style={[styles.resumenValor, styles.colorVerde]}>+${totalEntradas.toFixed(2)}</Text>
                  </View>
                )}
                {totalSalidas > 0 && (
                  <View style={styles.resumenRow}>
                    <Text style={styles.resumenLabel}>Salidas</Text>
                    <Text style={[styles.resumenValor, styles.colorRojo]}>-${totalSalidas.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.resumenRow, styles.resumenTotalRow]}>
                  <Text style={styles.resumenTotalLabel}>Esperado en caja</Text>
                  <Text style={styles.resumenTotalValor}>${saldoEsperado.toFixed(2)}</Text>
                </View>
              </View>

              <Text style={styles.modalLabel}>¿Cuánto hay físicamente en la caja?</Text>
              <TextInput
                style={styles.modalInput}
                value={saldoDeclarado}
                onChangeText={setSaldoDeclarado}
                keyboardType="decimal-pad"
                placeholder={`$${saldoEsperado.toFixed(2)}`}
              />

              {saldoDeclarado !== '' && (() => {
                const dif = parseFloat(saldoDeclarado) - saldoEsperado;
                return (
                  <Text style={[styles.difText, dif >= 0 ? styles.colorVerde : styles.colorRojo]}>
                    {dif >= 0 ? 'Sobrante: +' : 'Faltante: '}${Math.abs(dif).toFixed(2)}
                  </Text>
                );
              })()}

              <Text style={styles.modalLabel}>Notas (opcional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputMulti]}
                value={notas}
                onChangeText={setNotas}
                placeholder="Observaciones del corte..."
                multiline
                numberOfLines={3}
              />

              {errorMsg !== '' && <Text style={styles.errorText}>{errorMsg}</Text>}

              <View style={styles.modalBotones}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancelar]}
                  onPress={() => { setMostrarCierre(false); setSaldoDeclarado(''); setNotas(''); setErrorMsg(''); }}
                >
                  <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnRojo]} onPress={cerrarCaja}>
                  <Text style={styles.modalBtnConfirmarText}>Confirmar Cierre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ============ MODAL: HISTORIAL ============ */}
      <Modal visible={mostrarHistorial} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.historialModalHeader}>
              <Text style={styles.modalTitulo}>Historial de Cajas</Text>
              <TouchableOpacity onPress={() => setMostrarHistorial(false)}>
                <Text style={styles.historialModalCerrar}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {sesiones.length === 0 ? (
                <Text style={styles.emptyText}>Sin historial</Text>
              ) : (
                sesiones.map(s => (
                  <View key={s.id} style={styles.historialCard}>
                    <View style={styles.historialLeft}>
                      <Text style={styles.historialUsuario}>{getPerfilNombre(s.usuario_id)}</Text>
                      <Text style={styles.historialFecha}>
                        {formatFecha(s.fecha_apertura)}
                        {s.fecha_cierre ? ` → ${formatFecha(s.fecha_cierre)}` : ''}
                      </Text>
                      <Text style={styles.historialSaldos}>
                        Inicio: ${s.saldo_inicial.toFixed(2)}
                        {s.saldo_final != null ? `  |  Cierre: $${s.saldo_final.toFixed(2)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.historialRight}>
                      <Text style={[styles.historialBadge, s.estado === 'abierta' ? styles.badgeAbierta : styles.badgeCerrada]}>
                        {s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                      </Text>
                      {s.diferencia != null && (
                        <Text style={[styles.historialDif, s.diferencia >= 0 ? styles.colorVerde : styles.colorRojo]}>
                          {s.diferencia >= 0 ? '+' : ''}${s.diferencia.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cargandoText: { marginTop: 12, color: '#666' },

  // Header
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerFecha: { color: '#bfdbfe', fontSize: 14 },

  // Caja abierta card
  cajaAbiertaCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderTopWidth: 4,
    borderTopColor: '#16a34a',
  },
  cajaEstadoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cajaEstadoBadge: { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginRight: 10 },
  cajaEstadoBadgeText: { color: '#16a34a', fontWeight: 'bold', fontSize: 12 },
  cajaHoraApertura: { color: '#6b7280', fontSize: 13 },
  cajaMontoLabel: { color: '#6b7280', fontSize: 14, marginBottom: 4 },
  cajaMontoBig: { fontSize: 44, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  desgloseContainer: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 16 },
  desgloseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  desgloseLabel: { color: '#6b7280', fontSize: 14 },
  desgloseValor: { fontSize: 14, fontWeight: '600', color: '#111827' },

  botonesMovRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btnMov: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnEntrada: { backgroundColor: '#dcfce7' },
  btnSalida: { backgroundColor: '#fee2e2' },
  btnMovText: { fontWeight: 'bold', fontSize: 15, color: '#111827' },

  btnCerrarCaja: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCerrarCajaText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Sin caja
  sinCajaCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sinCajaIcon: { fontSize: 48, marginBottom: 12 },
  sinCajaTexto: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginBottom: 6 },
  sinCajaSubtexto: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  btnAbrirCaja: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnAbrirCajaText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Secciones
  seccion: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12 },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 4 },
  dotVerde: { backgroundColor: '#16a34a' },
  dotRojo: { backgroundColor: '#dc2626' },
  timelineInfo: { flex: 1 },
  timelineHora: { fontSize: 12, color: '#9ca3af' },
  timelineLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  timelineSublabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  timelineMonto: { fontSize: 15, fontWeight: 'bold', marginLeft: 8 },

  // Botón historial
  btnHistorial: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    alignItems: 'center',
  },
  btnHistorialText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },

  // Historial modal
  historialModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  historialModalCerrar: { fontSize: 20, color: '#9ca3af', paddingHorizontal: 8 },

  // Historial cards
  historialCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historialLeft: { flex: 1 },
  historialUsuario: { fontSize: 15, fontWeight: '600', color: '#111827' },
  historialFecha: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  historialSaldos: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  historialRight: { alignItems: 'flex-end', justifyContent: 'center' },
  historialBadge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeAbierta: { backgroundColor: '#dcfce7', color: '#16a34a' },
  badgeCerrada: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  historialDif: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },

  emptyText: { color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },

  // Colores
  colorVerde: { color: '#16a34a' },
  colorRojo: { color: '#dc2626' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  modalSubtitulo: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    color: '#111827',
  },
  modalInputMulti: { height: 80, textAlignVertical: 'top' },
  modalHint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  // Resumen cierre
  resumenCierre: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, marginBottom: 4 },
  resumenRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  resumenLabel: { color: '#6b7280', fontSize: 14 },
  resumenValor: { fontSize: 14, fontWeight: '600' },
  resumenTotalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 },
  resumenTotalLabel: { fontWeight: 'bold', color: '#111827', fontSize: 15 },
  resumenTotalValor: { fontWeight: 'bold', color: '#111827', fontSize: 16 },

  difText: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  errorText: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },

  // Botones modal
  modalBotones: { flexDirection: 'row', marginTop: 20, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnCancelar: { backgroundColor: '#f3f4f6' },
  modalBtnCancelarText: { color: '#6b7280', fontWeight: '600' },
  modalBtnConfirmar: { backgroundColor: '#2563eb' },
  modalBtnVerde: { backgroundColor: '#16a34a' },
  modalBtnRojo: { backgroundColor: '#dc2626' },
  modalBtnConfirmarText: { color: '#fff', fontWeight: 'bold' },
});
