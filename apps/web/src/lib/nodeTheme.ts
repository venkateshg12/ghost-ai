import { NODE_COLORS, type ColorPair } from "@repo/types";
import type { ResolvedTheme } from "@/lib/theme";

/*
  Canvas nodes are saved with the dark palette from NODE_COLORS (the server, the AI and old projects all
  speak it), so the stored data never changes with the theme. In the light theme each of those pairs is
  drawn as the entry at the same index below: a pale tint with a deep text colour, readable on a white
  canvas. A colour that isn't in the palette (a custom one) is drawn as saved.
 */
const LIGHT_NODE_COLORS: Pick<ColorPair, "bg" | "text">[] = [
  { bg: "#F3F4F6", text: "#1F2430" }, // Neutral
  { bg: "#E6F0FF", text: "#1D5FD0" }, // Blue
  { bg: "#F3E8FF", text: "#7E3FC4" }, // Purple
  { bg: "#FFF1DC", text: "#B35A00" }, // Orange
  { bg: "#FFE8E8", text: "#C62A2F" }, // Red
  { bg: "#FFE6EF", text: "#C2275F" }, // Pink
  { bg: "#E3F6E8", text: "#1E7A38" }, // Green
  { bg: "#DDF5F1", text: "#0B7F73" }, // Teal
];

export const themedNodeColors = (
  bg: string,
  text: string,
  theme: ResolvedTheme,
): { bg: string; text: string } => {
  if (theme === "dark") return { bg, text };
  const index = NODE_COLORS.findIndex((pair) => pair.bg.toLowerCase() === bg.toLowerCase());
  return LIGHT_NODE_COLORS[index] ?? { bg, text };
};
