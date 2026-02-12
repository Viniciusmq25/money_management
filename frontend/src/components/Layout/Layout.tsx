import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, DollarSign, Eye, EyeOff } from "lucide-react";
import Sidebar from "./Sidebar";
import { useMoneyVisibility } from "../../contexts/MoneyVisibilityContext";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showMoney, toggleMoneyVisibility } = useMoneyVisibility();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-primary-light border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold">Money</span>
          </div>
          <button
            onClick={toggleMoneyVisibility}
            className="p-2 text-muted hover:text-white hover:bg-surface-hover rounded-lg transition cursor-pointer"
            title={showMoney ? "Ocultar valores" : "Mostrar valores"}
          >
            {showMoney ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-primary p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
