const PREFIX = "unithe-bucanote-ui";

export function uiPrefStorageKey(userId: string, key: string) {
  return `${PREFIX}:${userId}:${key}`;
}

export const UI_PREF_KEYS = {
  weekdayExpanded: "weekdayExpanded",
  usageListVisible: "usageListVisible",
} as const;

export function readUiPref(
  userId: string | null,
  key: string,
  defaultValue: boolean,
): boolean {
  if (!userId || typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(uiPrefStorageKey(userId, key));
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* storage unavailable */
  }
  return defaultValue;
}

export function writeUiPref(
  userId: string | null,
  key: string,
  value: boolean,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(uiPrefStorageKey(userId, key), String(value));
  } catch {
    /* storage unavailable */
  }
}
