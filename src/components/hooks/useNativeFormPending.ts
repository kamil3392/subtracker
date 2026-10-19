import { useEffect, useState, type RefObject } from "react";

/**
 * Pending state for a native `<form method="POST" action="/api/...">` (no React form action, so
 * `useFormStatus` never reports pending). Turns on once the button's form actually submits — i.e.
 * client-side validation did not call `preventDefault` — and resets when the page is restored from
 * the back/forward cache.
 */
export function useNativeFormPending(buttonRef: RefObject<HTMLButtonElement | null>): boolean {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;

    const onSubmit = (event: SubmitEvent) => {
      // React's delegated `onSubmit` (validation) runs after this listener; read the outcome once dispatch is over.
      setTimeout(() => {
        if (!event.defaultPrevented) setPending(true);
      }, 0);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };

    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [buttonRef]);

  return pending;
}
