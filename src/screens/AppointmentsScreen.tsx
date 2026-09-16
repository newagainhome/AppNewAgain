import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
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


  // Función centralizada para chequear si una HORA ESPECÍFICA tiene conflicto
  const checkIfSlotHasConflict = (testTime: string) => {
    if (!selectedService) return false;

    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(testTime);
    const newEnd = newStart + parseInt(selectedService.duration);
    const travelMargin = 30; // 30 min de margen de conducción

    for (const app of existingAppointments) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);

      if (newStart < existingEnd && newEnd > existingStart) return true; // Solapamiento
      if (newStart >= existingEnd && newStart - existingEnd < travelMargin) return true; // Poco tiempo para llegar
      if (newEnd <= existingStart && existingStart - newEnd < travelMargin) return true; // Poco tiempo para salir
    }
    return false;
  };


  const saveAppointment = async () => {
    if (!client || !date || !time || !selectedService) {
      alert("Faltan datos por rellenar.");
      return;
    }
    if (checkIfSlotHasConflict(time)) {
      alert("La hora que has seleccionado tiene conflictos de tiempo. Elige una hora en verde.");
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

  // Generar horas de 10:00 a 20:00
  const timeSlots = [];
  for (let h = 10; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) continue; // Solo hasta las 20:00
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput style={styles.input} placeholder="Nombre del cliente" value={client} onChangeText={setClient} />
      <TextInput style={styles.input} placeholder="Dirección del domicilio" value={address} onChangeText={setAddress} />

      <Text style={styles.subtitle}>1. Selecciona el Servicio (imprescindible):</Text>
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

      <Text style={styles.subtitle}>2. Elige el Día:</Text>
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

      <Text style={styles.subtitle}>3. Elige la Hora (Verde = Disponible):</Text>
      {!selectedService && <Text style={styles.infoText}>Selecciona primero un servicio arriba para ver qué horas están libres.</Text>}
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {timeSlots.map(t => {
          const isConflict = selectedService ? checkIfSlotHasConflict(t) : false;
          const isSelected = time === t;
          
          let chipStyle: any = styles.chipBtn;
          let textStyle: any = styles.textUnselected;

          if (isSelected) {
             chipStyle = styles.chipSelected;
             textStyle = styles.textSelected;
          } else if (selectedService) {
             if (isConflict) {
               chipStyle = styles.chipConflict;
               textStyle = styles.textConflict;
             } else {
               chipStyle = styles.chipAvailable;
               textStyle = styles.textAvailable;
             }
          }

          return (
            <TouchableOpacity 
              key={t} 
              style={chipStyle}
              onPress={() => {
                if (isConflict) alert("⚠️ Cuidado, a esta hora chocas con otra limpieza o no te da tiempo a conducir.");
                setTime(t);
              }}
            >
              <Text style={textStyle}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
  infoText: { color: '#888', fontStyle: 'italic', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  
  scrollRow: { flexGrow: 0, marginBottom: 15 },
  
  // Estilos de los chips de horas/servicios
  chipBtn: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  chipSelected: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#002a54', borderWidth: 1, borderColor: '#002a54', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },

  // Estilos Semánticos para horas Libres/Ocupadas
  chipAvailable: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4a9b40', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textAvailable: { color: '#4a9b40', fontWeight: 'bold' },

  chipConflict: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#ffe5e5', borderWidth: 1, borderColor: '#d9534f', borderRadius: 20, marginRight: 10, justifyContent: 'center', opacity: 0.8 },
  textConflict: { color: '#d9534f', textDecorationLine: 'line-through' },
  
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },

  saveButton: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
