import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import type { Transaction } from "../types";
import toast from "react-hot-toast";

interface TransactionFilters {
  type?: string;
  category_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery<Transaction[]>({
    queryKey: ["transactions", filters],
    queryFn: () => api.get("/transactions", { params: filters }).then((r) => r.data),
  });
}

export function useTransactionCount(filters: Omit<TransactionFilters, "limit" | "offset"> = {}) {
  return useQuery<number>({
    queryKey: ["transactions-count", filters],
    queryFn: () => api.get("/transactions/count", { params: filters }).then((r) => r.data.count),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post("/transactions", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions-count"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transação criada!");
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/transactions/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transação atualizada!");
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions-count"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transação excluída!");
    },
  });
}
