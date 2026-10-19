import { useRef, type ComponentProps, type ReactNode } from "react";
import { useNativeFormPending } from "@/components/hooks/useNativeFormPending";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  /** Without a variant the button is the full-width `default` (primary) variant. */
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  /** Kitchen sink only (`src/pages/dev/dashboard-states.astro`): render the pending state without submitting. */
  forcePending?: boolean;
}

export function SubmitButton({ pendingText, icon, children, variant, className, forcePending }: SubmitButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const submitting = useNativeFormPending(ref);
  const pending = forcePending === true || submitting;

  return (
    <>
      <Button
        ref={ref}
        type="submit"
        variant={variant}
        disabled={pending}
        aria-busy={pending ? true : undefined}
        className={cn(variant ? undefined : "w-full", className)}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
            />
            {pendingText}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {icon}
            {children}
          </span>
        )}
      </Button>
      {/* Always mounted so the change to `pendingText` is announced; live regions inside a button are unreliable. */}
      <span role="status" className="sr-only">
        {pending ? pendingText : ""}
      </span>
    </>
  );
}
