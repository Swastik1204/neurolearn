import { Component } from "react";
import logger from "../debug/logger.js";

const log = logger.create("ErrorBoundary");

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    log.error("Uncaught render error", error?.message, errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-6">
        <div className="card w-full max-w-lg bg-base-100 shadow-xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-error text-2xl mb-2">
              Something went wrong
            </h2>
            <p className="text-base-content/70 mb-4">
              An unexpected error occurred. You can try again or refresh the
              page.
            </p>

            {isDev && this.state.error && (
              <div className="w-full mb-4">
                <div className="collapse collapse-arrow bg-error/10 rounded-lg">
                  <input type="checkbox" defaultChecked />
                  <div className="collapse-title font-mono text-sm text-error font-semibold">
                    {this.state.error.toString()}
                  </div>
                  <div className="collapse-content">
                    <pre className="text-xs overflow-auto max-h-60 whitespace-pre-wrap text-left text-base-content/80">
                      {this.state.errorInfo?.componentStack ||
                        this.state.error.stack}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="card-actions">
              <button className="btn btn-primary" onClick={this.handleRetry}>
                Try Again
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
