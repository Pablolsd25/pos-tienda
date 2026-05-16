import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, TextInput, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import type { SesionCaja, Venta, Perfil } from '../types';

export default function CortesCajaScreen() {
  const [sesiones, setSesiones] = useState<SesionCaja[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sesionActual, setSesionActual] = useState<SesionCaja | null>(null);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarApertura, setMostrarApertura] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [saldoDeclarado, setSaldoDeclarado] = useState('');
  const [notas, setNotas] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [sesionesRes, perfilesRes] = await Promise.all([
        supabase
          .from('sesiones_caja')
          .select('*')
          .order('fecha_apertura', { ascending: false })
          .limit(20),
        supabase.from('perfiles').select('*').order('nombre'),
      ]);

      setSesiones(sesionesRes.data || []);
      setPerfiles(perfilesRes.data || []);

      // Buscar sesión abierta
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: abierta } = await supabase
          .from('sesiones_caja')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('estado', 'abierta')
          .single();
        setSesionActual(abierta || null);
      }
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

  const loadVentasSesion = async (sesionId: string) => {
    const { data } = await supabase
      .from('ventas')
      .select('*')
      .eq('sesion_id', sesionId)
      .eq('estado', 'completada');
    setVentas(data || []);
  };

  const abrirCaja = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'No hay sesión activa');
        return;
      }

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
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo abrir la caja');
    }
  };

  const cerrarCaja = async () => {
    if (!sesionActual) return;

    try {
      const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0);
      const saldoFinal = parseFloat(saldoDeclarado) || 0;
      const diferencia = saldoFinal - (sesionActual.saldo_inicial + totalVentas);

      await supabase
        .from('sesiones_caja')
        .update({
          estado: 'cerrada',
          saldo_final: saldoFinal,
          fecha_cierre: new Date().toISOString(),
          diferencia: diferencia,
          notas: notas || null,
        })
        .eq('id', sesionActual.id);

      Alert.alert('Éxito', `Caja cerrada. Diferencia: $${diferencia.toFixed(2)}`);
      setMostrarCierre(false);
      setSaldoDeclarado('');
      setNotas('');
      loadData();
      setSesionActual(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getPerfilNombre = (id: string) => {
    const p = perfiles.find(p => p.id === id);
    return p?.nombre || 'Desconocido';
  };

  const formatFecha = (fecha: string) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderSesion = ({ item }: { item: SesionCaja }) => (
    <TouchableOpacity
      style={styles.sesionCard}
      onPress={() => loadVentasSesion(item.id)}
    >
      <View style={styles.sesionInfo}>
        <Text style={styles.sesionUsuario}>{getPerfilNombre(item.usuario_id)}</Text>
        <Text style={styles.sesionFecha}>
          {formatFecha(item.fecha_apertura)} - {item.estado === 'abierta' ? 'Abierta' : formatFecha(item.fecha_cierre!)}
        </Text>
        <Text style={styles.sesionSaldo}>
          Inicio: ${item.saldo_inicial.toFixed(2)}
          {item.saldo_final && ` | Final: $${item.saldo_final.toFixed(2)}`}
        </Text>
      </View>
      <View style={styles.sesionEstado}>
        <Text style={[styles.estadoBadge, item.estado === 'abierta' ? styles.estadoAbierta : styles.estadoCerrada]}>
          {item.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </Text>
        {item.diferencia !== null && (
          <Text style={[styles.diferencia, item.diferencia >= 0 ? styles.diferenciaPos : styles.diferenciaNeg]}>
            {item.diferencia >= 0 ? '+' : ''}${item.diferencia.toFixed(2)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cortes de Caja</Text>
      </View>

      {/* Sin sesión activa → botón Abrir Caja */}
      {!sesionActual && !cargando && (
        <View style={styles.sinSesionCard}>
          <Text style={styles.sinSesionTexto}>No hay caja abierta</Text>
          <TouchableOpacity
            style={styles.btnAbrirCaja}
            onPress={() => setMostrarApertura(true)}
          >
            <Text style={styles.btnAbrirCajaText}>Abrir Caja</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sesión actual */}
      {sesionActual && (
        <View style={styles.sesionActualCard}>
          <View style={styles.sesionActualHeader}>
            <Text style={styles.sesionActualTitle}>Caja Abierta</Text>
            <Text style={styles.sesionActualUsuario}>{getPerfilNombre(sesionActual.usuario_id)}</Text>
          </View>
          <Text style={styles.sesionActualSaldo}>
            Saldo inicial: ${sesionActual.saldo_inicial.toFixed(2)}
          </Text>
          <TouchableOpacity
            style={styles.btnCerrarCaja}
            onPress={() => {
              loadVentasSesion(sesionActual.id);
              setMostrarCierre(true);
            }}
          >
            <Text style={styles.btnCerrarCajaText}>Cerrar Caja</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resumen de ventas de sesión actual */}
      {ventas.length > 0 && (
        <View style={styles.ventasResumen}>
          <Text style={styles.ventasResumenTitle}>Ventas de sesión actual</Text>
          <Text style={styles.ventasResumenTotal}>{ventas.length} ventas</Text>
          <Text style={styles.ventasResumenMonto}>Total: ${totalVentas.toFixed(2)}</Text>
        </View>
      )}

      {/* Lista de sesiones */}
      <FlatList
        data={sesiones}
        renderItem={renderSesion}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {cargando ? 'Cargando...' : 'No hay sesiones de caja'}
          </Text>
        }
      />

      {/* Modal de apertura de caja */}
      <Modal visible={mostrarApertura} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Abrir Caja</Text>
            <Text style={styles.aperturaSubtitulo}>
              ¿Cuánto efectivo hay en caja al iniciar?
            </Text>

            <Text style={styles.label}>Monto inicial (opcional)</Text>
            <TextInput
              style={styles.input}
              value={montoInicial}
              onChangeText={setMontoInicial}
              keyboardType="decimal-pad"
              placeholder="0.00"
              autoFocus
            />
            <Text style={styles.aperturaHint}>
              Deja en blanco o escribe 0 si no hay efectivo inicial.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancelar]}
                onPress={() => { setMostrarApertura(false); setMontoInicial(''); }}
              >
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnAceptar]}
                onPress={abrirCaja}
              >
                <Text style={styles.modalBtnAceptarText}>Abrir Caja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de cierre */}
      <Modal visible={mostrarCierre} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cerrar Caja</Text>

              <View style={styles.modalResumen}>
                <View style={styles.modalResumenRow}>
                  <Text>Saldo inicial:</Text>
                  <Text>${sesionActual?.saldo_inicial.toFixed(2)}</Text>
                </View>
                <View style={styles.modalResumenRow}>
                  <Text>Ventas del día:</Text>
                  <Text>${totalVentas.toFixed(2)}</Text>
                </View>
                <View style={[styles.modalResumenRow, styles.modalResumenTotal]}>
                  <Text style={{ fontWeight: 'bold' }}>Total en caja:</Text>
                  <Text style={{ fontWeight: 'bold' }}>
                    ${((sesionActual?.saldo_inicial || 0) + totalVentas).toFixed(2)}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Saldo declarado en caja:</Text>
              <TextInput
                style={styles.input}
                value={saldoDeclarado}
                onChangeText={setSaldoDeclarado}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              {saldoDeclarado && (
                <Text style={[
                  styles.diferenciaCalculada,
                  (parseFloat(saldoDeclarado) - ((sesionActual?.saldo_inicial || 0) + totalVentas)) >= 0
                    ? styles.diferenciaPos
                    : styles.diferenciaNeg
                ]}>
                  Diferencia: ${
                    (parseFloat(saldoDeclarado) - ((sesionActual?.saldo_inicial || 0) + totalVentas)).toFixed(2)
                  }
                </Text>
              )}

              <Text style={styles.label}>Notas (opcional):</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={notas}
                onChangeText={setNotas}
                placeholder="Observaciones del corte..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancelar]}
                  onPress={() => setMostrarCierre(false)}
                >
                  <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnAceptar]}
                  onPress={cerrarCaja}
                >
                  <Text style={styles.modalBtnAceptarText}>Confirmar Cierre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#2563eb', padding: 16, paddingTop: 48 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sinSesionCard: { backgroundColor: '#eff6ff', margin: 12, padding: 20, borderRadius: 8, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  sinSesionTexto: { fontSize: 16, color: '#374151', marginBottom: 12 },
  btnAbrirCaja: { backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnAbrirCajaText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  aperturaSubtitulo: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 },
  aperturaHint: { fontSize: 12, color: '#999', marginTop: 6, textAlign: 'center' },
  sesionActualCard: { backgroundColor: '#dcfce7', margin: 12, padding: 16, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  sesionActualHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sesionActualTitle: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' },
  sesionActualUsuario: { fontSize: 14, color: '#666' },
  sesionActualSaldo: { fontSize: 16, marginBottom: 12 },
  btnCerrarCaja: { backgroundColor: '#dc2626', padding: 12, borderRadius: 6, alignItems: 'center' },
  btnCerrarCajaText: { color: '#fff', fontWeight: 'bold' },
  ventasResumen: { backgroundColor: '#fff', marginHorizontal: 12, padding: 12, borderRadius: 8 },
  ventasResumenTitle: { fontSize: 14, color: '#666' },
  ventasResumenTotal: { fontSize: 14, color: '#666' },
  ventasResumenMonto: { fontSize: 18, fontWeight: 'bold', color: '#2563eb', marginTop: 4 },
  list: { padding: 8 },
  sesionCard: { backgroundColor: '#fff', marginVertical: 4, padding: 12, borderRadius: 8, flexDirection: 'row' },
  sesionInfo: { flex: 1 },
  sesionUsuario: { fontSize: 16, fontWeight: '600' },
  sesionFecha: { fontSize: 12, color: '#666', marginTop: 2 },
  sesionSaldo: { fontSize: 14, color: '#666', marginTop: 4 },
  sesionEstado: { alignItems: 'flex-end' },
  estadoBadge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  estadoAbierta: { backgroundColor: '#dcfce7', color: '#16a34a' },
  estadoCerrada: { backgroundColor: '#f3f4f6', color: '#666' },
  diferencia: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  diferenciaPos: { color: '#16a34a' },
  diferenciaNeg: { color: '#dc2626' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  modalResumen: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16 },
  modalResumenRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  modalResumenTotal: { borderTopWidth: 1, borderTopColor: '#ddd', marginTop: 8, paddingTop: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  diferenciaCalculada: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginTop: 12 },
  modalButtons: { flexDirection: 'row', marginTop: 20 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  modalBtnCancelar: { backgroundColor: '#f5f5f5' },
  modalBtnCancelarText: { color: '#666', fontWeight: '600' },
  modalBtnAceptar: { backgroundColor: '#16a34a' },
  modalBtnAceptarText: { color: '#fff', fontWeight: '600' },
});