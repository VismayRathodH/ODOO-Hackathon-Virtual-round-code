"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CalendarIcon, Search, AlertCircle, ChevronLeft, ChevronRight, FileText, PlusCircle
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { expensesApi } from "@/lib/api/expenses";
import { Expense } from "@/types/expense";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { ExpenseDetailSheet } from "@/components/expenses/ExpenseDetailSheet";

export default function ExpensesPage() {
  const { company, role } = useAuth();
  const companyCurrency = company?.currency || "USD";

  // Filter States
  const [page, setPage] = useState(1);
  const limit = 20;
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  // Date Range State
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Sheet State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Fetch Logic
  const queryParams = {
    page,
    limit,
    ...(statusFilter !== "ALL" && { status: statusFilter }),
    ...(debouncedSearch && { q: debouncedSearch }),
    ...(dateRange.from && { startDate: dateRange.from.toISOString() }),
    ...(dateRange.to && { endDate: dateRange.to.toISOString() }),
  };

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["expenses_list", queryParams],
    queryFn: () => expensesApi.getExpenses(queryParams),
    staleTime: 30 * 1000,
  });

  // Derived variables
  const expenses = response?.data || [];
  const totalPages = response?.totalPages || 1;
  const hasData = expenses.length > 0;
  
  // Check if it's completely empty (no filters applied vs empty search result)
  const isCompletelyEmpty = !hasData && statusFilter === "ALL" && !debouncedSearch && !dateRange.from && !dateRange.to;

  const handleRowClick = (expense: Expense) => {
    setSelectedExpense(expense);
  };

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

  // Rendering logic
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {role === "ADMIN" ? "All Expenses" : role === "MANAGER" ? "Team Expenses" : "My Expenses"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and review expense records.
          </p>
        </div>
        {!isCompletelyEmpty && (
          <Button render={<Link href="/expenses/new" />}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Submit Expense
          </Button>
        )}
      </div>

      {!isCompletelyEmpty && (
        <div className="bg-card p-4 rounded-xl shadow-sm border space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search descriptions..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1); // Reset pagination on new search
                }}
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? "ALL"); setPage(1); }}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Picker */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal bg-background",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange({ from: range?.from, to: range?.to });
                      setPage(1);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Reset Filters */}
              {(statusFilter !== "ALL" || searchQuery || dateRange.from) && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearchQuery("");
                    setDateRange({ from: undefined, to: undefined });
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Original Amount</TableHead>
                  <TableHead className="text-right">Converted ({companyCurrency})</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <span>Failed to load expenses.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : hasData ? (
                  expenses.map((expense) => {
                    const parsedDate = new Date(expense.date);
                    const formattedDate = !isNaN(parsedDate.getTime()) 
                      ? format(parsedDate, "MMM dd, yyyy") 
                      : "Invalid Date";
                    const originalCurrency = expense.currency || "USD";
                    
                    const originalFormatted = new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: originalCurrency,
                    }).format(expense.amount);
                    
                    const convertedFormatted = new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: companyCurrency,
                    }).format(expense.convertedAmount ?? expense.amount);

                    return (
                      <TableRow 
                        key={expense.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(expense)}
                      >
                        <TableCell className="font-medium">{formattedDate}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell className="text-muted-foreground">{expense.category}</TableCell>
                        <TableCell className="text-right tabular-nums">{originalFormatted}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{convertedFormatted}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(expense.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleRowClick(expense); }}>
                            <span className="sr-only">Open menu</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No results found for your active filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <div className="text-sm text-muted-foreground px-4 font-medium">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isLoading}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State Block */}
      {isCompletelyEmpty && !isLoading && !isError && (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-card/50">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
            <FileText className="h-12 w-12 text-primary opacity-80" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">No expenses recorded yet</h2>
          <p className="text-muted-foreground max-w-sm mb-8">
            You haven't submitted any expenses. Once you do, they'll appear here for you to track their approval status.
          </p>
          <Button size="lg" className="shadow-md" render={<Link href="/expenses/new" />}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Submit your first expense
          </Button>
        </div>
      )}

      {/* Slide-over Detail */}
      <ExpenseDetailSheet 
        expense={selectedExpense} 
        onClose={() => setSelectedExpense(null)} 
      />
    </div>
  );
}
