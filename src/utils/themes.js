export const THEMES = Object.freeze([
	{
		id: "neurolearn",
		name: "Aurora Drift",
		tagline: "Lavender skies with aqua sparks to keep calm curiosity thriving.",
		sensoryNotes: "Balanced contrast, soft gradients, and gentle highlights.",
		preview: {
			gradient: ["#c7d2fe", "#fde2ff", "#6ee7b7"],
			accent: "#22d3ee",
			bubble: "#a855f7",
			card: "rgba(255, 255, 255, 0.82)",
			text: "#1f2937",
		},
	},
	{
		id: "cosmic-focus",
		name: "Cosmic Focus",
		tagline: "Midnight blues with guiding stars for deep, cozy concentration.",
		sensoryNotes: "Dim background with bright anchors for low-stimulation focus.",
		preview: {
			gradient: ["#1e1b4b", "#312e81", "#7c3aed"],
			accent: "#facc15",
			bubble: "#38bdf8",
			card: "rgba(15, 23, 42, 0.72)",
			text: "#f8fafc",
		},
	},
	{
		id: "sunny-meadow",
		name: "Sunny Meadow",
		tagline: "Sun-warmed greens and yellows for upbeat learning adventures.",
		sensoryNotes: "Bright but grounded tones support energising practice.",
		preview: {
			gradient: ["#fef08a", "#bef264", "#6ee7b7"],
			accent: "#f59e0b",
			bubble: "#22c55e",
			card: "rgba(255, 255, 255, 0.86)",
			text: "#1f2937",
		},
	},
	{
		id: "ocean-whisper",
		name: "Ocean Whisper",
		tagline: "Seafoam blues and lilac drift for calm, rhythmic practice.",
		sensoryNotes: "Cool spectrum palette that softens bright screens.",
		preview: {
			gradient: ["#bae6fd", "#c4b5fd", "#38bdf8"],
			accent: "#0ea5e9",
			bubble: "#6366f1",
			card: "rgba(255, 255, 255, 0.8)",
			text: "#0f172a",
		},
	},
]);

export const DEFAULT_THEME_ID = THEMES[0].id;

const THEME_LOOKUP = new Set(THEMES.map((theme) => theme.id));

export function isKnownTheme(themeId) {
	return THEME_LOOKUP.has(themeId);
}

export function getThemeById(themeId) {
	return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}
