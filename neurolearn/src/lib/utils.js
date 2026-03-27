import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Ensure sessions collection exists by creating metadata doc if needed */
export async function ensureSessionsCollection(db) {
  try {
    const sessionMetadataRef = doc(collection(db, 'sessions'), '_metadata');
    await setDoc(
      sessionMetadataRef,
      {
        createdAt: serverTimestamp(),
        collectionInitialized: true,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not initialize sessions collection:', err.message);
  }
}
