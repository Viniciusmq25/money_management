import { useState } from "react";
import { X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import type { Investment } from "../../types";
import { formatCurrency } from "../../utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  investment: Investment | null;
  showMoney: boolean;
  onSubmitDeposit: (data: { amount: number; deposit_date: string }) => void;
  onSubmitRedemption: (data: { amount: number; redemption_date: string }) => void;
  onSubmitStockTransaction?: (data: { type: string; quantity: number; price_per_share: number; date: string }) => void;
  onDeleteTransaction: (type: string, id: number) => void;
  isPending: boolean;
}

export default function DepositModal({
  open,
  onClose,
  investment,
  showMoney,
  onSubmitDeposit,
  onSubmitRedemption,
  onSubmitStockTransaction,
  onDeleteTransaction,
  isPending,
}: Props) {
  const [form, setForm] = useState({
    type: "DEPOSIT",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [stockForm, setStockForm] = useState({
    type: "COMPRA",
    quantity: "",
    price_per_share: "",
    date: new Date().toISOString().slice(0, 10),
  });

  if (!open || !investment) return null;

  const isStockMode = ["FII", "ACAO_BR", "ACAO_GLOBAL"].includes(investment.type);

  const deposits = investment.deposits || [];
  const redemptions = investment.redemptions || [];
  const stockTxs = investment.stock_transactions || [];

  const handleSubmitRendaFixa = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (form.type === "DEPOSIT") {
      onSubmitDeposit({ amount, deposit_date: form.date });
    } else {
      onSubmitRedemption({ amount, redemption_date: form.date });
    }
    setForm({ ...form, amount: "" });
  };

  const handleSubmitStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitStockTransaction) return;
    onSubmitStockTransaction({
      type: stockForm.type,
      quantity: parseFloat(stockForm.quantity),
      price_per_share: parseFloat(stockForm.price_per_share),
      date: stockForm.date,
    });
    setStockForm({ ...stockForm, quantity: "", price_per_share: "" });
  };

  const allRendaFixaTxs = [
    ...deposits.map((d: any) => ({ ...d, type: "DEPOSIT" })),
    ...redemptions.map((r: any) => ({ ...r, type: "REDEMPTION" })),
  ].sort(
    (a: any, b: any) =>
      new Date(b.deposit_date || b.redemption_date).getTime() -
      new Date(a.deposit_date || a.redemption_date).getTime(),
  );

  const sortedStockTxs = [...stockTxs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            Movimentações - {investment.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-white bg-surface hover:bg-surface-hover rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isStockMode ? (
          <>
            {/* Stock Transaction Form */}
            <form
              onSubmit={handleSubmitStock}
              className="bg-surface rounded-xl p-4 border border-border space-y-4"
            >
              <h4 className="text-sm font-semibold text-white">Nova Movimentação</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={stockForm.type}
                  onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="COMPRA">Compra</option>
                  <option value="VENDA">Venda</option>
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="Quantidade"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  required
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder-muted/50"
                />
                <div className="sm:col-span-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Preço por cota"
                    value={stockForm.price_per_share}
                    onChange={(e) => setStockForm({ ...stockForm, price_per_share: e.target.value })}
                    required
                    className="w-full pl-8 pr-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder-muted/50"
                  />
                </div>
                <input
                  type="date"
                  value={stockForm.date}
                  onChange={(e) => setStockForm({ ...stockForm, date: e.target.value })}
                  required
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
              </button>
            </form>

            {/* Stock Transactions History */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">Histórico</h4>
              {sortedStockTxs.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {sortedStockTxs.map((item) => {
                    const isBuy = item.type === "COMPRA";
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBuy ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}
                          >
                            {isBuy ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {isBuy ? "Compra" : "Venda"} — {item.quantity} cotas
                            </p>
                            <p className="text-xs text-muted">
                              {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-bold ${isBuy ? "text-success" : "text-danger"}`}>
                            {isBuy ? "+" : "-"}{" "}
                            {formatCurrency(item.quantity * item.price_per_share, showMoney)}
                          </span>
                          <button
                            onClick={() => onDeleteTransaction("STOCK", item.id)}
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
          </>
        ) : (
          <>
            {/* Renda Fixa Form */}
            <form
              onSubmit={handleSubmitRendaFixa}
              className="bg-surface rounded-xl p-4 border border-border space-y-4"
            >
              <h4 className="text-sm font-semibold text-white">Nova Movimentação</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                >
                  <option value="DEPOSIT">Aplicação</option>
                  <option value="REDEMPTION">Resgate</option>
                </select>
                <div className="sm:col-span-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full pl-8 pr-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="sm:col-span-1 px-3 py-2 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="sm:col-span-1 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
                </button>
              </div>
            </form>

            {/* Renda Fixa History */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">Histórico</h4>
              {allRendaFixaTxs.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {allRendaFixaTxs.map((item: any) => {
                    const isDeposit = item.type === "DEPOSIT";
                    const dateField = isDeposit ? item.deposit_date : item.redemption_date;

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDeposit ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}
                          >
                            {isDeposit ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {isDeposit ? "Aplicação" : "Resgate"}
                            </p>
                            <p className="text-xs text-muted">
                              {new Date(dateField + "T12:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-bold ${isDeposit ? "text-success" : "text-danger"}`}>
                            {isDeposit ? "+" : "-"}{" "}
                            {formatCurrency(item.amount, showMoney)}
                          </span>
                          <button
                            onClick={() => onDeleteTransaction(item.type, item.id)}
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
          </>
        )}
      </div>
    </div>
  );
}
