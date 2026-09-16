import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  Image,
  ActivityIndicator
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

interface Appointment {
  id: string;
  client: string;
  phone?: string;
  date: string;
  time: string;
  serviceName: string;
  duration: string;
  price?: string;
  address?: string;
  detailedInfo?: string;
  team?: string;
  reminderSent?: boolean;
  photos?: string[];
}

interface Team {
  id: string;
  name: string;
  members?: string;
  tools?: string;
  vehicle?: string;
}

export default function CalendarScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  
  // Recordatorios y Fotos
  const [pendingReminders, setPendingReminders] = useState<number>(0);
  const [tomorrowDateStr, setTomorrowDateStr] = useState<string>('');
  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({});
  
  // Modal de gestión de equipos
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [teamVehicle, setTeamVehicle] = useState('');
  const [teamTools, setTeamTools] = useState('');

  // Control para desplegar u ocultar detalles de cada columna
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [showCalendar, setShowCalendar] = useState(false);

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // 1. Cargar Equipos desde Firestore
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, async (snapshot) => {
      if (snapshot.empty) {
        try {
          await addDoc(collection(db, 'teams'), {
            name: 'Equipo 1',
            members: 'Carlos y Marcos',
            vehicle: 'Furgoneta 1 (Citroën Berlingo)',
            tools: 'Inyección-Extracción Kärcher, Cepillos, Vaporizador',
            createdAt: new Date()
          });
          await addDoc(collection(db, 'teams'), {
            name: 'Equipo 2',
            members: 'Andrea y Javier',
            vehicle: 'Furgoneta 2 (Renault Kangoo)',
            tools: 'Máquina Tapicerías Pro, Hidrolimpiadora',
            createdAt: new Date()
          });
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

  // 2. Cargar Citas y calcular conflictos por equipo
  useEffect(() => {
    const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((docSnap) => appsList.push({ id: docSnap.id, ...docSnap.data() } as Appointment));
      
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      
      const newConflicts: Record<string, string> = {};
      
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

  // 3. Chequear recordatorios pendientes para mañana
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tDate = tomorrow.toISOString().split('T')[0];
    setTomorrowDateStr(tDate);

    const qTomorrow = query(collection(db, 'appointments'), where('date', '==', tDate));
    const unsubscribe = onSnapshot(qTomorrow, (snapshot) => {
      let pending = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.reminderSent && data.phone) {
          pending++;
        }
      });
      setPendingReminders(pending);
    });
    return () => unsubscribe();
  }, []);

  const sendWhatsAppReminder = async (item: Appointment) => {
    if (!item.phone) return alert('El cliente no tiene teléfono guardado.');
    
    const isTomorrow = item.date === tomorrowDateStr;
    const isToday = item.date === new Date().toISOString().split('T')[0];
    
    let dateText = isTomorrow ? 'mañana' : (isToday ? 'hoy' : `el día ${item.date}`);
    
    const message = `Hola ${item.client}, te recordamos que ${dateText} tienes agendada la cita con NewAgain a las ${item.time}.`;
    
    let phoneNum = item.phone.replace(/\s+/g, '');
    if (phoneNum.length === 9 && (phoneNum.startsWith('6') || phoneNum.startsWith('7') || phoneNum.startsWith('8') || phoneNum.startsWith('9'))) {
      phoneNum = '34' + phoneNum;
    } else if (phoneNum.startsWith('+')) {
      phoneNum = phoneNum.substring(1);
    }
    
    const url = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
    
    try {
      await updateDoc(doc(db, 'appointments', item.id), {
        reminderSent: true
      });
      Linking.openURL(url);
    } catch(e) {
      alert('Error al actualizar el estado del recordatorio.');
    }
  };

  const pickAndUploadImage = async (appointmentId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.3, // Compresión automática al 30%
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhotos(prev => ({ ...prev, [appointmentId]: true }));
        
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const fileName = `appointments/${appointmentId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytesResumable(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        
        const appDoc = appointments.find(a => a.id === appointmentId);
        const currentPhotos = appDoc?.photos || [];
        await updateDoc(doc(db, 'appointments', appointmentId), {
          photos: [...currentPhotos, downloadUrl]
        });
        
        setUploadingPhotos(prev => ({ ...prev, [appointmentId]: false }));
      }
    } catch (error) {
      console.error(error);
      alert('Error al subir la imagen. Inténtalo de nuevo.');
      setUploadingPhotos(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const saveTeam = async () => {
    if (teamName.trim() === '') {
      alert('El nombre del equipo es obligatorio.');
      return;
    }

    try {
      const teamData = {
        name: teamName.trim(),
        members: teamMembers.trim(),
        vehicle: teamVehicle.trim(),
        tools: teamTools.trim()
      };

      if (editingTeamId) {
        await updateDoc(doc(db, 'teams', editingTeamId), {
          ...teamData,
          updatedAt: new Date()
        });
        setEditingTeamId(null);
      } else {
        await addDoc(collection(db, 'teams'), {
          ...teamData,
          createdAt: new Date()
        });
      }

      setTeamName('');
      setTeamMembers('');
      setTeamVehicle('');
      setTeamTools('');
    } catch (e) {
      alert('Error al guardar el equipo.');
    }
  };

  const startEditTeam = (t: Team) => {
    setEditingTeamId(t.id);
    setTeamName(t.name);
    setTeamMembers(t.members || '');
    setTeamVehicle(t.vehicle || '');
    setTeamTools(t.tools || '');
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setTeamMembers('');
    setTeamVehicle('');
    setTeamTools('');
  };

  const removeTeam = async (id: string, name: string) => {
    if (teams.length <= 1) {
      alert('Debes mantener al menos 1 equipo activo.');
      return;
    }
    if (window.confirm(`¿Seguro que deseas eliminar el "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'teams', id));
        if (editingTeamId === id) cancelEditTeam();
      } catch (e) {
        alert('Error al eliminar el equipo.');
      }
    }
  };

  const toggleTeamDetails = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const openMaps = (address: string | undefined) => {
    if (!address) return alert('Esta cita no tiene dirección.');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const callClient = (phone: string | undefined) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
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
      {/* Barra superior de herramientas */}
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

      {/* Alerta de recordatorios pendientes */}
      {pendingReminders > 0 && (
        <TouchableOpacity 
          style={styles.reminderAlertBanner} 
          onPress={() => {
            setSelectedDate(tomorrowDateStr);
            setShowCalendar(false);
          }}
        >
          <Text style={styles.reminderAlertText}>
            🔔 Tienes {pendingReminders} recordatorio(s) pendiente(s) para mañana. ¡Toca aquí para verlos!
          </Text>
        </TouchableOpacity>
      )}

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
          const isExpanded = !!expandedTeams[t.id];

          return (
            <View key={t.id} style={styles.teamColumn}>
              {/* Cabecera del Equipo */}
              <View style={styles.teamHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamTitle}>🚐 {t.name}</Text>
                  {t.members ? <Text style={styles.teamHeaderSubtitle}>👥 {t.members}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.teamCountBadge}>{teamApps.length} citas</Text>
                  {(t.vehicle || t.tools) && (
                    <TouchableOpacity onPress={() => toggleTeamDetails(t.id)}>
                      <Text style={styles.infoToggleText}>{isExpanded ? 'Ocultar ▲' : 'Ficha ℹ️'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Ficha desplegable con Miembros, Vehículo y Herramientas */}
              {isExpanded && (
                <View style={styles.teamInfoBox}>
                  {t.members ? <Text style={styles.teamInfoItem}><Text style={styles.infoBold}>Miembros:</Text> {t.members}</Text> : null}
                  {t.vehicle ? <Text style={styles.teamInfoItem}><Text style={styles.infoBold}>Vehículo:</Text> {t.vehicle}</Text> : null}
                  {t.tools ? <Text style={styles.teamInfoItem}><Text style={styles.infoBold}>Herramientas:</Text> {t.tools}</Text> : null}
                </View>
              )}

              {/* Lista de citas de este equipo */}
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

                    <View style={styles.clientRow}>
                      <Text style={styles.client}>👤 {item.client}</Text>
                      {item.phone ? (
                        <TouchableOpacity style={styles.phoneBadge} onPress={() => callClient(item.phone)}>
                          <Text style={styles.phoneText}>📞 {item.phone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {item.price ? (
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>💶 Presupuesto: {item.price} €</Text>
                      </View>
                    ) : null}

                    {conflicts[item.id] && (
                      <View style={styles.conflictBanner}>
                        <Text style={styles.conflictText}>{conflicts[item.id]}</Text>
                      </View>
                    )}

                    {item.address ? (
                      <View style={{ marginTop: 4 }}>
                        <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(item.address)}>
                          <Text style={styles.mapButtonText} numberOfLines={2}>📍 {item.address}</Text>
                        </TouchableOpacity>
                        {item.detailedInfo ? (
                          <View style={styles.detailedInfoBox}>
                            <Text style={styles.detailedInfoText}>🏢 {item.detailedInfo}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* SECCIÓN DE FOTOS ANTES/DESPUÉS */}
                    <View style={styles.photosSection}>
                      <Text style={styles.photosTitle}>📸 Fotografías (Antes/Después):</Text>
                      <View style={styles.photosRow}>
                        {item.photos && item.photos.map((photoUrl, idx) => (
                          <TouchableOpacity key={idx} onPress={() => Linking.openURL(photoUrl)}>
                            <Image source={{ uri: photoUrl }} style={styles.thumbnailImg} />
                          </TouchableOpacity>
                        ))}
                        
                        {uploadingPhotos[item.id] ? (
                          <View style={styles.uploadingBox}>
                            <ActivityIndicator size="small" color="#4a9b40" />
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={styles.addPhotoBtn} 
                            onPress={() => pickAndUploadImage(item.id)}
                          >
                            <Text style={styles.addPhotoBtnText}>+</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {item.phone ? (
                      <TouchableOpacity 
                        style={[styles.whatsappButton, item.reminderSent && styles.whatsappSentButton]} 
                        onPress={() => sendWhatsAppReminder(item)}
                      >
                        <Text style={[styles.whatsappButtonText, item.reminderSent && styles.whatsappSentText]}>
                          {item.reminderSent ? '✅ Recordatorio Enviado' : '📲 Enviar Recordatorio por WhatsApp'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                {teamApps.length === 0 && (
                  <View style={styles.emptyColumnBox}>
                    <Text style={styles.emptyColumnText}>Sin citas hoy</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* MODAL PARA GESTIONAR EQUIPOS, MIEMBROS, VEHÍCULOS Y HERRAMIENTAS */}
      <Modal visible={showTeamsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingTeamId ? '✏️ Modificar Equipo' : '⚙️ Configuración de Equipos'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Asigna el nombre, miembros, vehículo y herramientas para cada equipo.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Nombre del equipo (ej. Equipo 1 - Norte)"
                value={teamName}
                onChangeText={setTeamName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="👥 Miembros del equipo (ej. Carlos y Marta)"
                value={teamMembers}
                onChangeText={setTeamMembers}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="🚗 Vehículo asignado (ej. Citroën Berlingo 1234-XYZ)"
                value={teamVehicle}
                onChangeText={setTeamVehicle}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="🛠️ Herramientas (ej. Kärcher Puzzi, Cepillos, Vaporizador)"
                value={teamTools}
                onChangeText={setTeamTools}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                {editingTeamId && (
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditTeam}>
                    <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveTeamBtn} onPress={saveTeam}>
                  <Text style={styles.saveTeamBtnText}>
                    {editingTeamId ? 'Guardar Cambios' : '+ Añadir Equipo'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.teamListTitle}>Equipos Registrados ({teams.length})</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {teams.map((t) => (
                  <View key={t.id} style={styles.teamCardItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamItemTitle}>🚐 {t.name}</Text>
                      {t.members ? <Text style={styles.teamItemSub}>👥 {t.members}</Text> : null}
                      {t.vehicle ? <Text style={styles.teamItemSub}>🚗 {t.vehicle}</Text> : null}
                      {t.tools ? <Text style={styles.teamItemSub}>🛠️ {t.tools}</Text> : null}
                    </View>
                    <View style={styles.teamItemActions}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => startEditTeam(t)}>
                        <Text style={styles.iconBtnText}>✏️</Text>
                      </TouchableOpacity>
                      {teams.length > 1 && (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => removeTeam(t.id, t.name)}>
                          <Text style={styles.iconBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.closeModalBtn} onPress={() => { cancelEditTeam(); setShowTeamsModal(false); }}>
                <Text style={styles.closeModalBtnText}>Cerrar Ventana</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    paddingVertical: 10,
    backgroundColor: '#002a54',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9
  },
  teamTitle: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  teamHeaderSubtitle: { color: '#b0cbe8', fontSize: 12, marginTop: 2 },
  teamCountBadge: {
    backgroundColor: '#4a9b40',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  infoToggleText: { color: '#b0cbe8', fontSize: 11, textDecorationLine: 'underline', marginTop: 2 },
  teamInfoBox: {
    backgroundColor: '#f4f8fc',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe2ea',
    gap: 3
  },
  teamInfoItem: { fontSize: 12, color: '#333' },
  infoBold: { fontWeight: 'bold', color: '#002a54' },
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
  clientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  client: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  phoneBadge: { backgroundColor: '#eef7ee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#c5e6c5' },
  phoneText: { color: '#256320', fontWeight: 'bold', fontSize: 12 },
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
    borderWidth: 1,
    borderColor: '#d0d7de'
  },
  mapButtonText: { color: '#002a54', fontWeight: 'bold', fontSize: 13 },
  detailedInfoBox: {
    backgroundColor: '#fff8e7',
    borderWidth: 1,
    borderColor: '#fae4b2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6
  },
  detailedInfoText: { color: '#8a5800', fontWeight: 'bold', fontSize: 12 },
  emptyColumnBox: { paddingVertical: 30, alignItems: 'center' },
  emptyColumnText: { color: '#999', fontStyle: 'italic', fontSize: 14 },
  
  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002a54', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 8, backgroundColor: '#fafafa' },
  saveTeamBtn: { flex: 1, backgroundColor: '#4a9b40', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveTeamBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelEditBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelEditBtnText: { color: '#d9534f', fontWeight: 'bold', fontSize: 14 },
  teamListTitle: { fontSize: 15, fontWeight: 'bold', color: '#002a54', marginTop: 18, marginBottom: 8 },
  teamCardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f7f9fb', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e3ebf2' },
  teamItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#002a54' },
  teamItemSub: { fontSize: 12, color: '#555', marginTop: 2 },
  teamItemActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 6, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  iconBtnText: { fontSize: 14 },
  closeModalBtn: { backgroundColor: '#002a54', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  // Estilos WhatsApp
  reminderAlertBanner: {
    backgroundColor: '#fff3cd',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeeba',
    alignItems: 'center'
  },
  reminderAlertText: { color: '#856404', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10
  },
  whatsappButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  whatsappSentButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#dcdcdc'
  },
  whatsappSentText: { color: '#555', fontWeight: 'bold' },
  
  // Estilos de Fotografías
  photosSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  photosTitle: { fontSize: 13, fontWeight: 'bold', color: '#002a54', marginBottom: 8 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnailImg: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  uploadingBox: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#eef7ee', borderWidth: 1, borderColor: '#c5e6c5', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  addPhotoBtnText: { fontSize: 24, color: '#4a9b40' }
});
