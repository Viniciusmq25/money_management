import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  X,
  Bitcoin,
  Building2,
  Landmark,
  BarChart3,
  Globe,
  Loader2,
  RefreshCw,
  Link2,
  Link2Off,
  Key,
  Eye,
  EyeOff,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import api from "../api/client";
import { formatCurrency, formatPercent } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { InvestmentSummary } from "../types";
import toast from "react-hot-toast";

const TYPE_LABELS: Record<string, string> = {
  ALL: "Todos",
  CRYPTO: "Criptomoedas",
  FII: "FIIs",
  RENDA_FIXA: "Renda Fixa",
  ACAO_BR: "Ações BR",
  ACAO_GLOBAL: "Ações Global",
  CAIXINHA_NUBANK: "Caixinha Nubank",
  CAIXINHA_TURBO_NUBANK: "Caixinha Turbo",
};
const TYPE_COLORS: Record<string, string> = {
  ALL: "#64748B",
  CRYPTO: "#F59E0B",
  FII: "#6C63FF",
  RENDA_FIXA: "#10B981",
  ACAO_BR: "#3B82F6",
  ACAO_GLOBAL: "#EC4899",
  CAIXINHA_NUBANK: "#820AD1",
  CAIXINHA_TURBO_NUBANK: "#FF5733",
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  ALL: <LayoutGrid className="w-5 h-5" />,
  CRYPTO: <Bitcoin className="w-5 h-5" />,
  FII: <Building2 className="w-5 h-5" />,
  RENDA_FIXA: <Landmark className="w-5 h-5" />,
  ACAO_BR: <BarChart3 className="w-5 h-5" />,
  ACAO_GLOBAL: <Globe className="w-5 h-5" />,
  CAIXINHA_NUBANK: <Landmark className="w-5 h-5" />,
  CAIXINHA_TURBO_NUBANK: <TrendingUp className="w-5 h-5" />,
};

// Cores para ativos individuais no gráfico
const ASSET_COLORS = [
  "#F59E0B",
  "#6C63FF",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#820AD1",
  "#FF5733",
  "#14B8A6",
  "#8B5CF6",
  "#F43F5E",
  "#06B6D4",
  "#84CC16",
  "#EAB308",
  "#22C55E",
  "#A855F7",
];

type Tab =
  | "ALL"
  | "CRYPTO"
  | "FII"
  | "RENDA_FIXA"
  | "ACAO_BR"
  | "ACAO_GLOBAL"
  | "CAIXINHA_NUBANK"
  | "CAIXINHA_TURBO_NUBANK";

type SortColumn =
  | "ticker"
  | "type"
  | "quantity"
  | "avg_price"
  | "current_price"
  | "total_invested"
  | "current_value"
  | "profit_loss";
type SortDirection = "asc" | "desc";

export default function InvestmentsPage() {
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");
  const [showForm, setShowForm] = useState(false);
  const { showMoney } = useMoneyVisibility();

  // Movimentações Modal
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [transactionForm, setTransactionForm] = useState({
    type: "DEPOSIT",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  });

  // Binance integration state
  const [binanceStatus, setBinanceStatus] = useState<{
    configured: boolean;
    active: boolean;
    last_sync: string | null;
  } | null>(null);
  const [showBinanceConfig, setShowBinanceConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [binanceForm, setBinanceForm] = useState({
    api_key: "",
    api_secret: "",
  });
  const [showSecret, setShowSecret] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>("current_value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [form, setForm] = useState({
    type: "CRYPTO" as Tab,
    ticker: "",
    name: "",
    quantity: "",
    avg_price: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    rate_type: "",
    rate_value: "",
    maturity_date: "",
    original_amount: "", // valor original aplicado (para caixinhas)
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/investments/summary");
      setSummary(data);
    } catch {
      toast.error("Erro ao carregar investimentos");
    }
    setLoading(false);
  };

  const fetchBinanceStatus = async () => {
    try {
      const { data } = await api.get("/investments/binance/status");
      setBinanceStatus(data);
    } catch {
      // Silently fail
    }
  };

  const handleBinanceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/investments/binance/config", binanceForm);
      toast.success("Binance conectada com sucesso!");
      setShowBinanceConfig(false);
      setBinanceForm({ api_key: "", api_secret: "" });
      fetchBinanceStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao configurar Binance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBinanceSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/investments/binance/sync");
      toast.success(
        `Sincronizado! ${data.created} criados, ${data.updated} atualizados`,
      );
      fetchData();
      fetchBinanceStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleBinanceDisconnect = async () => {
    if (!confirm("Deseja desconectar sua conta Binance?")) return;
    try {
      await api.delete("/investments/binance/config");
      toast.success("Binance desconectada");
      setBinanceStatus(null);
    } catch {
      toast.error("Erro ao desconectar");
    }
  };

  useEffect(() => {
    fetchData();
    fetchBinanceStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isCaixinha =
        form.type === "CAIXINHA_NUBANK" ||
        form.type === "CAIXINHA_TURBO_NUBANK";

      // Cria o investimento
      const investmentResponse = await api.post("/investments", {
        type: form.type,
        ticker: isCaixinha
          ? form.type === "CAIXINHA_NUBANK"
            ? "CAIXINHA"
            : "CAIXINHA_TURBO"
          : form.ticker.toUpperCase(),
        name: isCaixinha ? TYPE_LABELS[form.type] : form.name,
        quantity: isCaixinha ? 0 : parseFloat(form.quantity),
        avg_price: isCaixinha ? 1 : parseFloat(form.avg_price),
        purchase_date: !isCaixinha ? form.purchase_date || null : null,
        rate_type:
          isCaixinha || form.type === "RENDA_FIXA"
            ? form.rate_type || null
            : null,
        rate_value:
          isCaixinha || form.type === "RENDA_FIXA"
            ? form.rate_value
              ? parseFloat(form.rate_value)
              : null
            : null,
        maturity_date:
          form.type === "RENDA_FIXA" ? form.maturity_date || null : null,
      });

      // Se é caixinha e tem quantidade, adiciona como deposit
      if (isCaixinha && form.quantity) {
        const investmentId = investmentResponse.data.id;
        await api.post(`/investments/${investmentId}/deposits`, {
          amount: parseFloat(form.quantity),
          deposit_date:
            form.purchase_date || new Date().toISOString().slice(0, 10),
        });
      }

      toast.success("Investimento adicionado");
      setShowForm(false);
      setForm({
        type: "CRYPTO",
        ticker: "",
        name: "",
        quantity: "",
        avg_price: "",
        purchase_date: new Date().toISOString().slice(0, 10),
        rate_type: "",
        rate_value: "",
        maturity_date: "",
        original_amount: "",
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTransactions = async (inv: any) => {
    setSelectedInvestment(inv);
    setShowTransactionsModal(true);
    fetchTransactions(inv.id);
  };

  const fetchTransactions = async (id: number) => {
    try {
      const [depRes, redRes] = await Promise.all([
        api.get(`/investments/${id}/deposits`),
        api.get(`/investments/${id}/redemptions`),
      ]);
      setDeposits(depRes.data);
      setRedemptions(redRes.data);
    } catch {
      toast.error("Erro ao carregar movimentações");
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (transactionForm.type === "DEPOSIT") {
        await api.post(`/investments/${selectedInvestment.id}/deposits`, {
          amount: parseFloat(transactionForm.amount),
          deposit_date: transactionForm.date,
        });
      } else {
        await api.post(`/investments/${selectedInvestment.id}/redemptions`, {
          amount: parseFloat(transactionForm.amount),
          redemption_date: transactionForm.date,
        });
      }
      toast.success("Movimentação registrada");
      setTransactionForm({ ...transactionForm, amount: "" });
      fetchTransactions(selectedInvestment.id);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (type: string, id: number) => {
    if (!confirm("Excluir esta movimentação?")) return;
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
      fetchTransactions(selectedInvestment.id);
      fetchData();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este investimento?")) return;
    try {
      await api.delete(`/investments/${id}`);
      toast.success("Excluído");
      fetchData();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  // Sorting function
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort icon helper
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  // Sorted positions
  const sortedPositions = useMemo(() => {
    const filtered =
      tab === "ALL"
        ? summary?.positions || []
        : summary?.positions.filter((p) => p.type === tab) || [];

    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case "ticker":
          aVal = a.ticker.toLowerCase();
          bVal = b.ticker.toLowerCase();
          break;
        case "type":
          aVal = TYPE_LABELS[a.type] || a.type;
          bVal = TYPE_LABELS[b.type] || b.type;
          break;
        case "quantity":
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case "avg_price":
          aVal = a.avg_price;
          bVal = b.avg_price;
          break;
        case "current_price":
          aVal = a.current_price ?? 0;
          bVal = b.current_price ?? 0;
          break;
        case "total_invested":
          aVal = a.total_invested ?? 0;
          bVal = b.total_invested ?? 0;
          break;
        case "current_value":
          aVal = a.current_value ?? 0;
          bVal = b.current_value ?? 0;
          break;
        case "profit_loss":
          aVal = a.profit_loss ?? 0;
          bVal = b.profit_loss ?? 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [summary?.positions, tab, sortColumn, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const positions = sortedPositions;

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
          {/* Binance Integration Buttons */}
          {binanceStatus?.configured ? (
            <>
              <button
                onClick={handleBinanceSync}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-2 bg-warning/20 hover:bg-warning/30 text-warning text-sm font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                title="Sincronizar com Binance"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Sincronizando..." : "Sync Binance"}
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
            onClick={() => {
              setForm({ ...form, type: tab === "ALL" ? "CRYPTO" : tab });
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* Binance Config Modal */}
      {showBinanceConfig && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowBinanceConfig(false)}
        >
          <div
            className="bg-primary-light rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <Bitcoin className="w-5 h-5 text-warning" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Conectar Binance
                </h3>
              </div>
              <button
                onClick={() => setShowBinanceConfig(false)}
                className="text-muted hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-muted text-sm mb-4">
              Para importar seus investimentos automaticamente, crie uma API Key
              na Binance com permissão <strong>apenas de leitura</strong>.
            </p>

            <form onSubmit={handleBinanceConfig} className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block">API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={binanceForm.api_key}
                    onChange={(e) =>
                      setBinanceForm({
                        ...binanceForm,
                        api_key: e.target.value,
                      })
                    }
                    placeholder="Cole sua API Key aqui"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-warning"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">
                  API Secret
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type={showSecret ? "text" : "password"}
                    value={binanceForm.api_secret}
                    onChange={(e) =>
                      setBinanceForm({
                        ...binanceForm,
                        api_secret: e.target.value,
                      })
                    }
                    placeholder="Cole seu API Secret aqui"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-warning"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
                  >
                    {showSecret ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
                <p className="text-xs text-warning">
                  ⚠️ <strong>Importante:</strong> Use apenas permissões de
                  leitura. Nunca habilite saques ou trading na API Key usada
                  aqui.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-warning hover:bg-warning/90 text-black font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Conectar e Testar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Total Investido</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(summary.total_invested, showMoney)}
            </p>
          </div>
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Valor Atual</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(summary.total_current_value, showMoney)}
            </p>
          </div>
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Lucro/Prejuízo</p>
            <p
              className={`text-2xl font-bold ${summary.profit_loss >= 0 ? "text-success" : "text-danger"}`}
            >
              {formatCurrency(summary.profit_loss, showMoney)}
            </p>
            <p
              className={`text-sm font-medium ${summary.profit_loss_pct >= 0 ? "text-success" : "text-danger"}`}
            >
              {formatPercent(summary.profit_loss_pct, showMoney)}
            </p>
          </div>
        </div>
      )}

      {/* Allocation chart + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-3">Alocação</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                    label={({ cx, cy, midAngle, outerRadius, payload }) => {
                      if (payload.percent < 5) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 16;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#CBD5E1"
                          fontSize={11}
                          fontWeight={600}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {`${payload.percent.toFixed(1)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {pieData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.color}
                        style={{
                          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1E2139",
                      border: "1px solid #3B3F5C",
                      borderRadius: 12,
                      padding: "10px 14px",
                    }}
                    itemStyle={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                    labelStyle={{
                      color: "#94A3B8",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                    formatter={(v: number, _name: string, entry: any) => [
                      `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                      entry.payload.name,
                    ]}
                    separator=" "
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: e.color }}
                      />
                      <span className="text-muted">{e.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-xs">
                        {e.percent.toFixed(1)}%
                      </span>
                      <span className="text-white font-medium">
                        {formatCurrency(e.value, showMoney)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted text-sm text-center py-6">
              Nenhum investimento
            </p>
          )}
        </div>

        {/* Positions Table */}
        <div className="lg:col-span-3 bg-primary-light rounded-2xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {(
              [
                "ALL",
                "CRYPTO",
                "FII",
                "RENDA_FIXA",
                "ACAO_BR",
                "ACAO_GLOBAL",
                "CAIXINHA_NUBANK",
                "CAIXINHA_TURBO_NUBANK",
              ] as Tab[]
            ).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
                  tab === t
                    ? "text-accent border-b-2 border-accent"
                    : "text-muted hover:text-white"
                }`}
              >
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">
                {tab === "ALL"
                  ? "Nenhum investimento cadastrado"
                  : `Nenhum investimento em ${TYPE_LABELS[tab]}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("ticker")}
                    >
                      <div className="flex items-center gap-1">
                        Ativo
                        {getSortIcon("ticker")}
                      </div>
                    </th>
                    {tab === "ALL" && (
                      <th
                        className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center gap-1">
                          Tipo
                          {getSortIcon("type")}
                        </div>
                      </th>
                    )}
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("quantity")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Qtd
                        {getSortIcon("quantity")}
                      </div>
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("avg_price")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Preço Médio
                        {getSortIcon("avg_price")}
                      </div>
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("current_price")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Atual
                        {getSortIcon("current_price")}
                      </div>
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("total_invested")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Investido
                        {getSortIcon("total_invested")}
                      </div>
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("current_value")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor Atual
                        {getSortIcon("current_value")}
                      </div>
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none"
                      onClick={() => handleSort("profit_loss")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        P&L
                        {getSortIcon("profit_loss")}
                      </div>
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-border last:border-0 hover:bg-surface-hover transition"
                    >
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {inv.ticker}
                          </p>
                          <p className="text-xs text-muted">{inv.name}</p>
                        </div>
                      </td>
                      {tab === "ALL" && (
                        <td className="px-5 py-3">
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-lg"
                            style={{
                              backgroundColor: `${TYPE_COLORS[inv.type]}20`,
                              color: TYPE_COLORS[inv.type],
                            }}
                          >
                            {TYPE_LABELS[inv.type]}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3 text-right text-sm text-white">
                        {inv.quantity.toLocaleString("pt-BR", {
                          maximumFractionDigits: 8,
                        })}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-white">
                        {formatCurrency(inv.avg_price, showMoney)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div>
                          <span className="text-sm text-white">
                            {inv.current_price
                              ? formatCurrency(inv.current_price, showMoney)
                              : "—"}
                          </span>
                          {inv.change_24h !== null &&
                            inv.change_24h !== undefined && (
                              <span
                                className={`block text-xs font-medium ${inv.change_24h >= 0 ? "text-success" : "text-danger"}`}
                              >
                                {formatPercent(inv.change_24h, showMoney)}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-white">
                        {formatCurrency(inv.total_invested || 0, showMoney)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-white">
                        {inv.current_value
                          ? formatCurrency(inv.current_value, showMoney)
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {inv.profit_loss !== null &&
                        inv.profit_loss !== undefined ? (
                          <div className="flex items-center justify-end gap-1">
                            {inv.profit_loss >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-danger" />
                            )}
                            <span
                              className={`text-sm font-semibold ${inv.profit_loss >= 0 ? "text-success" : "text-danger"}`}
                            >
                              {formatCurrency(
                                Math.abs(inv.profit_loss),
                                showMoney,
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {[
                            "CAIXINHA_NUBANK",
                            "CAIXINHA_TURBO_NUBANK",
                          ].includes(inv.type) && (
                            <button
                              onClick={() => handleOpenTransactions(inv)}
                              className="p-1.5 text-muted hover:text-accent transition cursor-pointer"
                              title="Movimentações (Aplicações/Resgates)"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 text-muted hover:text-danger transition cursor-pointer"
                            title="Excluir Ativo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Investment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <form
            onSubmit={handleSubmit}
            className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Novo Investimento
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as Tab })
              }
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="CRYPTO">Criptomoeda</option>
              <option value="FII">FII</option>
              <option value="RENDA_FIXA">Renda Fixa</option>
              <option value="ACAO_BR">Ação Brasileira</option>
              <option value="ACAO_GLOBAL">Ação Global</option>
              <option value="CAIXINHA_NUBANK">Caixinha Nubank</option>
              <option value="CAIXINHA_TURBO_NUBANK">Caixinha Turbo</option>
            </select>

            {!["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(
              form.type,
            ) && (
              <>
                <input
                  type="text"
                  placeholder={
                    form.type === "CRYPTO"
                      ? "Ticker (ex: BTC)"
                      : form.type === "FII"
                        ? "Ticker (ex: HGLG11)"
                        : form.type === "ACAO_BR"
                          ? "Ticker (ex: PETR4)"
                          : form.type === "ACAO_GLOBAL"
                            ? "Ticker (ex: AAPL34)"
                            : "Nome do título"
                  }
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </>
            )}

            <div className="space-y-1">
              {["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(
                form.type,
              ) ? null : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted ml-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Qtd"
                        value={form.quantity}
                        onChange={(e) =>
                          setForm({ ...form, quantity: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted ml-1">
                        Preço médio (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Preço"
                        value={form.avg_price}
                        onChange={(e) =>
                          setForm({ ...form, avg_price: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted ml-1">
                Data de Aplicação
              </label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) =>
                  setForm({ ...form, purchase_date: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {(form.type === "RENDA_FIXA" ||
              form.type === "CAIXINHA_NUBANK" ||
              form.type === "CAIXINHA_TURBO_NUBANK") && (
              <>
                <select
                  value={form.rate_type}
                  onChange={(e) =>
                    setForm({ ...form, rate_type: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="">Tipo de taxa</option>
                  <option value="CDI">% do CDI</option>
                  <option value="SELIC">% da Selic</option>
                  <option value="PREFIXADO">Prefixado</option>
                  <option value="IPCA+">IPCA+</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Taxa (ex: 100 para 100% CDI)"
                  value={form.rate_value}
                  onChange={(e) =>
                    setForm({ ...form, rate_value: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {form.type === "RENDA_FIXA" && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">
                      Vencimento
                    </label>
                    <input
                      type="date"
                      value={form.maturity_date}
                      onChange={(e) =>
                        setForm({ ...form, maturity_date: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Transactions Modal */}
      {showTransactionsModal && selectedInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Movimentações - {selectedInvestment.name}
              </h3>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="p-2 text-muted hover:text-white bg-surface hover:bg-surface-hover rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* New Transaction Form */}
            <form
              onSubmit={handleTransactionSubmit}
              className="bg-surface rounded-xl p-4 border border-border space-y-4"
            >
              <h4 className="text-sm font-semibold text-white">
                Nova Movimentação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={transactionForm.type}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      type: e.target.value,
                    })
                  }
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="DEPOSIT">Aplicação</option>
                  <option value="REDEMPTION">Resgate</option>
                </select>
                <div className="sm:col-span-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor"
                    value={transactionForm.amount}
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        amount: e.target.value,
                      })
                    }
                    required
                    className="w-full pl-8 pr-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      date: e.target.value,
                    })
                  }
                  required
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="sm:col-span-1 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Adicionar"
                  )}
                </button>
              </div>
            </form>

            {/* Transactions List */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">Histórico</h4>
              {deposits.length === 0 && redemptions.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {/* Combine and sort */}
                  {[
                    ...deposits.map((d) => ({ ...d, type: "DEPOSIT" })),
                    ...redemptions.map((r) => ({ ...r, type: "REDEMPTION" })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(
                          b.deposit_date || b.redemption_date,
                        ).getTime() -
                        new Date(a.deposit_date || a.redemption_date).getTime(),
                    )
                    .map((item, i) => {
                      const isDeposit = item.type === "DEPOSIT";
                      const dateField = isDeposit
                        ? item.deposit_date
                        : item.redemption_date;

                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDeposit ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}
                            >
                              {isDeposit ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {isDeposit ? "Aplicação" : "Resgate"}
                              </p>
                              <p className="text-xs text-muted">
                                {new Date(
                                  dateField + "T12:00:00",
                                ).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className={`text-sm font-bold ${isDeposit ? "text-success" : "text-danger"}`}
                            >
                              {isDeposit ? "+" : "-"}{" "}
                              {formatCurrency(item.amount, showMoney)}
                            </span>
                            <button
                              onClick={() =>
                                handleDeleteTransaction(item.type, item.id)
                              }
                              className="text-muted hover:text-danger cursor-pointer transition"
                              title="Excluir"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
