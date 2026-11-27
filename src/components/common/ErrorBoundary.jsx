import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.resetError)
          : this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="rounded-[20px] bg-[#FFF0F2] border border-[#FECDD6] p-6 m-4 text-[#D13B56] font-display shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[#E11D48] mt-0.5" />
            <div className="space-y-2 flex-1">
              <h3 className="text-[15px] font-bold text-[#881337]">
                {this.props.title || 'A UI component encountered an unexpected error'}
              </h3>
              <p className="text-[13px] text-[#9F1239]">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
              <button
                type="button"
                onClick={this.resetError}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#FECDD6] text-[12px] font-semibold text-[#881337] hover:bg-[#FFE4E6] transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Component
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
