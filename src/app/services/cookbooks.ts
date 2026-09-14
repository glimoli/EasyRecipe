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
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Cookbook } from '../models/types';

function cookbooksCol(uid: string) {
  return collection(db, 'users', uid, 'cookbooks');
}

function fromFirestore(id: string, data: Record<string, unknown>): Cookbook {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as Cookbook;
}

export async function createCookbook(
  uid: string,
  name: string,
  description?: string
): Promise<string> {
  const ref = await addDoc(cookbooksCol(uid), {
    name,
    description: description ?? '',
    coverImageUrl: '',
    recipeCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCookbook(
  uid: string,
  cookbookId: string,
  updates: Partial<Cookbook>
): Promise<void> {
  const ref = doc(db, 'users', uid, 'cookbooks', cookbookId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteCookbook(uid: string, cookbookId: string): Promise<void> {
  // Remove the cookbook reference from all recipes that belong to it
  const recipesCol = collection(db, 'users', uid, 'recipes');
  const q = query(recipesCol, where('cookbookIds', 'array-contains', cookbookId));
  const snap = await getDocs(q);
  const updates = snap.docs.map((d) =>
    updateDoc(d.ref, { cookbookIds: arrayRemove(cookbookId), updatedAt: serverTimestamp() })
  );
  await Promise.all(updates);

  // Delete the cookbook document itself — recipes are NOT deleted
  await deleteDoc(doc(db, 'users', uid, 'cookbooks', cookbookId));
}

export async function getCookbook(uid: string, cookbookId: string): Promise<Cookbook | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'cookbooks', cookbookId));
  return snap.exists() ? fromFirestore(snap.id, snap.data()) : null;
}

export async function listCookbooks(uid: string): Promise<Cookbook[]> {
  const q = query(cookbooksCol(uid), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d.id, d.data()));
}
