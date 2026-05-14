import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart3, TrendingUp, Menu, Plus } from "lucide-react";

interface BottomNavProps {
  onMenuOpen: () => void;
  onAddTransaction: () => void;
}

export default function BottomNav({ onMenuOpen, onAddTransaction }: BottomNavProps) {
  const linkClass = (isActive: boolean) =>
    `flex-1 flex justify-center items-center py-3 transition-all ${
      isActive ? "text-accent" : "text-muted hover:text-white"
    }`;

  const iconWrap = (isActive: boolean) =>
    `p-2 rounded-lg ${isActive ? "bg-accent/15" : ""}`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-primary-light border-t border-border">
      {/* Floating center button — positioned relative to the fixed nav */}
      <button
        onClick={onAddTransaction}
        className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-primary flex items-center justify-center shadow-lg shadow-accent/30 transition cursor-pointer z-10"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div className="flex items-center h-14 px-2">
        <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
          {({ isActive }) => (
            <div className={iconWrap(isActive)}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
          )}
        </NavLink>

        <NavLink to="/investments" className={({ isActive }) => linkClass(isActive)}>
          {({ isActive }) => (
            <div className={iconWrap(isActive)}>
              <TrendingUp className="w-5 h-5" />
            </div>
          )}
        </NavLink>

        {/* Spacer reserved for the floating center button */}
        <div className="flex-1" />

        <NavLink to="/reports" className={({ isActive }) => linkClass(isActive)}>
          {({ isActive }) => (
            <div className={iconWrap(isActive)}>
              <BarChart3 className="w-5 h-5" />
            </div>
          )}
        </NavLink>

        <button
          onClick={onMenuOpen}
          className="flex-1 flex justify-center items-center py-3 text-muted hover:text-white transition cursor-pointer"
        >
          <div className="p-2 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
        </button>
      </div>
    </nav>
  );
}
