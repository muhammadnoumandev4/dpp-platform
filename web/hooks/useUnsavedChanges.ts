'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';

export const DEFAULT_UNSAVED_MESSAGE =
  'You have unsaved changes. If you leave this page, your changes will be lost.';

interface UnsavedChangesRegistry {
  register: (key: string, isDirty: boolean) => void;
  unregister: (key: string) => void;
  /** True while any mounted form registered through `useUnsavedChanges` is dirty. */
  hasUnsavedChanges: () => boolean;
  /** Prompts if dirty; returns true when it is safe to proceed. */
  confirmDiscard: (message?: string) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesRegistry | null>(null);

/**
 * Tracks dirty state across sibling forms (e.g. the product editor tabs) so that
 * in-page transitions which do not touch the router — switching tabs, closing a
 * drawer — can still warn before discarding edits.
 */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const dirtyKeys = useRef(new Set<string>());

  const value = useMemo<UnsavedChangesRegistry>(() => {
    const hasUnsavedChanges = () => dirtyKeys.current.size > 0;
    return {
      register: (key, isDirty) => {
        if (isDirty) dirtyKeys.current.add(key);
        else dirtyKeys.current.delete(key);
      },
      unregister: (key) => {
        dirtyKeys.current.delete(key);
      },
      hasUnsavedChanges,
      confirmDiscard: (message = DEFAULT_UNSAVED_MESSAGE) => {
        if (!hasUnsavedChanges()) return true;
        if (!window.confirm(message)) return false;
        dirtyKeys.current.clear();
        return true;
      },
    };
  }, []);

  return createElement(UnsavedChangesContext.Provider, { value }, children);
}

/**
 * Guards in-page transitions. Returns a function that resolves to `true` when it
 * is safe to proceed, prompting the user first if anything is dirty.
 */
export function useDiscardGuard(): (message?: string) => boolean {
  const registry = useContext(UnsavedChangesContext);
  return useCallback(
    (message?: string) => (registry ? registry.confirmDiscard(message) : true),
    [registry],
  );
}

export function useUnsavedChanges(isDirty: boolean, message: string = DEFAULT_UNSAVED_MESSAGE) {
  const isDirtyRef = useRef(isDirty);
  const registry = useContext(UnsavedChangesContext);
  const key = useId();

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Publish dirty state to the surrounding provider (if any) so that sibling
  // navigation — tab switches in particular — can prompt before discarding.
  useEffect(() => {
    registry?.register(key, isDirty);
  }, [registry, key, isDirty]);

  useEffect(() => {
    return () => registry?.unregister(key);
  }, [registry, key]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Monkey-patch history to intercept client-side navigation
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const createPatchedState = (originalMethod: typeof window.history.pushState) => {
      return function (...args: Parameters<typeof window.history.pushState>) {
        if (isDirtyRef.current) {
          if (window.confirm(message)) {
            isDirtyRef.current = false; // allow subsequent navigations
            return originalMethod.apply(window.history, args);
          }
          // User canceled navigation
          return;
        }
        return originalMethod.apply(window.history, args);
      };
    };

    window.history.pushState = createPatchedState(originalPushState);
    window.history.replaceState = createPatchedState(originalReplaceState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [message]);
}
