import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      let isFirestoreError = false;
      
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed && parsed.error && parsed.operationType) {
          isFirestoreError = true;
          errorMessage = `Firestore Permission Denied during ${parsed.operationType} on path: ${parsed.path}. Error: ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON error string
      }

      return (
        <div className="p-6 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4 font-mono text-sm break-words">
            {errorMessage}
          </p>
          {isFirestoreError && (
            <p className="text-sm text-red-500 mt-2">
              This is likely a Firebase Security Rules issue. Please check your firestore.rules.
            </p>
          )}
          <button
            className="mt-4 px-4 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-md transition-colors text-sm font-medium"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

