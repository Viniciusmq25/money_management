import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: "/money/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/money/login") {
        window.location.href = "/money/login";
      }
    } else if (error.response?.status === 500) {
      toast.error("Erro interno do servidor. Tente novamente.");
    } else if (!error.response) {
      toast.error("Sem conexão com o servidor.");
    }
    return Promise.reject(error);
  }
);

export default api;
