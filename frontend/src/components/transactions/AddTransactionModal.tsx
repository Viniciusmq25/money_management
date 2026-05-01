import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreateTransaction, useUpdateTransaction } from "../../hooks/useTransactions";
import { useCategories } from "../../hooks/useCategories";
import type { Transaction } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction | null;
  onSuccess?: () => void;
}

const defaultForm = {
  type: "EXPENSE" as "INCOME" | "EXPENSE",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  category_id: "",
};

export default function AddTransactionModal({ isOpen, onClose, editTransaction, onSuccess }: Props) {
  const [form, setForm] = useState(defaultForm);
  const { data: categories = [] } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const submitting = createTransaction.isPending || updateTransaction.isPending;

  useEffect(() => {
    if (editTransaction) {
      setForm({
        type: editTransaction.type,
        amount: editTransaction.amount.toString(),
        description: editTransaction.description,
        date: editTransaction.date,
        category_id: editTransaction.category_id?.toString() || "",
      });
    } else {
      setForm({ ...defaultForm, date: new Date().toISOString().slice(0, 10) });
    }
  }, [editTransaction, isOpen]);

  const handleClose = () => {
    setForm({ ...defaultForm, date: new Date().toISOString().slice(0, 10) });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    if (!form.description.trim()) return;

    const payload = {
      type: form.type,
      amount,
      description: form.description.trim(),
      date: form.date,
      category_id: form.category_id ? parseInt(form.category_id) : null,
    };

    if (editTransaction) {
      updateTransaction.mutate({ id: editTransaction.id, data: payload }, {
        onSuccess: () => { onSuccess?.(); handleClose(); },
      });
    } else {
      createTransaction.mutate(payload, {
        onSuccess: () => { onSuccess?.(); handleClose(); },
      });
    }
  };

  const filteredCats = categories.filter((c) =>
    form.type === "INCOME" ? c.type === "INCOME" : c.type === "EXPENSE"
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-primary-light rounded-lg p-6 border border-border w-full max-w-md space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white font-display">
            {editTransaction ? "Editar" : "Nova"} Transação
          </h3>
          <button type="button" onClick={handleClose} className="text-muted hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm({ ...form, type: t, category_id: "" })}
              className={`flex-1 py-2 rounded text-sm font-semibold transition cursor-pointer ${
                form.type === t
                  ? t === "INCOME"
                    ? "bg-success text-primary"
                    : "bg-danger text-white"
                  : "bg-surface text-muted hover:text-white"
              }`}
            >
              {t === "INCOME" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <input
          type="number"
          step="0.01"
          placeholder="Valor (R$)"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
          className="w-full px-3 py-2.5 bg-surface border border-border rounded text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
        />
        <input
          type="text"
          placeholder="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          className="w-full px-3 py-2.5 bg-surface border border-border rounded text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
          className="w-full px-3 py-2.5 bg-surface border border-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="w-full px-3 py-2.5 bg-surface border border-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Sem categoria</option>
          {filteredCats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-accent hover:bg-accent-hover text-primary font-semibold rounded text-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
          ) : (
            editTransaction ? "Salvar" : "Adicionar"
          )}
        </button>
      </form>
    </div>
  );
}
