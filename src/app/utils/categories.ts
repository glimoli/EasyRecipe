import { Recipe } from '../models/types';

export const CATEGORY_GROUPS = [
  {
    key: 'breakfast',
    title: '🌅 Breakfast',
    color: '#FFF4EC',
    borderColor: '#FFE0CC',
    match: ['breakfast'],
  },
  {
    key: 'dinner-lunch',
    title: '🍽️ Lunch & Dinner',
    color: '#EDF7ED',
    borderColor: '#C8E6C9',
    match: ['lunch', 'dinner'],
  },
  {
    key: 'dessert-snacks',
    title: '🍰 Desserts & Snacks',
    color: '#FFF8E1',
    borderColor: '#FFE082',
    match: ['dessert', 'snack'],
  },
  {
    key: 'other',
    title: '📋 Other',
    color: '#F3E5F5',
    borderColor: '#CE93D8',
    match: [] as string[],
  },
];

export function getCategoryLabel(recipe: Recipe): string {
  const cats = recipe.categories.map((c) => c.toLowerCase());
  for (const group of CATEGORY_GROUPS) {
    if (group.match.length === 0) continue;
    if (group.match.some((m) => cats.includes(m))) {
      return group.title;
    }
  }
  return CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1].title;
}

export function getCategoryColors(recipe: Recipe): { color: string; borderColor: string } {
  const cats = recipe.categories.map((c) => c.toLowerCase());
  for (const group of CATEGORY_GROUPS) {
    if (group.match.length === 0) continue;
    if (group.match.some((m) => cats.includes(m))) {
      return { color: group.color, borderColor: group.borderColor };
    }
  }
  const other = CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1];
  return { color: other.color, borderColor: other.borderColor };
}
