import { useState } from "react";
import { Plus, RefreshCw, Link2, Link2Off } from "lucide-react";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import { TYPE_LABELS, TYPE_COLORS, ASSET_COLORS } from "../constants/theme";
import {
  useInvestmentSummary,
  useCreateInvestment,
  useDeleteInvestment,
  useCreateDeposit,
  useCreateRedemption,
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
import InvestmentForm from "../components/investments/InvestmentForm";
import DepositModal from "../components/investments/DepositModal";
import BinanceConfigModal from "../components/investments/BinanceConfigModal";

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
  const binanceSync = useBinanceSync();
  const binanceConfigMutation = useBinanceConfig();
  const deleteBinanceConfig = useDeleteBinanceConfig();

  const [tab, setTab] = useState<Tab>("ALL");
  const [showForm, setShowForm] = useState(false);
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
      onSuccess: () => setShowForm(false),
      onError: (err: any) =>
        toast.error(err.response?.data?.detail || "Erro ao salvar"),
    });
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
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
        />
      </div>

      <InvestmentForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmitInvestment}
        isPending={createInvestment.isPending}
        defaultType={tab}
      />

      <DepositModal
        open={showTransactionsModal}
        onClose={() => setShowTransactionsModal(false)}
        investment={selectedInvestment}
        showMoney={showMoney}
        onSubmitDeposit={handleSubmitDeposit}
        onSubmitRedemption={handleSubmitRedemption}
        onDeleteTransaction={handleDeleteTransaction}
        isPending={createDeposit.isPending || createRedemption.isPending}
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
