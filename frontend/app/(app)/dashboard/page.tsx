"use client";

import { useQuery } from "@tanstack/react-query";
import { expensesApi } from "@/lib/api/expenses";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardTable } from "@/components/dashboard/DashboardTable";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, CheckCircle2, DollarSign, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { company } = useAuth();
  const currency = company?.currency || "USD";

  const { data: stats, isLoading: isStatsLoading, isError: isStatsError } = useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: expensesApi.getExpenseStats,
    staleTime: 60 * 1000,
  });

  const { data: recentExpenses, isLoading: isRecentLoading, isError: isRecentError } = useQuery({
    queryKey: ["recent_expenses"],
    queryFn: expensesApi.getRecent,
    staleTime: 60 * 1000,
  });

  const formattedTotalAmount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(stats?.totalAmount || 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">
          Here&apos;s a summary of the latest expense activity.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isStatsLoading ? (
          <>
            <Skeleton className="h-[120px] w-full rounded-xl" />
            <Skeleton className="h-[120px] w-full rounded-xl" />
            <Skeleton className="h-[120px] w-full rounded-xl" />
            <Skeleton className="h-[120px] w-full rounded-xl" />
          </>
        ) : isStatsError ? (
          <Card className="col-span-full border-dashed bg-muted/50">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
              <AlertCircle className="h-8 w-8 text-destructive opacity-50" />
              <p>Failed to load dashboard statistics.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-sm border-border/50 transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">All time records</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                <div className="h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.pendingCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved This Month</CardTitle>
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.approvedMonthCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Processed claims</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{formattedTotalAmount}</div>
                <p className="text-xs text-muted-foreground mt-1">Approved expenses value</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Expenses Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight">Recent Expenses</h3>
        {isRecentLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-t-xl" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full rounded-b-xl" />
          </div>
        ) : isRecentError ? (
             <Card className="border-dashed bg-muted/50">
             <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
               <AlertCircle className="h-8 w-8 text-destructive opacity-50" />
               <p>Failed to load recent expenses.</p>
             </CardContent>
           </Card>
        ) : (
          <DashboardTable expenses={recentExpenses || []} />
        )}
      </div>
    </div>
  );
}
