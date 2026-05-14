import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, TrendingUp, Menu, Plus } from "lucide-react";

interface BottomNavProps {
  onMenuOpen: () => void;
  onAddTransaction: () => void;
}

const leftNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/investments", icon: TrendingUp, label: "Investimentos", end: false },
];

const rightNav = [
  { to: "/reports", icon: BarChart3, label: "Relatórios", end: false },
];

export default function BottomNav({ onMenuOpen, onAddTransaction }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-primary-light border-t border-border overflow-visible">
      <div className="flex items-center h-16 px-1 relative">
        {leftNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-all ${
                isActive ? "text-accent" : "text-muted hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-accent/15" : ""}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Center elevated action button */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={onAddTransaction}
            className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-primary flex items-center justify-center shadow-lg shadow-accent/30 transition cursor-pointer"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>

        {rightNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-all ${
                isActive ? "text-accent" : "text-muted hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-accent/15" : ""}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-1 flex-1 py-2 rounded-xl text-muted hover:text-white transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-xl">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}
