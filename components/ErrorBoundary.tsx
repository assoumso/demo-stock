import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full border border-red-200">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Une erreur est survenue</h1>
            <div className="bg-red-50 p-4 rounded border border-red-100 mb-6">
              <p className="font-mono text-sm text-red-800 break-words">
                {this.state.error?.toString()}
              </p>
            </div>
            {this.state.errorInfo && (
              <details className="mb-4">
                <summary className="cursor-pointer text-gray-600 font-medium mb-2">Détails techniques</summary>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-60 text-gray-700">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Recharger la page
            </button>
            <a
              href="/"
              className="ml-4 text-gray-600 hover:text-gray-800 underline"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
