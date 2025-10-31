import { useId } from "react";
import { FaSun } from "react-icons/fa";
import { useAppContext } from "../context/AppContext.jsx";

function BrightnessControl() {
  const { state, setBrightness } = useAppContext();
  const sliderId = useId();

  const handleChange = (event) => {
    setBrightness(Number(event.target.value));
  };

  return (
    <div className="flex items-center gap-2 rounded-full bg-base-200/80 px-3 py-2 shadow-inner">
      <FaSun className="text-warning" aria-hidden="true" />
      <label htmlFor={sliderId} className="sr-only">
        Adjust app brightness
      </label>
      <input
        id={sliderId}
        type="range"
        min="60"
        max="140"
        step="5"
        value={state.preferences.brightness}
        onChange={handleChange}
        className="range range-xs w-28"
        aria-valuemin={60}
        aria-valuemax={140}
        aria-valuenow={state.preferences.brightness}
      />
      <span className="text-xs font-semibold text-base-content/80">
        {state.preferences.brightness}%
      </span>
    </div>
  );
}

export default BrightnessControl;
