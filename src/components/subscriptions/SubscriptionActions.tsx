import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/types";

interface Props {
  id: string;
  name: string;
  status: SubscriptionStatus;
}

interface ConfirmActionProps {
  action: string;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingText: string;
  icon: ReactNode;
  destructive?: boolean;
}

// A separate component so `useFormStatus` reads the enclosing confirmation form (as in `SubmitButton`).
function ConfirmButton({
  pendingText,
  destructive,
  children,
}: {
  pendingText: string;
  destructive: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={destructive ? "destructive" : "default"}
      disabled={pending}
      className={cn("w-full sm:w-auto", !destructive && "bg-purple-600 text-white hover:bg-purple-500")}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

function ConfirmAction({
  action,
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingText,
  icon,
  destructive = false,
}: ConfirmActionProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={destructive ? "destructive" : "ghost"}
          className={cn(!destructive && "text-blue-100/80 hover:bg-white/10 hover:text-white")}
        >
          {icon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-blue-100/70">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* Native POST: the endpoint answers with a redirect, so no fetch and no JSON. */}
        <form method="POST" action={action}>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Keep
            </AlertDialogCancel>
            <ConfirmButton pendingText={pendingText} destructive={destructive}>
              {icon}
              {confirmLabel}
            </ConfirmButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SubscriptionActions({ id, name, status }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" && (
        <ConfirmAction
          action={`/api/subscriptions/${id}/cancel`}
          triggerLabel="Cancel"
          title={`Cancel ${name}?`}
          description="It keeps counting toward your total and renewals until its next renewal date, then disappears from both. This can't be undone."
          confirmLabel="Cancel subscription"
          pendingText="Cancelling..."
          icon={<Ban className="size-4" />}
        />
      )}
      <ConfirmAction
        action={`/api/subscriptions/${id}/delete`}
        triggerLabel="Delete"
        title={`Delete ${name}?`}
        description="This permanently removes the entry. This can't be undone."
        confirmLabel="Delete"
        pendingText="Deleting..."
        icon={<Trash2 className="size-4" />}
        destructive
      />
    </div>
  );
}
