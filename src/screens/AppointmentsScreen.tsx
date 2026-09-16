import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);

  // Cargar los servicios disponibles
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
      alert("Rellena todos los campos y selecciona un servicio.");
      return;
    }

    try {
      await addDoc(collection(db, 'appointments'), {
        client,
        date, // YYYY-MM-DD
        time, // HH:MM
        address,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        createdAt: new Date()
      });
      alert("Cita guardada correctamente en el calendario.");
      // Limpiar formulario y navegar al calendario
      setClient(''); setDate(''); setTime(''); setAddress(''); setSelectedService(null);
      navigation.navigate('Calendar');
    } catch (error) {
      console.error(error);
      alert("Error al guardar la cita.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput style={styles.input} placeholder="Nombre del cliente" value={client} onChangeText={setClient} />
      <TextInput style={styles.input} placeholder="Fecha (ej. 2026-10-25)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Hora (ej. 10:30)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Dirección del domicilio" value={address} onChangeText={setAddress} />

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
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 10, color: '#555' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15 },
  serviceBtn: { padding: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  serviceBtnSelected: { backgroundColor: '#0066cc', borderColor: '#0066cc' },
  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },
  saveButton: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
