import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import api from "../api/client";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        username: username.trim().toLowerCase(),
        password,
      });
      localStorage.setItem("token", data.access_token);
      navigate("/");
    } catch {
      toast.error("Usuário ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4 shadow-lg shadow-accent/30">
            <DollarSign className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Money Management</h1>
          <p className="text-muted text-sm mt-1">Organize sua vida financeira</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-primary-light rounded-2xl p-6 border border-border shadow-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Usuário</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu usuário"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full pl-11 pr-3 py-3 bg-surface border border-border rounded-xl text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full pl-11 pr-11 py-3 bg-surface border border-border rounded-xl text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition cursor-pointer"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-200 cursor-pointer"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
