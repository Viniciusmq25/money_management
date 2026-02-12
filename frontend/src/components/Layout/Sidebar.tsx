import { NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transações" },
  { to: "/investments", icon: TrendingUp, label: "Investimentos" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/import", icon: Upload, label: "Importar" },
  { to: "/reports", icon: BarChart3, label: "Relatórios" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { showMoney, toggleMoneyVisibility } = useMoneyVisibility();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleNavClick = () => {
    // Close mobile menu when navigating
    if (onClose) onClose();
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
          w-64 flex-col bg-primary-light border-r border-border
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Money</h1>
              <p className="text-xs text-muted">Management</p>
            </div>
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
                  isActive
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : "text-muted hover:text-white hover:bg-surface-hover"
                }`
              }
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={toggleMoneyVisibility}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-all duration-200 cursor-pointer"
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {showMoney ? "Ocultar Valores" : "Mostrar Valores"}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-danger hover:bg-surface-hover transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
