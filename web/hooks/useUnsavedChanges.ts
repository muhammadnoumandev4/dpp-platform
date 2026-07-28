'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useUnsavedChanges(isDirty: boolean, message: string = 'You have unsaved changes. If you leave this page, your changes will be lost.') {
  const router = useRouter();
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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
