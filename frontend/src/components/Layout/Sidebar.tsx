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
  Users,
} from "lucide-react";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";
import api from "../../api/client";
import toast from "react-hot-toast";
import { isAdmin, isImpersonating } from "../../utils/jwt";

const mainLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transações" },
  { to: "/investments", icon: TrendingUp, label: "Investimentos" },
];

const toolLinks = [
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/reports", icon: BarChart3, label: "Relatórios" },
  { to: "/import", icon: Upload, label: "Importar" },
];

const adminLink = { to: "/admin", icon: Users, label: "Administração" };

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

  const extraLinks = isAdmin() && !isImpersonating() ? [adminLink] : [];

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/money/login";
  };

  const handleNavClick = () => {
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

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
      collapsed ? "md:px-2 md:justify-center" : ""
    } ${
      isActive
        ? "border-l-2 border-accent text-accent bg-surface-hover pl-[10px]"
        : "text-muted hover:text-white hover:bg-surface-hover border-l-2 border-transparent pl-[10px]"
    }`;

  const renderLink = (link: { to: string; icon: React.ElementType; label: string }) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.to === "/"}
      onClick={handleNavClick}
      className={navItemClass}
      title={collapsed ? link.label : ""}
    >
      <link.icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && link.label}
    </NavLink>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex-col bg-primary-light border-r border-border
          transform transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex
          ${collapsed ? "md:w-16" : "md:w-56"}
          ${!collapsed ? "w-56" : "w-56"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center justify-between px-4 py-4 border-b border-border transition-all duration-300 ${collapsed ? "md:px-3 md:justify-center" : ""}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? "md:gap-0" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold text-white leading-tight font-display">Money</h1>
                <p className="text-xs text-muted leading-tight">Management</p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-muted hover:text-white hover:bg-surface-hover rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {[...mainLinks, ...extraLinks].map(renderLink)}

          <div className={`pt-4 pb-1 ${collapsed ? "hidden md:hidden" : ""}`}>
            <span className="px-3 text-xs font-semibold text-muted/60 uppercase tracking-widest">
              {!collapsed && "Ferramentas"}
            </span>
          </div>

          {toolLinks.map(renderLink)}
        </nav>

        {/* Footer actions */}
        <div className="p-2 border-t border-border space-y-0.5">
          <button
            onClick={toggleMoneyVisibility}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-all duration-150 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <Eye className="w-4 h-4 flex-shrink-0" /> : <EyeOff className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && (showMoney ? "Ocultar Valores" : "Mostrar Valores")}
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-all duration-150 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title="Alterar Senha"
          >
            <KeyRound className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Alterar Senha"}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-danger hover:bg-surface-hover transition-all duration-150 cursor-pointer ${
              collapsed ? "md:px-2 md:justify-center" : ""
            }`}
            title="Sair"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-primary-light rounded-lg p-6 w-full max-w-md border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-accent" />
                </div>
                <h3 className="text-base font-semibold text-white font-display">Alterar Senha</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-muted hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              {([
                { key: "current", label: "Senha Atual", placeholder: "Digite sua senha atual" },
                { key: "new", label: "Nova Senha", placeholder: "Mín. 6 caracteres" },
                { key: "confirm", label: "Confirmar Nova Senha", placeholder: "Confirme a nova senha" },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted mb-1 block uppercase tracking-wide">{label}</label>
                  <div className="relative">
                    <input
                      type={showPasswords[key] ? "text" : "password"}
                      value={passwordForm[key]}
                      onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                      placeholder={placeholder}
                      required
                      minLength={key !== "current" ? 6 : undefined}
                      className="w-full px-3 py-2.5 pr-10 bg-surface border border-border rounded text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, [key]: !showPasswords[key] })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
                    >
                      {showPasswords[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover text-primary font-semibold rounded text-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Alterando...</>
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
