import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/auth';
import { listRecipes } from '../services/recipes';
import { Recipe, RecipeSourceType } from '../models/types';
import { RootStackParamList } from '../navigation/AppNavigator';
import RecipeCard from '../components/RecipeCard';
import { CATEGORY_GROUPS, getCategoryLabel, getCategoryColors } from '../utils/categories';
import { generateRecipe } from '../services/aiService';
import { showAlert } from '../utils/confirm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MEAL_TYPES = ['Any', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];
const TIME_OPTIONS = ['Any', '15 min', '30 min', '45 min', '60 min'];

const SOURCE_FILTERS: { label: string; value: RecipeSourceType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Pinterest', value: 'pinterest' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Web', value: 'web' },
  { label: 'Manual', value: 'manual' },
  { label: 'AI', value: 'ai-generated' },
];

function categorizeRecipes(recipes: Recipe[]) {
  const assigned = new Set<string>();
  const groups: Record<string, Recipe[]> = {};

  for (const group of CATEGORY_GROUPS) {
    groups[group.key] = [];
  }

  // Assign to matching groups
  for (const recipe of recipes) {
    const cats = recipe.categories.map((c) => c.toLowerCase());
    let matched = false;
    for (const group of CATEGORY_GROUPS) {
      if (group.match.length === 0) continue; // skip 'other'
      if (group.match.some((m) => cats.includes(m))) {
        groups[group.key].push(recipe);
        assigned.add(recipe.id);
        matched = true;
        break;
      }
    }
  }

  // Unmatched go to 'other'
  for (const recipe of recipes) {
    if (!assigned.has(recipe.id)) {
      groups['other'].push(recipe);
    }
  }

  return groups;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<RecipeSourceType | 'all'>('all');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [aiFormOpen, setAiFormOpen] = useState(false);
  const [aiMealType, setAiMealType] = useState('Any');
  const [aiMaxTime, setAiMaxTime] = useState('Any');
  const [aiDietary, setAiDietary] = useState('');
  const [aiIngredients, setAiIngredients] = useState('');
  const [aiAvoid, setAiAvoid] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      listRecipes(user.uid).then((data) => {
        if (cancelled) return;
        setRecipes(data);
        setLoading(false);
      });
      return () => { cancelled = true; };
    }, [user])
  );

  function getFilteredRecipes(): Recipe[] {
    let result = recipes;
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'ai-generated') {
        result = result.filter((r) => r.sourceType === 'ai-generated' || r.sourceType === 'ai-remix');
      } else {
        result = result.filter((r) => r.sourceType === sourceFilter);
      }
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.tags.some((t) => t.toLowerCase().includes(lower)) ||
          r.categories.some((c) => c.toLowerCase().includes(lower)) ||
          r.ingredients.some((ing) => ing.name.toLowerCase().includes(lower)) ||
          (r.description ?? '').toLowerCase().includes(lower)
      );
    }
    return result;
  }

  async function handleGenerate() {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      const maxMinutes = aiMaxTime !== 'Any' ? parseInt(aiMaxTime) : undefined;
      const mealType = aiMealType !== 'Any' ? aiMealType.toLowerCase() : undefined;
      const recipe = await generateRecipe({
        mealType,
        maxMinutes,
        dietary: aiDietary.trim() || undefined,
        ingredients: aiIngredients.trim() || undefined,
        avoid: aiAvoid.trim() || undefined,
        existingTitles: recipes.map((r) => r.title),
      });
      navigation.navigate('RecipeEdit', { prefill: recipe as unknown as Record<string, unknown> });
    } catch {
      showAlert('Error', 'Failed to generate recipe. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  }

  const isSearching = search.trim().length > 0 || sourceFilter !== 'all';
  const filteredRecipes = getFilteredRecipes();
  const grouped = !isSearching ? categorizeRecipes(recipes) : null;

  return (
    <View style={styles.container}>
      {/* Header with sign out */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Recipes</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by title, tag, category, or ingredient..."
        value={search}
        onChangeText={setSearch}
      />

      {/* Source filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={SOURCE_FILTERS}
        keyExtractor={(item) => item.value}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, sourceFilter === item.value && styles.chipActive]}
            onPress={() => setSourceFilter(item.value)}
          >
            <Text style={[styles.chipText, sourceFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* AI Recipe Generator */}
      <TouchableOpacity
        style={styles.aiToggle}
        onPress={() => setAiFormOpen(!aiFormOpen)}
      >
        <Text style={styles.aiToggleText}>✨ Create with AI</Text>
        <Text style={styles.aiToggleChevron}>{aiFormOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {aiFormOpen && (
        <View style={styles.aiForm}>
          <Text style={styles.aiLabel}>Meal type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipRow}>
            {MEAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.aiChip, aiMealType === t && styles.aiChipActive]}
                onPress={() => setAiMealType(t)}
              >
                <Text style={[styles.aiChipText, aiMealType === t && styles.aiChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.aiLabel}>Max time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipRow}>
            {TIME_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.aiChip, aiMaxTime === t && styles.aiChipActive]}
                onPress={() => setAiMaxTime(t)}
              >
                <Text style={[styles.aiChipText, aiMaxTime === t && styles.aiChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.aiLabel}>Dietary preferences</Text>
          <TextInput
            style={styles.aiInput}
            placeholder="e.g. sugar-free, vegan, gluten-free..."
            value={aiDietary}
            onChangeText={setAiDietary}
          />

          <Text style={styles.aiLabel}>Key ingredients</Text>
          <TextInput
            style={styles.aiInput}
            placeholder="e.g. avocado, chicken, rice..."
            value={aiIngredients}
            onChangeText={setAiIngredients}
          />

          <Text style={styles.aiLabel}>Ingredients to avoid</Text>
          <TextInput
            style={styles.aiInput}
            placeholder="e.g. nuts, dairy, shellfish..."
            value={aiAvoid}
            onChangeText={setAiAvoid}
          />

          <TouchableOpacity
            style={styles.aiGenerateButton}
            onPress={handleGenerate}
            disabled={aiGenerating}
          >
            {aiGenerating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.aiGenerateText}>✨ Generate Recipe</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#E85D04" style={{ marginTop: 40 }} />
      ) : isSearching ? (
        /* Search results — flat list */
        <FlatList
          data={filteredRecipes}
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
            <Text style={styles.emptyText}>No recipes match your search.</Text>
          }
          contentContainerStyle={filteredRecipes.length === 0 ? styles.emptyContainer : undefined}
        />
      ) : (
        /* Default view — category containers */
        <ScrollView contentContainerStyle={styles.groupsContainer}>
          {CATEGORY_GROUPS.map((group) => {
            const groupRecipes = grouped![group.key];
            const isExpanded = expandedGroup === group.key;

            return (
              <TouchableOpacity
                key={group.key}
                style={[styles.groupCard, { backgroundColor: group.color, borderColor: group.borderColor }]}
                onPress={() => setExpandedGroup(isExpanded ? null : group.key)}
                activeOpacity={0.8}
              >
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupCount}>{groupRecipes.length}</Text>
                  </View>
                  <Text style={styles.groupChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </View>

                {!isExpanded && groupRecipes.length > 0 && (
                  <Text style={styles.groupPreview} numberOfLines={1}>
                    {groupRecipes.slice(0, 3).map((r) => r.title).join(' · ')}
                    {groupRecipes.length > 3 ? ` +${groupRecipes.length - 3} more` : ''}
                  </Text>
                )}

                {isExpanded && (
                  <View style={styles.groupRecipes}>
                    {groupRecipes.length === 0 ? (
                      <Text style={styles.groupEmpty}>No recipes in this category yet.</Text>
                    ) : (
                      groupRecipes.map((recipe) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
                        />
                      ))
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* FAB to import */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Import')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#333' },
  signOutButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  signOutText: { fontSize: 14, color: '#E85D04', fontWeight: '600' },
  searchInput: {
    margin: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, fontSize: 16, backgroundColor: '#fafafa',
  },
  filterList: { paddingHorizontal: 12, maxHeight: 44, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f0f0f0', marginHorizontal: 4,
  },
  chipActive: { backgroundColor: '#E85D04' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  groupsContainer: { paddingHorizontal: 16, paddingBottom: 80 },
  groupCard: {
    borderRadius: 14, borderWidth: 1.5, padding: 18, marginBottom: 14,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center' },
  groupTitle: { fontSize: 20, fontWeight: '700', flex: 1 },
  groupBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3, marginRight: 8,
  },
  groupCount: { fontSize: 14, fontWeight: '700', color: '#333' },
  groupChevron: { fontSize: 14, color: '#888' },
  groupPreview: { fontSize: 13, color: '#666', marginTop: 8 },
  groupRecipes: { marginTop: 12 },
  groupEmpty: { fontSize: 14, color: '#999', fontStyle: 'italic' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', textAlign: 'center', paddingHorizontal: 40 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#E85D04', alignItems: 'center',
    justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  aiToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#F3E5F5', borderRadius: 10,
  },
  aiToggleText: { fontSize: 15, fontWeight: '600', color: '#6A1B9A' },
  aiToggleChevron: { fontSize: 14, color: '#6A1B9A' },
  aiForm: {
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0',
  },
  aiLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 8, marginBottom: 4 },
  aiChipRow: { flexDirection: 'row', maxHeight: 38 },
  aiChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#f0f0f0', marginRight: 6,
  },
  aiChipActive: { backgroundColor: '#6A1B9A' },
  aiChipText: { fontSize: 13, color: '#555' },
  aiChipTextActive: { color: '#fff', fontWeight: '600' },
  aiInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10,
    fontSize: 14, backgroundColor: '#fff',
  },
  aiGenerateButton: {
    marginTop: 12, padding: 14, borderRadius: 8,
    backgroundColor: '#6A1B9A', alignItems: 'center',
  },
  aiGenerateText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
