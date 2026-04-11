import { useState } from "react";
import { RefreshCw, Link2, Link2Off } from "lucide-react";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import { TYPE_LABELS, TYPE_COLORS, ASSET_COLORS } from "../constants/theme";
import {
  useInvestmentSummary,
  useCreateInvestment,
  useDeleteInvestment,
  useCreateDeposit,
  useCreateRedemption,
  useCreateStockTransaction,
  useBinanceStatus,
  useBinanceSync,
  useBinanceConfig,
  useDeleteBinanceConfig,
} from "../hooks/useInvestments";
import type { Investment } from "../types";
import type { InvestmentFormData } from "../components/investments/InvestmentForm";
import toast from "react-hot-toast";

import InvestmentSummaryCards from "../components/investments/InvestmentSummaryCards";
import AllocationChart from "../components/investments/AllocationChart";
import InvestmentTable from "../components/investments/InvestmentTable";
import DepositModal from "../components/investments/DepositModal";
import BinanceConfigModal from "../components/investments/BinanceConfigModal";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "../components/common/Skeleton";

type Tab = "ALL" | "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";

export default function InvestmentsPage() {
  const { data: summary, isLoading: loading } = useInvestmentSummary();
  const { data: binanceStatusData } = useBinanceStatus();
  const binanceStatus = binanceStatusData as
    | { configured: boolean; active: boolean; last_sync: string | null }
    | undefined;
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const createDeposit = useCreateDeposit();
  const createRedemption = useCreateRedemption();
  const createStockTransaction = useCreateStockTransaction();
  const binanceSync = useBinanceSync();
  const binanceConfigMutation = useBinanceConfig();
  const deleteBinanceConfig = useDeleteBinanceConfig();

  const [tab, setTab] = useState<Tab>("ALL");
  const { showMoney } = useMoneyVisibility();

  const [selectedInvestment, setSelectedInvestment] =
    useState<Investment | null>(null);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showBinanceConfig, setShowBinanceConfig] = useState(false);

  const handleBinanceDisconnect = () => {
    if (!confirm("Deseja desconectar sua conta Binance?")) return;
    deleteBinanceConfig.mutate();
  };

  const handleSubmitInvestment = (data: InvestmentFormData) => {
    createInvestment.mutate(data, {
      onError: (err: any) =>
        toast.error(err.response?.data?.detail || "Erro ao salvar"),
    });
  };

  const handleSubmitStockTransaction = (data: {
    type: string;
    quantity: number;
    price_per_share: number;
    date: string;
  }) => {
    if (!selectedInvestment) return;
    createStockTransaction.mutate(
      { investmentId: selectedInvestment.id, data },
      {
        onSuccess: () => setShowTransactionsModal(false),
        onError: (err: any) =>
          toast.error(err.response?.data?.detail || "Erro ao salvar"),
      },
    );
  };

  const handleOpenTransactions = (inv: Investment) => {
    setSelectedInvestment(inv);
    setShowTransactionsModal(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este investimento?")) return;
    deleteInvestment.mutate(id);
  };

  const handleSubmitDeposit = (data: {
    amount: number;
    deposit_date: string;
  }) => {
    if (!selectedInvestment) return;
    createDeposit.mutate(
      { investmentId: selectedInvestment.id, data },
      {
        onSuccess: () => setShowTransactionsModal(false),
        onError: (err: any) =>
          toast.error(err.response?.data?.detail || "Erro ao salvar"),
      },
    );
  };

  const handleSubmitRedemption = (data: {
    amount: number;
    redemption_date: string;
  }) => {
    if (!selectedInvestment) return;
    createRedemption.mutate(
      { investmentId: selectedInvestment.id, data },
      {
        onSuccess: () => setShowTransactionsModal(false),
        onError: (err: any) =>
          toast.error(err.response?.data?.detail || "Erro ao salvar"),
      },
    );
  };

  const handleDeleteTransaction = async (type: string, id: number) => {
    if (!confirm("Excluir esta movimentação?")) return;
    if (!selectedInvestment) return;
    const { default: api } = await import("../api/client");
    try {
      if (type === "DEPOSIT") {
        await api.delete(
          `/investments/${selectedInvestment.id}/deposits/${id}`,
        );
      } else if (type === "STOCK") {
        await api.delete(
          `/investments/${selectedInvestment.id}/stock-transactions/${id}`,
        );
      } else {
        await api.delete(
          `/investments/${selectedInvestment.id}/redemptions/${id}`,
        );
      }
      toast.success("Excluído");
      setShowTransactionsModal(false);
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleBinanceConfigSubmit = (data: {
    api_key: string;
    api_secret: string;
  }) => {
    binanceConfigMutation.mutate(data, {
      onSuccess: () => setShowBinanceConfig(false),
      onError: (err: any) =>
        toast.error(
          err.response?.data?.detail || "Erro ao configurar Binance",
        ),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-surface animate-pulse rounded" />
          <div className="h-9 w-32 bg-surface animate-pulse rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <SkeletonChart />
          <SkeletonTable rows={6} className="lg:col-span-3" />
        </div>
      </div>
    );
  }

  // Filtered positions for the current tab
  const positions =
    tab === "ALL"
      ? summary?.positions || []
      : summary?.positions.filter((p) => p.type === tab) || [];

  // Pie chart data
  const pieDataRaw = summary
    ? tab === "ALL"
      ? Object.entries(summary.by_type).map(([key, val]) => ({
          name: TYPE_LABELS[key] || key,
          value: val.current || val.invested,
          color: TYPE_COLORS[key] || "#64748B",
        }))
      : positions.map((p, i) => ({
          name: p.ticker,
          value: p.current_value || p.total_invested || 0,
          color: ASSET_COLORS[i % ASSET_COLORS.length],
        }))
    : [];

  const pieTotal = pieDataRaw.reduce((acc, e) => acc + e.value, 0);
  const pieData = pieDataRaw.map((e) => ({
    ...e,
    percent: pieTotal > 0 ? (e.value / pieTotal) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-white">Investimentos</h2>
        <div className="flex items-center gap-2">
          {binanceStatus?.configured ? (
            <>
              <button
                onClick={() => binanceSync.mutate()}
                disabled={binanceSync.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-warning/20 hover:bg-warning/30 text-warning text-sm font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                title="Sincronizar com Binance"
              >
                <RefreshCw
                  className={`w-4 h-4 ${binanceSync.isPending ? "animate-spin" : ""}`}
                />
                {binanceSync.isPending ? "Sincronizando..." : "Sync Binance"}
              </button>
              <button
                onClick={handleBinanceDisconnect}
                className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition cursor-pointer"
                title="Desconectar Binance"
              >
                <Link2Off className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowBinanceConfig(true)}
              className="flex items-center gap-2 px-3 py-2 bg-warning/20 hover:bg-warning/30 text-warning text-sm font-medium rounded-xl transition cursor-pointer"
            >
              <Link2 className="w-4 h-4" /> Conectar Binance
            </button>
          )}
        </div>
      </div>

      {summary && (
        <InvestmentSummaryCards summary={summary} showMoney={showMoney} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <AllocationChart pieData={pieData} showMoney={showMoney} />
        <InvestmentTable
          positions={positions}
          tab={tab}
          onTabChange={setTab}
          showMoney={showMoney}
          onDelete={handleDelete}
          onOpenTransactions={handleOpenTransactions}
          onAddInvestment={handleSubmitInvestment}
          isAddPending={createInvestment.isPending}
        />
      </div>

      <DepositModal
        open={showTransactionsModal}
        onClose={() => setShowTransactionsModal(false)}
        investment={selectedInvestment}
        showMoney={showMoney}
        onSubmitDeposit={handleSubmitDeposit}
        onSubmitRedemption={handleSubmitRedemption}
        onSubmitStockTransaction={handleSubmitStockTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        isPending={createDeposit.isPending || createRedemption.isPending || createStockTransaction.isPending}
      />

      <BinanceConfigModal
        open={showBinanceConfig}
        onClose={() => setShowBinanceConfig(false)}
        onSubmit={handleBinanceConfigSubmit}
        isPending={binanceConfigMutation.isPending}
      />
    </div>
  );
}
