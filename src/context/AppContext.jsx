/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer, useEffect } from "react";
import { onAuthStateChanged } from "../firebase/auth.js";

const initialState = {
  user: null,
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
    case "SET_SESSION":
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
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
  const [state, dispatch] = useReducer(appReducer, initialState);

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

  // Expose memoised actions for components to interact with global state.
  const value = useMemo(
    () => ({
      state,
      setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
      updateSession: (payload) => dispatch({ type: "SET_SESSION", payload }),
      updateEmotion: (payload) => dispatch({ type: "UPDATE_EMOTION", payload }),
      updatePerformance: (payload) =>
        dispatch({ type: "UPDATE_PERFORMANCE", payload }),
      setLessonQueue: (lessons) =>
        dispatch({ type: "SET_LESSON_QUEUE", payload: lessons }),
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
