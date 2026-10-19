import { useRef, type ComponentProps, type ReactNode } from "react";
import { useNativeFormPending } from "@/components/hooks/useNativeFormPending";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIMARY_CLASSES =
  "w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  /** Without a variant the button keeps the app's primary (purple, full-width) look. */
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
      className={cn(variant ? undefined : PRIMARY_CLASSES, className)}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
