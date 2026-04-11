import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { showMoney, toggleMoneyVisibility } = useMoneyVisibility();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop header — visible only on md+ */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 bg-primary-light border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
              title={sidebarCollapsed ? "Expandir" : "Retrair"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <h1 className="text-lg font-semibold text-white">Money Management</h1>
          </div>
          <button
            onClick={toggleMoneyVisibility}
            className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile header — eye icon only, right-aligned */}
        <header className="md:hidden flex items-center justify-end px-4 py-3 bg-primary-light border-b border-border">
          <button
            onClick={toggleMoneyVisibility}
            className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-primary p-4 md:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMenuOpen={() => setSidebarOpen(true)} />
    </div>
  );
}
