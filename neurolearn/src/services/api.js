import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_VERCEL_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Firebase auth token to every request
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error getting auth token:', error.message);
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const analyzeHandwriting = (data) =>
  api.post('/api/analyze-handwriting', data);

export const generateReport = (data) =>
  api.post('/api/generate-report', data);

export const deleteHandwritingExercise = (sampleId) =>
  api.delete(`/api/handwriting-sample/${sampleId}`);

export const getStudentSummary = (studentId) =>
  api.get(`/api/student-summary/${studentId}`);

export const deleteUser = (uid) =>
  api.delete(`/api/user/${uid}`);

export default api;
