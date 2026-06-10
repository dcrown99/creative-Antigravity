import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * **ErrorBoundary Component**
 * 
 * A reusable React Error Boundary component for catching and handling errors in the component tree.
 * 
 * @example
 * ```tsx
 * import { ErrorBoundary } from '@repo/ui';
 * 
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 * 
 * @example With custom fallback function
 * ```tsx
 * <ErrorBoundary 
 *   fallback={(error, errorInfo) => (
 *     <div>
 *       <h1>Error: {error.message}</h1>
 *       <details>{errorInfo.componentStack}</details>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => {
 *     // Log to error reporting service
 *     console.error('Error caught:', error, errorInfo);
 *   }}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }

        // Call optional onError callback
        this.props.onError?.(error, errorInfo);

        // Update state with error info
        this.setState({ errorInfo });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            const { fallback } = this.props;
            const { error, errorInfo } = this.state;

            // If fallback is a function, call it with error details
            if (typeof fallback === 'function' && error && errorInfo) {
                return fallback(error, errorInfo);
            }

            // If fallback is provided as ReactNode, render it
            if (fallback) {
                return fallback;
            }

            // Default fallback UI
            return (
                <div
                    style={{
                        padding: '2rem',
                        margin: '2rem',
                        border: '1px solid #ef4444',
                        borderRadius: '0.5rem',
                        backgroundColor: '#fef2f2',
                    }}
                >
                    <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>
                        Something went wrong
                    </h2>
                    {process.env.NODE_ENV === 'development' && error && (
                        <>
                            <details style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                                    Error details
                                </summary>
                                <p style={{ color: '#991b1b' }}>
                                    <strong>Error:</strong> {error.toString()}
                                </p>
                                {errorInfo && (
                                    <p style={{ color: '#991b1b' }}>
                                        <strong>Component Stack:</strong>
                                        {errorInfo.componentStack}
                                    </p>
                                )}
                            </details>
                        </>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
