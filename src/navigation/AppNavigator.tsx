import React from 'react';
import { Image, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';

const Tab = createBottomTabNavigator();

// Componente para mostrar el logo en la cabecera
function LogoTitle() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        style={{ width: 150, height: 40 }}
        source={require('../../assets/logo.jpg')}
        resizeMode="contain"
      />
    </View>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator 
        screenOptions={{ 
          tabBarActiveTintColor: '#4a9b40', // Verde logo
          tabBarInactiveTintColor: '#999',
          headerStyle: { backgroundColor: '#002a54', height: 100 }, // Azul Marino logo con un poco más de altura
          headerTintColor: '#fff',
          headerTitleAlign: 'center',
          headerTitle: () => <LogoTitle />
        }}
      >
        <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
        <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Mis Citas' }} />
        <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Servicios' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
