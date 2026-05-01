import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Check, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import type { ImportPreview } from "../types";
import toast from "react-hot-toast";

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

export default function ImportPage() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const { showMoney } = useMoneyVisibility();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/x-ofx": [".ofx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    onDrop: async (files) => {
      if (!files.length) return;
      setLoading(true);
      setPreview(null);
      setDone(false);

      const formData = new FormData();
      formData.append("file", files[0]);

      try {
        const { data } = await api.post("/imports/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setPreview(data);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Erro ao processar arquivo");
      }
      setLoading(false);
    },
  });

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const { data } = await api.post("/imports/confirm", {
        filename: preview.filename,
        bank: preview.bank,
        transactions: preview.transactions,
      });
      toast.success(`${data.imported} transações importadas!`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions-count"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao importar");
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white font-display">Importar Extrato</h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-all duration-200 cursor-pointer ${
          isDragActive ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 bg-primary-light"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-white font-medium">
          {isDragActive
            ? "Solte o arquivo aqui..."
            : isTouchDevice
            ? "Toque para selecionar um arquivo"
            : "Arraste um arquivo OFX ou CSV aqui"}
        </p>
        {!isTouchDevice && (
          <p className="text-muted text-sm mt-1">ou clique para selecionar</p>
        )}
        <p className="text-muted/50 text-xs mt-3">Compatível com: Nubank, Itaú, Bradesco, Inter e outros bancos</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-muted">Processando arquivo...</span>
        </div>
      )}

      {/* Preview */}
      {preview && !done && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-primary-light rounded-lg p-5 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-semibold text-white">{preview.filename}</p>
                <p className="text-xs text-muted">
                  {preview.bank ? `${preview.bank} · ` : ""}
                  {preview.date_start && preview.date_end
                    ? `${formatDate(preview.date_start)} a ${formatDate(preview.date_end)}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface rounded p-3 text-center">
                <p className="text-xs text-muted">Total Transações</p>
                <p className="text-lg font-bold text-white">{preview.transactions.length}</p>
              </div>
              <div className="bg-surface rounded p-3 text-center">
                <p className="text-xs text-muted">Receitas</p>
                <p className="text-lg font-bold text-success">{formatCurrency(preview.total_income, showMoney)}</p>
              </div>
              <div className="bg-surface rounded p-3 text-center">
                <p className="text-xs text-muted">Despesas</p>
                <p className="text-lg font-bold text-danger">{formatCurrency(preview.total_expense, showMoney)}</p>
              </div>
              <div className="bg-surface rounded p-3 text-center">
                <p className="text-xs text-muted">Duplicatas</p>
                <p className={`text-lg font-bold ${preview.duplicates_count > 0 ? "text-warning" : "text-success"}`}>
                  {preview.duplicates_count}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction list */}
          <div className="bg-primary-light rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-primary-light">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Categoria</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.map((txn, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${txn.is_duplicate ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        {txn.is_duplicate ? (
                          <span className="flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="w-3.5 h-3.5" /> Duplicata
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <Check className="w-3.5 h-3.5" /> Nova
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">{formatDate(txn.date)}</td>
                      <td className="px-4 py-2.5 text-sm text-white">{txn.description}</td>
                      <td className="px-4 py-2.5">
                        {txn.suggested_category ? (
                          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">{txn.suggested_category}</span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-sm font-medium flex items-center justify-end gap-1 ${txn.type === "INCOME" ? "text-success" : "text-danger"}`}>
                          {txn.type === "INCOME" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {formatCurrency(txn.amount, showMoney)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setPreview(null); setDone(false); }}
              className="px-5 py-2.5 bg-surface hover:bg-surface-hover text-white text-sm font-medium rounded transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={importing || preview.transactions.filter((t) => !t.is_duplicate).length === 0}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary text-sm font-semibold rounded transition cursor-pointer flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${preview.transactions.filter((t) => !t.is_duplicate).length} transações`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Importação concluída!</h3>
          <p className="text-muted text-sm">Suas transações foram adicionadas com sucesso.</p>
          <button
            onClick={() => { setPreview(null); setDone(false); }}
            className="mt-4 px-5 py-2.5 bg-accent hover:bg-accent-hover text-primary text-sm font-semibold rounded transition cursor-pointer"
          >
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
}
