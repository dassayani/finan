import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: number;
  variant?: "default" | "income" | "expense";
}

export function StatsCard({ title, value, icon: Icon, trend, variant = "default" }: StatsCardProps) {
  const colors = {
    default: "bg-indigo-50 text-indigo-600",
    income: "bg-emerald-50 text-emerald-600",
    expense: "bg-red-50 text-red-600",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className={cn("mt-1 text-2xl font-bold", variant === "expense" ? "text-red-600" : variant === "income" ? "text-emerald-600" : "text-gray-900")}>
              {formatCurrency(value)}
            </p>
            {trend !== undefined && (
              <p className={cn("mt-1 text-xs", trend >= 0 ? "text-emerald-600" : "text-red-600")}>
                {trend >= 0 ? "+" : ""}{trend.toFixed(1)}% este mês
              </p>
            )}
          </div>
          <div className={cn("rounded-xl p-3", colors[variant])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
