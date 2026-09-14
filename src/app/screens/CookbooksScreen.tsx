import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { listCookbooks, createCookbook, deleteCookbook } from '../services/cookbooks';
import { Cookbook } from '../models/types';
import { RootStackParamList } from '../navigation/AppNavigator';
import { confirmAction } from '../utils/confirm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CookbooksScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      listCookbooks(user.uid).then((data) => {
        setCookbooks(data);
        setLoading(false);
      });
    }, [user])
  );

  async function handleCreate() {
    if (!user || !newName.trim()) return;
    await createCookbook(user.uid, newName.trim());
    setNewName('');
    setShowCreate(false);
    const data = await listCookbooks(user.uid);
    setCookbooks(data);
  }

  function handleDelete(cookbook: Cookbook) {
    if (!user) return;
    confirmAction('Delete Cookbook', `Delete "${cookbook.name}"?`, async () => {
      await deleteCookbook(user.uid, cookbook.id);
      const data = await listCookbooks(user.uid);
      setCookbooks(data);
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E85D04" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cookbooks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CookbookDetail', { cookbookId: item.id })}
            onLongPress={() => handleDelete(item)}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.recipeCount} recipes</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No cookbooks yet. Create one below!</Text>
        }
        contentContainerStyle={cookbooks.length === 0 ? styles.emptyContainer : undefined}
      />

      {showCreate ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            placeholder="Cookbook name"
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    padding: 16, marginHorizontal: 16, marginTop: 12,
    borderRadius: 10, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee',
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  cardSub: { fontSize: 13, color: '#888', marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', textAlign: 'center' },
  createRow: {
    flexDirection: 'row', padding: 16, gap: 8,
    borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff',
  },
  createInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#fafafa',
  },
  createButton: {
    backgroundColor: '#E85D04', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#E85D04', alignItems: 'center',
    justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
});
