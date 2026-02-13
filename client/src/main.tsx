import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { SSEProvider } from './context/SSEContext.tsx';

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
        <div className="p-10 min-h-screen bg-[#0a0a0f] text-white">
          <h1 className="mb-5 text-2xl font-bold text-[#FFCC00]">Something went wrong</h1>
          <pre className="p-5 overflow-auto text-red-500 rounded-lg bg-[#1a1a24]">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-6 py-3 mt-5 font-bold text-[#0a0a0f] bg-[#FFCC00] rounded-lg cursor-pointer border-none"
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
      <SSEProvider>
        <App />
      </SSEProvider>
    </ErrorBoundary>
  </StrictMode>,
);
