import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { MoneyVisibilityProvider } from "./contexts/MoneyVisibilityContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/money">
        <MoneyVisibilityProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#2A2D4A",
                color: "#F1F5F9",
                border: "1px solid #3B3F5C",
              },
            }}
          />
        </MoneyVisibilityProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
