export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Registering workers...');
        try {
            // Import worker module and register workers
            const { registerWorkers } = await import('./lib/workers/feed-fetcher');
            registerWorkers();

            console.log('[Instrumentation] Workers registered successfully');
        } catch (error) {
            console.error('[Instrumentation] Failed to register workers:', error);
        }
    }
}
