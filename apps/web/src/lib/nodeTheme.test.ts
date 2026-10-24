import { describe, expect, it } from "vitest";
import { NODE_COLORS } from "@repo/types";
import { themedNodeColors } from "./nodeTheme";

describe("themedNodeColors", () => {
  it("draws saved colours as they are in the dark theme", () => {
    expect(themedNodeColors("#10233D", "#52A8FF", "dark")).toEqual({ bg: "#10233D", text: "#52A8FF" });
  });

  it("maps every palette pair to a different light pair, case-insensitively", () => {
    const light = NODE_COLORS.map((pair) => themedNodeColors(pair.bg.toLowerCase(), pair.text, "light"));
    expect(new Set(light.map((pair) => pair.bg)).size).toBe(NODE_COLORS.length);
    light.forEach((pair, index) => expect(pair.bg).not.toBe(NODE_COLORS[index]!.bg));
  });

  it("leaves a custom colour alone in the light theme", () => {
    expect(themedNodeColors("#123456", "#abcdef", "light")).toEqual({ bg: "#123456", text: "#abcdef" });
  });
});
