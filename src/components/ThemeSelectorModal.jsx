import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import { useAppContext } from "../context/AppContext.jsx";
import { THEMES, getThemeById } from "../utils/themes.js";

const modalRoot = typeof document !== "undefined" ? document.body : null;

function ThemeSelectorModal({ open, onClose }) {
  const { state, setTheme } = useAppContext();
  const [activeIndex, setActiveIndex] = useState(0);

  const activeTheme = THEMES[activeIndex] ?? THEMES[0];
  const isCurrentTheme = useMemo(
    () => activeTheme.id === state.preferences.theme,
    [activeTheme.id, state.preferences.theme]
  );

  const goToTheme = useCallback((index) => {
    let next = index;
    if (index < 0) next = (THEMES.length + index) % THEMES.length;
    if (index >= THEMES.length) next = index % THEMES.length;
    setActiveIndex(next);
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % THEMES.length);
  }, []);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + THEMES.length) % THEMES.length);
  }, []);

  const handleSelect = useCallback(() => {
    setTheme(activeTheme.id);
    onClose();
  }, [activeTheme.id, onClose, setTheme]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const currentTheme = getThemeById(state.preferences.theme);
    const startingIndex = THEMES.findIndex(
      (theme) => theme.id === currentTheme.id
    );
    setActiveIndex(startingIndex === -1 ? 0 : startingIndex);
  }, [open, state.preferences.theme]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, handleNext, handlePrev, onClose]);

  if (!open || !modalRoot) {
    return null;
  }

  const gradientStyle = {
    backgroundImage: `linear-gradient(135deg, ${activeTheme.preview.gradient.join(
      ", "
    )})`,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-base-200/50 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a theme"
      onClick={handleBackdropClick}
    >
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-base-content/60">
            Personalise the journey
          </p>
          <h2 className="text-xl font-black text-base-content sm:text-2xl">
            Choose Your World
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-circle"
          onClick={onClose}
          aria-label="Close theme chooser"
        >
          <FaTimes />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-8 overflow-hidden px-4 pb-8 sm:px-6 md:flex-row md:items-center md:gap-12 lg:px-10">
        <div className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            className="btn btn-circle btn-outline absolute left-0 top-1/2 -translate-y-1/2"
            onClick={handlePrev}
            aria-label="View previous theme"
          >
            <FaChevronLeft />
          </button>

          <button
            type="button"
            className="relative mx-auto w-full max-w-lg sm:max-w-2xl h-[500px] sm:h-[600px] overflow-hidden rounded-[3rem] border-[6px] border-white/70 shadow-2xl transition-transform focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-primary"
            style={gradientStyle}
            onClick={handleSelect}
            aria-label={`Use the ${activeTheme.name} theme`}
          >
            <div className="flex h-full flex-col justify-between p-10 sm:p-12">
              <div>
                <span
                  className="inline-flex rounded-full px-6 py-2 text-sm font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor: activeTheme.preview.card,
                    color: activeTheme.preview.text,
                  }}
                >
                  {activeTheme.name}
                </span>
                <p
                  className="mt-8 max-w-md text-base font-semibold sm:text-lg"
                  style={{ color: activeTheme.preview.text }}
                >
                  {activeTheme.tagline}
                </p>
              </div>

              <div className="space-y-5 sm:space-y-6">
                <div
                  className="flex items-center gap-5 rounded-3xl px-6 py-5 text-left text-base font-semibold sm:text-lg"
                  style={{
                    backgroundColor: activeTheme.preview.card,
                    color: activeTheme.preview.text,
                  }}
                >
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: activeTheme.preview.bubble }}
                  />
                  Comfort meter
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-white/40 px-6 py-5 text-sm font-semibold text-white sm:text-base">
                  <span>Focus path</span>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold"
                    style={{
                      backgroundColor: `${activeTheme.preview.accent}cc`,
                    }}
                  >
                    <FaCheck />
                    Soft mode
                  </span>
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="btn btn-circle btn-outline absolute right-0 top-1/2 -translate-y-1/2"
            onClick={handleNext}
            aria-label="View next theme"
          >
            <FaChevronRight />
          </button>
        </div>

        <aside className="flex flex-col items-center gap-6 md:w-72 md:items-start">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-base-content">
              {activeTheme.name}
            </h3>
            <p className="mt-2 text-sm text-base-content/80">
              {activeTheme.sensoryNotes}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {THEMES.map((theme, index) => (
              <button
                key={theme.id}
                type="button"
                className={`h-3 w-3 rounded-full transition-all ${
                  index === activeIndex ? "bg-primary scale-125" : "bg-base-300"
                }`}
                onClick={() => goToTheme(index)}
                aria-label={`Jump to ${theme.name}`}
              />
            ))}
          </div>

          <button
            type="button"
            className={`btn btn-wide ${
              isCurrentTheme ? "btn-disabled" : "btn-primary"
            }`}
            onClick={handleSelect}
            disabled={isCurrentTheme}
          >
            {isCurrentTheme ? "Theme active" : "Use this theme"}
          </button>
        </aside>
      </div>
    </div>,
    modalRoot
  );
}

export default ThemeSelectorModal;
