import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, KeyRound, Trash2, LogIn, X, Shield, Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { adminApi, type AdminUser } from "../api/admin";

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", password: "" });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createShowPw, setCreateShowPw] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetShowPw, setResetShowPw] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.listUsers());
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = createForm.username.trim().toLowerCase();
    if (!/^[a-z0-9]{4,}$/.test(username)) {
      toast.error("Username: 4+ caracteres, apenas letras minúsculas e números");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Senha mínima: 6 caracteres");
      return;
    }
    setCreateSubmitting(true);
    try {
      await adminApi.createUser(username, createForm.password);
      toast.success("Usuário criado");
      setCreateOpen(false);
      setCreateForm({ username: "", password: "" });
      await refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao criar usuário");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      toast.error("Senha mínima: 6 caracteres");
      return;
    }
    setResetSubmitting(true);
    try {
      await adminApi.resetPassword(resetTarget.id, resetPassword);
      toast.success(`Senha de ${resetTarget.username} redefinida`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao redefinir senha");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.username} excluído`);
      setDeleteTarget(null);
      await refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao excluir");
    }
  };

  const handleImpersonate = async (user: AdminUser) => {
    try {
      const { access_token } = await adminApi.impersonate(user.id);
      localStorage.setItem("token", access_token);
      toast.success(`Personificando ${user.username}`);
      navigate("/");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao personificar");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Administração</h1>
            <p className="text-sm text-muted">Gerenciar usuários do sistema</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      <div className="bg-primary-light rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted">Nenhum usuário</div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-4 px-4 py-4">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {user.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">{user.username}</span>
                    {user.is_admin && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                        <Shield className="w-3 h-3" /> admin
                      </span>
                    )}
                  </div>
                  {user.created_at && (
                    <p className="text-xs text-muted">
                      Criado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!user.is_admin && (
                    <button
                      onClick={() => handleImpersonate(user)}
                      title="Personificar"
                      className="p-2 text-muted hover:text-accent hover:bg-surface-hover rounded-lg transition cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setResetTarget(user)}
                    title="Redefinir senha"
                    className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {!user.is_admin && (
                    <button
                      onClick={() => setDeleteTarget(user)}
                      title="Excluir"
                      className="p-2 text-muted hover:text-danger hover:bg-surface-hover rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <Modal title="Novo usuário" icon={<UserPlus className="w-5 h-5 text-accent" />} onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Username</label>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="ex: irma (4+ caracteres, a-z, 0-9)"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Senha inicial</label>
              <div className="relative">
                <input
                  type={createShowPw ? "text" : "password"}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="mín. 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="button" onClick={() => setCreateShowPw(!createShowPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer">
                  {createShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={createSubmitting}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Criando...</> : "Criar usuário"}
            </button>
          </form>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <Modal title={`Redefinir senha — ${resetTarget.username}`} icon={<KeyRound className="w-5 h-5 text-accent" />} onClose={() => { setResetTarget(null); setResetPassword(""); }}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Nova senha</label>
              <div className="relative">
                <input
                  type={resetShowPw ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="mín. 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
                <button type="button" onClick={() => setResetShowPw(!resetShowPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer">
                  {resetShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={resetSubmitting}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {resetSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Redefinir"}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal title={`Excluir ${deleteTarget.username}?`} icon={<Trash2 className="w-5 h-5 text-danger" />} onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-muted mb-4">
            Todos os dados (transações, investimentos, metas, importações, categorias) deste usuário serão apagados permanentemente.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 bg-surface hover:bg-surface-hover text-white text-sm font-medium rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 bg-danger hover:opacity-90 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-primary-light rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">{icon}</div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
