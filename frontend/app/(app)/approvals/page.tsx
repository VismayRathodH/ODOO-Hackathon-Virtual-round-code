"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  AlertCircle,
  CheckCircle,
  FileDown,
  FileText,
  Loader2,
  XCircle,
  Check,
  X,
  Target,
  Calendar,
  Clock,
  MessageSquare
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { approvalsApi } from "@/lib/api/approvals";
import { expensesApi } from "@/lib/api/expenses";
import { Expense } from "@/types/expense";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Validation Schemas
const approveSchema = z.object({
  comment: z.string().optional(),
});
const rejectSchema = z.object({
  comment: z.string().min(10, "Rejection reason must be at least 10 characters."),
});

type ApproveFormValues = z.infer<typeof approveSchema>;
type RejectFormValues = z.infer<typeof rejectSchema>;

export default function ApprovalsPage() {
  const { role, company } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const companyCurrency = company?.currency || "USD";

  // Role Guarding (Redirects if EMPLOYEE)
  useEffect(() => {
    if (role === "EMPLOYEE") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  
  // Dialog States
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  
  // Animation State for removal
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Form Hooks
  const approveForm = useForm<ApproveFormValues>({
    resolver: zodResolver(approveSchema),
    defaultValues: { comment: "" },
  });
  
  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { comment: "" },
  });

  // Queries
  const { data: pendingExpenses, isLoading: isPendingLoading } = useQuery({
    queryKey: ["approvals_pending"],
    queryFn: approvalsApi.getPendingApprovals,
    enabled: role !== "EMPLOYEE",
  });

  // Update selected if current disappears
  useEffect(() => {
    if (pendingExpenses && pendingExpenses.length > 0) {
      // If we don't have one selected, or the selected one was removed, default to the first
      const stillExists = pendingExpenses.some(e => e.id === selectedExpenseId);
      if (!stillExists) {
        setSelectedExpenseId(pendingExpenses[0].id);
      }
    } else {
      setSelectedExpenseId(null);
    }
  }, [pendingExpenses, selectedExpenseId]);

  const selectedExpense = pendingExpenses?.find((e) => e.id === selectedExpenseId) || null;

  const { data: logs, isLoading: isLogsLoading } = useQuery({
    queryKey: ["expense_logs", selectedExpense?.id],
    queryFn: () => expensesApi.getExpenseLogs(selectedExpense!.id),
    enabled: !!selectedExpense?.id,
  });

  // Mutations
  const removeExpenseAnimState = (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
       queryClient.invalidateQueries({ queryKey: ["approvals_pending"] });
       queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
    }, 400); // Wait for CSS transition
  };

  const approveMutation = useMutation({
    mutationFn: (data: { id: string; comment?: string }) => 
      approvalsApi.approveExpense(data.id, data.comment),
    onSuccess: (_, variables) => {
      setIsApproveOpen(false);
      approveForm.reset();
      toast.success("Expense successfully approved.");
      removeExpenseAnimState(variables.id);
    },
    onError: (error: any) => {
      toast.error(error.message || "Approval failed.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { id: string; comment: string }) => 
      approvalsApi.rejectExpense(data.id, data.comment),
    onSuccess: (_, variables) => {
      setIsRejectOpen(false);
      rejectForm.reset();
      toast.success("Expense has been rejected.");
      removeExpenseAnimState(variables.id);
    },
    onError: (error: any) => {
      toast.error(error.message || "Rejection failed.");
    }
  });

  if (role === "EMPLOYEE") return null;

  // Handlers
  const onApproveSubmit = (values: ApproveFormValues) => {
    if (selectedExpense) {
      approveMutation.mutate({ id: selectedExpense.id, comment: values.comment });
    }
  };

  const onRejectSubmit = (values: RejectFormValues) => {
    if (selectedExpense) {
      rejectMutation.mutate({ id: selectedExpense.id, comment: values.comment });
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
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review and process outstanding employee expenses.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px_1fr] flex-1 gap-6 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Queue List */}
        <div className="flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              Pending Review
              {pendingExpenses && (
                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingExpenses.length}
                </span>
              )}
            </h2>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {isPendingLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-4 flex gap-4 animate-pulse">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : pendingExpenses?.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto opacity-20 mb-3 text-green-500" />
                  <p className="text-sm">You are all caught up!</p>
                </div>
              ) : (
                pendingExpenses?.map((expense) => {
                  const isRemoving = removingIds.has(expense.id);
                  const isSelected = selectedExpenseId === expense.id;
                  
                  // Basic formatting
                  const originalFormatted = new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: expense.currency || "USD",
                  }).format(expense.amount);
                  
                  return (
                    <Card 
                      key={expense.id} 
                      onClick={() => !isRemoving && setSelectedExpenseId(expense.id)}
                      className={cn(
                        "cursor-pointer transition-all duration-300 overflow-hidden",
                        isSelected 
                          ? "ring-2 ring-primary border-transparent bg-primary/5" 
                          : "hover:bg-muted/50 border-border/50 hover:border-border",
                        isRemoving ? "opacity-0 scale-95 translate-x-8 pointer-events-none h-0 mb-0 border-0 p-0 overflow-hidden" : ""
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10 mt-0.5">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${expense.userName || expense.userId}&backgroundColor=random`} />
                            <AvatarFallback>{(expense.userName || "?").charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-semibold truncate pr-2">{expense.userName || "Unknown Employee"}</p>
                              <span className="text-sm font-bold whitespace-nowrap tabular-nums">{originalFormatted}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate font-medium">
                              {expense.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(expense.date), "MMM d")}</span>
                              <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {expense.category}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT COLUMN: Detail Pane */}
        <div className="hidden md:flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm relative">
          {!selectedExpense ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
              <FileText className="h-16 w-16 opacity-10 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No expense selected</h3>
              <p className="text-sm max-w-[250px]">Select an item from the queue on the left to review its details.</p>
            </div>
          ) : (
            <>
              {removingIds.has(selectedExpense.id) && (
                <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center backdrop-blur-sm animate-in fade-in transition-all">
                  <div className="bg-card text-foreground p-4 rounded-xl shadow-lg border flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" /> Processing...
                  </div>
                </div>
              )}
              
              <div className="p-6 border-b flex items-start justify-between bg-muted/10">
                <div>
                  <h2 className="text-xl font-bold">{selectedExpense.description}</h2>
                  <p className="text-sm text-muted-foreground mt-1">ID: {selectedExpense.id.slice(0, 8).toUpperCase()}...</p>
                </div>
                {selectedExpense.receiptUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer" />}
                  >
                    <FileDown className="h-4 w-4 mr-2" /> Receipt
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                  {/* Financial High-level Block */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">Requested Amount</p>
                      <div className="text-2xl font-bold tabular-nums">
                        {new Intl.NumberFormat(undefined, { style: "currency", currency: selectedExpense.currency || "USD" }).format(selectedExpense.amount)}
                      </div>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                      <p className="text-xs text-primary/80 mb-1 font-medium tracking-wide uppercase">Company Cost Equivalent</p>
                      <div className="text-2xl font-bold tabular-nums text-primary/90">
                        {new Intl.NumberFormat(undefined, { style: "currency", currency: companyCurrency }).format(selectedExpense.convertedAmount ?? selectedExpense.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-y-6">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <Avatar className="h-4 w-4"><AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedExpense.userName || selectedExpense.userId}&backgroundColor=random`} /></Avatar> Submitter
                      </div>
                      <div className="text-sm font-medium">{selectedExpense.userName || selectedExpense.userId}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Date Incurred
                      </div>
                      <div className="text-sm font-medium">{format(new Date(selectedExpense.date), "PPP")}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <Target className="h-3.5 w-3.5" /> Category
                      </div>
                      <div className="text-sm font-medium">{selectedExpense.category}</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Timeline */}
                  <div>
                    <h3 className="font-semibold text-sm mb-4">Approval Timeline</h3>
                    {isLogsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Skeleton className="h-4 w-4 rounded-full" /> <Skeleton className="h-4 w-32" />
                      </div>
                    ) : logs && logs.length > 0 ? (
                      <div className="space-y-4">
                        {logs.map((log, index) => (
                          <div key={log.id} className="relative pl-6">
                            {index !== logs.length - 1 && (
                              <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-border" />
                            )}
                            <div className="absolute left-[-1px] top-1 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center">
                              {getLogIcon(log.action)}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{log.action}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.timestamp), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">by {log.userName}</div>
                            {log.comment && (
                              <div className="mt-2 text-sm text-foreground bg-muted/40 p-2.5 rounded-md italic">
                                "{log.comment}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">No events logged yet.</div>
                    )}
                  </div>
                </div>
              </ScrollArea>
              
              {/* Action Ribbon */}
              <div className="p-4 border-t bg-background flex flex-col sm:flex-row gap-3 items-center justify-end">
                <p className="text-xs text-muted-foreground mr-auto hidden sm:block">Action is irreversible once confirmed.</p>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30" onClick={() => setIsRejectOpen(true)}>
                  <X className="mr-2 h-4 w-4" /> Reject Issue
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsApproveOpen(true)}>
                  <Check className="mr-2 h-4 w-4" /> Approve Expense
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* APPROVAL DIALOG */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this expense? It will move to the next stage in the authorization pipeline.
            </DialogDescription>
          </DialogHeader>
          <Form {...approveForm}>
            <form onSubmit={approveForm.handleSubmit(onApproveSubmit)} className="space-y-4 pt-2">
              <FormField
                control={approveForm.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approval Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Leave a note for the auditing team..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsApproveOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={approveMutation.isPending}>
                  {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Approval
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription className="text-red-600/90 dark:text-red-400">
              You are about to reject this request. A comprehensive reason is legally required.
            </DialogDescription>
          </DialogHeader>
          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4 pt-2">
              <FormField
                control={rejectForm.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-destructive flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Rejection Reason *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Explain to the submitter why this is rejected (min 10 chars)..." className="resize-none border-destructive focus-visible:ring-destructive" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={rejectMutation.isPending}>
                  {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Rejection
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
