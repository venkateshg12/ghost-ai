export const AI_PARTICIPANT = {
    id: "plano",
    name: "Plano",
    color: "#6457f9",
} as const;

const CURSOR_COLORS = [
    "#f87171", // Light Red
    "#f472b6", // Pink
    "#c084fc", // Purple
    "#818cf8", // Indigo
    "#60a5fa", // Blue
    "#38bdf8", // Sky
    "#2dd4bf", // Teal
    "#34d399", // Emerald
    "#a3e635", // Lime
    "#fbbf24", // Amber
    "#fb923c", // Orange
];

/**
 * Returns a stable, deterministic cursor and avatar border color for a given user id.
 */
export const getUserColor = (userId: string): string => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash % CURSOR_COLORS.length)]!;
};
