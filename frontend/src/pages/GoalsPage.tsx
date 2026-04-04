import { useState } from "react";
import { Plus, Target, X, Calendar, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { Goal } from "../types";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "../hooks/useGoals";

export default function GoalsPage() {
  const { data: goals = [], isLoading: loading } = useGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [showForm, setShowForm] = useState(false);
  const { showMoney } = useMoneyVisibility();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    icon: "target",
    color: "#6C63FF",
  });

  const COLORS = ["#6C63FF", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#8B5CF6", "#F97316"];

  const submitting = createGoal.isPending || updateGoal.isPending;

  const resetForm = () => {
    setForm({ name: "", target_amount: "", current_amount: "0", deadline: "", icon: "target", color: "#6C63FF" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount),
      deadline: form.deadline || null,
      icon: form.icon,
      color: form.color,
    };
    if (editId) {
      updateGoal.mutate({ id: editId, data: payload }, { onSuccess: resetForm });
    } else {
      createGoal.mutate(payload, { onSuccess: resetForm });
    }
  };

  const handleEdit = (g: Goal) => {
    setForm({
      name: g.name,
      target_amount: g.target_amount.toString(),
      current_amount: g.current_amount.toString(),
      deadline: g.deadline || "",
      icon: g.icon,
      color: g.color,
    });
    setEditId(g.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir esta meta?")) return;
    deleteGoal.mutate(id);
  };

  const handleUpdateAmount = (goal: Goal, delta: number) => {
    updateGoal.mutate({ id: goal.id, data: { current_amount: Math.max(0, goal.current_amount + delta) } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Metas Financeiras</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted text-lg">Nenhuma meta definida</p>
          <p className="text-muted/60 text-sm mt-1">Crie metas para acompanhar seus objetivos financeiros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <div key={goal.id} className="bg-primary-light rounded-2xl p-5 border border-border hover:border-accent/30 transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: goal.color + "20" }}>
                    <Target className="w-5 h-5" style={{ color: goal.color }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{goal.name}</h3>
                    {goal.deadline && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" /> {formatDate(goal.deadline)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(goal)} className="p-1 text-muted hover:text-accent transition cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(goal.id)} className="p-1 text-muted hover:text-danger transition cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted">{formatCurrency(goal.current_amount, showMoney)}</span>
                  <span className="text-white font-medium">{formatCurrency(goal.target_amount, showMoney)}</span>
                </div>
                <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(goal.progress || 0, 100)}%`,
                      backgroundColor: goal.color,
                    }}
                  />
                </div>
                <p className="text-right text-xs font-semibold mt-1" style={{ color: goal.color }}>
                  {(goal.progress || 0).toFixed(1)}%
                </p>
              </div>

              {/* Quick update buttons */}
              <div className="flex gap-2">
                {[100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleUpdateAmount(goal, val)}
                    className="flex-1 py-1.5 text-xs font-medium bg-surface hover:bg-surface-hover text-muted hover:text-white rounded-lg transition cursor-pointer"
                  >
                    +R${val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <form onSubmit={handleSubmit} className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editId ? "Editar" : "Nova"} Meta</h3>
              <button type="button" onClick={resetForm} className="text-muted hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <input type="text" placeholder="Nome da meta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
            <input type="number" step="0.01" placeholder="Valor da meta (R$)" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />
            <input type="number" step="0.01" placeholder="Valor atual (R$)" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent" />

            <div>
              <label className="text-xs text-muted mb-1 block">Prazo (opcional)</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            <div>
              <label className="text-xs text-muted mb-2 block">Cor</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full transition cursor-pointer ${form.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-primary-light" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                editId ? "Salvar" : "Criar Meta"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
