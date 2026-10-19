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
}

export function SubmitButton({ pendingText, icon, children, variant, className }: SubmitButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const pending = useNativeFormPending(ref);

  return (
    <Button
      ref={ref}
      type="submit"
      variant={variant}
      disabled={pending}
      className={cn(variant ? undefined : "w-full", className)}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
