import { useState } from "react";
import { FaPalette } from "react-icons/fa";
import ThemeSelectorModal from "./ThemeSelectorModal.jsx";

function ThemeController({ variant = "icon", className = "" }) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const baseClass =
    variant === "cta"
      ? "btn btn-primary btn-sm sm:btn md:btn-lg gap-2 rounded-full shadow-lg"
      : "btn btn-ghost btn-circle";
  const mergedClass = `${baseClass} ${className}`.trim();

  return (
    <>
      <button
        type="button"
        className={mergedClass}
        onClick={handleOpen}
        aria-label="Open theme chooser"
      >
        <FaPalette
          className={variant === "cta" ? "text-base-100" : "text-primary"}
        />
        {variant === "cta" ? (
          <span className="text-sm font-semibold tracking-tight">
            Choose Your World
          </span>
        ) : null}
      </button>
      <ThemeSelectorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default ThemeController;
