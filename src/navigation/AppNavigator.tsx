import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import LoginScreen from '../screens/LoginScreen';
import POSScreen from '../screens/POSScreen';
import ProductosScreen from '../screens/ProductosScreen';
import InventarioScreen from '../screens/InventarioScreen';
import ResumenVentasScreen from '../screens/ResumenVentasScreen';
import CortesCajaScreen from '../screens/CortesCajaScreen';
import type { RootStackParamList, MainTabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { paddingBottom: 6, paddingTop: 6, height: 60 },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen
        name="POS"
        component={POSScreen}
        options={{
          tabBarLabel: 'Venta',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: 20 }}>🛒</Text>,
        }}
      />
      <Tab.Screen
        name="Productos"
        component={ProductosScreen}
        options={{
          tabBarLabel: 'Productos',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: 20 }}>📦</Text>,
        }}
      />
      <Tab.Screen
        name="Inventario"
        component={InventarioScreen}
        options={{
          tabBarLabel: 'Inventario',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Resumen"
        component={ResumenVentasScreen}
        options={{
          tabBarLabel: 'Resumen',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: 20 }}>📈</Text>,
        }}
      />
      <Tab.Screen
        name="Ajustes"
        component={CortesCajaScreen}
        options={{
          tabBarLabel: 'Caja',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: 20 }}>💰</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}