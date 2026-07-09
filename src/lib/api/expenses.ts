import { apiFetch } from "./client";

export type SplitStrategy = "EQUAL" | "CUSTOM_PERCENTAGE";

export interface ExpenseSplit {
  userId: string;
  amountOwed: number;
}

export interface ExpenseResponse {
  id: string;
  groupId: string;
  payerId: string;
  amount: number;
  description: string;
  splitStrategy: SplitStrategy;
  createdBy: string;
  createdAt: string;
  editable: boolean;
  splits: ExpenseSplit[];
}

export interface ExpenseWriteRequest {
  payerId: string;
  amount: number;
  description: string;
  strategy: SplitStrategy;
  splits: ExpenseSplit[];
}

export function listExpenses(groupId: string) {
  return apiFetch<ExpenseResponse[]>(`/groups/${groupId}/expenses`);
}

export function createExpense(groupId: string, body: ExpenseWriteRequest) {
  return apiFetch<ExpenseResponse>(`/groups/${groupId}/expenses`, { method: "POST", body });
}

export function updateExpense(expenseId: string, body: ExpenseWriteRequest) {
  return apiFetch<ExpenseResponse>(`/expenses/${expenseId}`, { method: "PATCH", body });
}

export function deleteExpense(expenseId: string) {
  return apiFetch<void>(`/expenses/${expenseId}`, { method: "DELETE" });
}
