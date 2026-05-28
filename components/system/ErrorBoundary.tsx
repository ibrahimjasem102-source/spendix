"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  feature?: string;
  variant?: "feature" | "page";
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const tag = this.props.feature ? ` [${this.props.feature}]` : "";
    console.error(`[Spendix${tag}]`, error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { variant = "feature", feature } = this.props;

    if (variant === "page") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-400/10 border border-rose-400/20">
            <AlertTriangle className="h-7 w-7 text-rose-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-[hsl(var(--text-1))]">
              {feature ? `${feature} failed to load` : "Something went wrong"}
            </p>
            <p className="mt-1 text-sm text-[hsl(var(--text-2))]">
              An unexpected error occurred. Try refreshing the page.
            </p>
          </div>
          <button
            onClick={() => { this.reset(); window.location.reload(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-400/10 border border-rose-400/20 text-sm font-medium text-rose-300 hover:bg-rose-400/15 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh page
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/10">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[hsl(var(--text-1))]">
              {feature ? `${feature} unavailable` : "Section unavailable"}
            </p>
            <p className="mt-0.5 text-xs text-[hsl(var(--text-2))]">
              This section encountered an error.
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}

export function FeatureErrorBoundary({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  return (
    <ErrorBoundary variant="feature" feature={feature}>
      {children}
    </ErrorBoundary>
  );
}

export function PageErrorBoundary({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  return (
    <ErrorBoundary variant="page" feature={feature}>
      {children}
    </ErrorBoundary>
  );
}
