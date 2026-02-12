export function formatCurrency(value: number, visible: boolean = true): string {
  if (!visible) {
    return "R$ •••••";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number, visible: boolean = true): string {
  if (!visible) {
    return "•••%";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
