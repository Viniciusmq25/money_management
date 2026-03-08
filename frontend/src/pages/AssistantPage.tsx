import { useEffect, useState } from "react";
import { Bot, Loader2, Send, Sparkles, Wallet, Target, ShoppingCart } from "lucide-react";
import api from "../api/client";
import { formatCurrency } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { AssistantChatResponse, AssistantContext, AssistantMessage } from "../types";
import toast from "react-hot-toast";

const starterMessages: AssistantMessage[] = [
  {
    role: "assistant",
    content: "Eu leio o contexto financeiro calculado pelo sistema e posso ajudar com plano mensal, corte de gastos, metas e simulação de compra.",
  },
];

export default function AssistantPage() {
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [sending, setSending] = useState(false);
  const { showMoney } = useMoneyVisibility();

  useEffect(() => {
    api.get("/assistant/context")
      .then((response) => setContext(response.data))
      .catch(() => toast.error("Erro ao carregar contexto do assistente"))
      .finally(() => setLoadingContext(false));
  }, []);

  const sendMessage = async (message: string, overrides?: { amount?: string; description?: string }) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const history = messages.slice(-8);
    const nextUserMessage: AssistantMessage = { role: "user", content: trimmed };
    setMessages((current) => [...current, nextUserMessage]);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post<AssistantChatResponse>("/assistant/chat", {
        message: trimmed,
        history,
        purchase_amount: overrides?.amount ? Number(overrides.amount) : undefined,
        purchase_description: overrides?.description || undefined,
      });
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      setContext((current) => current ? { ...current, model: data.model, snapshot: data.snapshot } : current);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Erro ao falar com o assistente");
      setMessages((current) => current.filter((item, index) => index !== current.length - 1));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handlePurchaseSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseAmount) {
      toast.error("Informe o valor da compra");
      return;
    }
    const description = purchaseDescription.trim() || "compra sem descrição";
    await sendMessage(
      `Avalie a compra de ${description} no valor de R$ ${purchaseAmount}. Quero saber impacto no saldo, no mês e nas metas.`,
      { amount: purchaseAmount, description }
    );
  };

  if (loadingContext) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!context) {
    return <p className="text-muted">Erro ao carregar assistente.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Assistente IA</h2>
          <p className="text-sm text-muted mt-1">Planejamento e simulação guiados pelos dados reais do sistema.</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${context.configured ? "border-success/30 text-success bg-success/10" : "border-yellow-500/30 text-yellow-300 bg-yellow-500/10"}`}>
          <Sparkles className="w-4 h-4" />
          {context.configured ? `Modelo: ${context.model}` : "Backend sem ANTHROPIC_API_KEY"}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-4">
        <section className="bg-primary-light rounded-2xl border border-border p-4 md:p-5 flex flex-col min-h-[680px]">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-11 h-11 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Copiloto financeiro</h3>
              <p className="text-xs text-muted">Responde com base no snapshot consolidado do backend.</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${message.role === "user" ? "bg-accent text-white" : "bg-surface text-slate-100 border border-border"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-surface border border-border text-muted inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pensando...
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {context.suggested_prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={sending || !context.configured}
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-border bg-surface text-muted hover:text-white hover:border-accent/40 transition disabled:opacity-50 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre seu plano do mês, metas, gastos ou uma compra que você está considerando..."
                rows={3}
                disabled={!context.configured || sending}
                className="flex-1 resize-none px-4 py-3 bg-surface border border-border rounded-2xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={!context.configured || sending || !input.trim()}
                className="self-end h-12 px-4 rounded-2xl bg-accent text-white font-semibold hover:bg-accent-hover disabled:opacity-50 transition cursor-pointer inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-primary-light rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-accent" />
              <h3 className="text-white font-semibold">Snapshot Financeiro</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-muted mb-1">Saldo atual</p>
                <p className="text-white font-semibold">{formatCurrency(context.snapshot.current_balance, showMoney)}</p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-muted mb-1">Resultado do mês</p>
                <p className={`font-semibold ${context.snapshot.monthly_result >= 0 ? "text-success" : "text-danger"}`}>
                  {formatCurrency(context.snapshot.monthly_result, showMoney)}
                </p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-muted mb-1">Receitas do mês</p>
                <p className="text-success font-semibold">{formatCurrency(context.snapshot.monthly_income, showMoney)}</p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-muted mb-1">Despesas do mês</p>
                <p className="text-danger font-semibold">{formatCurrency(context.snapshot.monthly_expense, showMoney)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePurchaseSimulation} className="bg-primary-light rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-accent" />
              <h3 className="text-white font-semibold">Simular Compra</h3>
            </div>
            <input
              value={purchaseDescription}
              onChange={(e) => setPurchaseDescription(e.target.value)}
              placeholder="Ex.: notebook, viagem, celular"
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              placeholder="Valor da compra"
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!context.configured || sending || !purchaseAmount}
              className="w-full h-12 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover disabled:opacity-50 transition cursor-pointer"
            >
              Avaliar impacto da compra
            </button>
            {context.snapshot.purchase_scenario && (
              <div className="rounded-xl bg-surface p-3 border border-border space-y-2 text-sm">
                <p className="text-white font-medium">Cenário calculado</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Saldo após compra</span>
                  <span className="text-white font-semibold">
                    {formatCurrency(context.snapshot.purchase_scenario.balance_after_purchase, showMoney)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Resultado do mês após compra</span>
                  <span className={`font-semibold ${context.snapshot.purchase_scenario.monthly_result_after_purchase >= 0 ? "text-success" : "text-danger"}`}>
                    {formatCurrency(context.snapshot.purchase_scenario.monthly_result_after_purchase, showMoney)}
                  </span>
                </div>
              </div>
            )}
          </form>

          <div className="bg-primary-light rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-accent" />
              <h3 className="text-white font-semibold">Metas e Pressão</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-muted mb-1">Gap total das metas</p>
                <p className="text-white font-semibold">{formatCurrency(context.snapshot.goals_total_gap, showMoney)}</p>
              </div>
              {context.snapshot.goals.slice(0, 3).map((goal) => (
                <div key={goal.name} className="rounded-xl bg-surface p-3 border border-border">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-white font-medium truncate">{goal.name}</p>
                    <span className="text-xs text-muted">{goal.progress.toFixed(0)}%</span>
                  </div>
                  <p className="text-muted text-xs">Falta {formatCurrency(goal.remaining_amount, showMoney)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}