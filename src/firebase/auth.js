import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { app } from './config.js'
import logger from '../debug/logger.js'

const log = logger.create('auth')

const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
})

export function onAuthStateChanged(handler) {
  return auth.onAuthStateChanged(handler)
}

export async function registerChild({ email, password, displayName }) {
  log.info('Registering new user', email)
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }
  log.info('User registered successfully', credential.user.uid)
  return credential.user
}

export async function login({ email, password }) {
  log.info('Login attempt', email)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  log.info('Login successful', credential.user.uid)
  return credential.user
}

export async function loginWithGoogle() {
  log.info('Google login initiated')
  try {
    const result = await signInWithPopup(auth, googleProvider)
    log.info('Google login successful', result.user.uid)
    return result.user
  } catch (error) {
    log.error('Google login error:', error)
    throw error
  }
}

export async function logout() {
  log.info('Logging out')
  await signOut(auth)
  log.info('Logged out')
}

export { auth }
