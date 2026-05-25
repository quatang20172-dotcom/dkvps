import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket() {
    const [stats, setStats] = useState(null);
    const [connected, setConnected] = useState(false);
    const ws = useRef(null);
    const reconnectTimer = useRef(null);

    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws`;

        ws.current = new WebSocket(url);

        ws.current.onopen = () => {
            setConnected(true);
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'stats') {
                    setStats(message.data);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        ws.current.onclose = () => {
            setConnected(false);
            reconnectTimer.current = setTimeout(connect, 5000);
        };

        ws.current.onerror = () => {
            ws.current?.close();
        };
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            ws.current?.close();
        };
    }, [connect]);

    return { stats, connected };
}
