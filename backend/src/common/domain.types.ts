export const USER_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPROVAL_TYPES = ['SEQUENTIAL', 'CONDITIONAL', 'HYBRID'] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: UserRole;
  companyId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
  currency: string;
  country: string | null;
  createdAt: string;
};

export type ExpenseRecord = {
  id: string;
  userId: string;
  amount: number | string;
  currency: string;
  convertedAmount: number | string;
  companyCurrency: string;
  category: string;
  description: string;
  date: string;
  receiptUrl: string | null;
  status: ExpenseStatus;
  currentStep: number;
  currentApproverId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRuleRecord = {
  id: string;
  companyId: string;
  name: string;
  type: ApprovalType;
  percentageThreshold: number | null;
  specificApproverId: string | null;
  createdAt: string;
};

export type ApprovalStepRecord = {
  id: string;
  ruleId: string;
  approverId: string;
  sequence: number;
  isManagerApprover: boolean;
};