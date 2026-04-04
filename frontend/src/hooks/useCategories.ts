import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { Category } from "../types";

export function useCategories(type?: "INCOME" | "EXPENSE") {
  return useQuery<Category[]>({
    queryKey: ["categories", type],
    queryFn: () => api.get("/categories", { params: type ? { type } : {} }).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}
