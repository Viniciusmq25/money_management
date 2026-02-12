import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, ArrowUpRight, ArrowDownRight, X, Loader2 } from "lucide-react";
import api from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { Transaction, Category } from "../types";
import toast from "react-hot-toast";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { showMoney } = useMoneyVisibility();
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("");

  // Form state
  const [form, setForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    category_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterCat) params.category_id = filterCat;
      if (search) params.search = search;
      const [txnRes, catRes] = await Promise.all([
        api.get("/transactions", { params }),
        api.get("/categories"),
      ]);
      setTransactions(Array.isArray(txnRes.data) ? txnRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch {
      toast.error("Erro ao carregar transações");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterCat, search]);

  const resetForm = () => {
    setForm({ type: "EXPENSE", amount: "", description: "", date: new Date().toISOString().slice(0, 10), category_id: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!form.date) {
      toast.error("Data é obrigatória");
      return;
    }
    
    setSubmitting(true);
    const payload = {
      type: form.type,
      amount: amount,
      description: form.description.trim(),
      date: form.date,
      category_id: form.category_id ? parseInt(form.category_id) : null,
    };

    try {
      if (editId) {
        await api.put(`/transactions/${editId}`, payload);
        toast.success("Transação atualizada");
      } else {
        await api.post("/transactions", payload);
        toast.success("Transação adicionada");
      }
      resetForm();
      fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        toast.error(detail);
      } else if (Array.isArray(detail)) {
        toast.error(detail.map((d: any) => d.msg).join(", "));
      } else {
        toast.error("Erro ao salvar");
      }
    } finally {
      setSubmitting(false);
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

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta transação?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast.success("Excluída");
      fetchData();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const filteredCats = categories.filter((c) => (form.type === "INCOME" ? c.type === "INCOME" : c.type === "EXPENSE"));

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2.5 bg-primary-light border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 bg-primary-light border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receitas</option>
          <option value="EXPENSE">Despesas</option>
        </select>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Data</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Valor</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition">
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
                    <td className="px-5 py-3 text-sm text-muted">{formatDate(txn.date)}</td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
