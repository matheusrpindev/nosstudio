"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { initialActionState } from "@/lib/action-state";
import { markAllNotificationsReadAction } from "./actions";
import { NOTIFICATIONS_CHANGED } from "./shared";

/** "Marcar todas como lidas" (da página e do sino). */
export function MarkAllRead({ disabled, size, onDone }: { disabled?: boolean; size?: "sm" | "md"; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size={size}
      icon={<CheckCheck />}
      loading={pending}
      disabled={disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsReadAction(initialActionState, new FormData());
          window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
          if (result.message) toast(result.message);
          onDone?.();
        })
      }
    >
      Marcar todas como lidas
    </Button>
  );
}
