import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

interface ReportParams {
  start_date?: string;
  end_date?: string;
  granularity?: "day" | "month";
}

export function useReports(params: ReportParams) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => api.get("/dashboard/summary", { params }).then((r) => r.data),
    enabled: !!params.start_date && !!params.end_date,
  });
}
