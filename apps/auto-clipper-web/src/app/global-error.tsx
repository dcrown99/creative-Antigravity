'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-white text-black p-4">
                    <h2 className="text-2xl font-bold">Critical Error</h2>
                    <p className="text-gray-600 max-w-md text-center">
                        {error.message || 'A critical error occurred in the root layout.'}
                    </p>
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => reset()}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
