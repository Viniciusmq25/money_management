import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import type { DashboardData } from "../types";

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard/summary").then((r) => r.data),
    staleTime: 0,
  });
}
