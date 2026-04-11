import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, BarChart3, TrendingUp, Menu } from "lucide-react";

interface BottomNavProps {
  onMenuOpen: () => void;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transações", end: false },
  { to: "/investments", icon: TrendingUp, label: "Investimentos", end: false },
  { to: "/reports", icon: BarChart3, label: "Relatórios", end: false },
];

export default function BottomNav({ onMenuOpen }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-primary-light border-t border-border">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => (
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
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? "bg-accent/15" : ""
                  }`}
                >
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
