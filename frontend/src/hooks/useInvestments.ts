import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import type { Investment, InvestmentSummary } from "../types";
import toast from "react-hot-toast";

export function useInvestments(type?: string) {
  return useQuery<Investment[]>({
    queryKey: ["investments", type],
    queryFn: () => api.get("/investments", { params: type ? { type } : {} }).then((r) => r.data),
  });
}

export function useInvestmentSummary() {
  return useQuery<InvestmentSummary>({
    queryKey: ["investment-summary"],
    queryFn: () => api.get("/investments/summary").then((r) => r.data),
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post("/investments", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Investimento criado!");
    },
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/investments/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      toast.success("Investimento atualizado!");
    },
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/investments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Investimento excluído!");
    },
  });
}

export function useCreateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: number; data: any }) =>
      api.post(`/investments/${investmentId}/deposits`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      toast.success("Aporte registrado!");
    },
  });
}

export function useCreateRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: number; data: any }) =>
      api.post(`/investments/${investmentId}/redemptions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      toast.success("Resgate registrado!");
    },
  });
}

export function useBinanceStatus() {
  return useQuery({
    queryKey: ["binance-status"],
    queryFn: () => api.get("/investments/binance/status").then((r) => r.data),
    retry: false,
  });
}

export function useBinanceSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/investments/binance/sync").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment-summary"] });
      qc.invalidateQueries({ queryKey: ["binance-status"] });
      toast.success("Binance sincronizada!");
    },
  });
}

export function useBinanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { api_key: string; api_secret: string }) =>
      api.post("/investments/binance/config", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["binance-status"] });
      toast.success("Binance configurada!");
    },
  });
}

export function useDeleteBinanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/investments/binance/config"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["binance-status"] });
      toast.success("Configuração removida!");
    },
  });
}
