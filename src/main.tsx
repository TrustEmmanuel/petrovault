import React, { type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreProvider } from "./state/store";
import "./index.css";

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="mx-auto max-w-lg px-6 py-16 text-sm text-zinc-800">
          <p className="font-semibold text-zinc-950">PetroVault could not render this view.</p>
          <p className="mt-2 text-xs leading-5 text-zinc-600">{this.state.message}</p>
          <button
            type="button"
            className="mt-4 h-8 bg-zinc-900 px-3 text-xs font-medium text-white"
            onClick={() => this.setState({ message: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
