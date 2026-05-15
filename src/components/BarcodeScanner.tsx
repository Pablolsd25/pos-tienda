import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from 'react-native';
import { CameraView, Camera, type BarcodeType } from 'expo-camera';

const TODOS_LOS_TIPOS: BarcodeType[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e',
  'code128', 'code39', 'code93', 'itf14',
  'codabar', 'pdf417', 'aztec', 'datamatrix', 'qr',
];

interface BarcodeScannerProps {
  visible: boolean;
  onScan: (codigo: string) => void;
  onClose: () => void;
  titulo?: string;
}

// ─── Componente Web ────────────────────────────────────────────────────────────
function BarcodeScannerWeb({ visible, onScan, onClose, titulo }: BarcodeScannerProps) {
  const [codigoManual, setCodigoManual] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectandoRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      detenerCamara();
      setCodigoManual('');
      setError('');
      setCamaraActiva(false);
    }
  }, [visible]);

  const iniciarCamara = async () => {
    try {
      // Verificar si BarcodeDetector está disponible (Chrome 83+)
      if (typeof (window as any).BarcodeDetector === 'undefined') {
        setError('Tu navegador no soporta detección automática de códigos. Ingresa el código manualmente.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      setCamaraActiva(true);

      // Dar tiempo al DOM para montar el video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          iniciarDeteccion();
        }
      }, 200);
    } catch (err: any) {
      setError('No se pudo acceder a la cámara. Ingresa el código manualmente.');
    }
  };

  const iniciarDeteccion = async () => {
    if (detectandoRef.current) return;
    detectandoRef.current = true;

    try {
      const detector = new (window as any).BarcodeDetector({ formats: [
        'ean_13', 'ean_8', 'upc_a', 'upc_e',
        'code_128', 'code_39', 'code_93',
        'itf', 'codabar', 'qr_code', 'pdf417',
        'data_matrix', 'aztec',
      ]});

      const detectar = async () => {
        if (!videoRef.current || !detectandoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            detectandoRef.current = false;
            detenerCamara();
            onScan(barcodes[0].rawValue);
            onClose();
            return;
          }
        } catch (_) {}
        animRef.current = requestAnimationFrame(detectar);
      };

      animRef.current = requestAnimationFrame(detectar);
    } catch (err) {
      setError('Error al iniciar detección. Ingresa el código manualmente.');
      detectandoRef.current = false;
    }
  };

  const detenerCamara = () => {
    detectandoRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  const confirmarManual = () => {
    const codigo = codigoManual.trim();
    if (!codigo) return;
    setCodigoManual('');
    onScan(codigo);
    onClose();
  };

  const cerrar = () => {
    detenerCamara();
    setCodigoManual('');
    setError('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{titulo ?? 'Escanear código'}</Text>
          <TouchableOpacity onPress={cerrar} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webBody}>
          {/* Camara web */}
          {!camaraActiva ? (
            <TouchableOpacity style={styles.btnCamara} onPress={iniciarCamara}>
              <Text style={styles.btnCamaraIcon}>📷</Text>
              <Text style={styles.btnCamaraText}>Usar cámara para escanear</Text>
              <Text style={styles.btnCamaraNote}>(requiere Chrome en macOS)</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.videoContainer}>
              {/* @ts-ignore - elemento nativo HTML en web */}
              <video
                ref={videoRef}
                style={{ width: '100%', maxHeight: 320, borderRadius: 12, objectFit: 'cover' }}
                muted
                playsInline
              />
              <Text style={styles.detectandoText}>Buscando código de barras...</Text>
              <TouchableOpacity style={styles.btnDetenerCamara} onPress={detenerCamara}>
                <Text style={styles.btnDetenerCamaraText}>Detener cámara</Text>
              </TouchableOpacity>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o ingresa manualmente</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Input manual */}
          <Text style={styles.label}>Código de barras</Text>
          <TextInput
            style={styles.input}
            value={codigoManual}
            onChangeText={setCodigoManual}
            placeholder="Ej: 7501234567890"
            keyboardType="default"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirmarManual}
          />
          <Text style={styles.hint}>
            Si tienes un lector físico de códigos de barras USB, conéctalo y escanea aquí directamente.
          </Text>

          <TouchableOpacity
            style={[styles.btnConfirmar, !codigoManual.trim() && styles.btnConfirmarDisabled]}
            onPress={confirmarManual}
            disabled={!codigoManual.trim()}
          >
            <Text style={styles.btnConfirmarText}>Confirmar código</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Componente Nativo (iOS / Android) ────────────────────────────────────────
function BarcodeScannerNativo({ visible, onScan, onClose, titulo }: BarcodeScannerProps) {
  const [usarFallback, setUsarFallback] = useState(false);
  const [tienePermiso, setTienePermiso] = useState<boolean | null>(null);
  const [escaneado, setEscaneado] = useState(false);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEscaneado(false);

    if (CameraView.isModernBarcodeScannerAvailable) {
      lanzarEscanerNativo();
    } else {
      setUsarFallback(true);
      solicitarPermiso();
    }

    return () => limpiar();
  }, [visible]);

  const limpiar = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    CameraView.dismissScanner().catch(() => {});
  };

  const lanzarEscanerNativo = async () => {
    try {
      subscriptionRef.current = CameraView.onModernBarcodeScanned((resultado) => {
        limpiar();
        onScan(resultado.data);
        onClose();
      });
      await CameraView.launchScanner({
        barcodeTypes: TODOS_LOS_TIPOS,
        isGuidanceEnabled: true,
        isHighlightingEnabled: true,
        isPinchToZoomEnabled: true,
      });
    } catch {
      setUsarFallback(true);
      solicitarPermiso();
    }
  };

  const solicitarPermiso = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setTienePermiso(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita la cámara para escanear.', [
        { text: 'OK', onPress: onClose },
      ]);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (escaneado) return;
    setEscaneado(true);
    onScan(data);
    onClose();
  };

  const cerrar = () => {
    limpiar();
    setUsarFallback(false);
    setTienePermiso(null);
    onClose();
  };

  if (!usarFallback) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
        <View style={styles.nativoOverlay}>
          <TouchableOpacity style={styles.nativoCerrar} onPress={cerrar}>
            <Text style={styles.nativoCerrarText}>✕  Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{titulo ?? 'Escanear código'}</Text>
          <TouchableOpacity onPress={cerrar} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        {tienePermiso === null ? (
          <View style={styles.center}><Text style={styles.infoText}>Solicitando permiso...</Text></View>
        ) : tienePermiso === false ? (
          <View style={styles.center}>
            <Text style={styles.infoText}>Sin acceso a la cámara</Text>
            <TouchableOpacity style={styles.btnRetry} onPress={solicitarPermiso}>
              <Text style={styles.btnRetryText}>Solicitar permiso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: TODOS_LOS_TIPOS }}
            onBarcodeScanned={escaneado ? undefined : handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.scanHint}>
                  {escaneado ? 'Código detectado!' : 'Apunta al código de barras'}
                </Text>
              </View>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

// ─── Exportación: elige según plataforma ──────────────────────────────────────
export default function BarcodeScanner(props: BarcodeScannerProps) {
  if (Platform.OS === 'web') {
    return <BarcodeScannerWeb {...props} />;
  }
  return <BarcodeScannerNativo {...props} />;
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const SCAN_BOX = 260;
const CORNER = 24;
const THICKNESS = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    backgroundColor: '#1a1a1a',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  btnRetry: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnRetryText: { color: '#fff', fontWeight: '600' },
  // Nativo overlay
  nativoOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60, alignItems: 'center' },
  nativoCerrar: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30 },
  nativoCerrarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Camera fallback
  camera: { flex: 1 },
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: SCAN_BOX },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 24 },
  scanBox: { width: SCAN_BOX, height: SCAN_BOX, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  cornerTL: { top: 0, left: 0, borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS, borderColor: '#2563eb' },
  cornerTR: { top: 0, right: 0, borderTopWidth: THICKNESS, borderRightWidth: THICKNESS, borderColor: '#2563eb' },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS, borderColor: '#2563eb' },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS, borderColor: '#2563eb' },
  scanHint: {
    color: '#fff', fontSize: 16, fontWeight: '500', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, overflow: 'hidden',
  },
  // Web
  webBody: { flex: 1, backgroundColor: '#fff', padding: 20 },
  btnCamara: {
    backgroundColor: '#f0f4ff',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnCamaraIcon: { fontSize: 40, marginBottom: 8 },
  btnCamaraText: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  btnCamaraNote: { fontSize: 12, color: '#888', marginTop: 4 },
  videoContainer: { marginBottom: 16, alignItems: 'center' },
  detectandoText: { color: '#2563eb', fontWeight: '600', marginTop: 8, marginBottom: 8 },
  btnDetenerCamara: { backgroundColor: '#fee2e2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnDetenerCamaraText: { color: '#dc2626', fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e5e5' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 14, fontSize: 18, textAlign: 'center',
    letterSpacing: 2, marginBottom: 8,
  },
  hint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  btnConfirmar: {
    backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center',
  },
  btnConfirmarDisabled: { backgroundColor: '#93c5fd' },
  btnConfirmarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
