import { startTransition, useMemo, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Scroll / viewport sync hooks.
//
// Both hooks use `useSyncExternalStore`, which is the React 18+
// recommended primitive for subscribing to browser state (window.scrollY,
// matchMedia, etc.) without tearing under concurrent renders.
//
// `client-event-listeners`: every listener registration lives inside a
// single `subscribe` function that is passed to
// `useSyncExternalStore`, which guarantees exactly one listener per
// subscriber and automatic cleanup on unmount.
//
// `client-passive-event-listeners`: the scroll listener is registered
// with `{ passive: true }` because the hook never calls
// `event.preventDefault()`. This lets the browser start scrolling
// before the handler runs.
//
// `rerender-transitions`: every store-change notification is funneled
// through `startTransition` so the consumer re-renders at transition
// priority and never blocks the next paint.
//
// These hooks are introduced ahead of Phase C's masthead + reveal work
// and are intentionally not consumed yet.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// useScrollY
// ---------------------------------------------------------------------------

/**
 * Subscribe to `window.scrollY` via `useSyncExternalStore` with a
 * passive scroll listener. Store-change notifications are deferred
 * into a transition.
 *
 * SSR-safe: returns 0 outside a browser environment.
 */
export function useScrollY(): number {
  return useSyncExternalStore(
    subscribeToScroll,
    getScrollSnapshot,
    getScrollServerSnapshot,
  );
}

function subscribeToScroll(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {
      // No-op cleanup in a non-browser environment.
    };
  }
  const handler = (): void => {
    // Defer the store-change notification so downstream consumers
    // re-render in a transition rather than on the hot scroll path.
    startTransition(onStoreChange);
  };
  window.addEventListener("scroll", handler, { passive: true });
  return () => {
    window.removeEventListener("scroll", handler);
  };
}

function getScrollSnapshot(): number {
  return typeof window === "undefined" ? 0 : window.scrollY;
}

function getScrollServerSnapshot(): number {
  return 0;
}

// ---------------------------------------------------------------------------
// useMediaQuery
// ---------------------------------------------------------------------------

/**
 * Subscribe to a CSS media query via `useSyncExternalStore`. The
 * `MediaQueryList` and its `subscribe`/`getSnapshot` closures are
 * memoized on `query` so `useSyncExternalStore` only re-subscribes
 * when the query string changes.
 *
 * SSR-safe: returns `false` outside a browser environment.
 */
export function useMediaQuery(query: string): boolean {
  const store = useMemo(() => createMediaQueryStore(query), [query]);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

interface MediaQueryStore {
  readonly subscribe: (onStoreChange: () => void) => () => void;
  readonly getSnapshot: () => boolean;
  readonly getServerSnapshot: () => boolean;
}

function createMediaQueryStore(query: string): MediaQueryStore {
  if (typeof window === "undefined") {
    return {
      subscribe: () => () => {
        // No-op cleanup in a non-browser environment.
      },
      getSnapshot: () => false,
      getServerSnapshot: () => false,
    };
  }

  const mql = window.matchMedia(query);
  return {
    subscribe: (onStoreChange) => {
      const handler = (): void => {
        startTransition(onStoreChange);
      };
      mql.addEventListener("change", handler);
      return () => {
        mql.removeEventListener("change", handler);
      };
    },
    getSnapshot: () => mql.matches,
    getServerSnapshot: () => false,
  };
}
