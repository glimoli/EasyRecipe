import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { extractRecipeFromUrl } from '../services/recipeExtractor';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ImportMode = 'manual' | 'text' | 'url' | 'keep' | 'mfp';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Parse MyFitnessPal CSV export rows into recipes.
 * MFP export typically has columns: Name, Ingredients, Servings, Calories, etc.
 * The format varies but commonly the foods/recipes CSV has these fields.
 */
function parseMfpCsv(csvText: string): Record<string, unknown>[] {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const recipes: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    // Try to find name/title column
    const title = row['name'] || row['recipe name'] || row['food name'] || row['title'] || '';
    if (!title.trim()) continue;

    recipes.push({
      title: title.trim(),
      sourceType: 'manual',
      isAiGenerated: false,
      ingredients: parseIngredientsFromMfp(row['ingredients'] || row['ingredient'] || ''),
      steps: [],
      servings: parseInt(row['servings'] || row['number of servings'] || '1', 10) || 1,
      categories: [] as string[],
      tags: ['myfitnesspal'],
      cookbookIds: [] as string[],
      nutrition: {
        calories: parseFloat(row['calories'] || row['energy (kcal)'] || '0') || 0,
        proteinG: parseFloat(row['protein (g)'] || row['protein'] || '0') || 0,
        carbsG: parseFloat(row['carbohydrates (g)'] || row['carbs'] || row['total carbohydrate'] || '0') || 0,
        fatG: parseFloat(row['fat (g)'] || row['fat'] || row['total fat'] || '0') || 0,
        fiberG: parseFloat(row['fiber (g)'] || row['fiber'] || row['dietary fiber'] || '0') || 0,
        sodiumMg: parseFloat(row['sodium (mg)'] || row['sodium'] || '0') || 0,
      },
    });
  }
  return recipes;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseIngredientsFromMfp(ingredientsStr: string) {
  if (!ingredientsStr.trim()) return [];
  return ingredientsStr.split(/[;,\n]/).filter((s) => s.trim()).map((s) => ({
    name: s.trim(),
    quantity: 0,
    unit: 'to_taste' as const,
  }));
}

/**
 * Parse Google Keep JSON export (from Google Takeout) into recipe data.
 * Keep notes have: title, textContent, listContent[{text, isChecked}]
 */
function parseGoogleKeepJson(json: Record<string, unknown>) {
  const title = (json.title as string) || 'Untitled Recipe';

  // Keep can store content as textContent (plain text) or listContent (checklist)
  let rawText = '';
  if (json.textContent && typeof json.textContent === 'string') {
    rawText = json.textContent;
  } else if (Array.isArray(json.listContent)) {
    rawText = (json.listContent as { text: string; isChecked: boolean }[])
      .map((item) => item.text)
      .join('\n');
  }

  // Use the same local parser
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let inSteps = false;

  for (const line of lines) {
    if (/^\d+[\.\)]/.test(line) || /^step\s/i.test(line)) {
      inSteps = true;
    }
    if (/^(instructions|directions|method|steps)/i.test(line)) {
      inSteps = true;
      continue;
    }
    if (/^(ingredients)/i.test(line)) {
      inSteps = false;
      continue;
    }
    if (inSteps) {
      stepLines.push(line);
    } else {
      ingredientLines.push(line);
    }
  }

  // Extract labels from Keep as tags
  const labels = Array.isArray(json.labels)
    ? (json.labels as { name: string }[]).map((l) => l.name)
    : [];

  return {
    title,
    sourceType: 'manual' as const,
    isAiGenerated: false,
    ingredients: ingredientLines.map((l) => ({
      name: l.replace(/^[-•*☐☑]\s*/, ''),
      quantity: 0,
      unit: 'to_taste' as const,
    })),
    steps: stepLines.map((l, i) => ({
      order: i + 1,
      instruction: l.replace(/^\d+[\.\)]\s*/, ''),
    })),
    servings: 4,
    categories: [] as string[],
    tags: ['google-keep', ...labels],
    cookbookIds: [] as string[],
  };
}

/**
 * Basic client-side parser: splits pasted text into a title (first line)
 * and the rest as raw ingredients/steps for the user to review.
 */
function parseTextLocally(raw: string) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = lines[0] ?? 'Untitled Recipe';

  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let inSteps = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Heuristic: lines starting with a number + period/paren are steps
    if (/^\d+[\.\)]/.test(line) || /^step\s/i.test(line)) {
      inSteps = true;
    }
    // Also switch to steps on common headers
    if (/^(instructions|directions|method|steps)/i.test(line)) {
      inSteps = true;
      continue;
    }
    if (/^(ingredients)/i.test(line)) {
      inSteps = false;
      continue;
    }

    if (inSteps) {
      stepLines.push(line);
    } else {
      ingredientLines.push(line);
    }
  }

  return {
    title,
    sourceType: 'manual' as const,
    isAiGenerated: false,
    ingredients: ingredientLines.map((l) => ({
      name: l.replace(/^[-•*]\s*/, ''),
      quantity: 0,
      unit: 'to_taste' as const,
    })),
    steps: stepLines.map((l, i) => ({
      order: i + 1,
      instruction: l.replace(/^\d+[\.\)]\s*/, ''),
    })),
    servings: 4,
    categories: [] as string[],
    tags: ['manual'],
    cookbookIds: [] as string[],
  };
}

export default function ImportScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<ImportMode>('manual');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [keepJson, setKeepJson] = useState('');
  const [keepTagFilter, setKeepTagFilter] = useState('');
  const [mfpCsv, setMfpCsv] = useState('');
  const [loading, setLoading] = useState(false);

  function handleManualEntry() {
    navigation.navigate('RecipeEdit', {});
  }

  function handlePasteText() {
    if (!text.trim()) return;
    const parsed = parseTextLocally(text);
    navigation.navigate('RecipeEdit', { prefill: parsed as unknown as Record<string, unknown> });
  }

  function keepNoteMatchesFilter(json: Record<string, unknown>): boolean {
    if (!keepTagFilter.trim()) return true;
    const filterTags = keepTagFilter.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
    const noteLabels = Array.isArray(json.labels)
      ? (json.labels as { name: string }[]).map((l) => l.name.toLowerCase())
      : [];
    return filterTags.some((f) => noteLabels.includes(f));
  }

  function handleKeepFileUpload() {
    if (Platform.OS !== 'web') {
      showAlert('Not supported', 'Google Keep import via file upload is only available on web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const results: string[] = [];
      let imported = 0;

      for (let i = 0; i < files.length; i++) {
        try {
          const fileText = await files[i].text();
          const json = JSON.parse(fileText);

          // Skip trashed notes
          if (json.isTrashed) continue;

          // Filter by label/tag if specified
          if (!keepNoteMatchesFilter(json)) continue;

          const parsed = parseGoogleKeepJson(json);
          if (files.length === 1) {
            // Single file: go to edit screen
            navigation.navigate('RecipeEdit', { prefill: parsed as unknown as Record<string, unknown> });
            return;
          }
          // Multiple files: batch import
          const { createRecipe } = await import('../services/recipes');
          if (user) {
            await createRecipe(user.uid, parsed as any);
            imported++;
            results.push(`✓ ${parsed.title}`);
          }
        } catch (err) {
          results.push(`✗ ${files[i].name}: ${err instanceof Error ? err.message : 'Parse error'}`);
        }
      }

      if (imported > 0) {
        showAlert('Import Complete', `Imported ${imported} recipe(s) from Google Keep.\n\n${results.join('\n')}`);
        navigation.navigate('Main');
      } else {
        showAlert('No recipes imported', results.join('\n'));
      }
    };
    input.click();
  }

  async function handleKeepPasteJson() {
    if (!keepJson.trim()) return;
    try {
      const parsed = JSON.parse(keepJson);
      const notes: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

      // Filter out trashed notes and apply label filter
      const filtered = notes.filter((n) => !n.isTrashed && keepNoteMatchesFilter(n));

      if (filtered.length === 0) {
        showAlert('No matching notes', keepTagFilter.trim()
          ? `No notes found with labels: ${keepTagFilter}. Check your labels or clear the filter.`
          : 'No valid notes found in the pasted JSON.');
        return;
      }

      if (filtered.length === 1) {
        const recipe = parseGoogleKeepJson(filtered[0]);
        navigation.navigate('RecipeEdit', { prefill: recipe as unknown as Record<string, unknown> });
        return;
      }

      // Multiple notes: batch import
      const { createRecipe } = await import('../services/recipes');
      const results: string[] = [];
      let imported = 0;
      for (const note of filtered) {
        try {
          const recipe = parseGoogleKeepJson(note);
          if (user) {
            await createRecipe(user.uid, recipe as any);
            imported++;
            results.push(`\u2713 ${recipe.title}`);
          }
        } catch (err) {
          results.push(`\u2717 ${(note.title as string) || 'Unknown'}: ${err instanceof Error ? err.message : 'Error'}`);
        }
      }
      showAlert('Import Complete', `Imported ${imported} of ${filtered.length} notes.\n\n${results.join('\n')}`);
      navigation.navigate('Main');
    } catch {
      showAlert('Invalid JSON', 'Could not parse the JSON. Make sure you pasted valid JSON — either a single note object or an array of notes.');
    }
  }

  function handleMfpFileUpload() {
    if (Platform.OS !== 'web') {
      showAlert('Not supported', 'MyFitnessPal CSV import is only available on web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const csvText = await files[0].text();
      const recipes = parseMfpCsv(csvText);
      if (recipes.length === 0) {
        showAlert('No recipes found', 'Could not find any recipes in the CSV file. Make sure it contains a header row with columns like Name, Ingredients, Calories, etc.');
        return;
      }
      if (recipes.length === 1) {
        navigation.navigate('RecipeEdit', { prefill: recipes[0] as unknown as Record<string, unknown> });
        return;
      }
      // Batch import
      const { createRecipe } = await import('../services/recipes');
      const results: string[] = [];
      let imported = 0;
      for (const recipe of recipes) {
        try {
          if (user) {
            await createRecipe(user.uid, recipe as any);
            imported++;
            results.push(`\u2713 ${recipe.title}`);
          }
        } catch (err) {
          results.push(`\u2717 ${recipe.title}: ${err instanceof Error ? err.message : 'Error'}`);
        }
      }
      showAlert('Import Complete', `Imported ${imported} of ${recipes.length} recipes from MyFitnessPal.\n\n${results.join('\n')}`);
      navigation.navigate('Main');
    };
    input.click();
  }

  function handleMfpPasteCsv() {
    if (!mfpCsv.trim()) return;
    const recipes = parseMfpCsv(mfpCsv);
    if (recipes.length === 0) {
      showAlert('No recipes found', 'Could not parse any recipes from the pasted CSV.');
      return;
    }
    if (recipes.length === 1) {
      navigation.navigate('RecipeEdit', { prefill: recipes[0] as unknown as Record<string, unknown> });
      return;
    }
    // Multiple — go batch
    (async () => {
      const { createRecipe } = await import('../services/recipes');
      const results: string[] = [];
      let imported = 0;
      for (const recipe of recipes) {
        try {
          if (user) {
            await createRecipe(user.uid, recipe as any);
            imported++;
            results.push(`\u2713 ${recipe.title}`);
          }
        } catch (err) {
          results.push(`\u2717 ${recipe.title}: ${err instanceof Error ? err.message : 'Error'}`);
        }
      }
      showAlert('Import Complete', `Imported ${imported} of ${recipes.length} recipes.\n\n${results.join('\n')}`);
      navigation.navigate('Main');
    })();
  }

  async function handleImportUrl() {
    if (!url.trim() || !user) return;

    try {
      new URL(url);
    } catch {
      showAlert('Invalid URL', 'Please enter a valid URL.');
      return;
    }

    setLoading(true);
    try {
      const recipe = await extractRecipeFromUrl(url);
      navigation.navigate('RecipeEdit', { prefill: recipe as unknown as Record<string, unknown> });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not extract recipe';
      showAlert('Import Failed', message + '\n\nNote: URL extraction requires Cloud Functions to be deployed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Import a Recipe</Text>

      {/* Mode toggle */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeText, mode === 'manual' && styles.modeTextActive]}>Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'text' && styles.modeActive]}
            onPress={() => setMode('text')}
          >
            <Text style={[styles.modeText, mode === 'text' && styles.modeTextActive]}>
              Paste Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'url' && styles.modeActive]}
            onPress={() => setMode('url')}
          >
            <Text style={[styles.modeText, mode === 'url' && styles.modeTextActive]}>From URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'keep' && styles.modeActive]}
            onPress={() => setMode('keep')}
          >
            <Text style={[styles.modeText, mode === 'keep' && styles.modeTextActive]}>Google Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'mfp' && styles.modeActive]}
            onPress={() => setMode('mfp')}
          >
            <Text style={[styles.modeText, mode === 'mfp' && styles.modeTextActive]}>MyFitnessPal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {mode === 'manual' ? (
        <>
          <Text style={styles.label}>Create a Recipe Manually</Text>
          <Text style={styles.hint}>
            Fill in the title, ingredients, and instructions yourself.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleManualEntry}>
            <Text style={styles.buttonText}>Create Recipe</Text>
          </TouchableOpacity>
        </>
      ) : mode === 'text' ? (
        <>
          <Text style={styles.label}>Paste Recipe Text</Text>
          <Text style={styles.hint}>
            Paste the full recipe text below. First line becomes the title.
            Lines before numbered steps are treated as ingredients.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={"Chicken Parmesan\n2 chicken breasts\n1 cup breadcrumbs\n1 cup marinara sauce\n1. Bread the chicken\n2. Fry until golden\n3. Top with sauce and cheese\n4. Bake at 375°F for 20 min"}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !text.trim() && styles.buttonDisabled]}
            onPress={handlePasteText}
            disabled={!text.trim()}
          >
            <Text style={styles.buttonText}>Parse & Edit Recipe</Text>
          </TouchableOpacity>
        </>
      ) : mode === 'url' ? (
        <>
          <Text style={styles.label}>Recipe URL</Text>
          <Text style={styles.hint}>
            Paste a link from TikTok, Instagram, YouTube, Pinterest, Facebook, or any recipe site.
            {'\n'}⚠️ Requires Cloud Functions (Blaze plan) to be deployed.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.button, (!url.trim() || loading) && styles.buttonDisabled]}
            onPress={handleImportUrl}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Extract Recipe</Text>
            )}
          </TouchableOpacity>
        </>
      ) : mode === 'keep' ? (
        <>
          <Text style={styles.label}>Import from Google Keep</Text>
          <Text style={styles.hint}>
            Export your notes from Google Takeout:{'\n'}
            1. Go to takeout.google.com{'\n'}
            2. Select only "Google Keep" and export{'\n'}
            3. Unzip the downloaded file{'\n'}
            {'\n'}
            Then choose one of the two options below.
          </Text>

          <Text style={styles.label}>Filter by Keep label (optional)</Text>
          <Text style={styles.hint}>
            Only import notes with these labels. Comma-separated. Leave empty to import all.
          </Text>
          <TextInput
            style={styles.input}
            value={keepTagFilter}
            onChangeText={setKeepTagFilter}
            placeholder="e.g. Recipes, Cooking, Meal Prep"
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.button} onPress={handleKeepFileUpload}>
            <Text style={styles.buttonText}>Upload Keep JSON File(s)</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>Paste Google Keep JSON</Text>
          <Text style={styles.hint}>
            Paste the JSON content from a single Keep note file, or the full Takeout JSON array containing multiple notes.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={'Paste a single Keep note JSON or an array of notes...\n\nSingle note example:\n{"title": "My Recipe", "textContent": "..."}\n\nMultiple notes example:\n[{"title": "Recipe 1", ...}, {"title": "Recipe 2", ...}]'}
            value={keepJson}
            onChangeText={setKeepJson}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !keepJson.trim() && styles.buttonDisabled]}
            onPress={handleKeepPasteJson}
            disabled={!keepJson.trim()}
          >
            <Text style={styles.buttonText}>Parse Keep Note</Text>
          </TouchableOpacity>
        </>
      ) : mode === 'mfp' ? (
        <>
          <Text style={styles.label}>Import from MyFitnessPal</Text>
          <Text style={styles.hint}>
            Export your data from MyFitnessPal:{'\n'}
            1. Open MyFitnessPal app or website{'\n'}
            2. Go to Settings → Account → Download Your Data{'\n'}
            3. Wait for the email with your data export{'\n'}
            4. Unzip and find the CSV file with your recipes/foods{'\n'}
            {'\n'}
            Then choose one of the two options below.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleMfpFileUpload}>
            <Text style={styles.buttonText}>Upload MyFitnessPal CSV</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>Paste CSV data</Text>
          <Text style={styles.hint}>
            Paste the CSV content from your MyFitnessPal export. Include the header row.
            {'\n'}Nutrition data (calories, protein, carbs, fat) will be imported automatically.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={'Name,Ingredients,Servings,Calories,Protein (g),Carbohydrates (g),Fat (g)\nChicken Salad,"chicken;lettuce;tomato",2,350,30,10,20'}
            value={mfpCsv}
            onChangeText={setMfpCsv}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !mfpCsv.trim() && styles.buttonDisabled]}
            onPress={handleMfpPasteCsv}
            disabled={!mfpCsv.trim()}
          >
            <Text style={styles.buttonText}>Import from CSV</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  heading: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  modeScroll: { marginBottom: 20, maxHeight: 50 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: {
    flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center',
  },
  modeActive: { backgroundColor: '#E85D04' },
  modeText: { fontSize: 15, color: '#555', fontWeight: '600' },
  modeTextActive: { color: '#fff' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14,
    fontSize: 16, backgroundColor: '#fafafa', marginBottom: 16,
  },
  textArea: { height: 180 },
  button: {
    backgroundColor: '#E85D04', borderRadius: 8, padding: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { paddingHorizontal: 12, fontSize: 14, color: '#999', fontWeight: '600' },
});
