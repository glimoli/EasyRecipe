import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { getRecipe, deleteRecipe, addRecipeToCookbook, removeRecipeFromCookbook } from '../services/recipes';
import { listCookbooks } from '../services/cookbooks';
import { Recipe, Cookbook } from '../models/types';
import { RootStackParamList } from '../navigation/AppNavigator';
import SourceBadge from '../components/SourceBadge';
import { confirmAction } from '../utils/confirm';
import { reviewRecipe as reviewRecipeApi, remixRecipe as remixRecipeApi, RecipeReview } from '../services/aiService';
import { showAlert } from '../utils/confirm';

type RouteProps = RouteProp<RootStackParamList, 'RecipeDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RecipeDetailScreen() {
  const { user } = useAuth();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [cookbookModalVisible, setCookbookModalVisible] = useState(false);
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [review, setReview] = useState<RecipeReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      getRecipe(user.uid, route.params.recipeId).then((r) => {
        setRecipe(r);
        setLoading(false);
      });
    }, [user, route.params.recipeId])
  );

  function handleDelete() {
    if (!user || !recipe) return;
    confirmAction(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.title}"?`,
      async () => {
        await deleteRecipe(user.uid, recipe.id);
        navigation.goBack();
      }
    );
  }

  function handleDuplicate() {
    if (!recipe) return;
    const { id, createdAt, updatedAt, ...rest } = recipe;
    const prefill = {
      ...rest,
      title: `${recipe.title} (copy)`,
    };
    navigation.navigate('RecipeEdit', { prefill: prefill as unknown as Record<string, unknown> });
  }

  async function openCookbookModal() {
    if (!user) return;
    const cbs = await listCookbooks(user.uid);
    setCookbooks(cbs);
    setCookbookModalVisible(true);
  }

  async function toggleCookbook(cookbookId: string) {
    if (!user || !recipe || togglingId) return;
    setTogglingId(cookbookId);
    const isIn = recipe.cookbookIds.includes(cookbookId);
    if (isIn) {
      await removeRecipeFromCookbook(user.uid, recipe.id, cookbookId);
      setRecipe({ ...recipe, cookbookIds: recipe.cookbookIds.filter((id) => id !== cookbookId) });
    } else {
      await addRecipeToCookbook(user.uid, recipe.id, cookbookId);
      setRecipe({ ...recipe, cookbookIds: [...recipe.cookbookIds, cookbookId] });
    }
    setTogglingId(null);
  }

  async function handleReview() {
    if (!recipe || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await reviewRecipeApi(recipe);
      setReview(result);
      setReviewModalVisible(true);
    } catch (err) {
      showAlert('Error', 'Failed to get recipe tips. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleRemix() {
    if (!recipe || aiLoading) return;
    setAiLoading(true);
    try {
      const remixed = await remixRecipeApi(recipe);
      navigation.navigate('RecipeEdit', { prefill: remixed as unknown as Record<string, unknown> });
    } catch (err) {
      showAlert('Error', 'Failed to remix recipe. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E85D04" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text>Recipe not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Image */}
      {recipe.imageUrl && recipe.imageUrl.length > 0 ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(e) => console.log('Detail image error:', e.nativeEvent)}
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No Photo</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{recipe.title}</Text>
        <SourceBadge sourceType={recipe.sourceType} label={recipe.sourcePlatformLabel} />
        {recipe.isAiGenerated && (
          <View style={styles.aiWarning}>
            <Text style={styles.aiWarningText}>
              {recipe.aiDisclaimer ??
                'AI-generated recipe — review ingredients for allergies/accuracy before cooking'}
            </Text>
          </View>
        )}
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{recipe.servings} {recipe.servingUnit || 'servings'}</Text>
        {recipe.prepTimeMinutes != null && (
          <Text style={styles.meta}>Prep: {recipe.prepTimeMinutes} min</Text>
        )}
        {recipe.cookTimeMinutes != null && (
          <Text style={styles.meta}>Cook: {recipe.cookTimeMinutes} min</Text>
        )}
        {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && (
          <Text style={styles.meta}>Total: {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</Text>
        )}
      </View>

      {/* Description */}
      {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

      {/* Two-column layout: recipe on left, nutrition on right */}
      <View style={styles.twoColumn}>
        {/* Left column: Ingredients + Steps */}
        <View style={styles.leftColumn}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients.map((ing, i) => (
            <Text key={i} style={styles.ingredient}>
              • {ing.quantity > 0 ? `${ing.quantity} ${ing.unit}` : ''} {ing.name}
              {ing.notes ? ` (${ing.notes})` : ''}
            </Text>
          ))}

          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.steps.map((step) => (
            <View key={step.order} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{step.order}</Text>
              <Text style={styles.stepText}>{step.instruction}</Text>
            </View>
          ))}

          {/* Variations */}
          {recipe.variations && recipe.variations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Variations</Text>
              {recipe.variations.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                <Text key={i} style={styles.variationItem}>💡 {line.trim()}</Text>
              ))}
            </>
          )}

          {/* Notes */}
          {recipe.notes && recipe.notes.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              {recipe.notes.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                <Text key={i} style={styles.noteItem}>📝 {line.trim()}</Text>
              ))}
            </>
          )}
        </View>

        {/* Right column: Nutrition */}
        <View style={styles.rightColumn}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <Text style={styles.nutritionSubtitle}>Per serving</Text>
          {recipe.nutrition ? (
            <View style={styles.nutritionStack}>
              <View style={styles.nutritionCardLarge}>
                <Text style={styles.nutritionValueLarge}>{recipe.nutrition.calories}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.proteinG}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.carbsG}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
              </View>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.fatG}g</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.fiberG}g</Text>
                  <Text style={styles.nutritionLabel}>Fiber</Text>
                </View>
              </View>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionCard}>
                  <Text style={styles.nutritionValue}>{recipe.nutrition.sodiumMg}mg</Text>
                  <Text style={styles.nutritionLabel}>Sodium</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.nutritionMissing}>
              No nutrition data yet. Edit recipe to auto-calculate.
            </Text>
          )}

          {/* AI actions */}
          <View style={styles.aiActions}>
            <TouchableOpacity
              style={[styles.aiButton, styles.reviewButton]}
              onPress={handleReview}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="#1565C0" />
              ) : (
                <Text style={styles.reviewButtonText}>💡 Get Tips</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aiButton, styles.remixButton]}
              onPress={handleRemix}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="#6A1B9A" />
              ) : (
                <Text style={styles.remixButtonText}>✨ Remix</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {recipe.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {recipe.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('RecipeEdit', { recipeId: recipe.id })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.duplicateButton} onPress={handleDuplicate}>
          <Text style={styles.duplicateButtonText}>Duplicate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cookbookButton} onPress={openCookbookModal}>
        <Text style={styles.cookbookButtonText}>📚 Add to Cookbook</Text>
      </TouchableOpacity>

      {/* Review tips modal */}
      <Modal visible={reviewModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💡 Recipe Tips</Text>
            {review && (
              <>
                <Text style={styles.overallRating}>{review.overallRating}</Text>
                <FlatList
                  data={review.tips}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item }) => (
                    <View style={styles.tipRow}>
                      <Text style={styles.tipCategory}>{item.category.toUpperCase()}</Text>
                      <Text style={styles.tipText}>{item.suggestion}</Text>
                    </View>
                  )}
                />
              </>
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setReviewModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cookbook modal */}
      <Modal visible={cookbookModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Cookbook</Text>
            {cookbooks.length === 0 ? (
              <Text style={styles.modalEmpty}>No cookbooks yet. Create one from the Cookbooks tab.</Text>
            ) : (
              <FlatList
                data={cookbooks}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isIn = recipe.cookbookIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.modalRow, isIn && styles.modalRowActive]}
                      onPress={() => toggleCookbook(item.id)}
                      disabled={togglingId === item.id}
                    >
                      <Text style={styles.modalCheck}>{isIn ? '☑' : '☐'}</Text>
                      <Text style={styles.modalRowText}>{item.name}</Text>
                      {togglingId === item.id && (
                        <ActivityIndicator size="small" color="#E85D04" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setCookbookModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 250 },
  imagePlaceholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { color: '#999', fontSize: 16 },
  header: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  aiWarning: {
    backgroundColor: '#FFF3CD', borderRadius: 8, padding: 10, marginTop: 8,
  },
  aiWarningText: { color: '#856404', fontSize: 13 },
  metaRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 16, marginBottom: 12 },
  meta: { fontSize: 14, color: '#666' },
  description: { paddingHorizontal: 16, marginBottom: 16, color: '#444', lineHeight: 22 },
  twoColumn: { flexDirection: 'row', paddingHorizontal: 8 },
  leftColumn: { flex: 3, paddingRight: 8 },
  rightColumn: {
    flex: 1.2, backgroundColor: '#FAFFFE', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E0F0E0', marginTop: 16, alignSelf: 'flex-start',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 8, marginTop: 16, marginBottom: 8 },
  nutritionSubtitle: { fontSize: 12, color: '#888', paddingHorizontal: 8, marginBottom: 12 },
  ingredient: { paddingHorizontal: 16, fontSize: 15, lineHeight: 26, color: '#333' },
  stepRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 12 },
  stepNumber: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#E85D04',
    color: '#fff', textAlign: 'center', lineHeight: 28, fontSize: 14,
    fontWeight: '600', marginRight: 12,
  },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, color: '#333' },
  variationItem: { paddingHorizontal: 16, fontSize: 14, lineHeight: 24, color: '#555', marginBottom: 4 },
  noteItem: { paddingHorizontal: 16, fontSize: 14, lineHeight: 24, color: '#555', marginBottom: 4 },
  nutritionStack: { gap: 8 },
  nutritionRow: { flexDirection: 'row', gap: 8 },
  nutritionCardLarge: {
    backgroundColor: '#F0FFF0', borderRadius: 10, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#D0F0D0',
  },
  nutritionCard: {
    flex: 1, backgroundColor: '#F0FFF0', borderRadius: 10, padding: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#D0F0D0',
  },
  nutritionValueLarge: { fontSize: 28, fontWeight: '700', color: '#2D7D2D' },
  nutritionValue: { fontSize: 16, fontWeight: '700', color: '#2D7D2D' },
  nutritionLabel: { fontSize: 10, color: '#666', marginTop: 2, textTransform: 'uppercase' },
  nutritionMissing: {
    fontSize: 13, color: '#999', fontStyle: 'italic',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 8 },
  tag: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: '#666' },
  actions: { flexDirection: 'row', padding: 16, gap: 12, marginBottom: 40 },
  editButton: {
    flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#E85D04', alignItems: 'center',
  },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  deleteButton: {
    flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#dc3545', alignItems: 'center',
  },
  deleteButtonText: { color: '#dc3545', fontWeight: '600', fontSize: 16 },
  duplicateButton: {
    flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E85D04', alignItems: 'center',
  },
  duplicateButtonText: { color: '#E85D04', fontWeight: '600', fontSize: 16 },
  cookbookButton: {
    marginHorizontal: 16, marginBottom: 40, padding: 14, borderRadius: 8,
    backgroundColor: '#F3E5F5', alignItems: 'center',
  },
  cookbookButtonText: { color: '#7B1FA2', fontWeight: '600', fontSize: 16 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '60%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalEmpty: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    paddingHorizontal: 12, borderRadius: 8, marginBottom: 4,
  },
  modalRowActive: { backgroundColor: '#F3E5F5' },
  modalCheck: { fontSize: 20, marginRight: 12 },
  modalRowText: { fontSize: 16, color: '#333' },
  modalClose: {
    marginTop: 16, padding: 14, borderRadius: 8,
    backgroundColor: '#E85D04', alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  aiActions: {
    flexDirection: 'column', gap: 8, marginTop: 16,
  },
  aiButton: {
    padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1,
  },
  reviewButton: {
    backgroundColor: '#E3F2FD', borderColor: '#90CAF9',
  },
  reviewButtonText: { color: '#1565C0', fontWeight: '600', fontSize: 15 },
  remixButton: {
    backgroundColor: '#F3E5F5', borderColor: '#CE93D8',
  },
  remixButtonText: { color: '#6A1B9A', fontWeight: '600', fontSize: 15 },
  overallRating: {
    fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 16,
    paddingHorizontal: 4, fontStyle: 'italic',
  },
  tipRow: {
    backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  tipCategory: {
    fontSize: 11, fontWeight: '700', color: '#E85D04', marginBottom: 4,
    letterSpacing: 0.5,
  },
  tipText: { fontSize: 14, color: '#333', lineHeight: 20 },
});
