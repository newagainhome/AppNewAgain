import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { collection, addDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Service {
  id: string;
  name: string;
  duration: string;
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach((doc) => {
        servicesList.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(servicesList);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addService = async () => {
    if (name.trim() !== '' && duration.trim() !== '') {
      try {
        await addDoc(collection(db, 'services'), { name, duration, createdAt: new Date() });
        setName(''); setDuration('');
      } catch (error) {
        alert("Hubo un error al guardar.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo Servicio</Text>
      
      <TextInput style={styles.input} placeholder="Nombre (ej. Limpieza Sofá)" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Duración estimada (minutos)" keyboardType="numeric" value={duration} onChangeText={setDuration} />
      
      <TouchableOpacity style={styles.button} onPress={addService}>
        <Text style={styles.buttonText}>Añadir Servicio</Text>
      </TouchableOpacity>

      <Text style={styles.titleList}>Tus Servicios Guardados</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#4a9b40" />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.serviceCard}>
              <Text style={styles.serviceName}>{item.name}</Text>
              <Text style={styles.serviceDuration}>⏱ {item.duration} min</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aún no has añadido ningún servicio.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  titleList: { fontSize: 18, fontWeight: 'bold', marginTop: 30, marginBottom: 15, color: '#002a54' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15 },
  button: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center' }, // Verde logo
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  serviceCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 1 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: '#002a54' }, // Azul logo
  serviceDuration: { color: '#4a9b40', fontWeight: 'bold' },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});
