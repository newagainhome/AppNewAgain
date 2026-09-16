import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image, Linking } from 'react-native';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../config/firebase';

interface Expense {
  id: string;
  concept: string;
  date: string;
  amount: number;
  ticketUrl?: string;
  createdAt: any;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ticketImage, setTicketImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesList: Expense[] = [];
      snapshot.forEach((docSnap) => {
        expensesList.push({ id: docSnap.id, ...docSnap.data() } as Expense);
      });
      setExpenses(expensesList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setTicketImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.3,
      });
      handleImageResult(result);
    } catch (error) {
      alert('Error al seleccionar la imagen.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.3,
      });
      handleImageResult(result);
    } catch (error) {
      alert('Error al abrir la cámara.');
    }
  };

  const saveExpense = async () => {
    if (concept.trim() === '' || amount.trim() === '' || date.trim() === '') {
      alert('Por favor, completa concepto, importe y fecha.');
      return;
    }

    try {
      setUploading(true);
      let downloadUrl = '';

      if (ticketImage) {
        const response = await fetch(ticketImage);
        const blob = await response.blob();
        const fileName = `tickets/${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadBytesResumable(storageRef, blob);
        downloadUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'expenses'), {
        concept: concept.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        date: date.trim(),
        ticketUrl: downloadUrl || null,
        createdAt: new Date()
      });

      setConcept('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setTicketImage(null);
      setUploading(false);
    } catch (error) {
      alert('Hubo un error al guardar el gasto.');
      setUploading(false);
    }
  };

  const deleteExpense = async (id: string, conceptName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar el gasto "${conceptName}"?`)) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (error) {
        alert('Hubo un error al eliminar el gasto.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💸 Registrar Nuevo Gasto</Text>
      
      <View style={styles.formRow}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Concepto (ej. Gasolina Furgoneta 1)"
          value={concept}
          onChangeText={setConcept}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Importe (€)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>
      
      <View style={styles.formRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Fecha (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
        />
        <View style={{ flex: 1.5, flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.photoBtnSmall} onPress={takePhoto}>
            <Text style={styles.photoBtnText}>📷 Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtnSmall} onPress={pickImage}>
            <Text style={styles.photoBtnText}>📁 Galería</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {ticketImage && (
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <Text style={{ color: '#4a9b40', fontWeight: 'bold', marginBottom: 4 }}>✓ Ticket adjuntado correctamente</Text>
          <Image source={{ uri: ticketImage }} style={styles.previewImg} />
        </View>
      )}

      <TouchableOpacity
        style={styles.buttonAdd}
        onPress={saveExpense}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Añadir Gasto</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.titleList}>Historial de Gastos</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#d9534f" />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDate}>{item.date}</Text>
                <Text style={styles.expenseConcept}>{item.concept}</Text>
              </View>
              
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>- {item.amount.toFixed(2)} €</Text>
                <View style={styles.cardActions}>
                  {item.ticketUrl ? (
                    <TouchableOpacity style={styles.ticketBtn} onPress={() => Linking.openURL(item.ticketUrl!)}>
                      <Text style={styles.ticketIcon}>🧾 Ver Ticket</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.iconBtn} onPress={() => deleteExpense(item.id, item.concept)}>
                    <Text style={styles.actionIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay gastos registrados aún.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#d9534f' },
  titleList: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#d9534f' },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 15 },
  photoBtnSmall: { flex: 1, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dbe2ea', paddingVertical: 12, paddingHorizontal: 5, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  photoBtnText: { color: '#002a54', fontWeight: 'bold', fontSize: 13 },
  previewImg: { width: 100, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 5 },
  buttonAdd: { backgroundColor: '#d9534f', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  expenseCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#d9534f', elevation: 1 },
  expenseInfo: { flex: 1 },
  expenseDate: { fontSize: 12, color: '#777', fontWeight: 'bold', marginBottom: 2 },
  expenseConcept: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#d9534f', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ticketBtn: { backgroundColor: '#eef4fa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#cce0f5' },
  ticketIcon: { fontSize: 12, color: '#002a54', fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  actionIcon: { fontSize: 16 },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});
