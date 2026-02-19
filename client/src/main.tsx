import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { SSEProvider } from './context/SSEContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 min-h-screen bg-base text-primary">
          <h1 className="mb-5 text-2xl font-bold text-cba-gold">Something went wrong</h1>
          <pre className="p-5 overflow-auto text-red-500 rounded-lg bg-elevated">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-6 py-3 mt-5 font-bold text-base bg-cba-gold rounded-lg cursor-pointer border-none"
          >
            Clear Storage & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SSEProvider>
          <App />
        </SSEProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
