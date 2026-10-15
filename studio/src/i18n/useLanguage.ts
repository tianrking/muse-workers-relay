import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage } from "./runtime";

export function useLanguage() {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => "en" as const,
  );
}
