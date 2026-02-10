import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, X, Bitcoin, Building2, Landmark, BarChart3, Globe, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import api from "../api/client";
import { formatCurrency, formatPercent } from "../utils/format";
import type { InvestmentSummary } from "../types";
import toast from "react-hot-toast";

const TYPE_LABELS: Record<string, string> = { 
  CRYPTO: "Criptomoedas", 
  FII: "FIIs", 
  RENDA_FIXA: "Renda Fixa", 
  ACAO_BR: "Ações BR", 
  ACAO_GLOBAL: "Ações Global",
  CAIXINHA_NUBANK: "Caixinha Nubank",
  CAIXINHA_TURBO_NUBANK: "Caixinha Turbo"
};
const TYPE_COLORS: Record<string, string> = { 
  CRYPTO: "#F59E0B", 
  FII: "#6C63FF", 
  RENDA_FIXA: "#10B981", 
  ACAO_BR: "#3B82F6", 
  ACAO_GLOBAL: "#EC4899",
  CAIXINHA_NUBANK: "#820AD1",
  CAIXINHA_TURBO_NUBANK: "#FF5733"
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  CRYPTO: <Bitcoin className="w-5 h-5" />,
  FII: <Building2 className="w-5 h-5" />,
  RENDA_FIXA: <Landmark className="w-5 h-5" />,
  ACAO_BR: <BarChart3 className="w-5 h-5" />,
  ACAO_GLOBAL: <Globe className="w-5 h-5" />,
  CAIXINHA_NUBANK: <Landmark className="w-5 h-5" />,
  CAIXINHA_TURBO_NUBANK: <TrendingUp className="w-5 h-5" />
};

type Tab = "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL" | "CAIXINHA_NUBANK" | "CAIXINHA_TURBO_NUBANK";

export default function InvestmentsPage() {
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("CRYPTO");
  const [showForm, setShowForm] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isCaixinha = form.type === "CAIXINHA_NUBANK" || form.type === "CAIXINHA_TURBO_NUBANK";
      await api.post("/investments", {
        type: form.type,
        ticker: isCaixinha ? (form.type === "CAIXINHA_NUBANK" ? "CAIXINHA" : "CAIXINHA_TURBO") : form.ticker.toUpperCase(),
        name: isCaixinha ? TYPE_LABELS[form.type] : form.name,
        quantity: parseFloat(form.quantity),
        avg_price: isCaixinha ? 1 : parseFloat(form.avg_price),
        purchase_date: form.purchase_date || null,
        rate_type: form.rate_type || null,
        rate_value: form.rate_value ? parseFloat(form.rate_value) : null,
        maturity_date: form.maturity_date || null,
      });
      toast.success("Investimento adicionado");
      setShowForm(false);
      setForm({ type: "CRYPTO", ticker: "", name: "", quantity: "", avg_price: "", purchase_date: new Date().toISOString().slice(0, 10), rate_type: "", rate_value: "", maturity_date: "" });
      fetchData();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const positions = summary?.positions.filter((p) => p.type === tab) || [];
  const pieData = summary
    ? Object.entries(summary.by_type).map(([key, val]) => ({
        name: TYPE_LABELS[key] || key,
        value: val.current || val.invested,
        color: TYPE_COLORS[key] || "#64748B",
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Investimentos</h2>
        <button
          onClick={() => {
            setForm({ ...form, type: tab });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Total Investido</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_invested)}</p>
          </div>
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Valor Atual</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_current_value)}</p>
          </div>
          <div className="bg-primary-light rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted mb-1">Lucro/Prejuízo</p>
            <p className={`text-2xl font-bold ${summary.profit_loss >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(summary.profit_loss)}
            </p>
            <p className={`text-sm font-medium ${summary.profit_loss_pct >= 0 ? "text-success" : "text-danger"}`}>
              {formatPercent(summary.profit_loss_pct)}
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
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, color: "#F1F5F9" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                      <span className="text-muted">{e.name}</span>
                    </div>
                    <span className="text-white font-medium">{formatCurrency(e.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted text-sm text-center py-6">Nenhum investimento</p>
          )}
        </div>

        {/* Positions Table */}
        <div className="lg:col-span-3 bg-primary-light rounded-2xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {(["CRYPTO", "FII", "RENDA_FIXA", "ACAO_BR", "ACAO_GLOBAL", "CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
                  tab === t ? "text-accent border-b-2 border-accent" : "text-muted hover:text-white"
                }`}
              >
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">Nenhum investimento em {TYPE_LABELS[tab]}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Ativo</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Qtd</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Preço Médio</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Atual</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Investido</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Valor Atual</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">P&L</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition">
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{inv.ticker}</p>
                          <p className="text-xs text-muted">{inv.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-white">{inv.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</td>
                      <td className="px-5 py-3 text-right text-sm text-white">{formatCurrency(inv.avg_price)}</td>
                      <td className="px-5 py-3 text-right">
                        <div>
                          <span className="text-sm text-white">{inv.current_price ? formatCurrency(inv.current_price) : "—"}</span>
                          {inv.change_24h !== null && inv.change_24h !== undefined && (
                            <span className={`block text-xs font-medium ${inv.change_24h >= 0 ? "text-success" : "text-danger"}`}>
                              {formatPercent(inv.change_24h)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-white">{formatCurrency(inv.total_invested || 0)}</td>
                      <td className="px-5 py-3 text-right text-sm text-white">{inv.current_value ? formatCurrency(inv.current_value) : "—"}</td>
                      <td className="px-5 py-3 text-right">
                        {inv.profit_loss !== null && inv.profit_loss !== undefined ? (
                          <div className="flex items-center justify-end gap-1">
                            {inv.profit_loss >= 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-danger" />
                            )}
                            <span className={`text-sm font-semibold ${inv.profit_loss >= 0 ? "text-success" : "text-danger"}`}>
                              {formatCurrency(Math.abs(inv.profit_loss))}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-muted hover:text-danger transition cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
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
          <form onSubmit={handleSubmit} className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Novo Investimento</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Tab })}
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

            {!["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(form.type) && (
              <>
                <input type="text" placeholder={form.type === "CRYPTO" ? "Ticker (ex: BTC)" : form.type === "FII" ? "Ticker (ex: HGLG11)" : form.type === "ACAO_BR" ? "Ticker (ex: PETR4)" : form.type === "ACAO_GLOBAL" ? "Ticker (ex: AAPL34)" : "Nome do título"} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} required className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
                <input type="text" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
              </>
            )}

            <div className={`grid ${["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(form.type) ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
              <input type="number" step="any" placeholder={["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(form.type) ? "Quantidade em R$" : "Quantidade"} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required className="px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
              {!["CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"].includes(form.type) && (
                <input type="number" step="0.01" placeholder="Preço médio (R$)" value={form.avg_price} onChange={(e) => setForm({ ...form, avg_price: e.target.value })} required className="px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted ml-1">Data de Aplicação</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            {(form.type === "RENDA_FIXA" || form.type === "CAIXINHA_NUBANK" || form.type === "CAIXINHA_TURBO_NUBANK") && (
              <>
                <select value={form.rate_type} onChange={(e) => setForm({ ...form, rate_type: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer">
                  <option value="">Tipo de taxa</option>
                  <option value="CDI">% do CDI</option>
                  <option value="SELIC">% da Selic</option>
                  <option value="PREFIXADO">Prefixado</option>
                  <option value="IPCA+">IPCA+</option>
                </select>
                <input type="number" step="0.01" placeholder="Taxa (ex: 100 para 100% CDI)" value={form.rate_value} onChange={(e) => setForm({ ...form, rate_value: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
                {form.type === "RENDA_FIXA" && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">Vencimento</label>
                    <input type="date" value={form.maturity_date} onChange={(e) => setForm({ ...form, maturity_date: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                )}
              </>
            )}

            <button type="submit" disabled={submitting} className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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
    </div>
  );
}
