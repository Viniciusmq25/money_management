import { useState, useRef, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  subMonths,
  addMonths,
  subDays,
  isWithinInterval,
  isToday,
  isAfter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DateRange {
  start: Date;
  end: Date;
  label: string;
  months: number;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

const DAY_PRESETS = [
  { label: "Semana atual", months: 1 },
  { label: "Mês atual", months: 1 },
  { label: "Últimos 7 dias", months: 1 },
  { label: "Últimos 14 dias", months: 1 },
  { label: "Últimos 30 dias", months: 1 },
];

const MONTH_PRESETS = [
  { label: "Últimos 3 meses", months: 3 },
  { label: "Últimos 6 meses", months: 6 },
  { label: "Último ano", months: 12 },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => subMonths(new Date(), 1));
  const [selecting, setSelecting] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelecting(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const today = new Date();

  function handlePreset(preset: { label: string; months: number }) {
    const end = today;
    let start: Date;
    switch (preset.label) {
      case "Semana atual":
        start = startOfWeek(today, { weekStartsOn: 0 });
        break;
      case "Mês atual":
        start = startOfMonth(today);
        break;
      case "Últimos 7 dias":
        start = subDays(today, 7);
        break;
      case "Últimos 14 dias":
        start = subDays(today, 14);
        break;
      case "Últimos 30 dias":
        start = subDays(today, 30);
        break;
      default:
        start = subMonths(today, preset.months);
    }
    onChange({ start, end, label: preset.label, months: preset.months });
    setSelecting(null);
    setIsOpen(false);
  }

  function handleDayClick(day: Date) {
    if (!selecting) {
      setSelecting(day);
    } else {
      const start = day < selecting ? day : selecting;
      const end = day < selecting ? selecting : day;
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const months = Math.max(1, Math.ceil(diffDays / 30));
      const label = `${format(start, "dd MMM", { locale: ptBR })} - ${format(end, "dd MMM", { locale: ptBR })}`;
      onChange({ start, end, label: capitalize(label), months: Math.min(months, 12) });
      setSelecting(null);
      setIsOpen(false);
    }
  }

  function renderMonth(monthDate: Date) {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    return (
      <div className="flex-1 min-w-[210px]">
        <div className="text-center text-sm font-semibold text-white mb-3">
          {capitalize(format(monthDate, "MMMM yyyy", { locale: ptBR }))}
        </div>
        <div className="grid grid-cols-7 gap-0 text-center text-xs text-muted mb-1">
          {["Do", "Se", "Te", "Qu", "Qu", "Se", "Sá"].map((d, i) => (
            <div key={i} className="py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0">
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, monthDate);
            const isStart = selecting ? isSameDay(day, selecting) : isSameDay(day, value.start);
            const isEnd = !selecting && isSameDay(day, value.end);
            const selected = isStart || isEnd;
            const inRange =
              !selecting &&
              value.start &&
              value.end &&
              !isSameDay(value.start, value.end) &&
              isWithinInterval(day, { start: value.start, end: value.end });
            const isTodayDay = isToday(day);
            const isFuture = isAfter(day, today);

            return (
              <button
                key={i}
                onClick={() => inMonth && !isFuture && handleDayClick(day)}
                disabled={!inMonth || isFuture}
                className={[
                  "w-8 h-8 mx-auto rounded-full text-xs flex items-center justify-center transition-colors",
                  !inMonth
                    ? "text-muted/20 cursor-default"
                    : isFuture
                    ? "text-muted/40 cursor-default"
                    : "text-white/80 hover:bg-primary-lighter cursor-pointer",
                  selected ? "!bg-accent !text-white font-bold" : "",
                  inRange && !selected ? "bg-accent/15" : "",
                  isTodayDay && !selected ? "ring-1 ring-muted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-primary-light border border-border rounded-xl text-sm text-white hover:border-accent transition cursor-pointer"
      >
        <Calendar size={16} className="text-muted" />
        <span>{value.label}</span>
        <ChevronRight
          size={14}
          className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-surface border border-border rounded-2xl shadow-2xl z-50 flex overflow-hidden">
          {/* Presets sidebar */}
          <div className="border-r border-border py-3 px-2 min-w-[160px]">
            {DAY_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => handlePreset(preset)}
                className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition cursor-pointer ${
                  value.label === preset.label
                    ? "bg-accent/20 text-accent font-medium"
                    : "text-muted hover:text-white hover:bg-primary-lighter"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <div className="border-t border-border my-2 mx-2" />
            {MONTH_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => handlePreset(preset)}
                className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition cursor-pointer ${
                  value.label === preset.label
                    ? "bg-accent/20 text-accent font-medium"
                    : "text-muted hover:text-white hover:bg-primary-lighter"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="p-1.5 hover:bg-primary-lighter rounded-lg transition cursor-pointer"
              >
                <ChevronLeft size={16} className="text-muted" />
              </button>
              <button
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="p-1.5 hover:bg-primary-lighter rounded-lg transition cursor-pointer"
              >
                <ChevronRight size={16} className="text-muted" />
              </button>
            </div>
            <div className="flex gap-6">
              {renderMonth(viewMonth)}
              {renderMonth(addMonths(viewMonth, 1))}
            </div>
            {selecting && (
              <p className="text-xs text-accent mt-3 text-center">
                Selecione a data final
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type { DateRange };
