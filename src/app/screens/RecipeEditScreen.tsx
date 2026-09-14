import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { getRecipe, createRecipe, updateRecipe } from '../services/recipes';
import { calculateNutrition } from '../services/nutritionLookup';
import { Recipe, Ingredient, RecipeStep, RecipeCategory } from '../models/types';
import { RootStackParamList } from '../navigation/AppNavigator';

type RouteProps = RouteProp<RootStackParamList, 'RecipeEdit'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const CATEGORY_OPTIONS = [
  { key: 'breakfast', label: '🌅 Breakfast' },
  { key: 'lunch', label: '🍽️ Lunch' },
  { key: 'dinner', label: '🍽️ Dinner' },
  { key: 'dessert', label: '🍰 Dessert' },
  { key: 'snack', label: '🍿 Snack' },
  { key: 'appetizer', label: '🥗 Appetizer' },
  { key: 'beverage', label: '🥤 Beverage' },
  { key: 'other', label: '📋 Other' },
];

export default function RecipeEditScreen() {
  const { user } = useAuth();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();

  const recipeId = route.params?.recipeId;
  const prefill = route.params?.prefill;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [servings, setServings] = useState('4');
  const [servingUnit, setServingUnit] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [categories, setCategories] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string>('');
  const [variations, setVariations] = useState('');
  const [notes, setNotes] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sodium, setSodium] = useState('');
  const [calculatingNutrition, setCalculatingNutrition] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceData, setSourceData] = useState<Partial<Recipe>>({});

  useEffect(() => {
    if (prefill) {
      applyData(prefill as unknown as Partial<Recipe>);
    } else if (recipeId && user) {
      getRecipe(user.uid, recipeId).then((r) => {
        if (r) applyData(r);
      });
    }
  }, []);

  function applyData(data: Partial<Recipe>) {
    setSourceData(data);
    setTitle(data.title ?? '');
    setDescription(data.description ?? '');
    setImageUrl(data.imageUrl ?? '');
    setServings(String(data.servings ?? 4));
    setServingUnit(data.servingUnit ?? '');
    setPrepTime(data.prepTimeMinutes ? String(data.prepTimeMinutes) : '');
    setCookTime(data.cookTimeMinutes ? String(data.cookTimeMinutes) : '');
    if (data.ingredients) {
      setIngredientsText(
        data.ingredients.map((i) => {
          const hasQuantity = i.quantity > 0 && i.unit !== 'to_taste';
          return hasQuantity
            ? `${i.quantity} ${i.unit} ${i.name}${i.notes ? ` (${i.notes})` : ''}`
            : `${i.name}${i.notes ? ` (${i.notes})` : ''}`;
        }).join('\n')
      );
    }
    if (data.steps) {
      setStepsText(data.steps.map((s) => s.instruction).join('\n'));
    }
    setCategories((data.categories ?? []).join(', '));
    setSelectedCategories(data.categories ?? []);
    setTags((data.tags ?? []).join(', '));
    setVariations(data.variations ?? '');
    setNotes(data.notes ?? '');
    if (data.nutrition) {
      setCalories(data.nutrition.calories ? String(data.nutrition.calories) : '');
      setProtein(data.nutrition.proteinG ? String(data.nutrition.proteinG) : '');
      setCarbs(data.nutrition.carbsG ? String(data.nutrition.carbsG) : '');
      setFat(data.nutrition.fatG ? String(data.nutrition.fatG) : '');
      setFiber(data.nutrition.fiberG ? String(data.nutrition.fiberG) : '');
      setSodium(data.nutrition.sodiumMg ? String(data.nutrition.sodiumMg) : '');
    }
  }

  function toggleCategory(key: string) {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  }

  const VALID_UNITS = new Set([
    'tsp', 'tbsp', 'cup', 'ml', 'liter', 'oz', 'fl_oz',
    'g', 'kg', 'lb', 'piece', 'pinch', 'to_taste',
  ]);

  function parseIngredients(text: string): Ingredient[] {
    return text
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const cleaned = line.trim().replace(/^[-•*☐☑]\s*/, '');
        const parts = cleaned.split(/\s+/);
        const maybeQty = parseFloat(parts[0]);
        const hasQuantity = !isNaN(maybeQty) && parts.length >= 2;

        if (hasQuantity) {
          const maybeUnit = parts[1]?.toLowerCase();
          if (VALID_UNITS.has(maybeUnit)) {
            return {
              name: parts.slice(2).join(' ') || cleaned,
              quantity: maybeQty,
              unit: maybeUnit as Ingredient['unit'],
            };
          }
          // Number but no valid unit — treat as quantity + piece
          return {
            name: parts.slice(1).join(' ') || cleaned,
            quantity: maybeQty,
            unit: 'piece' as Ingredient['unit'],
          };
        }

        // No quantity — just ingredient name
        return { name: cleaned, quantity: 0, unit: 'to_taste' as Ingredient['unit'] };
      });
  }

  function parseSteps(text: string): RecipeStep[] {
    return text
      .split('\n')
      .filter((l) => l.trim())
      .map((line, i) => ({
        order: i + 1,
        instruction: line.trim().replace(/^\d+[\.\)]\s*/, ''),
      }));
  }

  async function handleAutoCalculateNutrition() {
    const ingredients = parseIngredients(ingredientsText);
    if (ingredients.length === 0) {
      showAlert('No ingredients', 'Add some ingredients first, then calculate nutrition.');
      return;
    }
    setCalculatingNutrition(true);
    try {
      const numServings = parseInt(servings, 10) || 4;
      const result = await calculateNutrition(ingredients, numServings);

      setCalories(String(result.perServing.calories));
      setProtein(String(result.perServing.proteinG));
      setCarbs(String(result.perServing.carbsG));
      setFat(String(result.perServing.fatG));
      setFiber(String(result.perServing.fiberG));
      setSodium(String(result.perServing.sodiumMg));

      showAlert(
        'Nutrition Calculated',
        `Matched ${result.matched} of ${result.total_ingredients} ingredients via USDA database.\n\nValues shown are per serving (${numServings} servings).\n\nTotal recipe: ${result.total.calories} cal, ${result.total.proteinG}g protein, ${result.total.carbsG}g carbs, ${result.total.fatG}g fat`
        + (result.unmatched.length > 0
          ? `\n\nCould not find:\n${result.unmatched.map((n) => `  • ${n}`).join('\n')}\n\nYou can manually adjust the nutrition values below.`
          : '')
      );
    } catch (e) {
      console.error('Nutrition calc failed:', e);
      showAlert('Error', 'Failed to calculate nutrition. Check your internet connection.');
    } finally {
      setCalculatingNutrition(false);
    }
  }

  async function handleSave() {
    if (!user || !title.trim()) {
      showAlert('Missing title', 'Please enter a recipe title.');
      return;
    }
    setLoading(true);
    try {
      const recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        description: description.trim() || undefined,
        sourceType: sourceData.sourceType ?? 'manual',
        sourceUrl: sourceData.sourceUrl,
        sourcePlatformLabel: sourceData.sourcePlatformLabel,
        sourceRecipeIds: sourceData.sourceRecipeIds,
        isAiGenerated: sourceData.isAiGenerated ?? false,
        aiDisclaimer: sourceData.aiDisclaimer,
        imageUrl: imageUrl.trim() || '',
        ingredients: parseIngredients(ingredientsText),
        steps: parseSteps(stepsText),
        servings: parseInt(servings, 10) || 4,
        servingUnit: servingUnit.trim() || '',
        prepTimeMinutes: prepTime ? parseInt(prepTime, 10) : undefined,
        cookTimeMinutes: cookTime ? parseInt(cookTime, 10) : undefined,
        categories: selectedCategories as RecipeCategory[],
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        variations: variations.trim() || '',
        notes: notes.trim() || '',
        nutrition: (calories || protein || carbs || fat) ? {
          calories: parseFloat(calories) || 0,
          proteinG: parseFloat(protein) || 0,
          carbsG: parseFloat(carbs) || 0,
          fatG: parseFloat(fat) || 0,
          fiberG: parseFloat(fiber) || 0,
          sodiumMg: parseFloat(sodium) || 0,
        } : undefined,
        cookbookIds: sourceData.cookbookIds ?? [],
      };

      console.log('Saving recipe...', recipeData.title);

      if (recipeId) {
        await updateRecipe(user.uid, recipeId, recipeData);
        console.log('Recipe updated:', recipeId);
      } else {
        const newId = await createRecipe(user.uid, recipeData);
        console.log('Recipe created:', newId);
      }

      // Navigate back to recipe list
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Main');
      }
    } catch (e: unknown) {
      console.error('Save failed:', e);
      const message = e instanceof Error ? e.message : 'Save failed';
      showAlert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Recipe title" />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Short description" />

      <Text style={styles.label}>Image URL (optional)</Text>
      <Text style={styles.hint}>Right-click a photo on any website → "Copy image address" → paste here. Must be a direct image link (e.g. .jpg, .png, .webp)</Text>
      <TextInput
        style={styles.input}
        value={imageUrl}
        onChangeText={setImageUrl}
        placeholder="https://example.com/photo.jpg"
        autoCapitalize="none"
        keyboardType="url"
      />
      {imageUrl.trim() ? (
        <View style={styles.imagePreview}>
          <Text style={styles.imagePreviewLabel}>Preview:</Text>
          <Image
            source={{ uri: imageUrl.trim() }}
            style={styles.imagePreviewImg}
            resizeMode="cover"
            onError={(e) => console.log('Image load error:', e.nativeEvent)}
          />
          <Text style={styles.imagePreviewUrl} numberOfLines={1}>{imageUrl}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionHeader}>Serving & Time</Text>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Servings</Text>
          <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="4" />
        </View>
        <View style={[styles.rowItem, { flex: 1.5 }]}>
          <Text style={styles.label}>Serving Size</Text>
          <TextInput style={styles.input} value={servingUnit} onChangeText={setServingUnit} placeholder="e.g. cups, slices, pieces" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Prep (min)</Text>
          <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" placeholder="15" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Cook (min)</Text>
          <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholder="30" />
        </View>
      </View>

      <Text style={styles.label}>Ingredients (one per line: quantity unit name)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={ingredientsText}
        onChangeText={setIngredientsText}
        placeholder={"2 cup flour\n1 tsp salt\n3 piece eggs"}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Instructions (one step per line)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={stepsText}
        onChangeText={setStepsText}
        placeholder={"Preheat oven to 350°F\nMix dry ingredients..."}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <Text style={styles.sectionHeader}>Categories</Text>
      <Text style={styles.hint}>Select all that apply</Text>
      <View style={styles.checklistRow}>
        {CATEGORY_OPTIONS.map((opt) => {
          const isSelected = selectedCategories.includes(opt.key);
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.checklistItem, isSelected && styles.checklistItemSelected]}
              onPress={() => toggleCategory(opt.key)}
            >
              <Text style={styles.checklistCheck}>{isSelected ? '☑' : '☐'}</Text>
              <Text style={[styles.checklistLabel, isSelected && styles.checklistLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Tags (comma-separated)</Text>
      <TextInput
        style={styles.input}
        value={tags}
        onChangeText={setTags}
        placeholder="quick, healthy, keto"
      />

      <Text style={styles.sectionHeader}>Variations (optional)</Text>
      <Text style={styles.hint}>Add recipe variations, substitutions, or tips for different dietary needs</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={variations}
        onChangeText={setVariations}
        placeholder={"Use coconut oil instead of butter for dairy-free\nSubstitute almond flour for gluten-free\nAdd chili flakes for extra heat"}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.sectionHeader}>Notes (optional)</Text>
      <Text style={styles.hint}>Personal notes, tips, or reminders about this recipe</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder={"Best served with rice\nCan be stored in the fridge for 3 days\nKids loved this one!"}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.sectionHeader}>Nutrition (per serving)</Text>
      <TouchableOpacity
        style={[styles.autoCalcButton, calculatingNutrition && styles.buttonDisabled]}
        onPress={handleAutoCalculateNutrition}
        disabled={calculatingNutrition}
      >
        {calculatingNutrition ? (
          <View style={styles.autoCalcRow}>
            <ActivityIndicator color="#E85D04" size="small" />
            <Text style={styles.autoCalcText}>  Looking up ingredients...</Text>
          </View>
        ) : (
          <Text style={styles.autoCalcText}>🔍 Auto-calculate from ingredients</Text>
        )}
      </TouchableOpacity>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Calories</Text>
          <TextInput style={styles.input} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="0" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Protein (g)</Text>
          <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="0" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Carbs (g)</Text>
          <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="0" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Fat (g)</Text>
          <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="0" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Fiber (g)</Text>
          <TextInput style={styles.input} value={fiber} onChangeText={setFiber} keyboardType="numeric" placeholder="0" />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Sodium (mg)</Text>
          <TextInput style={styles.input} value={sodium} onChangeText={setSodium} keyboardType="numeric" placeholder="0" />
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        <Text style={styles.buttonText}>{recipeId ? 'Update Recipe' : 'Save Recipe'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  hint: { fontSize: 12, color: '#888', marginBottom: 8 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#E85D04', marginTop: 8, marginBottom: 12 },
  autoCalcButton: {
    backgroundColor: '#FFF4EC', borderRadius: 8, padding: 14, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FFE0CC',
  },
  autoCalcRow: { flexDirection: 'row', alignItems: 'center' },
  autoCalcText: { fontSize: 15, color: '#E85D04', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  rowItem: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
    fontSize: 15, backgroundColor: '#fafafa', marginBottom: 16,
  },
  textArea: { height: 140 },
  imagePreview: { marginBottom: 16 },
  imagePreviewLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  imagePreviewImg: {
    width: '100%', height: 180, borderRadius: 8, backgroundColor: '#f0f0f0', marginBottom: 4,
  },
  imagePreviewUrl: { fontSize: 12, color: '#555' },
  button: {
    backgroundColor: '#E85D04', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  checklistRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  checklistItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
  },
  checklistItemSelected: {
    backgroundColor: '#FFF4EC', borderColor: '#E85D04',
  },
  checklistCheck: { fontSize: 18, marginRight: 6 },
  checklistLabel: { fontSize: 14, color: '#555' },
  checklistLabelSelected: { color: '#E85D04', fontWeight: '600' },
});
