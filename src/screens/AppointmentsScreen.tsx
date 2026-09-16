import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const srvs: any[] = [];
      snapshot.forEach(doc => srvs.push({ id: doc.id, ...doc.data() }));
      setServices(srvs);
    });
    return () => unsubscribe();
  }, []);

  const saveAppointment = async () => {
    if (!client || !date || !time || !selectedService) {
      alert("Rellena todos los campos (cliente, fecha, hora y servicio).");
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

  // Generar horas en intervalos de 15 minutos (de 08:00 a 20:45)
  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };
  const timeSlots = generateTimeSlots();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput style={styles.input} placeholder="Nombre del cliente" value={client} onChangeText={setClient} />
      <TextInput style={styles.input} placeholder="Dirección del domicilio (para el GPS)" value={address} onChangeText={setAddress} />

      <Text style={styles.subtitle}>Selecciona la Fecha:</Text>
      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={(day: any) => setDate(day.dateString)}
          markedDates={{ [date]: { selected: true, selectedColor: '#4a9b40' } }}
          theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
        />
      </View>
      <Text style={styles.selectedDateText}>📅 Fecha elegida: {date}</Text>

      <Text style={styles.subtitle}>Selecciona la Hora (cada 15m):</Text>
      <View style={styles.timeGrid}>
        {timeSlots.map(t => (
          <TouchableOpacity 
            key={t} 
            style={[styles.timeBtn, time === t && styles.timeBtnSelected]}
            onPress={() => setTime(t)}
          >
            <Text style={time === t ? styles.textSelected : styles.textUnselected}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {time !== '' && <Text style={styles.selectedDateText}>⏰ Hora elegida: {time}</Text>}

      <Text style={styles.subtitle}>Selecciona el Servicio:</Text>
      {services.map(srv => (
        <TouchableOpacity 
          key={srv.id} 
          style={[styles.serviceBtn, selectedService?.id === srv.id && styles.serviceBtnSelected]}
          onPress={() => setSelectedService(srv)}
        >
          <Text style={selectedService?.id === srv.id ? styles.textSelected : styles.textUnselected}>
            {srv.name} (⏱ {srv.duration} min)
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.saveButton} onPress={saveAppointment}>
        <Text style={styles.saveButtonText}>Guardar Cita</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#002a54' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#002a54' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  selectedDateText: { fontSize: 15, color: '#4a9b40', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 10 },
  timeBtn: { paddingVertical: 10, paddingHorizontal: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, margin: 4, width: '22%', alignItems: 'center' },
  timeBtnSelected: { backgroundColor: '#002a54', borderColor: '#002a54' },

  serviceBtn: { padding: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  serviceBtnSelected: { backgroundColor: '#002a54', borderColor: '#002a54' },
  
  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },
  saveButton: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
