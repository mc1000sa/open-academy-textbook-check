import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const COLLECTION_NAMES = Object.freeze({
  teachers: 'openacademy_textbook_teachers',
  classes: 'openacademy_textbook_classes',
  students: 'openacademy_textbook_students',
  studentRequests: 'openacademy_textbook_student_requests',
  books: 'openacademy_textbook_books',
  classBooks: 'openacademy_textbook_class_books',
  inspections: 'openacademy_textbook_inspections',
  configs: 'openacademy_textbook_configs',
  attendance: 'attendance',
  consulting: 'consulting'
});

let firebaseServicePromise;

export function createRefs(db) {
  return {
    teachers: collection(db, COLLECTION_NAMES.teachers),
    classes: collection(db, COLLECTION_NAMES.classes),
    students: collection(db, COLLECTION_NAMES.students),
    studentRequests: collection(db, COLLECTION_NAMES.studentRequests),
    books: collection(db, COLLECTION_NAMES.books),
    classBooks: collection(db, COLLECTION_NAMES.classBooks),
    inspections: collection(db, COLLECTION_NAMES.inspections),
    configs: collection(db, COLLECTION_NAMES.configs),
    attendance: collection(db, COLLECTION_NAMES.attendance),
    consulting: collection(db, COLLECTION_NAMES.consulting)
  };
}

export async function getFirebaseService() {
  if (!firebaseServicePromise) {
    firebaseServicePromise = (async () => {
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const auth = getAuth(app);

      await signInAnonymously(auth);

      return {
        app,
        db,
        auth,
        refs: createRefs(db)
      };
    })();
  }

  return firebaseServicePromise;
}
