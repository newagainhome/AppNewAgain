import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Appointment {
  id: string;
  client: string;
  date: string;
  time: string;
  serviceName: string;
  duration: string;
  price?: string;
  address?: string;
  team?: string;
}

interface Team {
  id: string;
  name: string;
}

export default function CalendarScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  
  // Modal para gestionar equipos
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // 1. Cargar Equipos desde Firestore (y auto-inicializar si no hay ninguno)
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, async (snapshot) => {
      if (snapshot.empty) {
        // Inicializar con Equipo 1 y Equipo 2 por defecto
        try {
          await addDoc(collection(db, 'teams'), { name: 'Equipo 1', createdAt: new Date() });
          await addDoc(collection(db, 'teams'), { name: 'Equipo 2', createdAt: new Date() });
        } catch (e) {
          console.error(e);
        }
      } else {
        const teamsList: Team[] = [];
        snapshot.forEach((docSnap) => {
          teamsList.push({ id: docSnap.id, ...docSnap.data() } as Team);
        });
        teamsList.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(teamsList);
      }
    });

    return () => unsubscribeTeams();
  }, []);

  // 2. Cargar Citas de la fecha seleccionada y calcular conflictos por equipo
  useEffect(() => {
    const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((docSnap) => appsList.push({ id: docSnap.id, ...docSnap.data() } as Appointment));
      
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      
      const newConflicts: Record<string, string> = {};
      
      // Evaluar conflictos por cada equipo
      teams.forEach((t) => {
        const teamApps = appsList.filter((a) => (a.team || teams[0]?.name || 'Equipo 1') === t.name);
        
        for (let i = 0; i < teamApps.length - 1; i++) {
          const current = teamApps[i];
          const next = teamApps[i + 1];
          const currentEndTimeMins = getMinutes(current.time) + parseInt(current.duration || '0');
          const nextStartTimeMins = getMinutes(next.time);
          const freeTimeMins = nextStartTimeMins - currentEndTimeMins;
          const estimatedTravelTime = 30; 

          if (freeTimeMins < 0) {
            newConflicts[next.id] = `⚠️ Solapamiento: La cita anterior acaba a las ${Math.floor(currentEndTimeMins / 60)}:${(currentEndTimeMins % 60).toString().padStart(2, '0')}.`;
          } else if (freeTimeMins < estimatedTravelTime) {
            newConflicts[next.id] = `🚗 ¡Ojo! Solo hay ${freeTimeMins} min para llegar.`;
          }
        }
      });
      
      setConflicts(newConflicts);
      setAppointments(appsList);
    });

    return () => unsubscribeApps();
  }, [selectedDate, teams]);

  const addTeam = async () => {
    if (newTeamName.trim() === '') return;
    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName.trim(),
        createdAt: new Date()
      });
      setNewTeamName('');
    } catch (e) {
      alert('Error al crear el equipo.');
    }
  };

  const removeTeam = async (id: string, name: string) => {
    if (teams.length <= 1) {
      alert('Debes mantener al menos 1 equipo activo.');
      return;
    }
    if (window.confirm(`¿Seguro que deseas eliminar el "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'teams', id));
      } catch (e) {
        alert('Error al eliminar el equipo.');
      }
    }
  };

  const openMaps = (address: string | undefined) => {
    if (!address) return alert('Esta cita no tiene dirección.');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const deleteAppointment = async (id: string) => {
    if (window.confirm('¿Estás completamente seguro de que deseas eliminar esta cita?')) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (error) {
        alert('Hubo un error al intentar eliminar la cita.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Selector de Fecha Plegable */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCalendar(!showCalendar)}>
          <Text style={styles.datePickerText}>📅 {selectedDate} {showCalendar ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.manageTeamsBtn} onPress={() => setShowTeamsModal(true)}>
            <Text style={styles.manageTeamsText}>👥 Equipos ({teams.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newApptBtn} onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.newApptText}>+ Cita</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showCalendar && (
        <View style={styles.calendarModal}>
          <Calendar
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
              setShowCalendar(false);
            }}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#4a9b40' } }}
            theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
          />
        </View>
      )}

      {/* VISTA EN COLUMNAS POR CADA EQUIPO DISPONIBLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.columnsScrollView}>
        {teams.map((t) => {
          const teamApps = appointments.filter(
            (a) => (a.team || teams[0]?.name || 'Equipo 1') === t.name
          );

          return (
            <View key={t.id} style={styles.teamColumn}>
              {/* Cabecera de la columna del equipo */}
              <View style={styles.teamHeader}>
                <Text style={styles.teamTitle}>🚐 {t.name}</Text>
                <Text style={styles.teamCountBadge}>{teamApps.length} citas</Text>
              </View>

              {/* Lista de citas asignadas a este equipo */}
              <ScrollView style={styles.columnBody} showsVerticalScrollIndicator={false}>
                {teamApps.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.time}>{item.time} (🕒 {item.duration}m)</Text>
                        <Text style={styles.service}>{item.serviceName}</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteAppointment(item.id)}>
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.client}>👤 {item.client}</Text>

                    {item.price ? (
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>💶 {item.price} €</Text>
                      </View>
                    ) : null}

                    {conflicts[item.id] && (
                      <View style={styles.conflictBanner}>
                        <Text style={styles.conflictText}>{conflicts[item.id]}</Text>
                      </View>
                    )}

                    {item.address ? (
                      <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(item.address)}>
                        <Text style={styles.mapButtonText} numberOfLines={1}>📍 {item.address}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                {teamApps.length === 0 && (
                  <View style={styles.emptyColumnBox}>
                    <Text style={styles.emptyColumnText}>Sin citas asignadas</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* MODAL PARA GESTIONAR Y CONTROLAR EL NÚMERO DE EQUIPOS */}
      <Modal visible={showTeamsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Configurar Equipos</Text>
            <Text style={styles.modalSubtitle}>Añade o elimina los equipos de trabajo disponibles.</Text>

            <View style={styles.addTeamRow}>
              <TextInput
                style={styles.addTeamInput}
                placeholder="Nombre (ej. Equipo 3, Furgoneta 2...)"
                value={newTeamName}
                onChangeText={setNewTeamName}
              />
              <TouchableOpacity style={styles.addTeamBtn} onPress={addTeam}>
                <Text style={styles.addTeamBtnText}>+ Añadir</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
              {teams.map((t) => (
                <View key={t.id} style={styles.teamListItem}>
                  <Text style={styles.teamListItemText}>🚐 {t.name}</Text>
                  {teams.length > 1 && (
                    <TouchableOpacity onPress={() => removeTeam(t.id, t.name)}>
                      <Text style={styles.removeTeamText}>Eliminar 🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowTeamsModal(false)}>
              <Text style={styles.closeModalBtnText}>Cerrar y Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  datePickerBtn: {
    backgroundColor: '#eef4fa',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e0f0'
  },
  datePickerText: { color: '#002a54', fontWeight: 'bold', fontSize: 15 },
  topActions: { flexDirection: 'row', gap: 8 },
  manageTeamsBtn: {
    backgroundColor: '#002a54',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  manageTeamsText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  newApptBtn: {
    backgroundColor: '#4a9b40',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  newApptText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  calendarModal: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  columnsScrollView: { flex: 1, paddingHorizontal: 10, paddingVertical: 12 },
  teamColumn: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%'
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#002a54',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9
  },
  teamTitle: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  teamCountBadge: {
    backgroundColor: '#4a9b40',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  columnBody: { padding: 12, flex: 1 },
  card: {
    backgroundColor: '#fbfcfd',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#002a54',
    borderWidth: 1,
    borderColor: '#e8edf2'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  time: { fontWeight: 'bold', color: '#002a54', fontSize: 15 },
  service: { color: '#4a9b40', fontWeight: 'bold', fontSize: 13, marginTop: 2 },
  deleteIcon: { fontSize: 16, padding: 4 },
  client: { fontSize: 14, color: '#333', marginBottom: 6 },
  priceContainer: {
    backgroundColor: '#eaf5ea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  priceText: { color: '#2d6a26', fontWeight: 'bold', fontSize: 13 },
  conflictBanner: {
    backgroundColor: '#ffe5e5',
    padding: 8,
    borderRadius: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ffcccc'
  },
  conflictText: { color: '#d9534f', fontWeight: 'bold', fontSize: 12 },
  mapButton: {
    backgroundColor: '#eef2f5',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d7de'
  },
  mapButtonText: { color: '#002a54', fontWeight: 'bold', fontSize: 13 },
  emptyColumnBox: { paddingVertical: 30, alignItems: 'center' },
  emptyColumnText: { color: '#999', fontStyle: 'italic', fontSize: 14 },
  
  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 450, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002a54', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 15 },
  addTeamRow: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  addTeamInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addTeamBtn: { backgroundColor: '#4a9b40', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 8 },
  addTeamBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  teamListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  teamListItemText: { fontSize: 15, fontWeight: 'bold', color: '#002a54' },
  removeTeamText: { color: '#d9534f', fontWeight: 'bold', fontSize: 13 },
  closeModalBtn: { backgroundColor: '#002a54', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
