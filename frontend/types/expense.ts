export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  convertedAmount?: number;
  currency?: string;
  companyCurrency?: string;
  date: string;
  category: string;
  status: ExpenseStatus;
  userId: string;
  userName?: string;
  rejectionReason?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface ExpenseStats {
  totalCount: number;
  pendingCount: number;
  approvedMonthCount: number;
  totalAmount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExpenseLog {
  id: string;
  expenseId: string;
  userId: string;
  userName: string;
  action: 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED';
  timestamp: string;
  comment?: string;
}
