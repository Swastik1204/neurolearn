import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { app } from './config.js'

const auth = getAuth(app)

export function onAuthStateChanged(handler) {
  return auth.onAuthStateChanged(handler)
}

export async function registerChild({ email, password, displayName }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }
  return credential.user
}

export async function login({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logout() {
  await signOut(auth)
}

export { auth }
