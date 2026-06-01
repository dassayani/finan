"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CreateTransactionInput } from "@/types";

const schema = z.object({
  description: z.string().min(1, "Informe a descrição"),
  amount: z.string().min(1, "Informe o valor"),
  type: z.enum(["INCOME", "EXPENSE"]),
  date: z.string().min(1, "Informe a data"),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Category {
  id: string;
  name: string;
  color: string;
}

interface TransactionFormProps {
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<FormData>;
  loading?: boolean;
}

export function TransactionForm({ onSubmit, onCancel, initialData, loading }: TransactionFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "EXPENSE",
      date: new Date().toISOString().split("T")[0],
      ...initialData,
    },
  });

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      ...data,
      amount: parseFloat(data.amount),
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
      <Input
        label="Descrição"
        placeholder="Ex: Supermercado"
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <Input
          label="Data"
          type="date"
          error={errors.date?.message}
          {...register("date")}
        />
      </div>

      <Select label="Tipo" error={errors.type?.message} {...register("type")}>
        <option value="EXPENSE">Despesa</option>
        <option value="INCOME">Receita</option>
      </Select>

      <Select label="Categoria" {...register("categoryId")}>
        <option value="">Sem categoria</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </Select>

      <Input
        label="Observações (opcional)"
        placeholder="Detalhes adicionais..."
        {...register("notes")}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Salvar
        </Button>
      </div>
    </form>
  );
}
