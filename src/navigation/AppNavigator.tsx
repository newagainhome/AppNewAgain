import React from 'react';
import { Image, View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';
import RouteScreen from '../screens/RouteScreen';

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

function LogoTitle() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 5 }}>
      <Image
        style={{ width: 140, height: 40 }}
        source={require('../../assets/logo.jpg')}
        resizeMode="contain"
      />
    </View>
  );
}

function TopTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#002a54', // Azul marino corporativo (Texto Pestaña Activa)
        tabBarInactiveTintColor: '#888888', // Gris oscuro (Texto Pestaña Inactiva)
        tabBarStyle: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#dddddd' }, // Fondo blanco para máxima lectura
        tabBarIndicatorStyle: { backgroundColor: '#4a9b40', height: 4 }, // Raya verde
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 15, textTransform: 'none' }, // Letra grande y clara
        tabBarItemStyle: { paddingVertical: 10 } // Espaciado cómodo, sin forzar alturas
      }}
    >
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Calendario' }} />
      <Tab.Screen name="Route" component={RouteScreen} options={{ tabBarLabel: 'Rutas' }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ tabBarLabel: 'Nueva Cita' }} />
      <Tab.Screen name="Services" component={ServicesScreen} options={{ tabBarLabel: 'Servicios' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#002a54' },
          headerTitleAlign: 'center',
          headerTitle: () => <LogoTitle />
        }}
      >
        <Stack.Screen name="Main" component={TopTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
