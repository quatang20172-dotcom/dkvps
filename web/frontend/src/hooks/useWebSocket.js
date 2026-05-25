import { useState, useEffect, useRef, useCallback } from 'react';
import { useServer } from '../contexts/ServerContext';

export function useWebSocket() {
    const { wsUrl } = useServer();
    const [stats, setStats] = useState(null);
    const [connected, setConnected] = useState(false);
    const ws = useRef(null);
    const reconnectTimer = useRef(null);

    const connect = useCallback(() => {
        if (!wsUrl) return;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => setConnected(true);

        ws.current.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'stats') setStats(msg.data);
            } catch { /* ignore */ }
        };

        ws.current.onclose = () => {
            setConnected(false);
            reconnectTimer.current = setTimeout(connect, 5000);
        };

        ws.current.onerror = () => ws.current?.close();
    }, [wsUrl]);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            ws.current?.close();
        };
    }, [connect]);

    return { stats, connected };
}
