import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while loading your request. Please try refreshing the page.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.operationType) {
          friendly = `Unable to complete database ${parsed.operationType} action. Please ensure you are signed in with a verified account or contact store support.`;
        }
      } catch {
        if (this.state.message) {
          friendly = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#F8F1E4] flex items-center justify-center p-6 font-poppins">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#D4AF62]/40 shadow-xl p-8 text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-[#D4AF62]/40 flex items-center justify-center text-[#65102F]">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="font-cinzel text-xl font-bold text-[#120D0B]">SDA Collections Notice</h2>
              <p className="text-xs text-gray-600 leading-relaxed">{friendly}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#120D0B] text-[#F8F1E4] rounded-xl text-xs font-semibold hover:bg-[#D4AF62] hover:text-[#120D0B] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
