import { Expense } from "@/types/expense";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/empty-state";
interface DashboardTableProps {
  expenses: Expense[];
}

export function DashboardTable({ expenses }: DashboardTableProps) {
  const { company } = useAuth();
  const currency = company?.currency || "USD";

  return (
    expenses.length === 0 ? (
      <EmptyState
        icon="inbox"
        title="No recent expenses"
        description="You don't have any recent expenses to show. Submit a new expense to get started."
      />
    ) : (
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        {/* Hand-rolled table to perfectly match requirements without installing extra packages */}
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
                  Date
                </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Description
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                Amount
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {expenses.map((expense) => {
              const formattedDate = new Date(expense.date).toLocaleDateString(
                undefined,
                { year: "numeric", month: "short", day: "numeric" }
              );

              const formattedAmount = new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: currency,
              }).format(expense.amount);

              const badgeColor =
                expense.status === "APPROVED"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40"
                  : expense.status === "REJECTED"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40";

              return (
                <tr
                  key={expense.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="p-4 align-middle whitespace-nowrap text-muted-foreground">
                    {formattedDate}
                  </td>
                  <td className="p-4 align-middle font-medium">
                    {expense.description}
                  </td>
                  <td className="p-4 align-middle text-right tabular-nums font-medium">
                    {formattedAmount}
                  </td>
                  <td className="p-4 align-middle">
                    <Badge variant="secondary" className={`border-none ${badgeColor}`}>
                      {expense.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {/* Empty state is handled above */}
          </tbody>
        </table>
      </div>
    </div>
    )
  );
}
