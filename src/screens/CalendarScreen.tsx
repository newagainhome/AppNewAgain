import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Appointment {
  id: string;
  client: string;
  date: string;
  time: string;
  serviceName: string;
  duration: string;
  address?: string;
}

export default function CalendarScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    // Buscar citas para el día seleccionado
    const q = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((doc) => {
        appsList.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      // Ordenar por hora (cronológicamente)
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      setAppointments(appsList);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Función para abrir Google Maps
  const openMaps = (address: string | undefined) => {
    if (!address) {
      Alert.alert("Aviso", "Esta cita no tiene dirección registrada.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir el mapa."));
  };

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: '#0066cc' }
        }}
        theme={{
          todayTextColor: '#0066cc',
          arrowColor: '#0066cc',
        }}
      />
      
      <View style={styles.header}>
        <Text style={styles.title}>Citas ({selectedDate})</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Appointments')}>
          <Text style={styles.buttonText}>+ Nueva Cita</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.time}>{item.time} (🕒 {item.duration}m)</Text>
              <Text style={styles.service}>{item.serviceName}</Text>
            </View>
            <Text style={styles.client}>👤 {item.client}</Text>
            
            {/* Botón de navegación a Google Maps si hay dirección */}
            {item.address ? (
              <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(item.address)}>
                <Text style={styles.mapButtonText}>📍 Navegar a: {item.address}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay citas programadas para este día.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  button: { backgroundColor: '#0066cc', padding: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 15, padding: 15, borderRadius: 8, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  time: { fontWeight: 'bold', color: '#0066cc', fontSize: 16 },
  client: { fontSize: 16, marginBottom: 10 },
  service: { color: '#666', fontStyle: 'italic', marginBottom: 10 },
  mapButton: { backgroundColor: '#eef2f5', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#d0d7de', marginTop: 5 },
  mapButtonText: { color: '#0066cc', fontWeight: 'bold', fontSize: 15 },
  empty: { textAlign: 'center', color: '#888', marginTop: 20 }
});
