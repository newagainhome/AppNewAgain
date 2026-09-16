import React from 'react';
import { Image, View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';
import RouteScreen from '../screens/RouteScreen'; // Importamos la nueva pantalla

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
        tabBarActiveTintColor: '#4a9b40',
        tabBarInactiveTintColor: '#e0e0e0',
        tabBarStyle: { backgroundColor: '#002a54' },
        tabBarIndicatorStyle: { backgroundColor: '#4a9b40', height: 4 },
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 12 }
      }}
    >
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
      <Tab.Screen name="Route" component={RouteScreen} options={{ title: 'Ruta' }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Citas' }} />
      <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Servicios' }} />
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
