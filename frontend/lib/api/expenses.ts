import { apiClient } from "./client";
import { Expense, ExpenseStats, PaginatedResponse, ExpenseLog } from "@/types/expense";

type ExpenseQueryParams = {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
};

type BackendExpense = {
  id: string;
  amount: number | string;
  convertedAmount?: number | string;
  currency?: string;
  companyCurrency?: string;
  date: string;
  category: string;
  description?: string;
  status: Expense["status"];
  userId: string;
  user?: {
    id: string;
    email: string;
  };
  receiptUrl?: string | null;
  createdAt?: string;
};

const toNumber = (value: number | string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeExpense = (expense: BackendExpense): Expense => {
  const amount = toNumber(expense.amount, 0);
  const convertedAmount =
    expense.convertedAmount !== undefined
      ? toNumber(expense.convertedAmount, amount)
      : amount;

  return {
    id: expense.id,
    description: expense.description ?? "",
    amount,
    convertedAmount,
    currency: expense.currency ?? "USD",
    companyCurrency: expense.companyCurrency,
    date: expense.date,
    category: expense.category,
    status: expense.status,
    userId: expense.userId,
    userName: expense.user?.email,
    receiptUrl: expense.receiptUrl ?? undefined,
    createdAt: expense.createdAt ?? new Date().toISOString(),
  };
};

const applyClientFilters = (expenses: Expense[], params?: ExpenseQueryParams): Expense[] => {
  if (!params) {
    return expenses;
  }

  const searchQuery = params.q?.trim().toLowerCase();
  const start = params.startDate ? new Date(params.startDate) : null;
  const end = params.endDate ? new Date(params.endDate) : null;

  return expenses.filter((expense) => {
    if (params.userId && expense.userId !== params.userId) {
      return false;
    }

    if (searchQuery) {
      const haystack = [
        expense.description,
        expense.category,
        expense.userName,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchQuery)) {
        return false;
      }
    }

    if (start || end) {
      const expenseDate = new Date(expense.date);

      if (Number.isNaN(expenseDate.getTime())) {
        return false;
      }

      if (start && expenseDate < start) {
        return false;
      }

      if (end && expenseDate > end) {
        return false;
      }
    }

    return true;
  });
};

const sortExpenses = (expenses: Expense[]) => {
  return [...expenses].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
};

const fetchAllExpenses = async (status?: string): Promise<Expense[]> => {
  const searchParams = new URLSearchParams();
  if (status && status !== "ALL") {
    searchParams.set("status", status);
  }

  const queryString = searchParams.toString();
  const endpoint = `/expenses${queryString ? `?${queryString}` : ""}`;
  const rawExpenses = await apiClient<BackendExpense[]>(endpoint);

  return sortExpenses(rawExpenses.map(normalizeExpense));
};

export const expensesApi = {
  getExpenses: async (params?: ExpenseQueryParams): Promise<PaginatedResponse<Expense>> => {
    const expenses = await fetchAllExpenses(params?.status);
    const filtered = applyClientFilters(expenses, params);

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.max(1, params?.limit ?? 20);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const data = filtered.slice(startIndex, startIndex + limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  },

  getExpense: async (id: string) => {
    const expense = await apiClient<BackendExpense>(`/expenses/${id}`);
    return normalizeExpense(expense);
  },

  createExpense: async (data: {
    amount: number;
    currency: string;
    category: string;
    description: string;
    date: string;
    receiptUrl?: string;
  }) => {
    const created = await apiClient<BackendExpense>("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });

    return normalizeExpense(created);
  },

  getExpenseLogs: async (_id: string): Promise<ExpenseLog[]> => {
    return [];
  },

  getExpenseStats: async (): Promise<ExpenseStats> => {
    const expenses = await fetchAllExpenses();
    const now = new Date();

    const approvedThisMonth = expenses.filter((expense) => {
      if (expense.status !== "APPROVED") {
        return false;
      }

      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getFullYear() === now.getFullYear() &&
        expenseDate.getMonth() === now.getMonth()
      );
    });

    const totalAmount = expenses
      .filter((expense) => expense.status === "APPROVED")
      .reduce((sum, expense) => sum + (expense.convertedAmount ?? expense.amount), 0);

    return {
      totalCount: expenses.length,
      pendingCount: expenses.filter((expense) => expense.status === "PENDING").length,
      approvedMonthCount: approvedThisMonth.length,
      totalAmount,
    };
  },

  getRecent: async () => {
    const expenses = await fetchAllExpenses();
    return expenses.slice(0, 5);
  },
};
