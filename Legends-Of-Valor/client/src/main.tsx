import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "lov_token";

if (API_BASE) {
  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (typeof url === "string" && url.startsWith("/api/")) {
      const fullUrl = `${API_BASE}${url}`;
      const token = localStorage.getItem(TOKEN_KEY);
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const patchedInit: RequestInit = {
        credentials: "include",
        ...init,
        headers: {
          ...authHeader,
          ...(init?.headers as Record<string, string> | undefined),
        },
      };

      if (typeof input === "string") {
        return _fetch(fullUrl, patchedInit);
      }
      return _fetch(new Request(fullUrl, patchedInit));
    }

    return _fetch(input, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
