import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Appointment {
  id: string; client: string; date: string; time: string; serviceName: string; duration: string; address?: string; team?: string;
}

export default function CalendarScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string>>({}); 

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((doc) => appsList.push({ id: doc.id, ...doc.data() } as Appointment));
      
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      
      const newConflicts: Record<string, string> = {};
      
      // Separar por equipos para calcular conflictos independientes
      const teams = ['Equipo 1', 'Equipo 2', 'Equipo 3'];
      
      teams.forEach(teamName => {
        const teamApps = appsList.filter(a => (a.team || 'Equipo 1') === teamName);
        
        for (let i = 0; i < teamApps.length - 1; i++) {
          const current = teamApps[i];
          const next = teamApps[i + 1];
          const currentEndTimeMins = getMinutes(current.time) + parseInt(current.duration || '0');
          const nextStartTimeMins = getMinutes(next.time);
          const freeTimeMins = nextStartTimeMins - currentEndTimeMins;
          const estimatedTravelTime = 30; 

          if (freeTimeMins < 0) {
             newConflicts[next.id] = `⚠️ Solapamiento en ${teamName}: La cita anterior acaba a las ${Math.floor(currentEndTimeMins/60)}:${(currentEndTimeMins%60).toString().padStart(2,'0')}.`;
          } else if (freeTimeMins < estimatedTravelTime) {
             newConflicts[next.id] = `🚗 ¡Ojo ${teamName}! Solo hay ${freeTimeMins} min para llegar.`;
          }
        }
      });
      
      setConflicts(newConflicts);
      setAppointments(appsList);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  const openMaps = (address: string | undefined) => {
    if (!address) return Alert.alert("Aviso", "Esta cita no tiene dirección.");
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const deleteAppointment = async (id: string) => {
    if (window.confirm("¿Estás completamente seguro de que deseas eliminar esta cita?")) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (error) {
        alert("Hubo un error al intentar eliminar la cita.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
        markedDates={{ [selectedDate]: { selected: true, selectedColor: '#4a9b40' } }}
        theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
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
              <View>
                <View style={styles.teamBadge}>
                  <Text style={styles.teamBadgeText}>{item.team || 'Equipo 1'}</Text>
                </View>
                <Text style={styles.time}>{item.time} (🕒 {item.duration}m)</Text>
                <Text style={styles.service}>{item.serviceName}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteAppointment(item.id)}>
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.client}>👤 {item.client}</Text>
            
            {conflicts[item.id] && (
              <View style={styles.conflictBanner}>
                <Text style={styles.conflictText}>{conflicts[item.id]}</Text>
              </View>
            )}
            
            {item.address ? (
              <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(item.address)}>
                <Text style={styles.mapButtonText}>📍 Navegar a: {item.address}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay citas programadas.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#002a54' },
  button: { backgroundColor: '#4a9b40', padding: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 15, padding: 15, borderRadius: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#002a54' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  teamBadge: { backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 5 },
  teamBadgeText: { color: '#002a54', fontWeight: 'bold', fontSize: 12 },
  time: { fontWeight: 'bold', color: '#002a54', fontSize: 16 },
  service: { color: '#4a9b40', fontWeight: 'bold', marginTop: 3 },
  deleteIcon: { fontSize: 20, padding: 5 },
  client: { fontSize: 16, marginBottom: 10, color: '#333' },
  conflictBanner: { backgroundColor: '#ffe5e5', padding: 10, borderRadius: 5, marginBottom: 10, borderWidth: 1, borderColor: '#ffcccc' },
  conflictText: { color: '#d9534f', fontWeight: 'bold', fontSize: 13 },
  mapButton: { backgroundColor: '#eef2f5', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#d0d7de' },
  mapButtonText: { color: '#002a54', fontWeight: 'bold', fontSize: 15 },
  empty: { textAlign: 'center', color: '#888', marginTop: 20 }
});
