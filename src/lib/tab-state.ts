export function readInitialTab<T extends string>(options: {
  queryParam: string | null;
  validTabs: readonly T[];
  storageKey: string;
  fallback: T;
}): T {
  const { queryParam, validTabs, storageKey, fallback } = options;
  if (queryParam && validTabs.includes(queryParam as T)) {
    return queryParam as T;
  }
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(storageKey);
  if (saved && validTabs.includes(saved as T)) {
    return saved as T;
  }
  return fallback;
}

export function persistTab<T extends string>(options: {
  next: T;
  storageKey: string;
  clearQueryWhen?: T;
  queryParamName?: string;
}) {
  if (typeof window === "undefined") return;
  const { next, storageKey, clearQueryWhen, queryParamName = "tab" } = options;
  const url = new URL(window.location.href);
  if (clearQueryWhen && next === clearQueryWhen) {
    url.searchParams.delete(queryParamName);
  } else {
    url.searchParams.set(queryParamName, next);
  }
  window.localStorage.setItem(storageKey, next);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
