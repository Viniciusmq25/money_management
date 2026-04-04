import { Fragment, useState } from "react";
import { Plus, Search, Pencil, Trash2, ArrowUpRight, ArrowDownRight, X, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { Transaction } from "../types";
import { useTransactions, useTransactionCount, useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [showForm, setShowForm] = useState(false);
  const { showMoney } = useMoneyVisibility();
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Form state
  const [form, setForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    category_id: "",
  });

  const filterParams: Record<string, any> = {};
  if (filterType) filterParams.type = filterType;
  if (filterCat) filterParams.category_id = parseInt(filterCat);
  if (search) filterParams.search = search;

  const { data: transactions = [], isLoading: loading } = useTransactions({ ...filterParams, limit, offset: 0 });
  const { data: totalCount = 0 } = useTransactionCount(filterParams);
  const { data: categories = [] } = useCategories();

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const hasMore = transactions.length < totalCount;
  const submitting = createTransaction.isPending || updateTransaction.isPending;

  const resetForm = () => {
    setForm({ type: "EXPENSE", amount: "", description: "", date: new Date().toISOString().slice(0, 10), category_id: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }
    if (!form.description.trim()) {
      return;
    }

    const payload = {
      type: form.type,
      amount,
      description: form.description.trim(),
      date: form.date,
      category_id: form.category_id ? parseInt(form.category_id) : null,
    };

    if (editId) {
      updateTransaction.mutate({ id: editId, data: payload }, { onSuccess: resetForm });
    } else {
      createTransaction.mutate(payload, { onSuccess: resetForm });
    }
  };

  const handleEdit = (txn: Transaction) => {
    setForm({
      type: txn.type,
      amount: txn.amount.toString(),
      description: txn.description,
      date: txn.date,
      category_id: txn.category_id?.toString() || "",
    });
    setEditId(txn.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir esta transação?")) return;
    deleteTransaction.mutate(id);
  };

  const handleLoadMore = () => {
    if (hasMore) setLimit((prev) => prev + PAGE_SIZE);
  };

  const filteredCats = categories.filter((c) => (form.type === "INCOME" ? c.type === "INCOME" : c.type === "EXPENSE"));
  const groupedTransactions = transactions.reduce<Array<{ date: string; items: Transaction[] }>>((acc, txn) => {
    const dateKey = txn.date.slice(0, 10);
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.items.push(txn);
    } else {
      acc.push({ date: dateKey, items: [txn] });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Transações</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nova Transação
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2.5 bg-primary-light border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setLimit(PAGE_SIZE); }}
          className="px-4 py-2.5 bg-primary-light border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receitas</option>
          <option value="EXPENSE">Despesas</option>
        </select>
        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setLimit(PAGE_SIZE); }}
          className="px-4 py-2.5 bg-primary-light border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <form onSubmit={handleSubmit} className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editId ? "Editar" : "Nova"} Transação</h3>
              <button type="button" onClick={resetForm} className="text-muted hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2">
              {["EXPENSE", "INCOME"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t as any, category_id: "" })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    form.type === t
                      ? t === "INCOME"
                        ? "bg-success text-white"
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
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              placeholder="Descrição"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">Sem categoria</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                editId ? "Salvar" : "Adicionar"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-lg">Nenhuma transação encontrada</p>
          <p className="text-muted/60 text-sm mt-1">Adicione sua primeira transação clicando no botão acima</p>
        </div>
      ) : (
        <div className="bg-primary-light rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Valor</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {groupedTransactions.map((group, groupIndex) => (
                  <Fragment key={group.date}>
                    <tr>
                      <td colSpan={5} className="px-5 pt-5 pb-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {formatDate(group.date)}
                        </div>
                      </td>
                    </tr>

                    {group.items.map((txn) => (
                      <tr key={txn.id} className="border-b border-border hover:bg-surface-hover transition">
                        <td className="px-5 py-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              txn.type === "INCOME" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                            }`}
                          >
                            {txn.type === "INCOME" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-white">{txn.description}</span>
                          {txn.source === "IMPORT" && (
                            <span className="ml-2 text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">Importado</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {txn.category ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: txn.category.color + "20", color: txn.category.color }}>
                              {txn.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className={`px-5 py-3 text-sm font-semibold text-right ${txn.type === "INCOME" ? "text-success" : "text-danger"}`}>
                          {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount, showMoney)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(txn)} className="p-1.5 text-muted hover:text-accent transition cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(txn.id)} className="p-1.5 text-muted hover:text-danger transition cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {groupIndex < groupedTransactions.length - 1 && (
                      <tr>
                        <td colSpan={5} className="h-4" />
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="border-t border-border p-4 flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2.5 bg-surface hover:bg-surface-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer flex items-center gap-2"
              >
                Ver mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
