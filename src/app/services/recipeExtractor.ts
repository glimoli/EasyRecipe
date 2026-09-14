import { RecipeSourceType, Recipe } from '../models/types';

const CLOUD_FUNCTIONS_BASE = 'https://us-central1-easyrecipe-68ba1.cloudfunctions.net';

/**
 * Detect the source platform from a URL.
 */
export function detectSourceType(url: string): RecipeSourceType {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('pinterest.com')) return 'pinterest';
  if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook';
  return 'web';
}

/**
 * Build a human-readable platform label from the URL.
 */
export function buildPlatformLabel(url: string, sourceType: RecipeSourceType): string {
  const labels: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
    pinterest: 'Pinterest',
    facebook: 'Facebook',
    web: new URL(url).hostname.replace('www.', ''),
  };
  return labels[sourceType] ?? sourceType;
}

/**
 * Extract a recipe from a URL via the Cloud Function.
 * Returns a partial Recipe for the user to review/edit before saving.
 */
export async function extractRecipeFromUrl(
  url: string
): Promise<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'cookbookIds'>> {
  const sourceType = detectSourceType(url);
  const platformLabel = buildPlatformLabel(url, sourceType);

  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/extractRecipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Extraction failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    title: data.title ?? 'Untitled Recipe',
    description: data.description,
    sourceType,
    sourceUrl: url,
    sourcePlatformLabel: platformLabel,
    isAiGenerated: false,
    imageUrl: data.imageUrl,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    servings: data.servings ?? 4,
    prepTimeMinutes: data.prepTimeMinutes,
    cookTimeMinutes: data.cookTimeMinutes,
    categories: [],
    tags: [platformLabel.toLowerCase()],
    nutrition: data.nutrition,
  };
}

/**
 * Extract a recipe from manually pasted text via the Cloud Function.
 */
export async function extractRecipeFromText(
  text: string
): Promise<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'cookbookIds'>> {
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/extractRecipeFromText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Text extraction failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    title: data.title ?? 'Untitled Recipe',
    description: data.description,
    sourceType: 'manual',
    isAiGenerated: false,
    imageUrl: data.imageUrl,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    servings: data.servings ?? 4,
    prepTimeMinutes: data.prepTimeMinutes,
    cookTimeMinutes: data.cookTimeMinutes,
    categories: [],
    tags: ['manual'],
    nutrition: data.nutrition,
  };
}

/**
 * Extract a recipe from an uploaded image (OCR) via the Cloud Function.
 */
export async function extractRecipeFromImage(
  imageUri: string
): Promise<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'cookbookIds'>> {
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/extractRecipeFromImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUri }),
  });

  if (!response.ok) {
    throw new Error(`Image extraction failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    title: data.title ?? 'Untitled Recipe',
    description: data.description,
    sourceType: 'image',
    isAiGenerated: false,
    imageUrl: imageUri,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    servings: data.servings ?? 4,
    prepTimeMinutes: data.prepTimeMinutes,
    cookTimeMinutes: data.cookTimeMinutes,
    categories: [],
    tags: ['image'],
    nutrition: data.nutrition,
  };
}
