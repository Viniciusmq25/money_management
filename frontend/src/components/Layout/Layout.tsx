import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Eye, EyeOff, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import ImpersonationBanner from "../ImpersonationBanner";
import AddTransactionModal from "../transactions/AddTransactionModal";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const { showMoney, toggleMoneyVisibility } = useMoneyVisibility();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />

        {/* Desktop header */}
        <header className="hidden md:flex items-center justify-between px-5 py-3 bg-primary-light border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 text-muted hover:text-white hover:bg-surface-hover rounded transition cursor-pointer"
              title={sidebarCollapsed ? "Expandir" : "Retrair"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <span className="text-sm font-semibold text-white font-display">Money Management</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMoneyVisibility}
              className="p-1.5 text-muted hover:text-white hover:bg-surface-hover rounded transition cursor-pointer"
              title={showMoney ? "Ocultar valores" : "Mostrar valores"}
            >
              {showMoney ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-primary text-xs font-semibold rounded transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nova transação
            </button>
          </div>
        </header>

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-end px-4 py-3 bg-primary-light border-b border-border">
          <button
            onClick={toggleMoneyVisibility}
            className="p-1.5 text-muted hover:text-white hover:bg-surface-hover rounded transition cursor-pointer"
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-primary p-4 md:p-5 lg:p-6 pb-20 md:pb-5 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav onMenuOpen={() => setSidebarOpen(true)} onAddTransaction={() => setShowAddModal(true)} />

      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
