import { IS_DEV } from "@/constants/env";
import { useAuthStore } from "./auth.store";
import { useEditorStore } from "./editor.store";

export { useAuthStore, useEditorStore };

// Central Store Registry for development environment browser inspection
if (IS_DEV && typeof window !== "undefined") {
  const stores: Record<string, unknown> = {
    useAuthStore,
    useEditorStore,
  };

  const target = window as unknown as Record<string, unknown>;
  target.stores = stores;

  Object.entries(stores).forEach(([name, store]) => {
    target[name] = store;
  });
}
