import { FileSearch, Inbox, CheckCircle2 } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: "inbox" | "search" | "check";
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  const Icon = {
    inbox: Inbox,
    search: FileSearch,
    check: CheckCircle2,
  }[icon];

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-8 text-center animate-in fade-in-50">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
