import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { supabase } from './src/lib/supabase';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Intentar restaurar sesión existente
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // 2. Si no hay sesión, crear una anónima automáticamente
          const { error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;
        }

        // 3. Garantizar que existe un perfil para este usuario
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!perfil) {
            await supabase.from('perfiles').insert({
              id: user.id,
              nombre: 'Admin',
              rol: 'admin',
              activo: true,
            });
          }
        }

        setListo(true);
      } catch (e: any) {
        setError(e.message || 'Error al iniciar');
      }
    };

    init();
  }, []);

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>No se pudo iniciar la app</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <Text style={styles.errorHint}>
          Activa "Allow anonymous sign-ins" en{'\n'}
          Supabase → Authentication → Configuration
        </Text>
      </View>
    );
  }

  if (!listo) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMsg: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHint: {
    fontSize: 13,
    color: '#2563eb',
    textAlign: 'center',
    lineHeight: 20,
  },
});
