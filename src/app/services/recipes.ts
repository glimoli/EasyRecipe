import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Recipe, RecipeSourceType } from '../models/types';

function recipesCol(uid: string) {
  return collection(db, 'users', uid, 'recipes');
}

function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

function toFirestore(recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) {
  return {
    ...removeUndefined(recipe as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function fromFirestore(id: string, data: Record<string, unknown>): Recipe {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as Recipe;
}

export async function createRecipe(
  uid: string,
  recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(recipesCol(uid), toFirestore(recipe));
  return ref.id;
}

export async function updateRecipe(
  uid: string,
  recipeId: string,
  updates: Partial<Recipe>
): Promise<void> {
  const ref = doc(db, 'users', uid, 'recipes', recipeId);
  await updateDoc(ref, { ...removeUndefined(updates as unknown as Record<string, unknown>), updatedAt: serverTimestamp() });
}

export async function deleteRecipe(uid: string, recipeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'recipes', recipeId));
}

export async function getRecipe(uid: string, recipeId: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'recipes', recipeId));
  return snap.exists() ? fromFirestore(snap.id, snap.data()) : null;
}

export async function listRecipes(uid: string): Promise<Recipe[]> {
  const q = query(recipesCol(uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

export async function listRecipesBySource(
  uid: string,
  sourceType: RecipeSourceType
): Promise<Recipe[]> {
  const q = query(
    recipesCol(uid),
    where('sourceType', '==', sourceType),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}

export async function listRecipesByCookbook(
  uid: string,
  cookbookId: string
): Promise<Recipe[]> {
  const q = query(
    recipesCol(uid),
    where('cookbookIds', 'array-contains', cookbookId)
  );
  const snap = await getDocs(q);
  const recipes = snap.docs.map((d) => fromFirestore(d.id, d.data()));
  return recipes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function searchRecipes(uid: string, searchTerm: string): Promise<Recipe[]> {
  // Firestore doesn't support full-text search natively.
  // Client-side filter for MVP; upgrade to Algolia/Typesense later.
  const all = await listRecipes(uid);
  const lower = searchTerm.toLowerCase();
  return all.filter(
    (r) =>
      r.title.toLowerCase().includes(lower) ||
      r.tags.some((t) => t.toLowerCase().includes(lower)) ||
      r.categories.some((c) => c.toLowerCase().includes(lower))
  );
}

export async function addRecipeToCookbook(
  uid: string,
  recipeId: string,
  cookbookId: string
): Promise<void> {
  const recipeRef = doc(db, 'users', uid, 'recipes', recipeId);
  const cookbookRef = doc(db, 'users', uid, 'cookbooks', cookbookId);
  await updateDoc(recipeRef, { cookbookIds: arrayUnion(cookbookId), updatedAt: serverTimestamp() });
  await updateDoc(cookbookRef, { recipeCount: increment(1), updatedAt: serverTimestamp() });
}

export async function removeRecipeFromCookbook(
  uid: string,
  recipeId: string,
  cookbookId: string
): Promise<void> {
  const recipeRef = doc(db, 'users', uid, 'recipes', recipeId);
  const cookbookRef = doc(db, 'users', uid, 'cookbooks', cookbookId);
  await updateDoc(recipeRef, { cookbookIds: arrayRemove(cookbookId), updatedAt: serverTimestamp() });
  await updateDoc(cookbookRef, { recipeCount: increment(-1), updatedAt: serverTimestamp() });
}
