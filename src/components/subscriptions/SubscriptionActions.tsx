import type { ReactNode } from "react";
import { Ban, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/form/SubmitButton";
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
        <Button type="button" size="sm" variant={destructive ? "destructive" : "secondary"}>
          {icon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* Native POST: the endpoint answers with a redirect, so no fetch and no JSON. */}
        <form method="POST" action={action}>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <SubmitButton
              pendingText={pendingText}
              icon={icon}
              variant={destructive ? "destructive" : undefined}
              className="w-full sm:w-auto"
            >
              {confirmLabel}
            </SubmitButton>
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
