import { Recipe } from '../models/types';

// Switch to production URL when deploying to Blaze:
// const CLOUD_FUNCTIONS_BASE = 'https://us-central1-easyrecipe-68ba1.cloudfunctions.net';
const CLOUD_FUNCTIONS_BASE = 'http://127.0.0.1:5001/easyrecipe-68ba1/us-central1';

export interface ReviewTip {
  category: string;
  suggestion: string;
}

export interface RecipeReview {
  tips: ReviewTip[];
  overallRating: string;
}

export async function reviewRecipe(recipe: Recipe): Promise<RecipeReview> {
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/reviewRecipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to review recipe');
  }

  return response.json();
}

export async function remixRecipe(
  recipe: Recipe,
  direction?: string
): Promise<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'cookbookIds'>> {
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/remixRecipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe, direction }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to remix recipe');
  }

  const data = await response.json();

  return {
    ...data,
    sourceType: 'ai-remix',
    sourceUrl: undefined,
    sourcePlatformLabel: `Remix of "${recipe.title}"`,
    sourceRecipeIds: [recipe.id],
    isAiGenerated: true,
    aiDisclaimer: 'AI-generated recipe — review ingredients for allergies/accuracy before cooking.',
    imageUrl: '',
    nutrition: undefined,
    notes: '',
    variations: '',
  };
}

export interface GenerateCriteria {
  mealType?: string;
  maxMinutes?: number;
  dietary?: string;
  ingredients?: string;
  avoid?: string;
  freeText?: string;
  existingTitles?: string[];
}

export async function generateRecipe(
  criteria: GenerateCriteria
): Promise<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'cookbookIds'>> {
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/generateRecipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to generate recipe');
  }

  const data = await response.json();

  return {
    ...data,
    sourceType: 'ai-generated',
    sourceUrl: undefined,
    sourcePlatformLabel: 'AI Generated',
    isAiGenerated: true,
    aiDisclaimer: 'AI-generated recipe — review ingredients for allergies/accuracy before cooking.',
    imageUrl: '',
    nutrition: undefined,
    notes: '',
    variations: '',
  };
}
