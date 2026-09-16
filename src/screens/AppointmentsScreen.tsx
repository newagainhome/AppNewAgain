import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const srvs: any[] = [];
      snapshot.forEach(doc => srvs.push({ id: doc.id, ...doc.data() }));
      setServices(srvs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', date));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: any[] = [];
      snapshot.forEach(doc => appsList.push({ id: doc.id, ...doc.data() }));
      setExistingAppointments(appsList);
    });
    return () => unsubscribe();
  }, [date]);

  useEffect(() => {
    if (!time || !selectedService) {
      setConflictWarning(null);
      return;
    }
    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(time);
    const newEnd = newStart + parseInt(selectedService.duration);
    const travelMargin = 30; 
    let warning = null;

    for (const app of existingAppointments) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);

      if (newStart < existingEnd && newEnd > existingStart) {
        warning = `⚠️ Solapamiento: Ya tienes limpieza de ${app.time} a ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}.`;
        break;
      }
      if (newStart >= existingEnd && newStart - existingEnd < travelMargin) {
        warning = `🚗 Aviso: La cita anterior acaba a las ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}. ¡Queda poco margen para viajar!`;
      }
      if (newEnd <= existingStart && existingStart - newEnd < travelMargin) {
        warning = `🚗 Aviso: Acabarás muy pegado a la siguiente cita de las ${app.time}.`;
      }
    }
    setConflictWarning(warning);
  }, [time, selectedService, existingAppointments]);


  const saveAppointment = async () => {
    if (!client || !date || !time || !selectedService) {
      alert("Faltan datos por rellenar.");
      return;
    }
    try {
      await addDoc(collection(db, 'appointments'), {
        client, date, time, address,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        createdAt: new Date()
      });
      setClient(''); setTime(''); setAddress(''); setSelectedService(null);
      navigation.navigate('Calendar');
    } catch (error) {
      alert("Error al guardar la cita.");
    }
  };

  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput style={styles.input} placeholder="Nombre del cliente" value={client} onChangeText={setClient} />
      <TextInput style={styles.input} placeholder="Dirección del domicilio" value={address} onChangeText={setAddress} />

      {/* Selector de Servicio Compacto */}
      <Text style={styles.subtitle}>1. Servicio:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {services.map(srv => (
          <TouchableOpacity 
            key={srv.id} 
            style={[styles.chipBtn, selectedService?.id === srv.id && styles.chipSelected]}
            onPress={() => setSelectedService(srv)}
          >
            <Text style={selectedService?.id === srv.id ? styles.textSelected : styles.textUnselected}>
              {srv.name} (⏱ {srv.duration}m)
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Selector de Fecha Ocultable */}
      <Text style={styles.subtitle}>2. Fecha:</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowCalendar(!showCalendar)}>
        <Text style={styles.dropdownText}>📅 {date} {showCalendar ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day: any) => { setDate(day.dateString); setShowCalendar(false); }}
            markedDates={{ [date]: { selected: true, selectedColor: '#4a9b40' } }}
            theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
          />
        </View>
      )}

      {/* Selector de Hora Compacto */}
      <Text style={styles.subtitle}>3. Hora:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {timeSlots.map(t => (
          <TouchableOpacity 
            key={t} 
            style={[styles.chipBtn, time === t && styles.chipSelected]}
            onPress={() => setTime(t)}
          >
            <Text style={time === t ? styles.textSelected : styles.textUnselected}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {conflictWarning && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{conflictWarning}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={saveAppointment}>
        <Text style={styles.saveButtonText}>Guardar Cita</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 10, color: '#002a54' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  
  // Elementos compactos deslizables (Chips)
  scrollRow: { flexGrow: 0, marginBottom: 10 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  chipSelected: { backgroundColor: '#002a54', borderColor: '#002a54' },
  
  // Botón desplegable para el calendario
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },

  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },
  
  warningBox: { backgroundColor: '#ffe5e5', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ffcccc', marginVertical: 10 },
  warningText: { color: '#d9534f', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },

  saveButton: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
