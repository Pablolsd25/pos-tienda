import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, Modal, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { Cliente, Fiado } from '../types';

// ─── Paleta ────────────────────────────────────────────────────────────────────
const AZUL   = '#1e40af';
const VERDE  = '#16a34a';
const ROJO   = '#dc2626';
const AMBER  = '#d97706';
const OSCURO = '#0f172a';
const GRIS   = '#64748b';
const BG     = '#f1f5f9';

// ─── Tipos locales ─────────────────────────────────────────────────────────────
interface ClienteConDeuda extends Cliente {
  deuda_total: number;   // suma de (monto - abonado) de fiados pendientes
  fiados: Fiado[];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function FiadosScreen() {

  // ── Estado principal ──────────────────────────────────────────────────────
  const [clientes, setClientes]         = useState<ClienteConDeuda[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [busqueda, setBusqueda]         = useState('');

  // ── Modal nuevo cliente ───────────────────────────────────────────────────
  const [modalCliente, setModalCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre]   = useState('');
  const [nuevoTel, setNuevoTel]         = useState('');
  const [nuevoNota, setNuevoNota]       = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [errorModal, setErrorModal]     = useState('');

  // ── Modal detalle / abono ─────────────────────────────────────────────────
  const [clienteSel, setClienteSel]     = useState<ClienteConDeuda | null>(null);
  const [modalDetalle, setModalDetalle] = useState(false);

  // ── Modal abonar ──────────────────────────────────────────────────────────
  const [modalAbonar, setModalAbonar]   = useState(false);
  const [fiadoSel, setFiadoSel]         = useState<Fiado | null>(null);
  const [montoAbono, setMontoAbono]     = useState('');

  // ── Modal fiado manual ────────────────────────────────────────────────────
  const [modalFiado, setModalFiado]         = useState(false);
  const [montoFiado, setMontoFiado]         = useState('');
  const [descripFiado, setDescripFiado]     = useState('');
  const [notaFiado, setNotaFiado]           = useState('');

  // ─── Carga ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data: cli } = await supabase
        .from('clientes').select('*').eq('activo', true).order('nombre');
      const { data: fds } = await supabase
        .from('fiados').select('*').order('created_at', { ascending: false });

      const result: ClienteConDeuda[] = (cli || []).map(c => {
        const mis = (fds || []).filter(f => f.cliente_id === c.id);
        const deuda = mis
          .filter(f => f.estado === 'pendiente')
          .reduce((s, f) => s + (f.monto - f.abonado), 0);
        return { ...c, deuda_total: deuda, fiados: mis };
      });
      // Primero los que deben algo
      result.sort((a, b) => b.deuda_total - a.deuda_total);
      setClientes(result);
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  }, []);

  useFocusEffect(
    useCallback(() => { cargar(); }, [cargar])
  );

  // ─── Filtro búsqueda ──────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono ?? '').includes(busqueda)
  );

  const totalGeneral = clientes.reduce((s, c) => s + c.deuda_total, 0);

  // ─── Guardar nuevo cliente ────────────────────────────────────────────────
  const guardarCliente = async () => {
    if (!nuevoNombre.trim()) { setErrorModal('El nombre es obligatorio'); return; }
    setGuardando(true);
    setErrorModal('');
    try {
      const { error } = await supabase.from('clientes').insert({
        nombre: nuevoNombre.trim(),
        telefono: nuevoTel.trim() || null,
        notas: nuevoNota.trim() || null,
      });
      if (error) throw error;
      setModalCliente(false);
      setNuevoNombre(''); setNuevoTel(''); setNuevoNota('');
      cargar();
    } catch (e: any) { setErrorModal(e?.message || 'Error al guardar'); }
    finally { setGuardando(false); }
  };

  // ─── Guardar fiado manual ─────────────────────────────────────────────────
  const guardarFiadoManual = async () => {
    const monto = parseFloat(montoFiado);
    if (!clienteSel) return;
    if (!descripFiado.trim()) { setErrorModal('¿Qué se llevó el cliente?'); return; }
    if (isNaN(monto) || monto <= 0) { setErrorModal('Ingresa un monto válido'); return; }
    setGuardando(true);
    setErrorModal('');
    try {
      // Combina descripción + nota extra en el campo 'nota'
      const notaFinal = notaFiado.trim()
        ? `${descripFiado.trim()} — ${notaFiado.trim()}`
        : descripFiado.trim();
      const { error } = await supabase.from('fiados').insert({
        cliente_id: clienteSel.id,
        monto,
        abonado: 0,
        estado: 'pendiente',
        nota: notaFinal,
      });
      if (error) throw error;
      setModalFiado(false);
      setMontoFiado(''); setDescripFiado(''); setNotaFiado('');
      cargar();
      setModalDetalle(false);
    } catch (e: any) {
      setErrorModal(e?.message || 'Error al guardar');
    } finally { setGuardando(false); }
  };

  // ─── Registrar abono ──────────────────────────────────────────────────────
  const registrarAbono = async () => {
    if (!fiadoSel) return;
    const monto = parseFloat(montoAbono);
    const pendiente = fiadoSel.monto - fiadoSel.abonado;
    if (isNaN(monto) || monto <= 0) { Alert.alert('Monto inválido'); return; }
    if (monto > pendiente + 0.001) {
      Alert.alert('El abono supera lo que se debe', `Máximo: $${pendiente.toFixed(2)}`);
      return;
    }
    setGuardando(true);
    try {
      const nuevoAbonado = fiadoSel.abonado + monto;
      const nuevoEstado  = nuevoAbonado >= fiadoSel.monto - 0.001 ? 'pagado' : 'pendiente';
      const { error } = await supabase.from('fiados').update({
        abonado: nuevoAbonado,
        estado: nuevoEstado,
      }).eq('id', fiadoSel.id);
      if (error) throw error;
      setModalAbonar(false);
      setMontoAbono('');
      setFiadoSel(null);
      setModalDetalle(false);
      cargar();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setGuardando(false); }
  };

  // ─── Abonar todo (liquidar) ───────────────────────────────────────────────
  const liquidarFiado = async (fiado: Fiado) => {
    const msg = `¿Marcar como pagado completo?\n$${fiado.monto.toFixed(2)}`;
    const confirmar = () => {
      supabase.from('fiados').update({ abonado: fiado.monto, estado: 'pagado' })
        .eq('id', fiado.id).then(({ error }) => {
          if (error) Alert.alert('Error', error.message);
          else { setModalDetalle(false); cargar(); }
        });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) confirmar();
    } else {
      Alert.alert('Liquidar fiado', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, pagado', onPress: confirmar },
      ]);
    }
  };

  // ─── Color según deuda ────────────────────────────────────────────────────
  const colorDeuda = (deuda: number) => {
    if (deuda <= 0)   return VERDE;
    if (deuda < 100)  return AMBER;
    return ROJO;
  };

  // ─── Iniciales del cliente ────────────────────────────────────────────────
  const iniciales = (nombre: string) =>
    nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER ITEM CLIENTE
  // ─────────────────────────────────────────────────────────────────────────
  const renderCliente = ({ item }: { item: ClienteConDeuda }) => (
    <TouchableOpacity
      style={styles.clienteCard}
      onPress={() => { setClienteSel(item); setModalDetalle(true); }}
      activeOpacity={0.75}
    >
      <View style={[styles.avatar, { backgroundColor: colorDeuda(item.deuda_total) + '22' }]}>
        <Text style={[styles.avatarText, { color: colorDeuda(item.deuda_total) }]}>
          {iniciales(item.nombre)}
        </Text>
      </View>

      <View style={styles.clienteInfo}>
        <Text style={styles.clienteNombre}>{item.nombre}</Text>
        {item.telefono ? (
          <Text style={styles.clienteTel}>{item.telefono}</Text>
        ) : null}
        <Text style={styles.clienteFiadosCount}>
          {item.fiados.filter(f => f.estado === 'pendiente').length} fiado(s) pendiente(s)
        </Text>
      </View>

      <View style={styles.deudaBox}>
        <Text style={[styles.deudaMonto, { color: colorDeuda(item.deuda_total) }]}>
          ${item.deuda_total.toFixed(2)}
        </Text>
        {item.deuda_total <= 0 && (
          <Text style={styles.pagadoLabel}>Al corriente</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────────────────
  //  UI PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fiados</Text>
          <Text style={styles.headerSub}>Cuentas pendientes</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalLabel}>Total debido</Text>
          <Text style={styles.totalMonto}>${totalGeneral.toFixed(2)}</Text>
        </View>
      </View>

      {/* ── BÚSQUEDA + botón nuevo ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
          placeholderTextColor="#94a3b8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity
          style={styles.btnNuevo}
          onPress={() => setModalCliente(true)}
        >
          <Text style={styles.btnNuevoText}>+ Cliente</Text>
        </TouchableOpacity>
      </View>

      {/* ── LISTA CLIENTES ── */}
      <FlatList
        data={clientesFiltrados}
        renderItem={renderCliente}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {cargando ? 'Cargando...' : 'No hay clientes aún.\nPresiona "+ Cliente" para agregar uno.'}
          </Text>
        }
      />

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DETALLE DEL CLIENTE
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalDetalle} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.detalleBox}>

            {/* Encabezado */}
            <View style={styles.detalleHeader}>
              <View>
                <Text style={styles.detalleTitulo}>{clienteSel?.nombre}</Text>
                {clienteSel?.telefono ? (
                  <Text style={styles.detalleTel}>{clienteSel.telefono}</Text>
                ) : null}
              </View>
              <View style={styles.detalleDeudaBox}>
                <Text style={[styles.detalleDeuda, { color: colorDeuda(clienteSel?.deuda_total ?? 0) }]}>
                  ${(clienteSel?.deuda_total ?? 0).toFixed(2)}
                </Text>
                <Text style={styles.detalleDeudaLabel}>pendiente</Text>
              </View>
            </View>

            {/* Botón nuevo fiado manual */}
            <TouchableOpacity
              style={styles.btnFiadoManual}
              onPress={() => setModalFiado(true)}
            >
              <Text style={styles.btnFiadoManualText}>+ Agregar fiado</Text>
            </TouchableOpacity>

            {/* Lista de fiados */}
            <ScrollView style={styles.fiadosList} showsVerticalScrollIndicator={false}>
              {(clienteSel?.fiados ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Sin fiados registrados</Text>
              ) : (
                (clienteSel?.fiados ?? []).map(f => {
                  const pendiente = f.monto - f.abonado;
                  return (
                      <View key={f.id} style={[
                        styles.fiadoRow,
                        f.estado === 'pagado' && styles.fiadoRowPagado,
                      ]}>
                        <View style={styles.fiadoRowLeft}>
                          <Text style={styles.fiadoFecha}>
                            {new Date(f.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', year: '2-digit',
                            })}
                          </Text>
                          {f.nota ? (
                            <Text style={styles.fiadoDescripcion}>{f.nota}</Text>
                          ) : null}
                          <Text style={styles.fiadoAbonado}>
                            Abonado: ${f.abonado.toFixed(2)} / ${f.monto.toFixed(2)}
                          </Text>
                        </View>

                      <View style={styles.fiadoRowRight}>
                        {f.estado === 'pagado' ? (
                          <View style={styles.badgePagado}>
                            <Text style={styles.badgePagadoText}>Pagado</Text>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.fiadoPendiente}>
                              ${pendiente.toFixed(2)}
                            </Text>
                            <TouchableOpacity
                              style={styles.btnAbono}
                              onPress={() => { setFiadoSel(f); setMontoAbono(''); setModalAbonar(true); }}
                            >
                              <Text style={styles.btnAbonoText}>Abonar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.btnLiquidar}
                              onPress={() => liquidarFiado(f)}
                            >
                              <Text style={styles.btnLiquidarText}>Liquidar</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.btnCerrar}
              onPress={() => { setModalDetalle(false); setClienteSel(null); }}
            >
              <Text style={styles.btnCerrarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ABONAR
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalAbonar} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.smallBox}>
            <Text style={styles.smallBoxTitulo}>Registrar abono</Text>
            {fiadoSel && (
              <Text style={styles.smallBoxSub}>
                Pendiente: ${(fiadoSel.monto - fiadoSel.abonado).toFixed(2)}
              </Text>
            )}
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Monto a abonar"
              placeholderTextColor="#94a3b8"
              value={montoAbono}
              onChangeText={setMontoAbono}
              autoFocus
            />
            <View style={styles.smallBoxBtns}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => { setModalAbonar(false); setFiadoSel(null); }}
              >
                <Text style={[styles.smallBtnText, { color: GRIS }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: VERDE }]}
                onPress={registrarAbono}
                disabled={guardando}
              >
                <Text style={[styles.smallBtnText, { color: '#fff' }]}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: FIADO MANUAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalFiado} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.smallBox}>
            <Text style={styles.smallBoxTitulo}>Agregar fiado a {clienteSel?.nombre}</Text>
            <Text style={styles.smallBoxSub}>Registra lo que se llevó y el monto</Text>
            <Text style={styles.inputLabel}>¿Qué se llevó? *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 2 refrescos, pan, leche..."
              placeholderTextColor="#94a3b8"
              value={descripFiado}
              onChangeText={setDescripFiado}
              autoFocus
            />
            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Monto ($) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              value={montoFiado}
              onChangeText={setMontoFiado}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Nota extra (opcional)"
              placeholderTextColor="#94a3b8"
              value={notaFiado}
              onChangeText={setNotaFiado}
            />
            <View style={styles.smallBoxBtns}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => { setModalFiado(false); setMontoFiado(''); setDescripFiado(''); setNotaFiado(''); setErrorModal(''); }}
              >
                <Text style={[styles.smallBtnText, { color: GRIS }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: AZUL }]}
                onPress={guardarFiadoManual}
                disabled={guardando}
              >
                <Text style={[styles.smallBtnText, { color: '#fff' }]}>
                  {guardando ? 'Guardando...' : 'Guardar fiado'}
                </Text>
              </TouchableOpacity>
            </View>
            {errorModal !== '' && (
              <Text style={styles.errorText}>{errorModal}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: NUEVO CLIENTE
      ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalCliente} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.smallBox}>
            <Text style={styles.smallBoxTitulo}>Nuevo cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              placeholderTextColor="#94a3b8"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Teléfono (opcional)"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={nuevoTel}
              onChangeText={setNuevoTel}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Notas (opcional)"
              placeholderTextColor="#94a3b8"
              value={nuevoNota}
              onChangeText={setNuevoNota}
            />
            <View style={styles.smallBoxBtns}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => { setModalCliente(false); setNuevoNombre(''); setNuevoTel(''); setNuevoNota(''); setErrorModal(''); }}
              >
                <Text style={[styles.smallBtnText, { color: GRIS }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: AZUL }]}
                onPress={guardarCliente}
                disabled={guardando}
              >
                <Text style={[styles.smallBtnText, { color: '#fff' }]}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
            {errorModal !== '' && (
              <Text style={styles.errorText}>{errorModal}</Text>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Header ──
  header: {
    backgroundColor: AZUL,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:   { color: '#93c5fd', fontSize: 13, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  totalLabel:  { color: '#93c5fd', fontSize: 12 },
  totalMonto:  { color: '#fff', fontSize: 22, fontWeight: '900' },

  // ── Búsqueda ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1, backgroundColor: BG, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: OSCURO,
  },
  btnNuevo: {
    backgroundColor: AZUL, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  btnNuevoText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Lista ──
  lista: { padding: 10, paddingBottom: 20 },
  emptyText: {
    textAlign: 'center', color: GRIS, marginTop: 50,
    fontSize: 15, lineHeight: 22,
  },

  // ── Card cliente ──
  clienteCard: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 8,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 3, elevation: 2,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:    { fontSize: 16, fontWeight: '800' },
  clienteInfo:   { flex: 1 },
  clienteNombre: { fontSize: 15, fontWeight: '700', color: OSCURO },
  clienteTel:    { fontSize: 12, color: GRIS, marginTop: 2 },
  clienteFiadosCount: { fontSize: 12, color: GRIS, marginTop: 2 },
  deudaBox:      { alignItems: 'flex-end' },
  deudaMonto:    { fontSize: 18, fontWeight: '900' },
  pagadoLabel:   { fontSize: 11, color: VERDE, fontWeight: '600', marginTop: 2 },

  // ── Modals ──
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  // ── Modal detalle ──
  detalleBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  detalleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 14,
  },
  detalleTitulo:    { fontSize: 20, fontWeight: '800', color: OSCURO },
  detalleTel:       { fontSize: 13, color: GRIS, marginTop: 3 },
  detalleDeudaBox:  { alignItems: 'flex-end' },
  detalleDeuda:     { fontSize: 26, fontWeight: '900' },
  detalleDeudaLabel:{ fontSize: 12, color: GRIS },

  btnFiadoManual: {
    backgroundColor: AZUL + '14', borderRadius: 10, borderWidth: 1.5,
    borderColor: AZUL, paddingVertical: 10, alignItems: 'center', marginBottom: 12,
  },
  btnFiadoManualText: { color: AZUL, fontWeight: '700', fontSize: 14 },

  fiadosList: { maxHeight: 380 },

  fiadoRow: {
    backgroundColor: BG, borderRadius: 10, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fiadoRowPagado: { opacity: 0.55 },
  fiadoRowLeft:   { flex: 1, gap: 3 },
  fiadoFecha:     { fontSize: 12, color: GRIS, fontWeight: '600' },
  fiadoDescripcion: { fontSize: 14, color: OSCURO, fontWeight: '700', marginTop: 2 },
  fiadoNota:      { fontSize: 12, color: GRIS, fontStyle: 'italic' },
  fiadoAbonado:   { fontSize: 11, color: GRIS },
  fiadoRowRight:  { alignItems: 'flex-end', gap: 5 },
  fiadoPendiente: { fontSize: 16, fontWeight: '900', color: ROJO },

  badgePagado: {
    backgroundColor: '#dcfce7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgePagadoText: { fontSize: 12, color: VERDE, fontWeight: '700' },

  btnAbono: {
    backgroundColor: AMBER + '22', borderRadius: 8, borderWidth: 1,
    borderColor: AMBER, paddingHorizontal: 10, paddingVertical: 5,
  },
  btnAbonoText: { fontSize: 12, fontWeight: '700', color: AMBER },

  btnLiquidar: {
    backgroundColor: VERDE + '18', borderRadius: 8, borderWidth: 1,
    borderColor: VERDE, paddingHorizontal: 10, paddingVertical: 5,
  },
  btnLiquidarText: { fontSize: 12, fontWeight: '700', color: VERDE },

  btnCerrar: {
    marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  btnCerrarText: { color: GRIS, fontWeight: '700', fontSize: 15 },

  // ── Modal pequeño (abono / fiado / cliente) ──
  smallBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
  },
  smallBoxTitulo: { fontSize: 18, fontWeight: '800', color: OSCURO, marginBottom: 4 },
  smallBoxSub:    { fontSize: 13, color: GRIS, marginBottom: 14 },
  inputLabel:     { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },

  input: {
    backgroundColor: BG, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: OSCURO,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  smallBoxBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  smallBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  smallBtnText: { fontWeight: '700', fontSize: 15 },
  errorText: {
    marginTop: 10,
    backgroundColor: '#fef2f2',
    color: ROJO,
    fontSize: 13,
    fontWeight: '600',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
  },
});
