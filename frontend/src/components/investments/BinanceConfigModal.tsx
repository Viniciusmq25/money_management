import { useState } from "react";
import { X, Bitcoin, Key, Eye, EyeOff, Link2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { api_key: string; api_secret: string }) => void;
  isPending: boolean;
}

export default function BinanceConfigModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: Props) {
  const [form, setForm] = useState({ api_key: "", api_secret: "" });
  const [showSecret, setShowSecret] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ api_key: "", api_secret: "" });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-primary-light rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
              <Bitcoin className="w-5 h-5 text-warning" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Conectar Binance
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-muted text-sm mb-4">
          Para importar seus investimentos automaticamente, crie uma API Key na
          Binance com permissão <strong>apenas de leitura</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={form.api_key}
                onChange={(e) =>
                  setForm({ ...form, api_key: e.target.value })
                }
                placeholder="Cole sua API Key aqui"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-warning"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">
              API Secret
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type={showSecret ? "text" : "password"}
                value={form.api_secret}
                onChange={(e) =>
                  setForm({ ...form, api_secret: e.target.value })
                }
                placeholder="Cole seu API Secret aqui"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-warning"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white cursor-pointer"
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
            <p className="text-xs text-warning">
              ⚠️ <strong>Importante:</strong> Use apenas permissões de leitura.
              Nunca habilite saques ou trading na API Key usada aqui.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-warning hover:bg-warning/90 text-black font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Conectar e Testar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
