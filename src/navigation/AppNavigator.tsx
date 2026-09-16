import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator 
        screenOptions={{ 
          tabBarActiveTintColor: '#4a9b40', // Verde logo
          tabBarInactiveTintColor: '#999',
          headerStyle: { backgroundColor: '#002a54' }, // Azul Marino logo
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' }
        }}
      >
        <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
        <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Mis Citas' }} />
        <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Servicios' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
