import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import POSScreen from '../screens/POSScreen';
import ProductosScreen from '../screens/ProductosScreen';
import InventarioScreen from '../screens/InventarioScreen';
import ResumenVentasScreen from '../screens/ResumenVentasScreen';
import CortesCajaScreen from '../screens/CortesCajaScreen';
import FiadosScreen from '../screens/FiadosScreen';
import type { MainTabParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_HEIGHT = Platform.OS === 'ios' ? 88 : 72;

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_HEIGHT,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="POS"
        component={POSScreen}
        options={{
          tabBarLabel: 'Venta',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 26 }}>{focused ? '🛒' : '🛒'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Productos"
        component={ProductosScreen}
        options={{
          tabBarLabel: 'Productos',
          tabBarIcon: () => <Text style={{ fontSize: 26 }}>📦</Text>,
        }}
      />
      <Tab.Screen
        name="Inventario"
        component={InventarioScreen}
        options={{
          tabBarLabel: 'Inventario',
          tabBarIcon: () => <Text style={{ fontSize: 26 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Resumen"
        component={ResumenVentasScreen}
        options={{
          tabBarLabel: 'Resumen',
          tabBarIcon: () => <Text style={{ fontSize: 26 }}>📈</Text>,
        }}
      />
      <Tab.Screen
        name="Fiados"
        component={FiadosScreen}
        options={{
          tabBarLabel: 'Fiados',
          tabBarIcon: () => <Text style={{ fontSize: 26 }}>📝</Text>,
        }}
      />
      <Tab.Screen
        name="Ajustes"
        component={CortesCajaScreen}
        options={{
          tabBarLabel: 'Caja',
          tabBarIcon: () => <Text style={{ fontSize: 26 }}>💰</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
