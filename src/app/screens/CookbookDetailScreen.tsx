import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { listRecipesByCookbook } from '../services/recipes';
import { getCookbook, deleteCookbook } from '../services/cookbooks';
import { Recipe, Cookbook } from '../models/types';
import { RootStackParamList } from '../navigation/AppNavigator';
import RecipeCard from '../components/RecipeCard';
import { confirmAction, showAlert } from '../utils/confirm';
import { getCategoryLabel, getCategoryColors } from '../utils/categories';

type RouteProps = RouteProp<RootStackParamList, 'CookbookDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CookbookDetailScreen() {
  const { user } = useAuth();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const [cookbook, setCookbook] = useState<Cookbook | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      Promise.all([
        getCookbook(user.uid, route.params.cookbookId),
        listRecipesByCookbook(user.uid, route.params.cookbookId),
      ]).then(([cb, recs]) => {
        setCookbook(cb);
        setRecipes(recs);
      }).catch((err) => {
        console.error('Failed to load cookbook:', err);
        showAlert('Error', 'Failed to load cookbook recipes. The database index may still be building — try again in a minute.');
      }).finally(() => {
        setLoading(false);
      });
    }, [user, route.params.cookbookId])
  );

  function handleDelete() {
    if (!user || !cookbook) return;
    confirmAction(
      'Delete Cookbook',
      `Are you sure you want to delete "${cookbook.name}"? Recipes will not be deleted.`,
      async () => {
        await deleteCookbook(user.uid, cookbook.id);
        navigation.goBack();
      }
    );
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>{cookbook?.name ?? 'Cookbook'}</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {cookbook?.description ? <Text style={styles.description}>{cookbook.description}</Text> : null}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            categoryLabel={getCategoryLabel(item)}
            categoryColor={getCategoryColors(item).color}
            categoryBorderColor={getCategoryColors(item).borderColor}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No recipes in this cookbook yet.</Text>
        }
        contentContainerStyle={recipes.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: 16,
  },
  title: { fontSize: 22, fontWeight: 'bold', padding: 16, paddingBottom: 4, flex: 1 },
  deleteButton: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#dc3545',
  },
  deleteButtonText: { color: '#dc3545', fontWeight: '600', fontSize: 14 },
  description: { fontSize: 14, color: '#666', paddingHorizontal: 16, marginBottom: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', textAlign: 'center' },
});
