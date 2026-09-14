import { Ingredient, NutritionInfo } from '../models/types';

// USDA FoodData Central API — free, unlimited
// Sign up at: https://fdc.nal.usda.gov/api-key-signup
const USDA_API_KEY = 'ETPMCc7GCAfXs4eEVodt0bUvL6nDxD88qMLo7JfN'; // TODO: Replace with your API key
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

interface UsdaFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface UsdaSearchResult {
  fdcId: number;
  description: string;
  foodNutrients: UsdaFoodNutrient[];
}

/**
 * Clean an ingredient name for better USDA search results.
 * Removes modifiers, adjectives, and preparation notes that confuse the search.
 */
function cleanIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')                // remove parenthetical notes
    .replace(/,.*$/, '')                     // remove everything after comma
    .replace(/\b(fresh|dried|ground|chopped|minced|diced|sliced|grated|shredded|crushed|whole|large|medium|small|raw|cooked|unsalted|salted|organic|boneless|skinless|all-purpose|extra-virgin|low-fat|non-fat|frozen|canned|packed)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search USDA for a food item and return the best match.
 * Retries with a simplified query if the first attempt fails.
 */
async function searchFood(query: string): Promise<UsdaSearchResult | null> {
  const cleaned = cleanIngredientName(query);
  const attempts = [cleaned];

  // Add a simplified version: just the last word(s) as fallback
  const words = cleaned.split(' ');
  if (words.length > 1) {
    attempts.push(words[words.length - 1]); // try just the base noun
  }

  for (const attempt of attempts) {
    if (!attempt) continue;
    const response = await fetch(
      `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(attempt)}&pageSize=3&dataType=Foundation,SR Legacy`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      console.warn(`USDA search failed for "${attempt}": ${response.status}`);
      continue;
    }

    const data = await response.json();
    const foods = data.foods as UsdaSearchResult[] | undefined;
    if (foods && foods.length > 0) {
      return foods[0];
    }
  }

  return null;
}

/**
 * Extract a specific nutrient value from USDA food nutrients array.
 * USDA nutrient IDs:
 *   1008 = Energy (kcal)
 *   1003 = Protein (g)
 *   1005 = Carbohydrates (g)
 *   1004 = Total Fat (g)
 *   1079 = Fiber (g)
 *   1093 = Sodium (mg)
 */
function getNutrientValue(nutrients: UsdaFoodNutrient[], nutrientId: number): number {
  const n = nutrients.find((f) => f.nutrientId === nutrientId);
  return n?.value ?? 0;
}

/**
 * USDA data is per 100g. Estimate the weight of an ingredient from its quantity/unit.
 * This is a rough approximation — common cooking conversions.
 */
function estimateGrams(quantity: number, unit: string): number {
  const unitLower = unit.toLowerCase();
  const conversions: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    oz: 28.35,
    lb: 453.6,
    cup: 240,
    cups: 240,
    tbsp: 15,
    tablespoon: 15,
    tsp: 5,
    teaspoon: 5,
    ml: 1,
    liter: 1000,
    fl_oz: 30,
    piece: 100,   // rough estimate
    pieces: 100,
    pinch: 1,
    to_taste: 0,
    slice: 30,
    slices: 30,
  };

  const gramsPerUnit = conversions[unitLower] ?? 100;
  return quantity * gramsPerUnit;
}

/**
 * Look up nutrition for a single ingredient via USDA API.
 * Returns nutrition scaled to the ingredient's quantity.
 */
async function lookupIngredient(ingredient: Ingredient): Promise<NutritionInfo | null> {
  const result = await searchFood(ingredient.name);
  if (!result) return null;

  const grams = estimateGrams(ingredient.quantity, ingredient.unit);
  const scale = grams / 100; // USDA data is per 100g

  return {
    calories: Math.round(getNutrientValue(result.foodNutrients, 1008) * scale),
    proteinG: Math.round(getNutrientValue(result.foodNutrients, 1003) * scale * 10) / 10,
    carbsG: Math.round(getNutrientValue(result.foodNutrients, 1005) * scale * 10) / 10,
    fatG: Math.round(getNutrientValue(result.foodNutrients, 1004) * scale * 10) / 10,
    fiberG: Math.round(getNutrientValue(result.foodNutrients, 1079) * scale * 10) / 10,
    sodiumMg: Math.round(getNutrientValue(result.foodNutrients, 1093) * scale),
  };
}

/**
 * Calculate total nutrition for a list of ingredients, then divide by servings.
 * Returns per-serving nutrition info.
 */
export async function calculateNutrition(
  ingredients: Ingredient[],
  servings: number
): Promise<{ perServing: NutritionInfo; total: NutritionInfo; matched: number; total_ingredients: number; unmatched: string[] }> {
  const totals: NutritionInfo = {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
  };

  let matched = 0;
  const unmatched: string[] = [];

  // Look up each ingredient (sequential to respect rate limits)
  for (const ing of ingredients) {
    if (!ing.name.trim()) continue;
    try {
      const nutrition = await lookupIngredient(ing);
      if (nutrition) {
        totals.calories += nutrition.calories;
        totals.proteinG += nutrition.proteinG;
        totals.carbsG += nutrition.carbsG;
        totals.fatG += nutrition.fatG;
        totals.fiberG += nutrition.fiberG;
        totals.sodiumMg += nutrition.sodiumMg;
        matched++;
      } else {
        unmatched.push(ing.name);
      }
    } catch (e) {
      console.warn(`Failed to look up "${ing.name}":`, e);
      unmatched.push(ing.name);
    }
  }

  // Round totals to avoid floating point display issues
  totals.calories = Math.round(totals.calories);
  totals.proteinG = Math.round(totals.proteinG * 10) / 10;
  totals.carbsG = Math.round(totals.carbsG * 10) / 10;
  totals.fatG = Math.round(totals.fatG * 10) / 10;
  totals.fiberG = Math.round(totals.fiberG * 10) / 10;
  totals.sodiumMg = Math.round(totals.sodiumMg);

  const s = Math.max(servings, 1);
  const perServing: NutritionInfo = {
    calories: Math.round(totals.calories / s),
    proteinG: Math.round((totals.proteinG / s) * 10) / 10,
    carbsG: Math.round((totals.carbsG / s) * 10) / 10,
    fatG: Math.round((totals.fatG / s) * 10) / 10,
    fiberG: Math.round((totals.fiberG / s) * 10) / 10,
    sodiumMg: Math.round(totals.sodiumMg / s),
  };

  return { perServing, total: totals, matched, total_ingredients: ingredients.length, unmatched };
}
