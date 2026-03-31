
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VixReel Uncaught Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-8 animate-vix-in">
            <div className="w-24 h-24 mx-auto rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-white">
                Something Spoiled
              </h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em] leading-relaxed">
                We encountered an unexpected error. Don't worry, we're keeping the reel spinning.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-left overflow-hidden">
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-2 tracking-widest">Error Details</p>
                <p className="text-[11px] font-mono text-red-400/80 break-words leading-relaxed">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReset}
                className="w-full py-5 vix-gradient rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Application
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-zinc-900 border border-zinc-800 rounded-[2rem] text-zinc-400 font-black uppercase tracking-widest text-[11px] hover:text-white transition-all flex items-center justify-center gap-3"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
