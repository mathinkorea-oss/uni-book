const PREFIX = "unithe-bucanote-ui";

export function uiPrefStorageKey(userId: string, key: string) {
  return `${PREFIX}:${userId}:${key}`;
}

export const UI_PREF_KEYS = {
  weekdayExpanded: "weekdayExpanded",
  usageListVisible: "usageListVisible",
  lastSaveCardId: "lastSaveCardId",
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

export function readUiPrefString(
  userId: string | null,
  key: string,
): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(uiPrefStorageKey(userId, key));
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeUiPrefString(
  userId: string | null,
  key: string,
  value: string,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(uiPrefStorageKey(userId, key), value);
  } catch {
    /* storage unavailable */
  }
}
