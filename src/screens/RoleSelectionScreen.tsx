import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAppContext } from '../context/AppContext';

export default function RoleSelectionScreen() {
  const { loginAsAdmin, loginAsTeam } = useAppContext();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Configuración de Seguridad
  const [adminConfig, setAdminConfig] = useState({ pinEnabled: true, pin: '1234' });

  useEffect(() => {
    // Escuchar equipos
    const q = query(collection(db, 'teams'), orderBy('name'));
    const unsubTeams = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setTeams(list);
      setLoading(false);
    });

    // Escuchar configuración de administrador
    const unsubConfig = onSnapshot(doc(db, 'config', 'admin'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminConfig(docSnap.data() as any);
      }
    });

    return () => {
      unsubTeams();
      unsubConfig();
    };
  }, []);

  const handleAdminPress = () => {
    if (adminConfig.pinEnabled) {
      setShowPinInput(true);
    } else {
      loginAsAdmin();
    }
  };

  const handleAdminSubmit = () => {
    if (pin === adminConfig.pin) {
      loginAsAdmin();
    } else {
      setErrorMsg('PIN incorrecto. Inténtalo de nuevo.');
      setPin('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Selecciona tu Perfil</Text>
        </View>

        {showPinInput ? (
          <View style={styles.pinSection}>
            <Text style={styles.subtitle}>Introduce el PIN de Administrador</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
              value={pin}
              onChangeText={(text) => {
                setPin(text);
                setErrorMsg('');
              }}
              autoFocus
            />
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            
            <TouchableOpacity style={styles.adminBtn} onPress={handleAdminSubmit}>
              <Text style={styles.btnText}>Acceder</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPinInput(false); setPin(''); setErrorMsg(''); }}>
              <Text style={styles.cancelText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rolesSection}>
            <TouchableOpacity style={styles.adminBtn} onPress={handleAdminPress}>
              <Text style={styles.btnText}>👑 Administrador</Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <Text style={styles.subtitle}>Equipos de Trabajo</Text>
            
            {loading ? (
              <ActivityIndicator color="#002a54" />
            ) : (
              teams.map((t) => (
                <TouchableOpacity 
                  key={t.id} 
                  style={styles.teamBtn} 
                  onPress={() => loginAsTeam(t.name)}
                >
                  <Text style={styles.teamText}>🚐 {t.name}</Text>
                </TouchableOpacity>
              ))
            )}
            {!loading && teams.length === 0 && (
              <Text style={{textAlign: 'center', color: '#888'}}>No hay equipos creados.</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 30, width: '100%', maxWidth: 400, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 150, height: 80, marginBottom: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#002a54' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 15, textAlign: 'center' },
  rolesSection: { gap: 10 },
  adminBtn: { backgroundColor: '#d9534f', padding: 15, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  teamBtn: { backgroundColor: '#eef4fa', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cce0f5' },
  teamText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  pinSection: { gap: 10 },
  pinInput: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, fontSize: 24, padding: 15, textAlign: 'center', letterSpacing: 10, marginBottom: 10 },
  errorText: { color: '#d9534f', textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  cancelBtn: { padding: 15, alignItems: 'center', marginTop: 5 },
  cancelText: { color: '#888', fontWeight: 'bold' },
});
