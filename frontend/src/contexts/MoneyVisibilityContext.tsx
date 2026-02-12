import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface MoneyVisibilityContextType {
  showMoney: boolean;
  toggleMoneyVisibility: () => void;
}

const MoneyVisibilityContext = createContext<MoneyVisibilityContextType | undefined>(undefined);

const STORAGE_KEY = "money_visibility";

export function MoneyVisibilityProvider({ children }: { children: ReactNode }) {
  const [showMoney, setShowMoney] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== "false"; // Default to true
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showMoney));
  }, [showMoney]);

  const toggleMoneyVisibility = () => setShowMoney((prev) => !prev);

  return (
    <MoneyVisibilityContext.Provider value={{ showMoney, toggleMoneyVisibility }}>
      {children}
    </MoneyVisibilityContext.Provider>
  );
}

export function useMoneyVisibility() {
  const context = useContext(MoneyVisibilityContext);
  if (context === undefined) {
    throw new Error("useMoneyVisibility must be used within a MoneyVisibilityProvider");
  }
  return context;
}
