import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

const TEAMS = ['Equipo 1', 'Equipo 2', 'Equipo 3'];

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [team, setTeam] = useState('Equipo 1');
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [smartSuggestion, setSmartSuggestion] = useState<any>(null);

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

  // Chequea conflictos SÓLO para el equipo seleccionado
  const checkIfSlotHasConflict = (testTime: string) => {
    if (!selectedService) return false;
    const teamApps = existingAppointments.filter(a => (a.team || 'Equipo 1') === team);

    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(testTime);
    const newEnd = newStart + parseInt(selectedService.duration);
    const travelMargin = 30; 
    
    for (const app of teamApps) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);
      if (newStart < existingEnd && newEnd > existingStart) return true; 
      if (newStart >= existingEnd && newStart - existingEnd < travelMargin) return true; 
      if (newEnd <= existingStart && existingStart - newEnd < travelMargin) return true; 
    }
    return false;
  };

  const findOptimalSlot = async () => {
    if (!address || address.length < 4 || !selectedService) {
      Alert.alert("Aviso", "Escribe una dirección y selecciona un servicio para buscar la ruta óptima.");
      return;
    }

    try {
      const baseDateObj = new Date(date);
      const start = new Date(baseDateObj); start.setDate(start.getDate() - 4);
      const end = new Date(baseDateObj); end.setDate(end.getDate() + 4);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const q = query(collection(db, 'appointments'), where('date', '>=', startStr), where('date', '<=', endStr));
      const snapshot = await getDocs(q);
      const appsInRange: any[] = [];
      snapshot.forEach(doc => appsInRange.push({ id: doc.id, ...doc.data() }));

      const getSimilarity = (addr1: string, addr2: string) => {
        if(!addr1 || !addr2) return 0;
        const words1 = addr1.toLowerCase().split(' ');
        const words2 = addr2.toLowerCase().split(' ');
        let matches = 0;
        for(let w1 of words1) {
          if(w1.length > 3 && words2.includes(w1)) matches++;
        }
        return matches;
      };

      let bestMatchApp = null;
      let maxSim = 0;

      for (const app of appsInRange) {
        const sim = getSimilarity(address, app.address);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatchApp = app;
        }
      }

      if (bestMatchApp && maxSim > 0) {
        const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const toTimeStr = (mins: number) => `${Math.floor(mins/60).toString().padStart(2,'0')}:${(mins%60).toString().padStart(2,'0')}`;
        
        const existingStart = getMinutes(bestMatchApp.time);
        const existingEnd = existingStart + parseInt(bestMatchApp.duration);
        const suggestedStartAfter = existingEnd + 30; 
        const roundedAfter = Math.ceil(suggestedStartAfter / 15) * 15; 
        const suggestedTime = toTimeStr(roundedAfter);
        const suggestedTeam = bestMatchApp.team || 'Equipo 1';
        
        setSmartSuggestion({
          date: bestMatchApp.date,
          time: suggestedTime,
          team: suggestedTeam,
          reason: `💡 Inteligencia de Rutas: El ${suggestedTeam} estará en esa zona el día ${bestMatchApp.date}. Para optimizar su ruta, te sugerimos asignarles esta cita a las ${suggestedTime}.`
        });
      } else {
        Alert.alert("Búsqueda finalizada", "No hay equipos en esa zona en los días próximos.");
        setSmartSuggestion(null);
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo calcular la ruta óptima.");
    }
  };

  const saveAppointment = async () => {
    if (!client || !date || !time || !selectedService) {
      alert("Faltan datos por rellenar.");
      return;
    }
    if (checkIfSlotHasConflict(time)) {
      alert("La hora seleccionada tiene conflictos para este equipo.");
      return;
    }
    try {
      await addDoc(collection(db, 'appointments'), {
        client, date, time, address, team,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        createdAt: new Date()
      });
      setClient(''); setTime(''); setAddress(''); setSelectedService(null); setSmartSuggestion(null);
      navigation.navigate('Calendar');
    } catch (error) {
      alert("Error al guardar la cita.");
    }
  };

  const timeSlots = [];
  for (let h = 10; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) continue; 
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput style={styles.input} placeholder="Nombre del cliente" value={client} onChangeText={setClient} />
      <TextInput style={styles.input} placeholder="Dirección (Calle, Ciudad)" value={address} onChangeText={setAddress} />

      <Text style={styles.subtitle}>1. Servicio:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {services.map(srv => (
          <TouchableOpacity 
            key={srv.id} 
            style={[styles.chipBtn, selectedService?.id === srv.id && styles.chipSelected]}
            onPress={() => setSelectedService(srv)}
          >
            <Text style={selectedService?.id === srv.id ? styles.textSelected : styles.textUnselected}>{srv.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.smartButton} onPress={findOptimalSlot}>
        <Text style={styles.smartButtonText}>✨ Sugerir Equipo y Fecha Óptimos</Text>
      </TouchableOpacity>

      {smartSuggestion && (
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionText}>{smartSuggestion.reason}</Text>
          <TouchableOpacity 
            style={styles.applyBtn} 
            onPress={() => {
              setDate(smartSuggestion.date);
              setTime(smartSuggestion.time);
              setTeam(smartSuggestion.team);
              setSmartSuggestion(null);
            }}
          >
            <Text style={styles.applyBtnText}>✅ Aplicar y Asignar Equipo</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.subtitle}>2. Equipo Asignado:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {TEAMS.map(t => (
          <TouchableOpacity key={t} style={[styles.chipBtn, team === t && styles.chipSelected]} onPress={() => setTeam(t)}>
            <Text style={team === t ? styles.textSelected : styles.textUnselected}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.subtitle}>3. Día y Hora:</Text>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {timeSlots.map(t => {
          const isConflict = selectedService ? checkIfSlotHasConflict(t) : false;
          let chipStyle: any = styles.chipBtn; let textStyle: any = styles.textUnselected;
          if (time === t) { chipStyle = styles.chipSelected; textStyle = styles.textSelected; } 
          else if (selectedService) {
             if (isConflict) { chipStyle = styles.chipConflict; textStyle = styles.textConflict; } 
             else { chipStyle = styles.chipAvailable; textStyle = styles.textAvailable; }
          }
          return (
            <TouchableOpacity key={t} style={chipStyle} onPress={() => { if (isConflict) alert("Conflicto detectado."); setTime(t); }}>
              <Text style={textStyle}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('Calendar')}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={saveAppointment}><Text style={styles.saveButtonText}>Guardar Cita</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 10, color: '#002a54' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  smartButton: { backgroundColor: '#002a54', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  smartButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  suggestionBox: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#90caf9', marginBottom: 15 },
  suggestionText: { color: '#0d47a1', fontSize: 14, marginBottom: 10, lineHeight: 20 },
  applyBtn: { backgroundColor: '#1976d2', padding: 10, borderRadius: 6, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: 'bold' },
  scrollRow: { flexGrow: 0, marginBottom: 15 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  chipSelected: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#002a54', borderWidth: 1, borderColor: '#002a54', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },
  chipAvailable: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4a9b40', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textAvailable: { color: '#4a9b40', fontWeight: 'bold' },
  chipConflict: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#ffe5e5', borderWidth: 1, borderColor: '#d9534f', borderRadius: 20, marginRight: 10, justifyContent: 'center', opacity: 0.8 },
  textConflict: { color: '#d9534f', textDecorationLine: 'line-through' },
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 40 },
  saveButton: { backgroundColor: '#4a9b40', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 10 },
  cancelButtonText: { color: '#d9534f', fontWeight: 'bold', fontSize: 16 }
});
