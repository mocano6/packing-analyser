/**
 * Warstwa Firestore z rejestracją odczytów i zapisów do metryk.
 * Importuj stąd zamiast z 'firebase/firestore' tam, gdzie chcesz zliczać zapytania.
 */
import {
  getDoc as firestoreGetDoc,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  addDoc as firestoreAddDoc,
  deleteDoc as firestoreDeleteDoc,
} from "firebase/firestore";
import { recordFirestoreRead, recordFirestoreWrite } from "./firestoreMetricsStore";

// Re-eksport wszystkiego z firebase/firestore
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  limitToLast,
  startAfter,
  endBefore,
  getDocsFromServer,
  getDocFromServer,
  writeBatch,
  enableNetwork,
  disableNetwork,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  clearIndexedDbPersistence,
  type Firestore,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type WriteBatch,
  type DocumentData,
  type SetOptions,
  type UpdateData,
} from "firebase/firestore";

import type { DocumentReference, Query, DocumentData, SetOptions, UpdateData } from "firebase/firestore";

// Opakowane funkcje z rejestracją metryk
export async function getDoc<T = DocumentData>(reference: DocumentReference<T>) {
  const result = await firestoreGetDoc(reference);
  recordFirestoreRead("getDoc");
  return result;
}

export async function getDocs<T = DocumentData>(q: Query<T>) {
  const result = await firestoreGetDocs(q);
  recordFirestoreRead("getDocs");
  return result;
}

export async function setDoc<T = DocumentData>(
  reference: DocumentReference<T>,
  data: T,
  options?: SetOptions
) {
  if (options !== undefined) {
    await firestoreSetDoc(reference, data, options);
  } else {
    await firestoreSetDoc(reference, data);
  }
  recordFirestoreWrite("setDoc");
}

export async function updateDoc<T = DocumentData>(
  reference: DocumentReference<T>,
  data: UpdateData<T>
) {
  await firestoreUpdateDoc(reference, data);
  recordFirestoreWrite("updateDoc");
}

export async function addDoc<T = DocumentData>(
  reference: import("firebase/firestore").CollectionReference<T>,
  data: T
) {
  const result = await firestoreAddDoc(reference, data);
  recordFirestoreWrite("addDoc");
  return result;
}

export async function deleteDoc(reference: DocumentReference<unknown>) {
  await firestoreDeleteDoc(reference);
  recordFirestoreWrite("deleteDoc");
}
