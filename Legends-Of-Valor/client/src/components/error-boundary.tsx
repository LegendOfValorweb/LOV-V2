import { Component, ErrorInfo, ReactNode } from "react";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#0d0d1a",
            color: "#ff6666",
            fontFamily: "monospace",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }}>⚔️</div>
          <h2 style={{ margin: 0, color: "#ffaa44" }}>Something went wrong</h2>
          <p style={{ color: "#aaa", maxWidth: 480 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.5rem",
              background: "#1a1a3e",
              border: "1px solid #ffaa44",
              color: "#ffaa44",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            Reload game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
