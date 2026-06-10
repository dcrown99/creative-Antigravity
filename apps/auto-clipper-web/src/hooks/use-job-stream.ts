import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

export function useJobStream(jobId: string | null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!jobId) return;

        const url = `${API_BASE_URL}/events/${jobId}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setData((prev: any) => ({ ...prev, ...parsedData }));
            } catch (e) {
                console.error('Failed to parse SSE data', e);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            // EventSourceは自動で再接続を試みるが、
            // 致命的なエラーの場合は閉じるなどの処理が必要
            // ここでは状態更新のみ
            setIsConnected(false);
        };

        return () => {
            eventSource.close();
            setIsConnected(false);
        };
    }, [jobId]);

    return { data, error, isConnected };
}
