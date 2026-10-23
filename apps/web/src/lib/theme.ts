"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
  Light / dark / follow-the-system. The choice is stored in localStorage; the resolved theme is written to
  `<html data-theme>` (the CSS in globals.css keys off it). THEME_INIT_SCRIPT runs in <head> before first
  paint so a returning visitor never sees the wrong theme flash, and this module keeps the attribute in
  sync afterwards.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "plano:theme";

// Mirrors `applyPreference` below — it has to run as plain text before React exists.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;document.documentElement.dataset.theme=d;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const readPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

const systemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

const applyPreference = (preference: ThemePreference) => {
  document.documentElement.dataset.theme = preference === "system" ? systemTheme() : preference;
};

export const setThemePreference = (preference: ThemePreference) => {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice applies for this visit only.
  }
  applyPreference(preference);
  notify();
};

let watching = false;
const watchExternalChanges = () => {
  if (watching) return;
  watching = true;
  // The OS flips light/dark while the app is open: follow it, but only if the user hasn't picked a side.
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (readPreference() === "system") {
      applyPreference("system");
      notify();
    }
  });
  // Another tab changed the choice.
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyPreference(readPreference());
      notify();
    }
  });
};

const subscribe = (listener: () => void) => {
  watchExternalChanges();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getResolvedSnapshot = (): ResolvedTheme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export const useTheme = () => {
  // The server (and the hydration pass) can't know the visitor's theme; "dark" there, corrected right after.
  const resolved = useSyncExternalStore(subscribe, getResolvedSnapshot, () => "dark" as ResolvedTheme);
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);
  return { preference, resolved, setPreference };
};
