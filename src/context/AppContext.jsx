/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
} from "react";
import { onAuthStateChanged } from "../firebase/auth.js";
import { DEFAULT_THEME_ID, isKnownTheme } from "../utils/themes.js";

const initialState = {
  user: null,
  authModal: {
    isOpen: false,
  },
  preferences: {
    theme: DEFAULT_THEME_ID,
    brightness: 100,
  },
  session: {
    activeLessonId: null,
    lastUpdated: null,
  },
  emotionState: {
    mood: "curious",
    confidence: 0.6,
    energy: 0.5,
  },
  performance: {
    streak: 0,
    accuracy: 0.5,
    target: "curved letters",
  },
  lessonQueue: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
      };
    case "SHOW_AUTH_MODAL":
      return {
        ...state,
        authModal: {
          ...state.authModal,
          isOpen: true,
        },
      };
    case "HIDE_AUTH_MODAL":
      return {
        ...state,
        authModal: {
          ...state.authModal,
          isOpen: false,
        },
      };
    case "SET_SESSION":
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
        },
      };
    case "SET_THEME":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          theme: action.payload,
        },
      };
    case "SET_BRIGHTNESS":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          brightness: action.payload,
        },
      };
    case "UPDATE_EMOTION":
      return {
        ...state,
        emotionState: {
          ...state.emotionState,
          ...action.payload,
        },
      };
    case "UPDATE_PERFORMANCE":
      return {
        ...state,
        performance: {
          ...state.performance,
          ...action.payload,
        },
      };
    case "SET_LESSON_QUEUE":
      return {
        ...state,
        lessonQueue: action.payload,
      };
    default:
      return state;
  }
}

const AppContext = createContext(undefined);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, (state) => {
    if (typeof window === "undefined") {
      return state;
    }

    try {
      const stored = window.localStorage.getItem("neurolearn:preferences");
      if (!stored) {
        return state;
      }

      const parsed = JSON.parse(stored);
      if (typeof parsed !== "object" || parsed === null) {
        return state;
      }

      const nextPreferences = {
        ...state.preferences,
        ...parsed,
      };

      if (!isKnownTheme(nextPreferences.theme)) {
        nextPreferences.theme = DEFAULT_THEME_ID;
      }

      return {
        ...state,
        preferences: nextPreferences,
      };
    } catch (error) {
      console.warn("Failed to read stored preferences", error);
      return state;
    }
  });

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      if (user) {
        dispatch({
          type: "SET_USER",
          payload: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          },
        });
      } else {
        dispatch({ type: "SET_USER", payload: null });
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const nextTheme = isKnownTheme(state.preferences.theme)
      ? state.preferences.theme
      : DEFAULT_THEME_ID;

    if (!isKnownTheme(state.preferences.theme)) {
      dispatch({ type: "SET_THEME", payload: nextTheme });
      return;
    }

    document.documentElement.setAttribute("data-theme", nextTheme);
  }, [state.preferences.theme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const normalized = Math.min(
      1.4,
      Math.max(0.6, state.preferences.brightness / 100)
    );
    document.documentElement.style.setProperty(
      "--app-brightness",
      normalized.toString()
    );
  }, [state.preferences.brightness]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        "neurolearn:preferences",
        JSON.stringify(state.preferences)
      );
    } catch (error) {
      console.warn("Failed to persist preferences", error);
    }
  }, [state.preferences]);

  // Expose memoised actions for components to interact with global state.
  const value = useMemo(
    () => ({
      state,
      setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
      showAuthModal: () => dispatch({ type: "SHOW_AUTH_MODAL" }),
      hideAuthModal: () => dispatch({ type: "HIDE_AUTH_MODAL" }),
      updateSession: (payload) => dispatch({ type: "SET_SESSION", payload }),
      updateEmotion: (payload) => dispatch({ type: "UPDATE_EMOTION", payload }),
      updatePerformance: (payload) =>
        dispatch({ type: "UPDATE_PERFORMANCE", payload }),
      setLessonQueue: (lessons) =>
        dispatch({ type: "SET_LESSON_QUEUE", payload: lessons }),
      setTheme: (theme) =>
        dispatch({
          type: "SET_THEME",
          payload: isKnownTheme(theme) ? theme : DEFAULT_THEME_ID,
        }),
      setBrightness: (value) =>
        dispatch({
          type: "SET_BRIGHTNESS",
          payload: Math.round(Math.min(140, Math.max(60, value))),
        }),
    }),
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
