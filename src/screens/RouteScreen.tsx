import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function RouteScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filterTeam, setFilterTeam] = useState('Todos');

  // Cargar equipos dinámicos
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      const teamsList: any[] = [];
      snapshot.forEach(docSnap => teamsList.push({ id: docSnap.id, ...docSnap.data() }));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
    });
    return () => unsubscribeTeams();
  }, []);

  // Cargar citas del día
  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: any[] = [];
      snapshot.forEach(doc => appsList.push({ id: doc.id, ...doc.data() }));
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      setAppointments(appsList);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Filtrar citas según el equipo seleccionado
  const filteredAppointments = appointments.filter(app => 
    filterTeam === 'Todos' ? true : (app.team || 'Equipo 1') === filterTeam
  );

  const openFullRoute = () => {
    if (filterTeam === 'Todos') {
      alert("Selecciona un equipo específico arriba para generar su ruta en Google Maps.");
      return;
    }
    
    const addresses = filteredAppointments.map(app => app.address).filter(addr => addr && addr.trim() !== '');
    if (addresses.length === 0) {
      alert(`No hay direcciones registradas para el ${filterTeam} este día.`);
      return;
    }
    
    const baseUrl = "https://www.google.com/maps/dir/";
    const encodedAddresses = addresses.map(addr => encodeURIComponent(addr)).join('/');
    Linking.openURL(baseUrl + encodedAddresses).catch(() => alert("No se pudo abrir el mapa."));
  };

  const callClient = (phone: string | undefined) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const teamOptions = ['Todos', ...(teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'])];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoja de Ruta Diaria</Text>

      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowCalendar(!showCalendar)}>
        <Text style={styles.dropdownText}>📅 Fecha: {selectedDate} {showCalendar ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day: any) => { setSelectedDate(day.dateString); setShowCalendar(false); }}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#4a9b40' } }}
            theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
          />
        </View>
      )}

      {/* Selector de Equipo dinámico para ver la ruta */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamFilterRow}>
        {teamOptions.map(t => (
          <TouchableOpacity 
            key={t} 
            style={[styles.teamFilterBtn, filterTeam === t && styles.teamFilterBtnSelected]}
            onPress={() => setFilterTeam(t)}
          >
            <Text style={filterTeam === t ? styles.teamFilterTextSelected : styles.teamFilterTextUnselected}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredAppointments.length > 0 ? (
        <View style={{ flex: 1 }}>
          <FlatList
            data={filteredAppointments}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.routeCard}>
                <View style={styles.numberCircle}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <View style={styles.clientHeader}>
                    <Text style={styles.time}>{item.time} - {item.client}</Text>
                    {item.phone ? (
                      <TouchableOpacity style={styles.phoneBadge} onPress={() => callClient(item.phone)}>
                        <Text style={styles.phoneText}>📞 Llamar: {item.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.address}>📍 {item.address || 'Sin dirección'}</Text>
                  {item.detailedInfo ? (
                    <Text style={styles.detailedInfo}>🏢 {item.detailedInfo}</Text>
                  ) : null}
                  <Text style={styles.teamBadgeText}>🚐 {item.team || 'Equipo 1'}</Text>
                </View>
              </View>
            )}
          />
          
          <TouchableOpacity 
            style={[styles.mapButton, filterTeam === 'Todos' && { backgroundColor: '#999' }]} 
            onPress={openFullRoute}
          >
            <Text style={styles.mapButtonText}>
              {filterTeam === 'Todos' ? 'Selecciona un equipo para ver ruta' : `🗺️ Abrir Ruta del ${filterTeam}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.empty}>No hay servicios para el {filterTeam} en esta fecha.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#002a54', textAlign: 'center' },
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 15 },
  
  teamFilterRow: { flexGrow: 0, marginBottom: 15, height: 45 },
  teamFilterBtn: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  teamFilterBtnSelected: { backgroundColor: '#002a54', borderColor: '#002a54' },
  teamFilterTextSelected: { color: '#fff', fontWeight: 'bold' },
  teamFilterTextUnselected: { color: '#333' },

  routeCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#eee' },
  numberCircle: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#002a54', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  numberText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  routeInfo: { flex: 1 },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  time: { fontWeight: 'bold', color: '#002a54', fontSize: 15 },
  phoneBadge: { backgroundColor: '#eef7ee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#c5e6c5' },
  phoneText: { color: '#256320', fontWeight: 'bold', fontSize: 12 },
  address: { color: '#444', fontSize: 14, marginBottom: 2 },
  detailedInfo: { color: '#8a5800', fontWeight: 'bold', fontSize: 12, marginBottom: 4, backgroundColor: '#fff8e7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  teamBadgeText: { color: '#4a9b40', fontWeight: 'bold', fontSize: 12 },

  mapButton: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  mapButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  empty: { textAlign: 'center', color: '#888', marginTop: 20, fontStyle: 'italic', fontSize: 16 }
});
