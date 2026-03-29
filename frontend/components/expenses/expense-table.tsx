"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Expense, ExpenseStatus } from "@/types/expense";
import { cn } from "@/lib/utils";
import { MoreHorizontal, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface ExpenseTableProps {
  expenses: Expense[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  showActions?: boolean;
}

const statusMap: Record<ExpenseStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
};

export function ExpenseTable({ expenses, onApprove, onReject, showActions = true }: ExpenseTableProps) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No expenses found"
        description="We couldn't find any expenses matching your criteria. Create a new expense to see it here."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Category</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            {showActions && <TableHead className="w-[80px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id} className="group hover:bg-muted/20 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="text-sm">{expense.description}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{expense.id.slice(0, 8)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  ${expense.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                    {expense.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(expense.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </TableCell>
                <TableCell>
                  <Badge className={cn("border-none px-2.5 py-0.5 text-[10px] font-bold", statusMap[expense.status].className)}>
                    {statusMap[expense.status].label}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted group-hover:bg-background transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="gap-2">
                          <ExternalLink className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        {expense.status === "PENDING" && onApprove && (
                          <DropdownMenuItem className="gap-2 text-green-600 focus:text-green-600" onClick={() => onApprove(expense.id)}>
                            <ThumbsUp className="h-4 w-4" /> Approve
                          </DropdownMenuItem>
                        )}
                        {expense.status === "PENDING" && onReject && (
                          <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => onReject(expense.id)}>
                            <ThumbsDown className="h-4 w-4" /> Reject
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
