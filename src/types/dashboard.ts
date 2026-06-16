export interface DashTransaction {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  expenseType: "FIXED" | "VARIABLE" | "BANK_BILL" | null;
  category: string | null;
  bank: string | null;
  date: string;
  isPaid: boolean;
  notes: string | null;
  installments: number | null;
  installmentIndex: number | null;
  groupId: string | null;
}

export interface DashBankFee {
  id: string;
  bank: string;
  name: string;
  amount: number;
  billingDay: number;
}

export interface DashBankBalance {
  id: string;
  bank: string;
  balance: number;
}

export interface DashBankEntry {
  id: string;
  bank: string | null;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string | null;
  groupId: string | null;
  isPaid: boolean;
}

export interface CategoryStat {
  key: string;
  name: string;
  value: number;
  color: string;
}

export interface ExpenseTypeData {
  fixed: number;
  variable: number;
  bankBill: number;
}

export interface MonthDashData {
  stats: { totalIncome: number; totalExpense: number; balance: number };
  categoryData: CategoryStat[];
  expenseTypeData: ExpenseTypeData;
}

export interface YearMonthData {
  m: string;
  income: number;
  expense: number;
  projected: boolean;
}
