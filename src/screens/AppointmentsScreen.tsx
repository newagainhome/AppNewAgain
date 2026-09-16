import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  
  // Dirección y validación estricta
  const [addressInput, setAddressInput] = useState('');
  const [validatedAddress, setValidatedAddress] = useState<string | null>(null);
  const [detailedInfo, setDetailedInfo] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const [price, setPrice] = useState('');
  const [team, setTeam] = useState('Equipo 1');
  const [teams, setTeams] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [smartSuggestion, setSmartSuggestion] = useState<any>(null);

  // 1. Cargar Equipos dinámicos desde Firestore
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      const teamsList: any[] = [];
      snapshot.forEach(docSnap => teamsList.push({ id: docSnap.id, ...docSnap.data() }));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
      if (teamsList.length > 0 && !team) {
        setTeam(teamsList[0].name);
      }
    });
    return () => unsubscribeTeams();
  }, []);

  // 2. Cargar Servicios
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const srvs: any[] = [];
      snapshot.forEach(docSnap => srvs.push({ id: docSnap.id, ...docSnap.data() }));
      setServices(srvs);
    });
    return () => unsubscribe();
  }, []);

  // 3. Cargar Citas para el día seleccionado
  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', date));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: any[] = [];
      snapshot.forEach(docSnap => appsList.push({ id: docSnap.id, ...docSnap.data() }));
      setExistingAppointments(appsList);
    });
    return () => unsubscribe();
  }, [date]);

  // BÚSQUEDA AUTOMÁTICA Y PRECISA DE DIRECCIONES
  const searchAddress = async (text: string) => {
    setAddressInput(text);
    setIsValidated(false);
    setValidatedAddress(null);

    if (!text || text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsValidating(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=es&q=${encodeURIComponent(text)}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NewAgainApp/1.0'
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setAddressSuggestions(data);
      } else {
        setAddressSuggestions([]);
      }
    } catch (error) {
      console.log('Error buscando dirección:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const selectAddress = (item: any) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || item.name || '';
    const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
    const municipality = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const postcode = addr.postcode ? ` (${addr.postcode})` : '';
    const province = addr.province || addr.state || '';

    let formatted = `${road}${houseNumber}`.trim();
    if (municipality) formatted += ` · ${municipality}${postcode}`;
    if (province && province !== municipality) formatted += ` · ${province}`;
    if (!formatted) formatted = item.display_name;

    setAddressInput(formatted);
    setValidatedAddress(formatted);
    setIsValidated(true);
    setAddressSuggestions([]);
  };

  const verifyInGoogleMaps = () => {
    if (!addressInput.trim()) {
      alert('Escribe una dirección primero.');
      return;
    }
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressInput)}`);
  };

  const handleSelectService = (srv: any) => {
    setSelectedService(srv);
    if (srv.price && !price) {
      setPrice(srv.price);
    }
  };

  const checkSlotStatus = (testTime: string) => {
    if (!selectedService) return { conflict: false };
    const currentTeam = team || (teams[0]?.name ?? 'Equipo 1');
    const teamApps = existingAppointments.filter(a => (a.team || teams[0]?.name || 'Equipo 1') === currentTeam);

    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(testTime);
    const newEnd = newStart + parseInt(selectedService.duration);
    const travelMargin = 30; 
    
    for (const app of teamApps) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);
      if (newStart < existingEnd && newEnd > existingStart) {
        return { conflict: true, reason: `⚠️ Solapamiento: Ya hay una cita de ${app.time} a ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}.` };
      }
      if (newStart >= existingEnd && newStart - existingEnd < travelMargin) {
        return { conflict: true, reason: `🚗 Falta tiempo al llegar: La cita de antes acaba a las ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}. Solo tienes ${newStart - existingEnd} min para conducir.` };
      }
      if (newEnd <= existingStart && existingStart - newEnd < travelMargin) {
        return { conflict: true, reason: `🚗 Falta tiempo al salir: Terminarías a las ${Math.floor(newEnd/60)}:${(newEnd%60).toString().padStart(2,'0')}. Solo tienes ${existingStart - newEnd} min para conducir a la cita de las ${app.time}.` };
      }
    }
    return { conflict: false };
  };

  const findOptimalSlot = async () => {
    if (!isValidated || !addressInput || !selectedService) {
      Alert.alert("Aviso", "Primero selecciona y valida una dirección oficial de la lista y elige un servicio.");
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
      snapshot.forEach(docSnap => appsInRange.push({ id: docSnap.id, ...docSnap.data() }));

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
        const sim = getSimilarity(addressInput, app.address);
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
        const suggestedTeam = bestMatchApp.team || teams[0]?.name || 'Equipo 1';
        
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
    if (!client.trim() || !date || !time || !selectedService) {
      alert("Por favor, rellena todos los campos obligatorios (cliente, servicio, fecha y hora).");
      return;
    }

    if (!isValidated || !validatedAddress) {
      alert("⚠️ Debes seleccionar una dirección validada del menú de sugerencias para asegurar la calle, el número y el municipio correctos.");
      return;
    }

    const status = checkSlotStatus(time);
    if (status.conflict) {
      alert(status.reason);
      return;
    }

    try {
      const finalTeam = team || (teams[0]?.name ?? 'Equipo 1');
      await addDoc(collection(db, 'appointments'), {
        client: client.trim(),
        date,
        time,
        address: validatedAddress,
        detailedInfo: detailedInfo.trim(),
        price: price.trim() || '',
        team: finalTeam,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        createdAt: new Date()
      });

      // Resetear estado
      setClient('');
      setTime('');
      setAddressInput('');
      setValidatedAddress(null);
      setDetailedInfo('');
      setIsValidated(false);
      setPrice('');
      setSelectedService(null);
      setSmartSuggestion(null);
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

  const activeTeamsList = teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nombre del cliente"
        value={client}
        onChangeText={setClient}
      />
      
      {/* SECCIÓN DE DIRECCIÓN VALIDADA OBLIGATORIA */}
      <View style={styles.addressSection}>
        <Text style={styles.inputLabel}>Dirección (Calle, Número y Municipio): *</Text>
        <View style={styles.addressInputRow}>
          <TextInput
            style={[
              styles.input,
              { flex: 1, marginBottom: 0 },
              isValidated && styles.inputValidated
            ]}
            placeholder="Ej: Calle la del Manojo de Rosas, 87, Madrid"
            value={addressInput}
            onChangeText={searchAddress}
          />
          <TouchableOpacity style={styles.mapsVerifyBtn} onPress={verifyInGoogleMaps}>
            <Text style={styles.mapsVerifyText}>🗺️ Ver Mapa</Text>
          </TouchableOpacity>
        </View>

        {isValidating && (
          <View style={styles.validatingRow}>
            <ActivityIndicator size="small" color="#002a54" />
            <Text style={styles.validatingText}>Validando dirección con mapas oficiales...</Text>
          </View>
        )}

        {/* Listado de sugerencias oficiales verificadas */}
        {addressSuggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsHeader}>📍 Toca una dirección oficial para validarla:</Text>
            {addressSuggestions.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionItem}
                onPress={() => selectAddress(item)}
              >
                <Text style={styles.suggestionItemTitle}>
                  {item.address?.road || item.name || 'Calle'}{item.address?.house_number ? `, ${item.address.house_number}` : ''}
                </Text>
                <Text style={styles.suggestionItemSubtitle}>
                  🏛️ {item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || 'Municipio'} {item.address?.postcode ? `(${item.address.postcode})` : ''} · {item.address?.province || item.address?.state || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isValidated ? (
          <View style={styles.validatedBadge}>
            <Text style={styles.validatedBadgeText}>✅ Dirección Oficial Validada: {validatedAddress}</Text>
          </View>
        ) : (
          addressInput.trim().length > 3 && addressSuggestions.length === 0 && !isValidating && (
            <Text style={styles.unvalidatedWarning}>
              ⚠️ Selecciona una de las direcciones oficiales que aparecen al escribir para asegurar el municipio y número.
            </Text>
          )
        )}
      </View>

      {/* NUEVO CAMPO: INFORMACIÓN DETALLADA */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.inputLabel}>Información detallada (Portal, Escalera, Piso, Puerta):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Portal 3, Escalera B, 2º Izquierda, Timbre Pérez"
          value={detailedInfo}
          onChangeText={setDetailedInfo}
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={styles.inputLabel}>Presupuesto acordado (€) (opcional):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 95"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />
      </View>

      <Text style={styles.subtitle}>1. Servicio:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {services.map(srv => (
          <TouchableOpacity 
            key={srv.id} 
            style={[styles.chipBtn, selectedService?.id === srv.id && styles.chipSelected]}
            onPress={() => handleSelectService(srv)}
          >
            <Text style={selectedService?.id === srv.id ? styles.textSelected : styles.textUnselected}>
              {srv.name} (⏱ {srv.duration}m{srv.price ? ` · 💶 ${srv.price}€` : ''})
            </Text>
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
        {activeTeamsList.map(t => (
          <TouchableOpacity key={t} style={[styles.chipBtn, (team || activeTeamsList[0]) === t && styles.chipSelected]} onPress={() => setTeam(t)}>
            <Text style={(team || activeTeamsList[0]) === t ? styles.textSelected : styles.textUnselected}>🚐 {t}</Text>
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
          const status = checkSlotStatus(t);
          const isConflict = selectedService ? status.conflict : false;
          let chipStyle: any = styles.chipBtn; let textStyle: any = styles.textUnselected;
          if (time === t) { chipStyle = styles.chipSelected; textStyle = styles.textSelected; } 
          else if (selectedService) {
             if (isConflict) { chipStyle = styles.chipConflict; textStyle = styles.textConflict; } 
             else { chipStyle = styles.chipAvailable; textStyle = styles.textAvailable; }
          }
          return (
            <TouchableOpacity key={t} style={chipStyle} onPress={() => { if (isConflict) alert(status.reason); setTime(t); }}>
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
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#002a54', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 15 },
  inputValidated: { borderColor: '#4a9b40', borderWidth: 2, backgroundColor: '#fafffa' },
  
  // Validación de Dirección
  addressSection: { marginBottom: 12 },
  addressInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  mapsVerifyBtn: { backgroundColor: '#eef4fa', borderWidth: 1, borderColor: '#002a54', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, justifyContent: 'center' },
  mapsVerifyText: { color: '#002a54', fontWeight: 'bold', fontSize: 13 },
  validatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  validatingText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  suggestionsCard: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#cfe0f2', marginTop: 4, elevation: 4, shadowOpacity: 0.15 },
  suggestionsHeader: { backgroundColor: '#f0f6fc', paddingHorizontal: 12, paddingVertical: 8, fontWeight: 'bold', color: '#002a54', fontSize: 12, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionItemTitle: { fontWeight: 'bold', color: '#002a54', fontSize: 14 },
  suggestionItemSubtitle: { color: '#555', fontSize: 12, marginTop: 2 },
  validatedBadge: { backgroundColor: '#eaf5ea', borderWidth: 1, borderColor: '#a3d9a3', padding: 8, borderRadius: 6, marginTop: 4 },
  validatedBadgeText: { color: '#256320', fontWeight: 'bold', fontSize: 12 },
  unvalidatedWarning: { color: '#c0392b', fontSize: 12, marginTop: 4, fontStyle: 'italic' },

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
