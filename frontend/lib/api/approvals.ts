import { apiClient } from "./client";
import { Expense } from "@/types/expense";
import { expensesApi } from "./expenses";

export const approvalsApi = {
  getPendingApprovals: async () => {
    const response = await expensesApi.getExpenses({
      status: "PENDING",
      page: 1,
      limit: 200,
    });

    return response.data;
  },

  approveExpense: async (id: string, comment?: string): Promise<Expense> => {
    await apiClient(`/expenses/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(comment ? { comment } : {}),
    });

    return expensesApi.getExpense(id);
  },

  rejectExpense: async (id: string, comment: string): Promise<Expense> => {
    await apiClient(`/expenses/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });

    return expensesApi.getExpense(id);
  },
};
