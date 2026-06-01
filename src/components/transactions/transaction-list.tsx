"use client";

import { Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TransactionWithCategory } from "@/types";

interface TransactionListProps {
  transactions: TransactionWithCategory[];
  onEdit?: (transaction: TransactionWithCategory) => void;
  onDelete?: (id: string) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Nenhuma transação encontrada
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center gap-4 py-4">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${transaction.type === "INCOME" ? "bg-emerald-50" : "bg-red-50"}`}>
            {transaction.type === "INCOME" ? (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{transaction.description}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>
              {transaction.category && (
                <Badge color={transaction.category.color}>{transaction.category.name}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${transaction.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
              {transaction.type === "INCOME" ? "+" : "-"}
              {formatCurrency(transaction.amount)}
            </span>

            {(onEdit || onDelete) && (
              <div className="flex gap-1">
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(transaction)} className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(transaction.id)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
