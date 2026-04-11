import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  Upload,
  BarChart3,
  LogOut,
  DollarSign,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";
import api from "../../api/client";
import toast from "react-hot-toast";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transações" },
  { to: "/investments", icon: TrendingUp, label: "Investimentos" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/reports", icon: BarChart3, label: "Relatórios" },
  { to: "/import", icon: Upload, label: "Importar" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
}

export default function Sidebar({ isOpen, onClose, collapsed = false }: SidebarProps) {
  const navigate = useNavigate();
  const { showMoney, toggleMoneyVisibility } = useMoneyVisibility();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleNavClick = () => {
    // Close mobile menu when navigating
    if (onClose) onClose();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    if (passwordForm.new.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        current_password: passwordForm.current,
        new_password: passwordForm.new,
      });
      toast.success("Senha alterada com sucesso!");
      setShowPasswordModal(false);
      setPasswordForm({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao alterar senha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex-col bg-primary-light border-r border-border
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex
          ${collapsed ? "md:w-20" : "md:w-64"}
          ${!collapsed ? "w-64" : "w-64"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center justify-between px-6 py-6 border-b border-border transition-all duration-300 ${collapsed ? "md:px-3 md:justify-center" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "md:gap-0" : ""}`}>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Money</h1>
                <p className="text-xs text-muted">Management</p>
              </div>
            )}
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  collapsed ? "md:px-2 md:justify-center" : ""
                } ${
                  isActive
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : "text-muted hover:text-white hover:bg-surface-hover"
                }`
              }
              title={collapsed ? link.label : ""}
            >
              <link.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && link.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={toggleMoneyVisibility}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-all duration-200 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <Eye className="w-5 h-5 flex-shrink-0" /> : <EyeOff className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && (showMoney ? "Ocultar Valores" : "Mostrar Valores")}
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-all duration-200 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title="Alterar Senha"
          >
            <KeyRound className="w-5 h-5 flex-shrink-0" />
            {!collapsed && "Alterar Senha"}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-danger hover:bg-surface-hover transition-all duration-200 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title="Sair"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-primary-light rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-white">Alterar Senha</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-muted hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Senha Atual</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    placeholder="Digite sua senha atual"
                    required
                    className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    placeholder="Digite a nova senha (mín. 6 caracteres)"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Confirmar Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="Confirme a nova senha"
                    required
                    className="w-full px-4 py-2.5 pr-10 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Alterar Senha"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
