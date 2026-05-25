import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const ServerContext = createContext(null);

export function useServer() {
    return useContext(ServerContext);
}

/**
 * Create an API client for a specific VPS agent
 */
function createApiClient(serverUrl, token) {
    const client = axios.create({
        baseURL: `${serverUrl}/api`,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        timeout: 30000
    });
    return client;
}

export function ServerProvider({ children }) {
    // Load saved servers from localStorage
    const [servers, setServers] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('myvps_servers') || '[]');
        } catch { return []; }
    });

    const [activeServerId, setActiveServerId] = useState(() => {
        return localStorage.getItem('myvps_active_server') || null;
    });

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('myvps_servers', JSON.stringify(servers));
    }, [servers]);

    useEffect(() => {
        if (activeServerId) localStorage.setItem('myvps_active_server', activeServerId);
    }, [activeServerId]);

    // Active server
    const activeServer = servers.find(s => s.id === activeServerId) || servers[0] || null;

    // Get API client for active server
    const api = activeServer ? createApiClient(activeServer.url, activeServer.token) : null;

    // Get WebSocket URL for active server
    const wsUrl = activeServer ? `${activeServer.url.replace('http', 'ws')}/ws?token=${activeServer.token}` : null;

    // Add server
    const addServer = async (name, url, apiKey) => {
        // Authenticate with agent
        const res = await axios.post(`${url}/api/auth/login`, { api_key: apiKey });
        const token = res.data.token;

        const id = Date.now().toString();
        const server = { id, name, url, token, apiKey, addedAt: new Date().toISOString() };
        setServers(prev => [...prev, server]);
        if (!activeServerId) setActiveServerId(id);
        return server;
    };

    // Remove server
    const removeServer = (id) => {
        setServers(prev => prev.filter(s => s.id !== id));
        if (activeServerId === id) {
            setActiveServerId(servers[0]?.id || null);
        }
    };

    // Update server token
    const refreshToken = async (id) => {
        const server = servers.find(s => s.id === id);
        if (!server) return;
        try {
            const res = await axios.post(`${server.url}/api/auth/login`, { api_key: server.apiKey });
            const updated = { ...server, token: res.data.token };
            setServers(prev => prev.map(s => s.id === id ? updated : s));
        } catch (e) {
            console.error('Token refresh failed:', e);
        }
    };

    return (
        <ServerContext.Provider value={{
            servers,
            activeServer,
            activeServerId,
            setActiveServerId,
            addServer,
            removeServer,
            refreshToken,
            api,
            wsUrl
        }}>
            {children}
        </ServerContext.Provider>
    );
}
