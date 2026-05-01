import { Fragment, useState } from "react";
import { Plus, Search, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { Transaction } from "../types";
import { useTransactions, useTransactionCount, useDeleteTransaction } from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";
import AddTransactionModal from "../components/transactions/AddTransactionModal";

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const { showMoney } = useMoneyVisibility();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filterParams: Record<string, any> = {};
  if (filterType) filterParams.type = filterType;
  if (filterCat) filterParams.category_id = parseInt(filterCat);
  if (search) filterParams.search = search;

  const { data: transactions = [], isLoading: loading } = useTransactions({ ...filterParams, limit, offset: 0 });
  const { data: totalCount = 0 } = useTransactionCount(filterParams);
  const { data: categories = [] } = useCategories();
  const deleteTransaction = useDeleteTransaction();

  const hasMore = transactions.length < totalCount;

  const handleEdit = (txn: Transaction) => {
    setEditTransaction(txn);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir esta transação?")) return;
    deleteTransaction.mutate(id);
  };

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white font-display">Transações</h2>
        <button
          onClick={() => { setEditTransaction(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-primary text-sm font-semibold rounded transition cursor-pointer"
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
            className="w-full pl-10 pr-4 py-2 bg-primary-light border border-border rounded text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setLimit(PAGE_SIZE); }}
          className="px-3 py-2 bg-primary-light border border-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receitas</option>
          <option value="EXPENSE">Despesas</option>
        </select>
        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setLimit(PAGE_SIZE); }}
          className="px-3 py-2 bg-primary-light border border-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <AddTransactionModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditTransaction(null); }}
        editTransaction={editTransaction}
      />

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
        <div className="bg-primary-light rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Valor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {groupedTransactions.map((group, groupIndex) => (
                  <Fragment key={group.date}>
                    <tr>
                      <td colSpan={5} className="px-4 pt-4 pb-1">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {formatDate(group.date)}
                        </div>
                      </td>
                    </tr>

                    {group.items.map((txn) => (
                      <tr key={txn.id} className="border-b border-border hover:bg-surface-hover transition">
                        <td className="px-4 py-2.5">
                          <div
                            className={`w-7 h-7 rounded flex items-center justify-center ${
                              txn.type === "INCOME" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                            }`}
                          >
                            {txn.type === "INCOME" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-white">{txn.description}</span>
                          {txn.source === "IMPORT" && (
                            <span className="ml-2 text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">Importado</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {txn.category ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: txn.category.color + "20", color: txn.category.color }}>
                              {txn.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-sm font-semibold text-right font-mono ${txn.type === "INCOME" ? "text-success" : "text-danger"}`}>
                          {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount, showMoney)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(txn)} className="p-1.5 text-muted hover:text-accent transition cursor-pointer">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(txn.id)} className="p-1.5 text-muted hover:text-danger transition cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {groupIndex < groupedTransactions.length - 1 && (
                      <tr><td colSpan={5} className="h-3" /></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="border-t border-border p-3 flex justify-center">
              <button
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                className="px-4 py-2 bg-surface hover:bg-surface-hover text-white text-sm font-semibold rounded transition cursor-pointer"
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
