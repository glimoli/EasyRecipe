// ── Source types ──────────────────────────────────────────────
export type RecipeSourceType =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'pinterest'
  | 'facebook'
  | 'web'
  | 'image'
  | 'manual'
  | 'ai-generated'
  | 'ai-remix';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MeasurementUnit =
  | 'tsp' | 'tbsp' | 'cup'
  | 'ml' | 'liter'
  | 'oz' | 'fl_oz'
  | 'g' | 'kg' | 'lb'
  | 'piece' | 'pinch' | 'to_taste';

export type RecipeCategory =
  | 'breakfast' | 'lunch' | 'dinner' | 'dessert'
  | 'snack' | 'appetizer' | 'beverage' | 'other';

// ── Ingredient ───────────────────────────────────────────────
export interface Ingredient {
  name: string;
  quantity: number;
  unit: MeasurementUnit;
  notes?: string;
}

// ── Step ─────────────────────────────────────────────────────
export interface RecipeStep {
  order: number;
  instruction: string;
  durationMinutes?: number;
}

// ── Nutrition ────────────────────────────────────────────────
export interface NutritionInfo {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

// ── Recipe ───────────────────────────────────────────────────
export interface Recipe {
  id: string;
  title: string;
  description?: string;
  sourceType: RecipeSourceType;
  sourceUrl?: string;
  sourcePlatformLabel?: string; // e.g. "@chef_john on TikTok"
  sourceRecipeIds?: string[];   // for ai-remix lineage
  isAiGenerated: boolean;
  aiDisclaimer?: string;
  imageUrl?: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  servings: number;
  servingUnit?: string; // e.g. "cups", "slices", "pieces", "bowls", "portions"
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  categories: RecipeCategory[];
  tags: string[];
  variations?: string;
  notes?: string;
  nutrition?: NutritionInfo;
  cookbookIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Cookbook ──────────────────────────────────────────────────
export interface Cookbook {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  recipeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── User ─────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  preferences: UserPreferences;
  createdAt: Date;
}

export interface UserPreferences {
  measurementSystem: 'metric' | 'imperial';
  defaultServings: number;
  dailyNutritionGoals?: NutritionGoals;
}

export interface NutritionGoals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// ── Meal Planning ────────────────────────────────────────────
export interface MealPlanEntry {
  id: string;
  recipeId: string;
  mealSlot: MealSlot;
  date: string; // YYYY-MM-DD
  servings: number;
}

// ── Meal Tracking / Food Diary ───────────────────────────────
export interface MealLogEntry {
  id: string;
  recipeId?: string;
  manualName?: string;
  mealSlot: MealSlot;
  servingsConsumed: number;
  overrideNutrition?: NutritionInfo; // for quick-add entries
  timestamp: Date;
}

// ── Grocery List ─────────────────────────────────────────────
export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: MeasurementUnit;
  purchased: boolean;
  recipeIds: string[]; // which recipes need this item
}

export interface GroceryList {
  id: string;
  name: string;
  items: GroceryItem[];
  createdAt: Date;
}
