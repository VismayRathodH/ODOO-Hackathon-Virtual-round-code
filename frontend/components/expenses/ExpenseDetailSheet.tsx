"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { expensesApi } from "@/lib/api/expenses";
import { Expense } from "@/types/expense";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calendar, DollarSign, Target, FileText, FileDown, CheckCircle, XCircle, Clock } from "lucide-react";

interface ExpenseDetailSheetProps {
  expense: Expense | null;
  onClose: () => void;
}

export function ExpenseDetailSheet({ expense, onClose }: ExpenseDetailSheetProps) {
  const { company } = useAuth();
  const companyCurrency = company?.currency || "USD";

  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ["expense_logs", expense?.id],
    queryFn: () => expensesApi.getExpenseLogs(expense!.id),
    enabled: !!expense?.id,
  });

  if (!expense) return null;

  const formattedDate = new Date(expense.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedAmount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: expense.currency || companyCurrency,
  }).format(expense.amount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 border-none hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400">APPROVED</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 border-none hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400">REJECTED</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-none hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400">PENDING</Badge>;
    }
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case "APPROVED": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED": return <XCircle className="h-4 w-4 text-red-500" />;
      case "CREATED": return <FileText className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-hidden flex flex-col p-0 border-l">
        <div className="p-6 pb-4 border-b">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold">Expense Details</SheetTitle>
              {getStatusBadge(expense.status)}
            </div>
            <SheetDescription>
              ID: {expense.id.slice(0, 8).toUpperCase()}...
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Primary Details */}
            <div className="bg-muted/30 rounded-lg p-5 border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {formattedAmount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Requested by: <span className="font-medium text-foreground">{expense.userName || expense.userId}</span>
              </div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Date
                </div>
                <div className="text-sm font-medium">{formattedDate}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Target className="h-3.5 w-3.5" /> Category
                </div>
                <div className="text-sm font-medium">{expense.category}</div>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <FileText className="h-3.5 w-3.5" /> Description
                </div>
                <div className="text-sm leading-relaxed">{expense.description}</div>
              </div>
            </div>

            {/* Rejection Reason if any */}
            {expense.status === "REJECTED" && expense.rejectionReason && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 p-4 rounded-md text-sm border border-red-200 dark:border-red-900/50">
                <strong>Rejection Reason:</strong> {expense.rejectionReason}
              </div>
            )}

            {/* Receipt Link if any */}
            {expense.receiptUrl && (
              <a 
                href={expense.receiptUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-muted/50 transition-colors text-primary"
              >
                <FileDown className="h-4 w-4" />
                View Attached Receipt
              </a>
            )}

            <Separator />

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-sm mb-4">Approval Timeline</h3>
              {isLogsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline...
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log, index) => (
                    <div key={log.id} className="relative pl-6">
                      {/* Timeline Line */}
                      {index !== logs.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-border" />
                      )}
                      {/* Timeline Dot */}
                      <div className="absolute left-[-1px] top-1 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center">
                        {getLogIcon(log.action)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{log.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        by {log.userName}
                      </div>
                      {log.comment && (
                        <div className="mt-2 text-sm text-foreground bg-muted/40 p-2.5 rounded-md italic">
                          "{log.comment}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">No timeline events found.</div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
