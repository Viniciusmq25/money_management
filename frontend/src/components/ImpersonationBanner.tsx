import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, LogOut, Loader2 } from "lucide-react";
import api from "../api/client";
import { adminApi } from "../api/admin";
import { isImpersonating } from "../utils/jwt";
import toast from "react-hot-toast";

type MeResponse = {
  user: { id: number; username: string; is_admin: boolean };
  real_user: { id: number; username: string; is_admin: boolean } | null;
  impersonating: boolean;
};

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isImpersonating()) return;
    api.get<MeResponse>("/auth/me").then((r) => setMe(r.data)).catch(() => {});
  }, []);

  if (!isImpersonating() || !me?.impersonating) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      const { access_token } = await adminApi.stopImpersonating();
      localStorage.setItem("token", access_token);
      toast.success("Voltou para sua conta");
      navigate("/admin");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao sair da personificação");
      setExiting(false);
    }
  };

  return (
    <div className="bg-accent/90 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm truncate">
          Visualizando como <strong>{me.user.username}</strong>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex-shrink-0"
      >
        {exiting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Sair
      </button>
    </div>
  );
}
