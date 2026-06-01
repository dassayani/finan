import { TransactionType } from "@prisma/client";

export type { TransactionType };

export interface TransactionWithCategory {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes?: string;
  categoryId?: string;
}
