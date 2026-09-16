import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
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
}

export default function CalendarScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    // Escuchar citas para el día seleccionado
    const q = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((doc) => {
        appsList.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      // Ordenar por hora
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      setAppointments(appsList);
    });
    return () => unsubscribe();
  }, [selectedDate]);

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
          <Text style={styles.buttonText}>+ Nueva</Text>
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
  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 8, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  time: { fontWeight: 'bold', color: '#0066cc' },
  client: { fontSize: 16 },
  service: { color: '#666', fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#888', marginTop: 20 }
});
